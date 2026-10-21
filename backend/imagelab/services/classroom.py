"""Teacher settings: PIN, self sign-up, and the state of every assignment.

Every experiment and Code Lab task is 'open', 'assigned' (with an optional
due date and note) or 'locked'. The PIN is never stored, only
SHA-256("imagelab:" + salt + ":" + pin) - the same hash the MATLAB version
wrote, so an existing PIN keeps working after the import.
"""

from __future__ import annotations

import hashlib
import hmac
import secrets

from ..errors import AppError, invalid
from ..storage.repositories import SettingsRepository
from ..utils import DATE_PATTERN, clean_name
from .catalog import MatlabCatalog

SETTINGS_KEY = "classroom"
STATUSES = ("open", "assigned", "locked")


def hash_pin(salt: str, pin: str) -> str:
    return hashlib.sha256(f"imagelab:{salt}:{pin}".encode("utf-8")).hexdigest()


def default_settings() -> dict:
    return {"pinHash": "", "salt": "", "selfRegister": True, "experiments": {}, "codeTasks": {}}


def _state(saved: dict | None) -> dict:
    saved = saved or {}
    return {"status": saved.get("status", "open"), "due": saved.get("due", ""), "note": saved.get("note", "")}


class ClassroomService:
    def __init__(self, repo: SettingsRepository, catalog: MatlabCatalog):
        self.repo = repo
        self.catalog = catalog

    # ------------------------------------------------------------ storage
    def settings(self) -> dict:
        s = default_settings()
        s.update(self.repo.get(SETTINGS_KEY, {}) or {})
        return s

    def _save(self, s: dict) -> None:
        self.repo.put(SETTINGS_KEY, s)

    # ------------------------------------------------------------ views
    def options(self) -> dict:
        """What the sign-in page may offer (no catalogue needed, works before MATLAB is ready)."""
        return self.options_of(self.settings())

    def experiment_states(self, s: dict | None = None) -> list[dict]:
        s = s or self.settings()
        return [{"number": e["number"], "title": e["title"], **_state(s["experiments"].get(str(e["number"])))}
                for e in self.catalog.experiments()]

    def code_task_states(self, s: dict | None = None) -> list[dict]:
        s = s or self.settings()
        return [{"id": t["id"], "title": t["title"], **_state(s["codeTasks"].get(t["id"]))}
                for t in self.catalog.code_tasks()]

    def public_view(self, s: dict | None = None) -> dict:
        s = s or self.settings()
        return {**self.options_of(s), "experiments": self.experiment_states(s), "codeTasks": self.code_task_states(s)}

    @staticmethod
    def options_of(s: dict) -> dict:
        return {"hasPin": bool(s["pinHash"]), "selfRegister": bool(s["selfRegister"])}

    # ------------------------------------------------------------ PIN
    def check_pin(self, pin: str) -> bool:
        s = self.settings()
        return not s["pinHash"] or hmac.compare_digest(hash_pin(s["salt"], pin or ""), s["pinHash"])

    def set_pin(self, old_pin: str, new_pin: str) -> dict:
        if not self.check_pin(old_pin):
            raise AppError("Wrong teacher PIN.", "ImageLab:teacherPin")
        s = self.settings()
        if not new_pin:
            s["pinHash"], s["salt"] = "", ""
        else:
            if not 4 <= len(new_pin) <= 32:
                raise invalid("The PIN must have 4 to 32 characters.")
            s["salt"] = secrets.token_hex(16)
            s["pinHash"] = hash_pin(s["salt"], new_pin)
        self._save(s)
        return self.public_view(s)

    # ------------------------------------------------------------ assignments
    def set_self_register(self, value: bool) -> dict:
        s = self.settings()
        s["selfRegister"] = bool(value)
        self._save(s)
        return self.public_view(s)

    def set_experiment(self, number: float, status: str, due: str = "", note: str = "") -> dict:
        n = int(number) if float(number).is_integer() else number
        if n not in self.catalog.experiment_numbers():
            raise invalid(f"There is no experiment {n}.")
        return self._assign("experiments", str(n), status, due, note)

    def set_code_task(self, task_id: str, status: str, due: str = "", note: str = "") -> dict:
        if task_id not in {t["id"] for t in self.catalog.code_tasks()}:
            raise invalid(f'There is no Code Lab task "{task_id}".')
        return self._assign("codeTasks", task_id, status, due, note)

    def _assign(self, kind: str, key: str, status: str, due: str, note: str) -> dict:
        status = (status or "").lower()
        if status not in STATUSES:
            raise invalid("Status must be open, assigned or locked.")
        due = due or ""
        if due and not DATE_PATTERN.match(due):
            raise invalid("The due date must look like 2026-10-31.")
        note = clean_name(note, 120)
        s = self.settings()
        s[kind][key] = {"status": status, "due": due, "note": note}
        self._save(s)
        return self.public_view(s)

    def assert_experiment_runnable(self, number: float) -> None:
        n = int(number) if float(number).is_integer() else number
        if _state(self.settings()["experiments"].get(str(n)))["status"] == "locked":
            raise AppError(f"Experiment {n} is locked by your teacher. Ask your teacher to unlock it.",
                           "ImageLab:experimentLocked")

    def assert_code_runnable(self, task_id: str, title: str) -> None:
        if _state(self.settings()["codeTasks"].get(task_id))["status"] == "locked":
            raise AppError(f'The task "{title}" is locked by your teacher. Ask your teacher to unlock it.',
                           "ImageLab:taskLocked")

    def status_of_code_task(self, task_id: str) -> dict:
        return _state(self.settings()["codeTasks"].get(task_id))
