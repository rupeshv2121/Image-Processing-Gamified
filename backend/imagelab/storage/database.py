"""SQLite database (data/imagelab.db): connections, schema, transactions.

One connection per thread (sqlite3 objects must not be shared between
threads). Write-ahead logging lets readers run while a writer commits.
Every read-modify-write goes through `transaction()`, which takes the
write lock at the start (BEGIN IMMEDIATE), so two requests for the same
student can never overwrite each other's progress.
"""

from __future__ import annotations

import json
import sqlite3
import threading
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Iterator

SCHEMA_VERSION = 1

SCHEMA = """
CREATE TABLE IF NOT EXISTS meta (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS profiles (
    seq     INTEGER PRIMARY KEY AUTOINCREMENT,
    id      TEXT NOT NULL UNIQUE,
    name    TEXT NOT NULL,
    roll    TEXT NOT NULL DEFAULT '',
    created TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS accounts (
    profile_id  TEXT PRIMARY KEY,
    salt        TEXT NOT NULL,
    hash        TEXT NOT NULL,
    iterations  INTEGER NOT NULL,
    must_change INTEGER NOT NULL DEFAULT 0,
    last_login  TEXT NOT NULL DEFAULT '',
    changed     TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS progress (
    profile_id TEXT PRIMARY KEY,
    doc        TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS submissions (
    profile_id TEXT NOT NULL,
    task_id    TEXT NOT NULL,
    doc        TEXT NOT NULL,
    PRIMARY KEY (profile_id, task_id)
);
CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS kernels (
    seq    INTEGER PRIMARY KEY AUTOINCREMENT,
    name   TEXT NOT NULL UNIQUE,
    matrix TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS leaderboard (
    seq         INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    roll        TEXT NOT NULL DEFAULT '',
    score       REAL NOT NULL,
    accuracy    REAL NOT NULL,
    best_streak REAL NOT NULL,
    mode        TEXT NOT NULL,
    date        TEXT NOT NULL
);
-- Saved live-quiz definitions and finished sessions: newest first (seq DESC)
CREATE TABLE IF NOT EXISTS live_sets (
    id  TEXT PRIMARY KEY,
    seq INTEGER NOT NULL,
    doc TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS live_results (
    id  TEXT PRIMARY KEY,
    seq INTEGER NOT NULL,
    doc TEXT NOT NULL
);
"""


def dumps(value: Any) -> str:
    return json.dumps(value, separators=(",", ":"), ensure_ascii=False)


def loads(text: str | None, default: Any = None) -> Any:
    if not text:
        return default
    try:
        return json.loads(text)
    except ValueError:
        return default                       # a damaged row never breaks a request


class Database:
    def __init__(self, path: Path | str):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._local = threading.local()
        self._all: list[sqlite3.Connection] = []
        self._all_lock = threading.Lock()
        self.conn.executescript(SCHEMA)               # executescript commits by itself
        with self.transaction() as db:
            db.execute("INSERT OR IGNORE INTO meta (key, value) VALUES ('schema', ?)", (str(SCHEMA_VERSION),))

    # ----------------------------------------------------------- connections
    @property
    def conn(self) -> sqlite3.Connection:
        conn = getattr(self._local, "conn", None)
        if conn is None:
            conn = sqlite3.connect(self.path, timeout=30, isolation_level=None, check_same_thread=False)
            conn.row_factory = sqlite3.Row
            conn.execute("PRAGMA journal_mode = WAL")
            conn.execute("PRAGMA synchronous = NORMAL")
            self._local.conn = conn
            with self._all_lock:
                self._all.append(conn)
        return conn

    def close(self) -> None:
        with self._all_lock:
            for conn in self._all:
                conn.close()
            self._all.clear()
        self._local = threading.local()

    # ----------------------------------------------------------- queries
    @contextmanager
    def transaction(self) -> Iterator[sqlite3.Connection]:
        """BEGIN IMMEDIATE ... COMMIT (ROLLBACK on error). Nested calls join the outer one."""
        conn = self.conn
        if conn.in_transaction:
            yield conn
            return
        conn.execute("BEGIN IMMEDIATE")
        try:
            yield conn
        except BaseException:
            conn.execute("ROLLBACK")
            raise
        conn.execute("COMMIT")

    def query(self, sql: str, args: tuple = ()) -> list[sqlite3.Row]:
        return self.conn.execute(sql, args).fetchall()

    def one(self, sql: str, args: tuple = ()) -> sqlite3.Row | None:
        return self.conn.execute(sql, args).fetchone()

    # ----------------------------------------------------------- meta
    def meta(self, key: str) -> str | None:
        row = self.one("SELECT value FROM meta WHERE key = ?", (key,))
        return row["value"] if row else None

    def set_meta(self, key: str, value: str) -> None:
        with self.transaction() as db:
            db.execute("INSERT INTO meta (key, value) VALUES (?, ?) "
                       "ON CONFLICT(key) DO UPDATE SET value = excluded.value", (key, value))
