"""Student profiles (the class roster).

Roll numbers are unique (students sign in with them). The first profile
'default' always exists and cannot be deleted. When a profile is removed,
the listeners registered with `on_removed` delete everything that belongs
to it (account, progress, Code Lab submissions, leaderboard scores), so
this service does not need to know about them. `on_renamed` listeners keep
copies of the name up to date (the leaderboard).
"""

from __future__ import annotations

import re
import secrets
from typing import Callable

from ..errors import invalid
from ..storage.repositories import ProfileRepository
from ..utils import clean_name, today_text
from .progress import ProgressService, default_progress, peek

DEFAULT_PROFILE = {"id": "default", "name": "Student 1", "roll": "", "created": ""}
MAX_PROFILES = 500
PROFILE_ID = re.compile(r"^[a-z0-9]{1,16}$")


def valid_id(profile_id: str) -> bool:
    return isinstance(profile_id, str) and bool(PROFILE_ID.match(profile_id))


def stats_row(profile: dict, s: dict) -> dict:
    """One roster entry with the student's short progress stats."""
    return {"id": profile["id"], "name": profile["name"], "roll": profile["roll"], "created": profile["created"],
            "xp": s["xp"], "level": s["level"], "badges": s["badgeCount"], "quizzes": s["quizzesTaken"],
            "accuracy": s["accuracy"], "bestScore": s["bestScore"], "dailyStreak": s["dailyStreak"],
            "codeTasks": s["codeTasks"], "lastActive": s["lastActive"]}


class ProfileService:
    def __init__(self, repo: ProfileRepository, progress: ProgressService):
        self.repo = repo
        self.progress = progress
        self._removed_listeners: list[Callable[[dict], None]] = []
        self._renamed_listeners: list[Callable[[dict], None]] = []
        if repo.count() == 0:
            repo.add(DEFAULT_PROFILE)

    def on_removed(self, listener: Callable[[str], None]) -> None:
        """listener(profile_id) after a profile was deleted."""
        self._removed_listeners.append(lambda profile: listener(profile["id"]))

    def on_removed_profile(self, listener: Callable[[dict], None]) -> None:
        """listener(profile) after a profile was deleted - for records that also stored the name."""
        self._removed_listeners.append(listener)

    def on_renamed(self, listener: Callable[[dict], None]) -> None:
        """listener(profile) after its name or roll number changed."""
        self._renamed_listeners.append(listener)

    # ------------------------------------------------------------ reading
    def roster(self) -> list[dict]:
        return self.repo.all()

    def get(self, profile_id: str) -> dict | None:
        return self.repo.get(profile_id) if valid_id(profile_id) else None

    def require(self, profile_id: str) -> dict:
        profile = self.get(profile_id)
        if profile is None:
            raise invalid("That student no longer exists.")
        return profile

    def find(self, identifier: str) -> dict | None:
        """Roll number first (unique), then the exact name - both not case sensitive."""
        if not identifier:
            return None
        key = identifier.lower()
        roster = self.roster()
        return (next((p for p in roster if p["roll"] and p["roll"].lower() == key), None)
                or next((p for p in roster if p["name"].lower() == key), None))

    def list(self) -> list[dict]:
        docs = self.progress.load_all()                  # one query for the whole class
        return [stats_row(p, peek(docs.get(p["id"]) or default_progress())) for p in self.roster()]

    # ------------------------------------------------------------ writing
    def add(self, name: str, roll: str = "") -> list[dict]:
        roster = self.roster()
        name, roll = self._clean_name(name), self._clean_roll(roll)
        self._check_unique(roster, name, roll)
        if len(roster) >= MAX_PROFILES:
            raise invalid(f"At most {MAX_PROFILES} student profiles are supported.")
        self.repo.add({"id": "s" + secrets.token_hex(5), "name": name, "roll": roll, "created": today_text()})
        return self.list()

    def update(self, profile_id: str, name: str, roll: str = "") -> list[dict]:
        if self.get(profile_id) is None:
            raise invalid("That student profile no longer exists.")
        others = [p for p in self.roster() if p["id"] != profile_id]
        name, roll = self._clean_name(name), self._clean_roll(roll)
        self._check_unique(others, name, roll)
        self.repo.update(profile_id, name, roll)
        for listener in self._renamed_listeners:
            listener(self.repo.get(profile_id))
        return self.list()

    def remove(self, profile_id: str) -> list[dict]:
        if profile_id == DEFAULT_PROFILE["id"]:
            raise invalid("The first profile cannot be deleted (you can rename it).")
        profile = self.get(profile_id)
        if profile is not None:
            self.repo.remove(profile_id)
            for listener in self._removed_listeners:
                listener(profile)
        return self.list()

    # ------------------------------------------------------------ validation
    @staticmethod
    def _clean_name(name: str) -> str:
        name = clean_name(name, 10_000)
        if not name:
            raise invalid("Please enter the student's name.")
        return name[:40]

    @staticmethod
    def _clean_roll(roll: str) -> str:
        return clean_name(roll, 10_000)[:20].strip()

    @staticmethod
    def _check_unique(profiles: list[dict], name: str, roll: str) -> None:
        if any(p["name"].lower() == name.lower() for p in profiles):
            raise invalid(f'A student called "{name}" already exists.')
        if roll and any(p["roll"].lower() == roll.lower() for p in profiles):
            raise invalid(f'Roll number "{roll}" is already taken.')
