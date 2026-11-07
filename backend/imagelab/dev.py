"""Development server:  python -m imagelab.dev [--lan]

start_imagelab_dev.bat runs this together with the Vite dev server (npm run dev).

* Starts ONE MATLAB engine in this process and shares it as "ImageLabDev".
* Runs the backend with auto-reload: saving a .py file under backend/imagelab
  restarts the backend in about a second, and the restarted backend connects
  to the same MATLAB again - no minute-long MATLAB start after every change.
* MATLAB re-reads an edited .m file by itself; ilab_dispatch.m rebuilds its
  table of operations when it meets one it does not know yet.

Not for the classroom: a reload signs everybody out (sessions live in memory).
Use start_imagelab.bat / start_imagelab_lan.bat there.
"""

from __future__ import annotations

import logging
import os
import sys

import uvicorn

from .config import PROJECT_ROOT, Settings

SESSION = "ImageLabDev"
log = logging.getLogger("imagelab")


def factory():
    """Called by uvicorn in every (re)started worker process."""
    from .web.app import create_app  # noqa: PLC0415 - imported in the worker, after a reload
    return create_app(Settings.from_environment([]))


def share_matlab():
    """Start (or find) the shared MATLAB session; the returned engine must stay referenced."""
    try:
        import matlab.engine  # noqa: PLC0415 - optional dependency
    except ImportError:
        log.warning("The MATLAB Engine API for Python is not installed - image operations will not work.")
        return None
    if SESSION in matlab.engine.find_matlab():
        log.info("Using the running shared MATLAB session '%s'.", SESSION)
        return None
    log.info("Starting MATLAB once for this development session ... (about 10-60 seconds)")
    eng = matlab.engine.start_matlab("-nodesktop")
    eng.eval(f"matlab.engine.shareEngine('{SESSION}')", nargout=0)
    return eng


def main(argv: list[str] | None = None) -> None:
    argv = sys.argv[1:] if argv is None else argv
    logging.basicConfig(level=logging.INFO, format="[ImageLab dev] %(message)s")
    os.environ["IMAGELAB_CONNECT"] = SESSION
    os.environ["IMAGELAB_NO_BROWSER"] = "1"
    if "--lan" in argv:
        os.environ["IMAGELAB_LAN"] = "1"
    settings = Settings.from_environment(argv)
    engine = share_matlab()  # noqa: F841 - keeps MATLAB alive while the reloader runs
    log.info("Backend on http://localhost:%d with auto-reload; open the UI at http://localhost:5173", settings.port)
    uvicorn.run("imagelab.dev:factory", factory=True, reload=True,
                reload_dirs=[str(PROJECT_ROOT / "backend" / "imagelab")],
                host="0.0.0.0" if settings.lan else "127.0.0.1", port=settings.port, log_level="warning")


if __name__ == "__main__":
    main()
