"""Teacher settings: PIN, self sign-up, and the state of every experiment.

Every experiment is 'open', 'assigned' (with an optional due date and note)
or 'locked'; the teacher's Code Lab tasks carry their own state
(code_tasks.py).

The teacher PIN and its one-time recovery code are never stored, only their
PBKDF2 hashes (hashing.py). A PIN from the MATLAB version is stored as
SHA-256("imagelab:" + salt + ":" + pin); it keeps working and is re-hashed with
PBKDF2 the first time it is used. There is no "no PIN" mode: without a PIN the
teacher side is closed until somebody creates one (services/auth.py).
"""

from __future__ import annotations

import hashlib
import hmac
import secrets

from ..errors import AppError, invalid
from ..storage.repositories import SettingsRepository
from ..utils import DATE_PATTERN, clean_name
from .catalog import MatlabCatalog
from .hashing import matches, new_hash

SETTINGS_KEY = "classroom"
STATUSES = ("open", "assigned", "locked")
PIN_LENGTH = (6, 32)
CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"     # no 0/O, 1/I/L


def hash_pin(salt: str, pin: str) -> str:
    """The MATLAB version's PIN hash (only read, to accept an imported PIN once)."""
    return hashlib.sha256(f"imagelab:{salt}:{pin}".encode("utf-8")).hexdigest()


def new_recovery_code() -> str:
    """12 characters in groups of 4, e.g. K7QF-2MXP-9TDA (about 59 bits)."""
    raw = "".join(secrets.choice(CODE_ALPHABET) for _ in range(12))
    return "-".join(raw[i:i + 4] for i in range(0, 12, 4))


def normalise_code(code: str) -> str:
    return "".join(ch for ch in str(code or "").upper() if ch.isalnum())


def check_new_pin(pin: str) -> None:
    lo, hi = PIN_LENGTH
    if not lo <= len(pin) <= hi:
        raise invalid(f"The PIN must have {lo} to {hi} characters.")


def default_settings() -> dict:
    # pinHash / salt: a PIN imported from the MATLAB version (SHA-256)
    return {"pin": None, "recovery": None, "pinHash": "", "salt": "", "selfRegister": True,
            "experiments": {}, "codeTasks": {}}


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

    def public_view(self, s: dict | None = None) -> dict:
        s = s or self.settings()
        return {**self.options_of(s), "experiments": self.experiment_states(s)}

    @staticmethod
    def options_of(s: dict) -> dict:
        return {"hasPin": bool(s["pin"] or s["pinHash"]), "hasRecovery": bool(s["recovery"]),
                "selfRegister": bool(s["selfRegister"])}

    # ------------------------------------------------------------ PIN
    def has_pin(self) -> bool:
        return self.options()["hasPin"]

    def check_pin(self, pin: str) -> bool:
        """False while there is no PIN: the teacher side is never open without one."""
        s = self.settings()
        if s["pin"]:
            return matches(s["pin"], pin or "")
        if s["pinHash"] and pin and hmac.compare_digest(hash_pin(s["salt"], pin), s["pinHash"]):
            s["pin"], s["pinHash"], s["salt"] = new_hash(pin), "", ""      # upgrade the imported PIN
            self._save(s)
            return True
        return False

    def check_recovery(self, code: str) -> bool:
        return matches(self.settings()["recovery"], normalise_code(code))

    def _store_pin(self, s: dict, pin: str) -> str:
        """Saves the PIN with a new recovery code (returned once, never stored)."""
        check_new_pin(pin)
        code = new_recovery_code()
        s["pin"], s["recovery"], s["pinHash"], s["salt"] = new_hash(pin), new_hash(normalise_code(code)), "", ""
        self._save(s)
        return code

    def create_pin(self, pin: str) -> str:
        """The first PIN (only while there is none)."""
        if self.has_pin():
            raise AppError("A teacher PIN already exists - sign in with it.", "ImageLab:teacherPin")
        return self._store_pin(self.settings(), pin)

    def set_pin(self, old_pin: str, new_pin: str) -> dict:
        """Change the PIN (it cannot be removed); a new recovery code replaces the old one."""
        if not self.check_pin(old_pin):
            raise AppError("Wrong teacher PIN.", "ImageLab:teacherPin")
        if not new_pin:
            raise invalid("Enter the new PIN. The teacher PIN cannot be removed, only changed.")
        code = self._store_pin(self.settings(), new_pin)
        return {**self.public_view(), "recoveryCode": code}

    def new_recovery(self, pin: str) -> dict:
        """A fresh recovery code (the old one stops working)."""
        if not self.check_pin(pin):
            raise AppError("Wrong teacher PIN.", "ImageLab:teacherPin")
        s = self.settings()
        code = new_recovery_code()
        s["recovery"] = new_hash(normalise_code(code))
        self._save(s)
        return {**self.public_view(s), "recoveryCode": code}

    def reset_pin(self, code: str, new_pin: str) -> str:
        """Forgot the PIN: a valid recovery code sets a new PIN (and a new code)."""
        if not self.check_recovery(code):
            raise AppError("Wrong recovery code.", "ImageLab:teacherPin")
        return self._store_pin(self.settings(), new_pin)

    def clear_pin(self) -> None:
        """reset_teacher_pin.bat: back to "create the teacher PIN" (students and data stay)."""
        s = self.settings()
        s["pin"], s["recovery"], s["pinHash"], s["salt"] = None, None, "", ""
        self._save(s)

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
