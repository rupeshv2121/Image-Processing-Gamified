"""Runtime settings, read once from the command line and the environment."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Sequence

PROJECT_ROOT = Path(__file__).resolve().parents[2]


def _flag(name: str) -> bool:
    return os.environ.get(name, "") not in ("", "0")


def _arg_value(argv: Sequence[str], name: str) -> str | None:
    if name in argv[:-1]:
        return argv[list(argv).index(name) + 1]
    return None


@dataclass(frozen=True)
class Settings:
    root: Path = PROJECT_ROOT
    data_dir: Path = PROJECT_ROOT / "data"
    runtime_dir: Path = PROJECT_ROOT / "runtime"
    report_dir: Path = PROJECT_ROOT / "reports" / "output"
    frontend_dist: Path = PROJECT_ROOT / "frontend" / "dist"
    port: int = 8765
    keep_hours: float = 24.0
    lan: bool = False
    # Name of a MATLAB session shared by ImageLab.m (None = start a new engine)
    shared_session: str | None = None
    open_browser: bool = True
    max_upload_bytes: int = 25 * 1024 * 1024
    result_cache_size: int = 300
    # Leaderboard of ImageLab 1.x (a MATLAB table), imported once
    legacy_leaderboard: Path = PROJECT_ROOT / "quizzes" / "leaderboard.mat"

    @property
    def image_dir(self) -> Path:
        return self.runtime_dir / "images"

    @property
    def upload_dir(self) -> Path:
        return self.runtime_dir / "uploads"

    @property
    def database_file(self) -> Path:
        return self.data_dir / "imagelab.db"

    @classmethod
    def from_environment(cls, argv: Sequence[str] = ()) -> "Settings":
        data_dir = Path(os.environ.get("IMAGELAB_DATA_DIR", PROJECT_ROOT / "data"))
        runtime_dir = Path(os.environ.get("IMAGELAB_RUNTIME_DIR", PROJECT_ROOT / "runtime"))
        return cls(
            data_dir=data_dir,
            runtime_dir=runtime_dir,
            report_dir=Path(os.environ.get("IMAGELAB_REPORT_DIR", PROJECT_ROOT / "reports" / "output")),
            port=int(os.environ.get("IMAGELAB_PORT", "8765")),
            keep_hours=float(os.environ.get("IMAGELAB_KEEP_HOURS", "24")),
            lan="--lan" in argv or _flag("IMAGELAB_LAN"),
            shared_session=_arg_value(argv, "--connect"),
            open_browser="--no-browser" not in argv and not _flag("IMAGELAB_NO_BROWSER"),
        )
