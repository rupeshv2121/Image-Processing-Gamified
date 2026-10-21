"""Student and teacher sign-in: passwords, sessions, lock-out.

* Passwords are never stored: PBKDF2-HMAC-SHA256, 120 000 iterations and a
  random 16-byte salt per password (byte-compatible with the hashes the
  MATLAB version wrote, so imported accounts keep their passwords).
* Session tokens are 256 random bits, kept only in memory (a restart signs
  everybody out). Students: 12 h, teacher: 8 h, renewed while in use.
* 5 wrong passwords lock an account for 5 minutes (also the teacher PIN).
* Failed sign-ins give one generic message, so nobody can find out which
  roll numbers exist.
The identity of a request is ALWAYS taken from its session, never from
what the browser claims.
"""

from __future__ import annotations

import hashlib
import hmac
import math
import re
import secrets
import threading
import time
from dataclasses import dataclass

from ..errors import AppError, invalid
from ..storage.repositories import AccountRepository
from ..utils import now_text, plural
from .classroom import ClassroomService
from .profiles import ProfileService

ITERATIONS = 120_000
TTL = {"student": 12 * 3600, "teacher": 8 * 3600}
MAX_FAILS, LOCK_SECONDS = 5, 300
RENEW_AFTER = 60
TOKEN = re.compile(r"^[0-9a-f]{64}$")
TEMP_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"   # no 0/O, 1/l/I


@dataclass
class Session:
    token: str
    role: str                 # 'student' | 'teacher'
    profile_id: str
    name: str
    expires: float
    renewed: float

    @property
    def is_teacher(self) -> bool:
        return self.role == "teacher"


def pbkdf2(password: str, salt_hex: str, iterations: int = ITERATIONS) -> str:
    return hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), bytes.fromhex(salt_hex), iterations, 32).hex()


def check_password(password: str) -> None:
    if not 6 <= len(password) <= 64:
        raise invalid("The password must have 6 to 64 characters.")


def new_account(password: str, must_change: bool, previous: dict | None = None) -> dict:
    check_password(password)
    salt = secrets.token_hex(16)
    return {"salt": salt, "hash": pbkdf2(password, salt), "iterations": ITERATIONS, "mustChange": must_change,
            "lastLogin": (previous or {}).get("lastLogin", ""), "changed": now_text()}


def verify(account: dict | None, password: str) -> bool:
    if not account or not account.get("hash") or not password:
        return False
    return hmac.compare_digest(pbkdf2(password, account["salt"], int(account["iterations"])), account["hash"])


