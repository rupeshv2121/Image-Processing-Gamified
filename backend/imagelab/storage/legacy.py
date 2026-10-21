"""One-time import of the data the MATLAB version kept in .mat files.

data/profiles.mat, accounts.mat, userProgress.mat, progress_<id>.mat,
classroom.mat, kernels.mat, liveQuizSets.mat, liveQuizResults.mat,
data/codelab/<id>.mat and quizzes/leaderboard.mat (a MATLAB table) can
only be read reliably by MATLAB, so MATLAB converts them to JSON once
(migration/exportLegacyData.m) and this module stores them in SQLite.
The .mat files are left untouched; the database remembers the import
(meta 'legacyImported') and never repeats it.

MATLAB's jsonencode turns 1-element arrays into scalars or objects; every
list field is normalised with as_list.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

from ..matlab import MatlabGateway
from ..services.progress import normalise
from ..utils import as_list, now_text
from .repositories import Repositories

log = logging.getLogger("imagelab.legacy")
DONE = "legacyImported"
LIST_FIELDS = ("categoryStats", "topicsCompleted", "experimentsCompleted", "badges", "quizHistory",
               "dailyChallenges", "events")


def legacy_files(data_dir: Path, leaderboard: Path) -> list[Path]:
    found = sorted(data_dir.glob("*.mat")) + sorted((data_dir / "codelab").glob("*.mat"))
    return found + ([leaderboard] if leaderboard.is_file() else [])


def _progress(p: dict) -> dict:
    p = dict(p or {})
    for name in LIST_FIELDS:
        p[name] = as_list(p.get(name))
    acts = p.get("activities")
    p["activities"] = {k: as_list(v) for k, v in acts.items()} if isinstance(acts, dict) else {}
    return normalise(p)


def _matrix(m: dict) -> list[list[float]]:
    rows, cols, data = int(m["rows"]), int(m["cols"]), as_list(m["data"])
    return [[float(x) for x in data[r * cols:(r + 1) * cols]] for r in range(rows)]


class LegacyImporter:
    def __init__(self, repos: Repositories, matlab: MatlabGateway, data_dir: Path, leaderboard: Path):
        self.repos, self.matlab = repos, matlab
        self.data_dir, self.leaderboard = data_dir, leaderboard

    @property
    def pending(self) -> bool:
        return self.repos.db.meta(DONE) is None

    @property
    def needs_matlab(self) -> bool:
        """Old .mat files are waiting to be imported (only MATLAB can read them)."""
        return self.pending and bool(legacy_files(self.data_dir, self.leaderboard))

    def run(self) -> None:
        """Import once (needs MATLAB if there are .mat files). Safe to call on every start."""
        if not self.pending:
            return
        files = legacy_files(self.data_dir, self.leaderboard)
        if files:
            log.info("Importing %d MATLAB data file(s) into %s ...", len(files), self.repos.db.path.name)
            raw = self.matlab.call_function("exportLegacyData", str(self.data_dir), str(self.leaderboard))
            self.store(json.loads(raw))
        self.repos.db.set_meta(DONE, now_text())

    def store(self, d: dict) -> None:
        r = self.repos
        with r.db.transaction():
            known = {p["id"] for p in r.profiles.all()}
            for p in as_list(d.get("profiles")):
                entry = {"id": p["id"], "name": p["name"], "roll": p.get("roll") or "", "created": p.get("created") or ""}
                if entry["id"] in known:
                    r.profiles.update(entry["id"], entry["name"], entry["roll"])
                else:
                    r.profiles.add(entry)
            for pid, a in (d.get("accounts") or {}).items():
                if a.get("hash"):
                    r.accounts.put(pid, {"salt": a["salt"], "hash": a["hash"], "iterations": int(a["iterations"]),
                                         "mustChange": bool(a.get("mustChange")), "lastLogin": a.get("lastLogin") or "",
                                         "changed": a.get("changed") or ""})
            for pid, p in (d.get("progress") or {}).items():
                r.progress.put(pid, _progress(p))
            for pid, subs in (d.get("submissions") or {}).items():
                for task, e in (subs or {}).items():
                    r.submissions.put(pid, task, e)
            s = d.get("classroom")
            if isinstance(s, dict):
                state = lambda e: {"status": e.get("status") or "open", "due": e.get("due") or "",  # noqa: E731
                                   "note": e.get("note") or ""}
                r.settings.put("classroom", {
                    "pinHash": s.get("pinHash") or "", "salt": s.get("salt") or "",
                    "selfRegister": bool(s.get("selfRegister", True)),
                    "experiments": {str(int(e["number"])): state(e) for e in as_list(s.get("experiments"))},
                    "codeTasks": {e["id"]: state(e) for e in as_list(s.get("codeTasks"))}})
            for k in as_list(d.get("kernels")):
                r.kernels.save(k["name"], _matrix(k["kernel"]))
            for e in as_list(d.get("leaderboard")):
                r.leaderboard.add({"Name": e["Name"], "Roll": e.get("Roll") or "", "Score": e["Score"],
                                   "Accuracy": e["Accuracy"], "BestStreak": e["BestStreak"], "Mode": e["Mode"],
                                   "Date": e["Date"]})
            r.live_sets.replace_all([self._live_set(x) for x in as_list(d.get("liveQuizSets"))])
            r.live_results.replace_all([self._live_result(x) for x in as_list(d.get("liveQuizResults"))])

    @staticmethod
    def _live_set(s: dict) -> dict:
        items = [{**q, "options": as_list(q.get("options"))} for q in as_list(s.get("questions"))]
        return {**s, "questions": items}

    @staticmethod
    def _live_result(r: dict) -> dict:
        board = [{**b, "choices": as_list(b.get("choices")), "times": as_list(b.get("times")),
                  "points": as_list(b.get("points"))} for b in as_list(r.get("leaderboard"))]
        questions = [{**q, "options": as_list(q.get("options")), "counts": as_list(q.get("counts"))}
                     for q in as_list(r.get("questions"))]
        return {**r, "leaderboard": board, "questions": questions}
