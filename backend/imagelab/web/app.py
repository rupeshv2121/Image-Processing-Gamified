"""FastAPI application: HTTP routes, start-up and shutdown.

    GET  /api/status                 is MATLAB ready? (polled by the UI while it starts)
    POST /api/run     {op, params}   every UI operation (rpc/dispatcher.py)
    POST /api/cancel                 interrupt the running MATLAB computation
    POST /api/upload  {name, data}   base64 image -> MATLAB imread -> image id
    GET  /api/image/<id>.png         result images written by MATLAB
    GET  /api/download/<id>.png      the same as a download
    GET  /reports/<file>             reports and exports
    GET  /*                          the built React UI (single-page app)

Classroom network mode: other devices may only sign in and play the live
quiz (rpc/access.py: remote_allowed) - Code Lab runs MATLAB code and the
labs write files, so they stay on this computer.
"""

from __future__ import annotations

import base64
import binascii
import json
import logging
import math
import mimetypes
import re
import threading
import time
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, Response
from starlette.concurrency import run_in_threadpool

from ..config import Settings
from ..container import Services
from ..errors import AppError
from ..matlab import MatlabEngine, MatlabGateway
from ..rpc.access import remote_allowed
from ..rpc.cache import ResultCache
from ..rpc.dispatcher import Dispatcher
from ..rpc.handlers import build_registry
from ..storage.database import Database
from ..storage.legacy import LegacyImporter
from .network import is_remote, lan_addresses

log = logging.getLogger("imagelab")

# Windows sometimes maps .js to text/plain in the registry, which breaks module scripts
for _ext, _type in ((".js", "text/javascript"), (".mjs", "text/javascript"), (".css", "text/css"),
                    (".svg", "image/svg+xml"), (".webmanifest", "application/manifest+json"),
                    (".pdf", "application/pdf"), (".csv", "text/csv"),
                    (".xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")):
    mimetypes.add_type(_type, _ext)

IMAGE_FILE = re.compile(r"^([A-Za-z0-9_\-]+)\.png$")
REPORT_FILE = re.compile(r"^[A-Za-z0-9_\-.]+$")
UPLOAD_TYPES = {".png", ".jpg", ".jpeg", ".tif", ".tiff", ".bmp", ".gif"}
REMOTE_MESSAGE = ("On this device you can join the live quiz. Everything else "
                  "(labs, Code Lab, teacher sign-in) works on the ImageLab computer.")
NO_STORE = {"Cache-Control": "no-store"}


