"""
ImageLab bridge server.

This file does NO image processing. It only:
  1. starts a MATLAB session through the MATLAB Engine API for Python,
  2. forwards every UI request to the MATLAB function ilab_dispatch.m,
  3. serves the PNG images that MATLAB writes, and the built React UI.

All algorithms live in the MATLAB .m files of this project.

Run:  python server/server.py   (or start_imagelab.bat)
Then open http://localhost:8765
"""

import base64
import json
import mimetypes
import os
import re
import sys
import threading
import time
import uuid
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote, urlparse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RUNTIME = os.path.join(ROOT, "runtime")
IMAGE_DIR = os.path.join(RUNTIME, "images")
UPLOAD_DIR = os.path.join(RUNTIME, "uploads")
REPORT_DIR = os.path.join(ROOT, "reports", "output")
FRONTEND_DIST = os.path.join(ROOT, "frontend", "dist")
PORT = int(os.environ.get("IMAGELAB_PORT", "8765"))
MAX_UPLOAD_BYTES = 25 * 1024 * 1024
SAFE_NAME = re.compile(r"^[A-Za-z0-9_\-.]+$")
# "--connect NAME": attach to a MATLAB session shared by ImageLab.m instead of
# starting a new one (so the user's own MATLAB does the processing).
SHARED_SESSION = sys.argv[sys.argv.index("--connect") + 1] if "--connect" in sys.argv[:-1] else None


class Matlab:
    """One shared MATLAB session. Calls are serialised with a lock."""

    def __init__(self):
        self.engine = None
        self.error = None
        self.ready = threading.Event()
        self.lock = threading.Lock()

    def start(self):
        try:
            import matlab.engine  # noqa: WPS433 (imported lazily on purpose)

            t = time.time()
            if SHARED_SESSION:
                # Started from MATLAB with ImageLab.m: use that MATLAB session
                print(f"[ImageLab] Connecting to the shared MATLAB session '{SHARED_SESSION}' ...")
                try:
                    eng = matlab.engine.connect_matlab(SHARED_SESSION)
                    eng.eval("1;", nargout=0)  # make sure the session answers
                except Exception as exc:
                    print(f"[ImageLab] Could not use the shared session ({exc}); starting a separate MATLAB engine.")
                    eng = matlab.engine.start_matlab("-nodesktop")
            else:
                print("[ImageLab] Starting MATLAB engine ... (about 10-60 seconds)")
                eng = matlab.engine.start_matlab("-nodesktop")
            eng.cd(ROOT, nargout=0)
            eng.ilab_setup(nargout=1)
            eng.ilab_store("init", IMAGE_DIR, nargout=1)
            eng.generateSampleImages(False, nargout=0)
            eng.ilab_figure(nargout=0)  # warm up MATLAB graphics for charts
            self.engine = eng
            print(f"[ImageLab] MATLAB ready in {time.time() - t:.1f} s")
        except Exception as exc:  # pragma: no cover - shown in the UI
            self.error = (
                "Could not start MATLAB through the MATLAB Engine API for Python: "
                f"{exc}. Install it with:  pip install matlabengine"
            )
            print("[ImageLab] " + self.error)
        finally:
            self.ready.set()

    def call(self, request: dict) -> dict:
        self.ready.wait()
        if self.engine is None:
            return {"ok": False, "error": self.error or "MATLAB is not running."}
        with self.lock:
            try:
                raw = self.engine.ilab_dispatch(json.dumps(request), nargout=1)
            except Exception as exc:
                return {"ok": False, "error": f"MATLAB engine error: {exc}"}
        return json.loads(raw)


MATLAB = Matlab()