class AuthService:
    def __init__(self, accounts: AccountRepository, profiles: ProfileService, classroom: ClassroomService,
                 clock=time.time):
        self.accounts = accounts
        self.profiles = profiles
        self.classroom = classroom
        self.clock = clock
        self._sessions: dict[str, Session] = {}
        self._failures: dict[str, dict] = {}
        self._lock = threading.Lock()

    # ------------------------------------------------------------ sessions
    def resolve(self, token: str) -> Session | None:
        if not isinstance(token, str) or not TOKEN.match(token):
            return None
        now = self.clock()
        with self._lock:
            s = self._sessions.get(token)
            if s is None:
                return None
            if now > s.expires:
                del self._sessions[token]
                return None
            if now - s.renewed > RENEW_AFTER:                 # sliding expiry
                s.expires, s.renewed = now + TTL[s.role], now
            return s

    def _open(self, role: str, profile_id: str, name: str, must_change: bool) -> dict:
        now = self.clock()
        token = secrets.token_hex(32)
        with self._lock:
            if len(self._sessions) > 5000:
                self._sessions = {k: v for k, v in self._sessions.items() if v.expires >= now}
            self._sessions[token] = Session(token, role, profile_id, name, now + TTL[role], now)
        return {"token": token, "role": role, "profileId": profile_id, "name": name, "mustChange": must_change}

    def logout(self, token: str) -> bool:
        with self._lock:
            self._sessions.pop(token, None)
        return True

    def end_sessions(self, profile_id: str) -> None:
        with self._lock:
            self._sessions = {k: v for k, v in self._sessions.items() if v.profile_id != profile_id}

    # ------------------------------------------------------------ lock-out
    def _check_lock(self, key: str) -> None:
        with self._lock:
            f = self._failures.get(key)
        if f:
            wait = math.ceil((f["until"] - self.clock()) / 60)
            if wait > 0:
                raise AppError(f"Too many wrong attempts. Try again in {wait} minute{plural(wait)}.", "ImageLab:locked")

    def _fail(self, key: str) -> None:
        with self._lock:
            f = self._failures.setdefault(key, {"count": 0, "until": 0.0})
            f["count"] += 1
            if f["count"] >= MAX_FAILS:
                f["until"], f["count"] = self.clock() + LOCK_SECONDS, 0
        if key == "teacher":
            raise AppError("Wrong teacher PIN.", "ImageLab:teacherPin")
        raise AppError("Wrong roll number / name or password.", "ImageLab:badLogin")

    def _clear(self, key: str) -> None:
        with self._lock:
            self._failures.pop(key, None)

    def _locked(self, profile_id: str) -> bool:
        with self._lock:
            f = self._failures.get("p:" + profile_id)
        return bool(f) and f["until"] > self.clock()

    # ------------------------------------------------------------ sign-in
    def login(self, identifier: str, password: str, claim: bool = False) -> dict:
        ident = (identifier or "").strip()
        key = "s:" + ident.lower()
        self._check_lock(key)
        profile = self.profiles.find(ident)
        if profile is None:
            self._fail(key)
        account = self.accounts.get(profile["id"])
        if not account or not account["hash"]:
            if not claim:
                raise AppError(f"Welcome, {profile['name']}! Your account has no password yet - choose one now.",
                               "ImageLab:needsPassword")
            account = new_account(password, False)
            self.accounts.put(profile["id"], account)
        else:
            key = "p:" + profile["id"]                         # lock the account, not the spelling
            self._check_lock(key)
            if not verify(account, password):
                self._fail(key)
        self._clear(key)
        self.accounts.set_last_login(profile["id"], now_text())
        return self._open("student", profile["id"], profile["name"], bool(account["mustChange"]))

    def register(self, name: str, roll: str, password: str) -> dict:
        if not self.classroom.options()["selfRegister"]:
            raise invalid("Ask your teacher to create your account.")
        roll = (roll or "").strip()
        if not roll:
            raise invalid("Please enter your roll number - you sign in with it.")
        check_password(password)
        self.profiles.add(name, roll)
        profile = self.profiles.find(roll)
        account = new_account(password, False)
        account["lastLogin"] = now_text()
        self.accounts.put(profile["id"], account)
        return self._open("student", profile["id"], profile["name"], False)

    def teacher_login(self, pin: str) -> dict:
        self._check_lock("teacher")
        if not self.classroom.check_pin(pin or ""):
            self._fail("teacher")
        self._clear("teacher")
        return self._open("teacher", "teacher", "Teacher", False)

    # ------------------------------------------------------------ passwords
    def change_password(self, profile_id: str, old: str, new: str) -> bool:
        account = self.accounts.get(profile_id)
        if account is None:
            raise invalid("This account has no password yet.")
        if not account["mustChange"] and not verify(account, old):
            raise invalid("Your current password is not correct.")
        if verify(account, new):
            raise invalid("Choose a password that is different from the current one.")
        self.accounts.put(profile_id, new_account(new, False, account))
        return True

    def reset_password(self, profile_id: str, password: str = "") -> dict:
        password = password or "".join(secrets.choice(TEMP_ALPHABET) for _ in range(8))
        if self.profiles.get(profile_id) is None:
            raise invalid("That student no longer exists.")
        self.accounts.put(profile_id, new_account(password, True, self.accounts.get(profile_id)))
        self.end_sessions(profile_id)                       # the old password no longer works anywhere
        self._clear("p:" + profile_id)
        return {"password": password}

    def status(self) -> list[dict]:
        accounts = self.accounts.all()
        out = []
        for p in self.profiles.roster():
            a = accounts.get(p["id"])
            has = bool(a and a["hash"])
            out.append({"id": p["id"], "hasPassword": has, "mustChange": bool(has and a["mustChange"]),
                        "lastLogin": a["lastLogin"] if has else "", "locked": self._locked(p["id"])})
        return out

    def forget(self, profile_id: str) -> None:
        """The profile was deleted: its account and sessions go too."""
        self.accounts.remove(profile_id)
        self.end_sessions(profile_id)
