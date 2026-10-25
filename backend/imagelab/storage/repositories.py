"""Repositories: the only code that knows the SQL schema.

Services receive plain dicts and lists, so they can be tested with any
storage and never build SQL themselves.
"""

from __future__ import annotations

from typing import Any, Callable

from .database import Database, dumps, loads


class ProfileRepository:
    """Student profiles in creation order (the roster)."""

    def __init__(self, db: Database):
        self.db = db

    @staticmethod
    def _row(r) -> dict:
        return {"id": r["id"], "name": r["name"], "roll": r["roll"], "created": r["created"]}

    def all(self) -> list[dict]:
        return [self._row(r) for r in self.db.query("SELECT id, name, roll, created FROM profiles ORDER BY seq")]

    def get(self, profile_id: str) -> dict | None:
        r = self.db.one("SELECT id, name, roll, created FROM profiles WHERE id = ?", (profile_id,))
        return self._row(r) if r else None

    def add(self, profile: dict) -> None:
        with self.db.transaction() as db:
            db.execute("INSERT INTO profiles (id, name, roll, created) VALUES (?, ?, ?, ?)",
                       (profile["id"], profile["name"], profile.get("roll", ""), profile.get("created", "")))

    def update(self, profile_id: str, name: str, roll: str) -> None:
        with self.db.transaction() as db:
            db.execute("UPDATE profiles SET name = ?, roll = ? WHERE id = ?", (name, roll, profile_id))

    def remove(self, profile_id: str) -> None:
        with self.db.transaction() as db:
            db.execute("DELETE FROM profiles WHERE id = ?", (profile_id,))

    def count(self) -> int:
        return self.db.one("SELECT COUNT(*) AS n FROM profiles")["n"]


class AccountRepository:
    """Password hashes of student accounts (never the passwords)."""

    def __init__(self, db: Database):
        self.db = db

    @staticmethod
    def _row(r) -> dict:
        return {"salt": r["salt"], "hash": r["hash"], "iterations": r["iterations"],
                "mustChange": bool(r["must_change"]), "lastLogin": r["last_login"], "changed": r["changed"]}

    def get(self, profile_id: str) -> dict | None:
        r = self.db.one("SELECT * FROM accounts WHERE profile_id = ?", (profile_id,))
        return self._row(r) if r else None

    def all(self) -> dict[str, dict]:
        return {r["profile_id"]: self._row(r) for r in self.db.query("SELECT * FROM accounts")}

    def put(self, profile_id: str, a: dict) -> None:
        with self.db.transaction() as db:
            db.execute(
                "INSERT INTO accounts (profile_id, salt, hash, iterations, must_change, last_login, changed) "
                "VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(profile_id) DO UPDATE SET salt = excluded.salt, "
                "hash = excluded.hash, iterations = excluded.iterations, must_change = excluded.must_change, "
                "last_login = excluded.last_login, changed = excluded.changed",
                (profile_id, a["salt"], a["hash"], int(a["iterations"]), int(bool(a["mustChange"])),
                 a.get("lastLogin", ""), a.get("changed", "")))

    def set_last_login(self, profile_id: str, when: str) -> None:
        with self.db.transaction() as db:
            db.execute("UPDATE accounts SET last_login = ? WHERE profile_id = ?", (when, profile_id))

    def remove(self, profile_id: str) -> None:
        with self.db.transaction() as db:
            db.execute("DELETE FROM accounts WHERE profile_id = ?", (profile_id,))


class DocumentRepository:
    """One JSON document per key (a student's progress)."""

    def __init__(self, db: Database, table: str = "progress"):
        self.db = db
        self.table = table

    def get(self, key: str) -> Any:
        r = self.db.one(f"SELECT doc FROM {self.table} WHERE profile_id = ?", (key,))
        return loads(r["doc"]) if r else None

    def all(self) -> dict[str, Any]:
        return {r["profile_id"]: loads(r["doc"]) for r in self.db.query(f"SELECT profile_id, doc FROM {self.table}")}

    def put(self, key: str, doc: Any) -> None:
        with self.db.transaction() as db:
            db.execute(f"INSERT INTO {self.table} (profile_id, doc) VALUES (?, ?) "
                       "ON CONFLICT(profile_id) DO UPDATE SET doc = excluded.doc", (key, dumps(doc)))

    def update(self, key: str, change: Callable[[Any], Any]) -> Any:
        """Read, change and write one document atomically; returns change()'s result."""
        with self.db.transaction() as db:
            r = db.execute(f"SELECT doc FROM {self.table} WHERE profile_id = ?", (key,)).fetchone()
            doc = loads(r["doc"]) if r else None
            doc, result, changed = change(doc)
            if changed:
                db.execute(f"INSERT INTO {self.table} (profile_id, doc) VALUES (?, ?) "
                           "ON CONFLICT(profile_id) DO UPDATE SET doc = excluded.doc", (key, dumps(doc)))
            return result

    def remove(self, key: str) -> None:
        with self.db.transaction() as db:
            db.execute(f"DELETE FROM {self.table} WHERE profile_id = ?", (key,))