class Handler(BaseHTTPRequestHandler):
    server_version = "ImageLab/1.0"

    def log_message(self, fmt, *args):  # quieter console
        line = str(args[0]) if args else ""
        if "/api/" in line and "/api/status" not in line and "/api/image/" not in line:
            sys.stdout.write("[http] " + (fmt % args) + "\n")

    # ------------------------------------------------------------- helpers
    def send_json(self, payload, status=200):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def send_file(self, path, cache=False, download_name=None):
        if not os.path.isfile(path):
            self.send_error(404, "Not found")
            return
        ctype = mimetypes.guess_type(path)[0] or "application/octet-stream"
        with open(path, "rb") as fh:
            data = fh.read()
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "max-age=3600" if cache else "no-store")
        if download_name:
            self.send_header("Content-Disposition", f'attachment; filename="{download_name}"')
        self.end_headers()
        self.wfile.write(data)

    def read_json(self):
        length = int(self.headers.get("Content-Length", "0"))
        if length > MAX_UPLOAD_BYTES * 1.4:
            raise ValueError("Request too large (max 25 MB image).")
        return json.loads(self.rfile.read(length) or b"{}")

    # ------------------------------------------------------------- routes
    def do_GET(self):
        path = unquote(urlparse(self.path).path)

        if path == "/api/status":
            self.send_json({
                "ready": MATLAB.ready.is_set(),
                "matlab": MATLAB.engine is not None,
                "error": MATLAB.error,
            })
            return

        m = re.match(r"^/api/image/([A-Za-z0-9_\-]+)\.png$", path)
        if m:
            self.send_file(os.path.join(IMAGE_DIR, m.group(1) + ".png"), cache=True)
            return

        m = re.match(r"^/api/download/([A-Za-z0-9_\-]+)\.png$", path)
        if m:
            self.send_file(os.path.join(IMAGE_DIR, m.group(1) + ".png"),
                           download_name=f"imagelab_{m.group(1)}.png")
            return

        m = re.match(r"^/reports/([A-Za-z0-9_\-.]+)$", path)
        if m and SAFE_NAME.match(m.group(1)):
            self.send_file(os.path.join(REPORT_DIR, m.group(1)))
            return

        # Static React build (single-page app)
        if not os.path.isdir(FRONTEND_DIST):
            self.send_response(200)
            self.send_header("Content-Type", "text/html")
            self.end_headers()
            self.wfile.write(
                b"<h2>ImageLab server is running.</h2><p>The UI is not built yet. Run "
                b"<code>npm install &amp;&amp; npm run build</code> in the frontend folder, "
                b"or use <code>npm run dev</code> for development.</p>")
            return
        rel = path.lstrip("/") or "index.html"
        full = os.path.normpath(os.path.join(FRONTEND_DIST, rel))
        if not full.startswith(os.path.normpath(FRONTEND_DIST)) or not os.path.isfile(full):
            full = os.path.join(FRONTEND_DIST, "index.html")
        self.send_file(full, cache="/assets/" in path)

    def do_POST(self):
        path = urlparse(self.path).path
        try:
            body = self.read_json()
        except Exception as exc:
            self.send_json({"ok": False, "error": f"Bad request: {exc}"}, 400)
            return

        if path == "/api/run":
            op = body.get("op")
            if not isinstance(op, str):
                self.send_json({"ok": False, "error": "Missing 'op'."}, 400)
                return
            self.send_json(MATLAB.call({"op": op, "params": body.get("params") or {}}))
            return

        if path == "/api/upload":
            # Save the uploaded bytes; MATLAB (imread) decodes and validates them.
            name = os.path.basename(str(body.get("name", "upload.png")))
            ext = os.path.splitext(name)[1].lower()
            if ext not in {".png", ".jpg", ".jpeg", ".tif", ".tiff", ".bmp", ".gif"}:
                self.send_json({"ok": False, "error":
                                "Unsupported file type. Use PNG, JPG, TIF, BMP or GIF."})
                return
            try:
                data = base64.b64decode(body.get("data", ""), validate=True)
            except Exception:
                self.send_json({"ok": False, "error": "The uploaded file is corrupted."})
                return
            if len(data) > MAX_UPLOAD_BYTES:
                self.send_json({"ok": False, "error": "Image too large (max 25 MB)."})
                return
            os.makedirs(UPLOAD_DIR, exist_ok=True)
            tmp = os.path.join(UPLOAD_DIR, uuid.uuid4().hex + ext)
            with open(tmp, "wb") as fh:
                fh.write(data)
            try:
                result = MATLAB.call({"op": "importImage", "params": {"path": tmp, "name": name}})
            finally:
                try:
                    os.remove(tmp)
                except OSError:
                    pass
            self.send_json(result)
            return

        self.send_json({"ok": False, "error": "Unknown endpoint."}, 404)


def main():
    os.makedirs(IMAGE_DIR, exist_ok=True)
    threading.Thread(target=MATLAB.start, daemon=True).start()
    httpd = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    url = f"http://localhost:{PORT}"
    print(f"[ImageLab] Server on {url}  (Ctrl+C to stop)")
    if "--no-browser" not in sys.argv and not os.environ.get("IMAGELAB_NO_BROWSER"):
        threading.Timer(1.5, lambda: webbrowser.open(url)).start()
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        if MATLAB.engine is not None and not SHARED_SESSION:
            MATLAB.engine.quit()  # never close the user's own MATLAB session


if __name__ == "__main__":
    main()
