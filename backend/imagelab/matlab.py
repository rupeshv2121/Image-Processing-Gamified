"""The single door to MATLAB.

`MatlabEngine` starts (or attaches to) one MATLAB session through the
MATLAB Engine API for Python and calls api/ilab_dispatch.m with
{"op": ..., "params": ...}. A MATLAB session runs one call at a time, so
calls are serialised with a lock; only image work waits for it - sign-in,
progress, quizzes and the live quiz never touch MATLAB.

Services depend on the small `MatlabGateway` protocol, not on this class,
so tests replace MATLAB with a fake.
"""

from __future__ import annotations

import json
import logging
import threading
import time
from pathlib import Path
from typing import Any, Protocol

from .errors import AppError

log = logging.getLogger("imagelab.matlab")


class MatlabGateway(Protocol):
    def call(self, op: str, params: dict | None = None) -> Any:
        """Run one MATLAB operation and return its data (raises AppError on failure)."""

    def call_function(self, name: str, *args: Any) -> Any:
        """Call any MATLAB function and return its first output."""


class MatlabEngine:
    def __init__(self, root: Path, image_dir: Path, shared_session: str | None = None):
        self.root = root
        self.image_dir = image_dir
        self.shared_session = shared_session
        self.engine = None
        self.error: str | None = None
        self.ready = threading.Event()
        self._lock = threading.Lock()
        self._current = None                    # FutureResult of the running call
        self._current_op: str | None = None
        self.info: dict = {}                    # MATLAB version and toolbox (op "ping")

    # ------------------------------------------------------------ life cycle
    def start(self) -> None:
        """Start MATLAB (blocking, 10-60 s). Run it in a background thread."""
        try:
            import matlab.engine  # noqa: PLC0415 - optional dependency, imported lazily

            t0 = time.time()
            eng = None
            if self.shared_session:
                log.info("Connecting to the shared MATLAB session '%s' ...", self.shared_session)
                try:
                    eng = matlab.engine.connect_matlab(self.shared_session)
                    eng.eval("1;", nargout=0)
                except Exception as exc:  # noqa: BLE001 - any engine failure -> fall back
                    log.warning("Could not use the shared session (%s); starting a separate engine.", exc)
                    eng = None
            if eng is None:
                log.info("Starting MATLAB engine ... (about 10-60 seconds)")
                eng = matlab.engine.start_matlab("-nodesktop")
            eng.cd(str(self.root), nargout=0)
            eng.ilab_setup(nargout=1)
            eng.ilab_store("init", str(self.image_dir), nargout=1)
            eng.generateSampleImages(False, nargout=0)
            eng.ilab_figure(nargout=0)                # warm up MATLAB graphics for charts
            self.engine = eng
            self.info = self.call("ping")
            log.info("MATLAB ready in %.1f s", time.time() - t0)
        except Exception as exc:  # noqa: BLE001 - shown in the UI
            self.engine = None
            self.error = ("Could not start MATLAB through the MATLAB Engine API for Python: "
                          f"{exc}. Install it with:  pip install matlabengine")
            log.error(self.error)
        finally:
            self.ready.set()

    def stop(self) -> None:
        """Quit the engine - never the user's own shared MATLAB session."""
        if self.engine is not None and not self.shared_session:
            try:
                self.engine.quit()
            except Exception:  # noqa: BLE001 - shutting down anyway
                pass
        self.engine = None

    @property
    def running(self) -> bool:
        return self.engine is not None

    # ------------------------------------------------------------ calls
    def _engine(self):
        if self.engine is None:
            self.ready.wait()                         # still starting
        if self.engine is None:
            raise AppError(self.error or "MATLAB is not running.", "ImageLab:matlab")
        return self.engine

    def call(self, op: str, params: dict | None = None) -> Any:
        request = json.dumps({"op": op, "params": params or {}}, separators=(",", ":"))
        raw = self._run(op, lambda eng: eng.ilab_dispatch(request, nargout=1, background=True))
        response = json.loads(raw)
        if not response.get("ok"):
            raise AppError(response.get("error") or "MATLAB error.", response.get("errorId") or "ImageLab:matlab")
        return response.get("data")

    def call_function(self, name: str, *args: Any) -> Any:
        return self._run(name, lambda eng: getattr(eng, name)(*args, nargout=1, background=True))

    def _run(self, label: str, start) -> Any:
        eng = self._engine()
        with self._lock:
            future = None
            try:
                future = start(eng)
                self._current, self._current_op = future, label
                return future.result()
            except AppError:
                raise
            except Exception as exc:  # noqa: BLE001 - engine errors become user messages
                if future is not None and future.cancelled():
                    raise AppError("Cancelled - MATLAB stopped the computation.", "ImageLab:cancelled",
                                   cancelled=True) from exc
                raise AppError(f"MATLAB engine error: {exc}", "ImageLab:matlab") from exc
            finally:
                self._current, self._current_op = None, None

    def cancel(self) -> dict:
        """Interrupt the running MATLAB call (like Ctrl+C in MATLAB)."""
        future = self._current
        if future is None or future.done():
            return {"cancelled": False, "message": "Nothing is running."}
        try:
            cancelled = bool(future.cancel())
        except Exception as exc:  # noqa: BLE001 - engine specific
            raise AppError(f"Could not cancel: {exc}", "ImageLab:matlab") from exc
        return {"cancelled": cancelled, "op": self._current_op}
