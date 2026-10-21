"""Start ImageLab:  python -m imagelab [--lan] [--no-browser] [--connect NAME]

(start_imagelab.bat runs this with the project's .venv; ImageLab.m adds
--connect so the user's own MATLAB session does the processing.)
"""

from __future__ import annotations

import logging
import sys
import threading
import webbrowser

import uvicorn

from .config import Settings
from .web.app import create_app
from .web.network import lan_addresses


def main(argv: list[str] | None = None) -> None:
    argv = sys.argv[1:] if argv is None else argv
    logging.basicConfig(level=logging.INFO, format="[ImageLab] %(message)s")
    settings = Settings.from_environment(argv)
    app = create_app(settings)
    url = f"http://localhost:{settings.port}"
    log = logging.getLogger("imagelab")
    log.info("Server on %s  (Ctrl+C to stop)", url)
    if settings.lan:
        urls = [f"http://{ip}:{settings.port}" for ip in lan_addresses()]
        log.info("Classroom network mode: students join the live quiz at %s",
                 " or ".join(urls) or f"http://<this computer's IP>:{settings.port}")
        log.info("Other devices can only sign in and play the live quiz. "
                 "If Windows asks, allow Python on PRIVATE networks.")
    if settings.open_browser:
        threading.Timer(1.5, lambda: webbrowser.open(url)).start()
    uvicorn.run(app, host="0.0.0.0" if settings.lan else "127.0.0.1", port=settings.port,
                log_level="warning", access_log=False)


if __name__ == "__main__":
    main()