class SubmissionRepository:
    """Code Lab submissions: one document per student and task."""

    def __init__(self, db: Database):
        self.db = db

    def of(self, profile_id: str) -> dict[str, dict]:
        rows = self.db.query("SELECT task_id, doc FROM submissions WHERE profile_id = ? ORDER BY rowid", (profile_id,))
        return {r["task_id"]: loads(r["doc"], {}) for r in rows}

    def all(self) -> dict[str, dict[str, dict]]:
        out: dict[str, dict[str, dict]] = {}
        for r in self.db.query("SELECT profile_id, task_id, doc FROM submissions ORDER BY rowid"):
            out.setdefault(r["profile_id"], {})[r["task_id"]] = loads(r["doc"], {})
        return out

    def update(self, profile_id: str, task_id: str, change: Callable[[dict | None], dict]) -> dict:
        with self.db.transaction() as db:
            r = db.execute("SELECT doc FROM submissions WHERE profile_id = ? AND task_id = ?",
                           (profile_id, task_id)).fetchone()
            doc = change(loads(r["doc"], None) if r else None)
            db.execute("INSERT INTO submissions (profile_id, task_id, doc) VALUES (?, ?, ?) "
                       "ON CONFLICT(profile_id, task_id) DO UPDATE SET doc = excluded.doc",
                       (profile_id, task_id, dumps(doc)))
            return doc

    def put(self, profile_id: str, task_id: str, doc: dict) -> None:
        self.update(profile_id, task_id, lambda _old: doc)

    def remove_profile(self, profile_id: str) -> None:
        with self.db.transaction() as db:
            db.execute("DELETE FROM submissions WHERE profile_id = ?", (profile_id,))

    def remove_task(self, task_id: str) -> None:
        with self.db.transaction() as db:
            db.execute("DELETE FROM submissions WHERE task_id = ?", (task_id,))


class SettingsRepository:
    """Small JSON values by key (the classroom settings)."""

    def __init__(self, db: Database):
        self.db = db

    def get(self, key: str, default: Any = None) -> Any:
        r = self.db.one("SELECT value FROM settings WHERE key = ?", (key,))
        return loads(r["value"], default) if r else default

    def put(self, key: str, value: Any) -> None:
        with self.db.transaction() as db:
            db.execute("INSERT INTO settings (key, value) VALUES (?, ?) "
                       "ON CONFLICT(key) DO UPDATE SET value = excluded.value", (key, dumps(value)))


class KernelRepository:
    """The kernel library of the Kernel Playground (name -> matrix)."""

    def __init__(self, db: Database):
        self.db = db

    def all(self) -> list[dict]:
        return [{"name": r["name"], "kernel": loads(r["matrix"], [])}
                for r in self.db.query("SELECT name, matrix FROM kernels ORDER BY seq")]

    def save(self, name: str, matrix: list[list[float]]) -> None:
        with self.db.transaction() as db:
            db.execute("INSERT INTO kernels (name, matrix) VALUES (?, ?) "
                       "ON CONFLICT(name) DO UPDATE SET matrix = excluded.matrix", (name, dumps(matrix)))


