"""Forgot the teacher PIN and lost the recovery code:  python -m imagelab.reset_pin [--yes]

(reset_teacher_pin.bat runs this with the project's .venv.) Removes the PIN and
the recovery code; the next teacher sign-in on the Spatia computer creates a new
PIN. Students, progress, scores and every other setting stay as they are. Only
somebody who can run programs on this computer can do this - and that person
can already read the data folder anyway.
"""

from __future__ import annotations

import sys

from .config import Settings
from .services.classroom import ClassroomService
from .storage.database import Database
from .storage.repositories import SettingsRepository


def main(argv: list[str] | None = None) -> int:
    argv = sys.argv[1:] if argv is None else argv
    settings = Settings.from_environment(argv)
    if not settings.database_file.is_file():
        print(f"No ImageLab data found at {settings.database_file} - nothing to reset.")
        return 1
    if "--yes" not in argv:
        answer = input("Remove the teacher PIN and its recovery code? Students and scores are kept. [y/N] ")
        if answer.strip().lower() not in ("y", "yes"):
            print("Nothing changed.")
            return 1
    db = Database(settings.database_file)
    try:
        ClassroomService(SettingsRepository(db), catalog=None).clear_pin()
    finally:
        db.close()
    print("The teacher PIN is removed. Open ImageLab, choose Teacher and create a new PIN.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