# ----------------------------------------------------------------- JSON
def _finite(value: Any) -> Any:
    """NaN / Inf -> null, as MATLAB's jsonencode(..., 'ConvertInfAndNaN', true) did."""
    if isinstance(value, float):
        return value if math.isfinite(value) else None
    if isinstance(value, dict):
        return {k: _finite(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_finite(v) for v in value]
    return value


class EnvelopeResponse(JSONResponse):
    def render(self, content: Any) -> bytes:
        try:
            text = json.dumps(content, ensure_ascii=False, allow_nan=False, separators=(",", ":"))
        except ValueError:                             # rare: a non-finite number somewhere
            text = json.dumps(_finite(content), ensure_ascii=False, allow_nan=False, separators=(",", ":"))
        return text.encode("utf-8")


def envelope(payload: dict, status: int = 200) -> EnvelopeResponse:
    return EnvelopeResponse(payload, status_code=status, headers=NO_STORE)


def failure(message: str, status: int = 200, **extra: Any) -> EnvelopeResponse:
    return envelope({"ok": False, "error": message, **extra}, status)


# ----------------------------------------------------------------- runtime clean-up
def cleanup_runtime(settings: Settings) -> int:
    """Delete result images older than keep_hours and stale temporary uploads."""
    now, removed = time.time(), 0
    for folder, max_age in ((settings.image_dir, settings.keep_hours * 3600), (settings.upload_dir, 3600)):
        if not folder.is_dir():
            continue
        for entry in folder.iterdir():
            try:
                if entry.is_file() and now - entry.stat().st_mtime > max_age:
                    entry.unlink()
                    removed += 1
            except OSError:
                pass                                   # file in use - next time
    return removed


def _cleanup_loop(settings: Settings, stop: threading.Event) -> None:
    while True:
        n = cleanup_runtime(settings)
        if n:
            log.info("Removed %d result image(s) older than %g h from runtime/", n, settings.keep_hours)
        if stop.wait(3600):
            return


# ----------------------------------------------------------------- application
def create_app(settings: Settings, matlab: MatlabGateway | None = None) -> FastAPI:
    """matlab: a ready gateway (tests); None = start the real MATLAB engine on start-up."""
    for folder in (settings.image_dir, settings.upload_dir, settings.data_dir):
        folder.mkdir(parents=True, exist_ok=True)
    engine = matlab if matlab is not None else MatlabEngine(settings.root, settings.image_dir, settings.shared_session)
    db = Database(settings.database_file)
    services = Services(settings, engine, db)
    data_ready = threading.Event()
    dispatcher = Dispatcher(services, build_registry(), ResultCache(settings.image_dir, settings.result_cache_size),
                            data_ready)
    importer = LegacyImporter(services.repos, engine, settings.data_dir, settings.legacy_leaderboard)
    lan_urls = [f"http://{ip}:{settings.port}" for ip in lan_addresses()] if settings.lan else []
    stop = threading.Event()

    def start_up() -> None:
        if not importer.needs_matlab:                  # usual case: nothing (left) to import
            _import()
        if isinstance(engine, MatlabEngine):
            engine.start()
        if not data_ready.is_set():
            _import()

    def _import() -> None:
        try:
            importer.run()
        except Exception:  # noqa: BLE001 - the app keeps working; the import is retried next start
            log.exception("Could not import the old MATLAB data files")
        finally:
            data_ready.set()

    @asynccontextmanager
    async def lifespan(_app: FastAPI):
        # MATLAB start-up and the one-time data import run in the background;
        # requests wait for the import only (rpc/dispatcher.py), never for MATLAB itself
        threading.Thread(target=start_up, name="imagelab-startup", daemon=True).start()
        if settings.keep_hours > 0:
            threading.Thread(target=_cleanup_loop, args=(settings, stop), name="imagelab-cleanup", daemon=True).start()
        yield
        stop.set()
        if isinstance(engine, MatlabEngine):
            engine.stop()
        db.close()

    app = FastAPI(title="ImageLab", version="2.0", lifespan=lifespan, docs_url=None, redoc_url=None,
                  openapi_url=None)
    app.state.services = services
    app.state.dispatcher = dispatcher

    def remote(request: Request) -> bool:
        return is_remote(request.client.host if request.client else None)

    async def read_json(request: Request, limit: int) -> dict:
        size = int(request.headers.get("content-length") or 0)
        if size > limit:
            raise AppError("Request too large (max 25 MB image).")
        body = await request.body()
        try:
            data = json.loads(body or b"{}")
        except ValueError as exc:
            raise AppError(f"Bad request: {exc}") from exc
        if not isinstance(data, dict):
            raise AppError("Bad request: expected a JSON object.")
        return data

    # ------------------------------------------------------------ API
    @app.get("/api/status")
    def status(request: Request):
        ready = getattr(engine, "ready", None)
        return envelope({"ready": ready.is_set() if ready else True, "matlab": bool(getattr(engine, "running", True)),
                         "error": getattr(engine, "error", None), "remote": remote(request), "lan": lan_urls})

    @app.post("/api/run")
    async def run(request: Request):
        try:
            body = await read_json(request, settings.max_upload_bytes * 2)
        except AppError as exc:
            return failure(exc.message, 400)
        op, params = body.get("op"), body.get("params") or {}
        if remote(request) and not remote_allowed(op, params if isinstance(params, dict) else {}):
            return failure(REMOTE_MESSAGE, 403, errorId="ImageLab:remote")
        if not isinstance(op, str):
            return failure("Missing 'op'.", 400)
        return envelope(await run_in_threadpool(dispatcher.run, op, params))

    @app.post("/api/cancel")
    def cancel(request: Request):
        if remote(request):
            return failure(REMOTE_MESSAGE, 403, errorId="ImageLab:remote")
        try:
            return envelope({"ok": True, "data": engine.cancel()})
        except AppError as exc:
            return failure(exc.message)

    @app.post("/api/upload")
    async def upload(request: Request):
        if remote(request):
            return failure(REMOTE_MESSAGE, 403, errorId="ImageLab:remote")
        try:
            body = await read_json(request, int(settings.max_upload_bytes * 1.4))
        except AppError as exc:
            return failure(exc.message, 400)
        return envelope(await run_in_threadpool(_import_upload, body))

    def _import_upload(body: dict) -> dict:
        """Save the bytes; MATLAB (imread) decodes and validates them."""
        name = Path(str(body.get("name") or "upload.png")).name
        ext = Path(name).suffix.lower()
        if ext not in UPLOAD_TYPES:
            return {"ok": False, "error": "Unsupported file type. Use PNG, JPG, TIF, BMP or GIF."}
        try:
            data = base64.b64decode(str(body.get("data") or ""), validate=True)
        except (binascii.Error, ValueError):
            return {"ok": False, "error": "The uploaded file is corrupted."}
        if len(data) > settings.max_upload_bytes:
            return {"ok": False, "error": "Image too large (max 25 MB)."}
        tmp = settings.upload_dir / (uuid.uuid4().hex + ext)
        tmp.write_bytes(data)
        try:
            return {"ok": True, "op": "importImage",
                    "data": engine.call("importImage", {"path": str(tmp), "name": name})}
        except AppError as exc:
            return {"ok": False, "op": "importImage", "error": exc.message, "errorId": exc.error_id}
        finally:
            tmp.unlink(missing_ok=True)

    # ------------------------------------------------------------ files
    def local_file(request: Request, folder: Path, name: str, pattern: re.Pattern, **kw) -> Response:
        if remote(request):
            return Response("Only available on the ImageLab computer", status_code=403)
        path = folder / name
        if not pattern.match(name) or not path.is_file():
            return Response("Not found", status_code=404)
        return FileResponse(path, **kw)

    @app.get("/api/image/{name}")
    def image(request: Request, name: str):
        return local_file(request, settings.image_dir, name, IMAGE_FILE, headers={"Cache-Control": "max-age=3600"})

    @app.get("/api/download/{name}")
    def download(request: Request, name: str):
        return local_file(request, settings.image_dir, name, IMAGE_FILE, filename=f"imagelab_{name}", headers=NO_STORE)

    @app.get("/reports/{name}")
    def report(request: Request, name: str):
        return local_file(request, settings.report_dir, name, REPORT_FILE, headers=NO_STORE)

    @app.get("/api/{rest:path}")
    def unknown_api(rest: str):
        return failure("Unknown endpoint.", 404)

    # ------------------------------------------------------------ the React UI
    dist = settings.frontend_dist.resolve()

    @app.get("/{rest:path}")
    def spa(rest: str):
        if not (dist / "index.html").is_file():
            return HTMLResponse("<h2>ImageLab server is running.</h2><p>The UI is not built yet. Run "
                                "<code>npm install &amp;&amp; npm run build</code> in the frontend folder, "
                                "or use <code>npm run dev</code> for development.</p>")
        path = (dist / rest).resolve()
        if not rest or not path.is_file() or dist not in path.parents:
            path = dist / "index.html"                 # client-side route
        cache = "max-age=31536000, immutable" if rest.startswith("assets/") else "no-store"
        return FileResponse(path, headers={"Cache-Control": cache})

    return app