class LeaderboardRepository:
    """Quiz scores, in the order they were added."""

    def __init__(self, db: Database):
        self.db = db

    def all(self) -> list[dict]:
        return [{"Name": r["name"], "Roll": r["roll"], "Score": r["score"], "Accuracy": r["accuracy"],
                 "BestStreak": r["best_streak"], "Mode": r["mode"], "Date": r["date"], "ProfileId": r["profile_id"]}
                for r in self.db.query("SELECT * FROM leaderboard ORDER BY seq")]

    def add(self, e: dict) -> None:
        with self.db.transaction() as db:
            db.execute("INSERT INTO leaderboard (name, roll, score, accuracy, best_streak, mode, date, profile_id) "
                       "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                       (e["Name"], e["Roll"], e["Score"], e["Accuracy"], e["BestStreak"], e["Mode"], e["Date"],
                        e.get("ProfileId", "")))

    def remove_student(self, profile_id: str, name: str, roll: str) -> None:
        """A student's scores; entries from before profile ids were stored are matched by name and roll."""
        with self.db.transaction() as db:
            db.execute("DELETE FROM leaderboard WHERE profile_id = ? "
                       "OR (profile_id = '' AND lower(name) = lower(?) AND roll = ?)", (profile_id, name, roll))

    def rename_student(self, profile_id: str, name: str, roll: str) -> None:
        with self.db.transaction() as db:
            db.execute("UPDATE leaderboard SET name = ?, roll = ? WHERE profile_id = ?", (name, roll, profile_id))

    def clear(self) -> None:
        with self.db.transaction() as db:
            db.execute("DELETE FROM leaderboard")


class OrderedDocuments:
    """Documents with an id, newest first (saved live quizzes, live quiz results)."""

    def __init__(self, db: Database, table: str):
        self.db = db
        self.table = table

    def all(self) -> list[dict]:
        return [loads(r["doc"], {}) for r in self.db.query(f"SELECT doc FROM {self.table} ORDER BY seq DESC")]

    def get(self, doc_id: str) -> dict | None:
        r = self.db.one(f"SELECT doc FROM {self.table} WHERE id = ?", (doc_id,))
        return loads(r["doc"], None) if r else None

    def put_first(self, doc: dict, keep: int) -> None:
        """Insert or replace doc as the newest entry and keep at most `keep` entries."""
        with self.db.transaction() as db:
            top = db.execute(f"SELECT COALESCE(MAX(seq), 0) AS s FROM {self.table}").fetchone()["s"]
            db.execute(f"INSERT INTO {self.table} (id, seq, doc) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE "
                       "SET seq = excluded.seq, doc = excluded.doc", (doc["id"], top + 1, dumps(doc)))
            db.execute(f"DELETE FROM {self.table} WHERE id NOT IN "
                       f"(SELECT id FROM {self.table} ORDER BY seq DESC LIMIT ?)", (keep,))

    def save(self, doc: dict) -> None:
        """Insert doc as the newest entry, or update it in place (its position is kept)."""
        with self.db.transaction() as db:
            if db.execute(f"SELECT 1 FROM {self.table} WHERE id = ?", (doc["id"],)).fetchone():
                db.execute(f"UPDATE {self.table} SET doc = ? WHERE id = ?", (dumps(doc), doc["id"]))
                return
            top = db.execute(f"SELECT COALESCE(MAX(seq), 0) AS s FROM {self.table}").fetchone()["s"]
            db.execute(f"INSERT INTO {self.table} (id, seq, doc) VALUES (?, ?, ?)", (doc["id"], top + 1, dumps(doc)))

    def count(self) -> int:
        return self.db.one(f"SELECT COUNT(*) AS n FROM {self.table}")["n"]

    def remove(self, doc_id: str) -> None:
        with self.db.transaction() as db:
            db.execute(f"DELETE FROM {self.table} WHERE id = ?", (doc_id,))

    def replace_all(self, docs: list[dict]) -> None:
        """Store docs (newest first) - used by the import of the old data files."""
        with self.db.transaction() as db:
            db.execute(f"DELETE FROM {self.table}")
            for seq, doc in enumerate(reversed(docs), start=1):
                db.execute(f"INSERT OR REPLACE INTO {self.table} (id, seq, doc) VALUES (?, ?, ?)",
                           (doc["id"], seq, dumps(doc)))


class Repositories:
    """Every repository over one database (built once by the container)."""

    def __init__(self, db: Database):
        self.db = db
        self.profiles = ProfileRepository(db)
        self.accounts = AccountRepository(db)
        self.progress = DocumentRepository(db, "progress")
        self.submissions = SubmissionRepository(db)
        self.settings = SettingsRepository(db)
        self.kernels = KernelRepository(db)
        self.leaderboard = LeaderboardRepository(db)
        self.live_sets = OrderedDocuments(db, "live_sets")
        self.live_results = OrderedDocuments(db, "live_results")
        self.code_tasks = OrderedDocuments(db, "code_tasks")
