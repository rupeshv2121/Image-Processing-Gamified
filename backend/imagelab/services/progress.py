"""Learning progress, XP and badges (one document per student).

XP:  +10 for each new thing tried, +20 per Learn topic, +50 per experiment,
     quiz score / 10, +50 for the first solve of each daily challenge,
     +40 for the first solve of each Code Lab task, +100 per badge.
     Level = floor(sqrt(XP / 100)) + 1.

Only signed-in students have progress. For the teacher and guests every
call returns an empty summary and nothing is stored.
`events` keeps the last 30 notable events for the teacher's activity feed.
"""

from __future__ import annotations

import copy
import math
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Callable

from ..storage.repositories import DocumentRepository
from ..utils import matlab_round, now_text, today_text


def default_progress() -> dict:
    return {
        "xp": 0, "quizzesTaken": 0, "questionsAnswered": 0, "questionsCorrect": 0,
        "bestStreak": 0, "perfectQuizzes": 0, "categoryStats": [], "activities": {},
        "topicsCompleted": [], "experimentsCompleted": [], "badges": [], "quizHistory": [],
        "dailyChallenges": [], "events": [], "lastActive": "",
    }


# Badges that were renamed: old id -> (new id, old name, new name)
RENAMED_BADGES = {"morphologist": ("region_describer", "Morphologist", "Region Describer")}


def normalise(doc: dict | None) -> dict:
    """Stored progress with defaults for fields added later, and renamed badges updated."""
    p = default_progress()
    if isinstance(doc, dict):
        p.update(doc)
    for b in p["badges"]:
        if isinstance(b, dict) and b.get("id") in RENAMED_BADGES:
            new_id, old_name, new_name = RENAMED_BADGES[b["id"]]
            b["id"] = new_id
            for e in p["events"]:
                if isinstance(e, dict) and isinstance(e.get("text"), str):
                    e["text"] = e["text"].replace(f'"{old_name}"', f'"{new_name}"')
    return p


@dataclass(frozen=True)
class Badge:
    id: str
    name: str
    description: str
    earned: Callable[[dict], bool]


def _count(p: dict, area: str) -> int:
    return len(p["activities"].get(area, []))


def _has(p: dict, area: str, item: str) -> bool:
    return item in p["activities"].get(area, [])


BADGES: tuple[Badge, ...] = (
    Badge("filter_master", "Filter Master", "Test 6 different spatial filters", lambda p: _count(p, "filters") >= 6),
    Badge("noise_fighter", "Noise Fighter", "Try 3 noise models and undo a blur in the Restoration Lab",
          lambda p: _count(p, "noise") >= 3 and _count(p, "deblur") >= 1),
    Badge("histogram_hero", "Histogram Hero", "Use 4 histogram processing methods", lambda p: _count(p, "histogram") >= 4),
    Badge("convolution_expert", "Convolution Expert",
          "Step through correlation AND convolution and use the kernel playground",
          lambda p: all(_has(p, "tools", t) for t in ("correlation", "convolution", "kernelPlayground"))),
    Badge("edge_detective", "Edge Detective", "Compare 4 edge detectors", lambda p: _count(p, "edges") >= 4),
    Badge("segmentation_pro", "Segmentation Pro", "Use 4 segmentation methods", lambda p: _count(p, "segmentation") >= 4),
    Badge("colour_artist", "Colour Artist", "Explore 3 colour models", lambda p: _count(p, "color") >= 3),
    Badge("perfect_quiz", "Perfect Quiz", "Answer 10/10 in a quiz", lambda p: p["perfectQuizzes"] >= 1),
    Badge("streak_master", "Streak Master", "Reach a streak of 5 correct answers", lambda p: p["bestStreak"] >= 5),
    Badge("experimenter", "Experimenter", "Complete 5 experiments", lambda p: len(p["experimentsCompleted"]) >= 5),
    Badge("scholar", "Scholar", "Complete 8 Learn topics", lambda p: len(p["topicsCompleted"]) >= 8),
    Badge("quiz_regular", "Quiz Regular", "Finish 5 quizzes", lambda p: p["quizzesTaken"] >= 5),
    Badge("region_describer", "Region Describer", "Describe a region's shape: signature, skeleton and moments",
          lambda p: _has(p, "descriptors", "region")),
    Badge("shape_analyst", "Shape Analyst", "Read a chain code and link edges with the Hough transform",
          lambda p: _count(p, "regions") >= 1 and _has(p, "edgelink", "hough")),
    Badge("restorer", "Restorer", "Restore noise with both adaptive filters",
          lambda p: _has(p, "filters", "adaptivemedian") and _has(p, "filters", "adaptivelocal")),
    Badge("daily_devotee", "Daily Devotee", "Solve the daily challenge 3 days in a row", lambda p: daily_streak(p) >= 3),
    Badge("matlab_coder", "MATLAB Coder", "Solve 5 Code Lab programming tasks", lambda p: _count(p, "codelab") >= 5),
)


# ----------------------------------------------------------------- derived values
def level(xp: float) -> int:
    return math.floor(math.sqrt(xp / 100)) + 1


def accuracy(p: dict) -> float:
    return 100 * p["questionsCorrect"] / max(p["questionsAnswered"], 1)


def best_score(p: dict) -> float:
    return max([h["score"] for h in p["quizHistory"]] + [0])


def daily_streak(p: dict, today: date | None = None) -> int:
    """Consecutive solved days ending today (or yesterday, if today is not solved yet)."""
    solved = {d["date"] for d in p["dailyChallenges"] if d.get("solved")}
    if not solved:
        return 0
    day = today or date.today()
    if day.isoformat() not in solved:
        day -= timedelta(days=1)
    n = 0
    while day.isoformat() in solved:
        n += 1
        day -= timedelta(days=1)
    return n


def peek(p: dict) -> dict:
    """Compact read-only summary used for class views."""
    return {"xp": p["xp"], "level": level(p["xp"]), "badgeCount": len(p["badges"]),
            "quizzesTaken": p["quizzesTaken"], "accuracy": accuracy(p), "bestScore": best_score(p),
            "dailyStreak": daily_streak(p), "codeTasks": _count(p, "codelab"), "lastActive": p["lastActive"]}


def summarise(p: dict, new_badges: list[str], profile_id: str) -> dict:
    have = {b["id"] for b in p["badges"]}
    weak, strong = [], []
    for c in p["categoryStats"]:
        if c["answered"] >= 2:
            acc = c["correct"] / c["answered"]
            if acc < 0.6:
                weak.append(c["name"])
            if acc >= 0.8:
                strong.append(c["name"])
    tested = sum(len(v) for k, v in p["activities"].items() if k in ("filters", "edges", "histogram", "sharpening"))
    return {
        "xp": p["xp"], "level": level(p["xp"]), "quizzesTaken": p["quizzesTaken"],
        "questionsAnswered": p["questionsAnswered"], "questionsCorrect": p["questionsCorrect"],
        "accuracy": accuracy(p), "bestStreak": p["bestStreak"], "bestScore": best_score(p),
        "filtersTested": tested, "topicsCompleted": list(p["topicsCompleted"]),
        "experimentsCompleted": list(p["experimentsCompleted"]), "activities": p["activities"],
        "categoryStats": list(p["categoryStats"]), "weakTopics": weak, "strongTopics": strong,
        "badges": [{"id": b.id, "name": b.name, "description": b.description, "earned": b.id in have} for b in BADGES],
        "newBadges": new_badges, "quizHistory": list(p["quizHistory"]), "dailyStreak": daily_streak(p),
        "dailyHistory": p["dailyChallenges"][-14:], "profileId": profile_id,
    }


def add_event(p: dict, kind: str, text: str) -> None:
    p["events"] = (p["events"] + [{"time": now_text(), "type": kind, "text": text}])[-30:]


def award_badges(p: dict) -> list[str]:
    have = {b["id"] for b in p["badges"]}
    new = []
    for badge in BADGES:
        if badge.id not in have and badge.earned(p):
            p["badges"].append({"id": badge.id, "earned": today_text()})
            p["xp"] += 100
            new.append(badge.name)
            add_event(p, "badge", f'Earned the badge "{badge.name}"')
    return new


# ----------------------------------------------------------------- service
class ProgressService:
    def __init__(self, repo: DocumentRepository):
        self.repo = repo

    # ------------------------------------------------------------ reading
    def load(self, profile_id: str) -> dict:
        return normalise(self.repo.get(profile_id))

    def load_all(self) -> dict[str, dict]:
        return {k: normalise(v) for k, v in self.repo.all().items()}

    def summary(self, actor: str, student_id: str | None) -> dict:
        """The 'get' summary of the caller (empty for the teacher and guests)."""
        if student_id is None:
            return summarise(default_progress(), [], actor)
        return summarise(self.load(student_id), [], student_id)

    def summary_of(self, profile_id: str) -> dict:
        return summarise(self.load(profile_id), [], profile_id)

    def remove(self, profile_id: str) -> None:
        self.repo.remove(profile_id)

    # ------------------------------------------------------------ writing
    def _change(self, actor: str, student_id: str | None, mutate: Callable[[dict], None], reset: bool = False) -> dict:
        if student_id is None:                            # teacher / guest: nothing is stored
            return summarise(default_progress(), [], actor)

        def change(doc):
            before = normalise(doc)
            p = default_progress() if reset else copy.deepcopy(before)
            mutate(p)
            new = award_badges(p)
            changed = p != before
            if changed and not reset:
                p["lastActive"] = now_text()
            return p, summarise(p, new, student_id), changed

        return self.repo.update(student_id, change)

    def activity(self, actor: str, student_id: str | None, area: str, item: str) -> dict:
        return self.activities(actor, student_id, [(area, item)])

    def activities(self, actor: str, student_id: str | None, done: list[tuple[str, str]]) -> dict:
        """Record things tried (+10 XP each new one) in one write."""
        def mutate(p):
            for area, item in done:
                items = p["activities"].setdefault(area, [])
                if item not in items:
                    items.append(item)
                    p["xp"] += 10
        return self._change(actor, student_id, mutate)

    def topic(self, actor: str, student_id: str | None, topic: str) -> dict:
        def mutate(p):
            if topic not in p["topicsCompleted"]:
                p["topicsCompleted"].append(topic)
                p["xp"] += 20
                add_event(p, "topic", f'Read "{topic}"')
        return self._change(actor, student_id, mutate)

    def experiment(self, actor: str, student_id: str | None, number: float) -> dict:
        n = int(number) if float(number).is_integer() else number
        def mutate(p):
            if n not in p["experimentsCompleted"]:
                p["experimentsCompleted"].append(n)
                p["xp"] += 50
                add_event(p, "experiment", f"Completed experiment {n}")
        return self._change(actor, student_id, mutate)

    def quiz(self, actor: str, student_id: str | None, summary: dict, results: list[dict]) -> dict:
        mode = summary.get("mode") or "Rapid Fire"

        def mutate(p):
            p["quizzesTaken"] += 1
            p["questionsAnswered"] += summary["total"]
            p["questionsCorrect"] += summary["correct"]
            p["bestStreak"] = max(p["bestStreak"], summary["bestStreak"])
            p["xp"] += matlab_round(summary["score"] / 10)
            if summary["total"] >= 10 and summary["correct"] == summary["total"]:
                p["perfectQuizzes"] += 1
            stats = {c["name"]: c for c in p["categoryStats"]}
            for r in results:
                name = str(r.get("category", ""))
                if name not in stats:
                    stats[name] = {"name": name, "answered": 0, "correct": 0}
                    p["categoryStats"].append(stats[name])
                stats[name]["answered"] += 1
                stats[name]["correct"] += int(bool(r.get("correct")))
            p["quizHistory"].append({"date": now_text(), "score": summary["score"],
                                     "accuracy": summary["accuracy"], "mode": mode})
            add_event(p, "quiz", f'{mode} quiz: {summary["correct"]}/{summary["total"]} correct '
                                 f'({matlab_round(summary["score"])} points)')
        return self._change(actor, student_id, mutate)

    def daily(self, actor: str, student_id: str | None, day: str, points: float, solved: bool) -> dict:
        def mutate(p):
            entry = next((d for d in p["dailyChallenges"] if d["date"] == day), None)
            if entry is None:
                entry = {"date": day, "points": 0, "solved": False, "attempts": 0}
                p["dailyChallenges"].append(entry)
            if solved and not entry["solved"]:                     # XP only for the first solve
                p["xp"] += 50
                add_event(p, "daily", f"Solved the daily challenge of {day}")
            entry["solved"] = entry["solved"] or solved
            entry["points"] = max(entry["points"], points)
            entry["attempts"] += 1
        return self._change(actor, student_id, mutate)

    def code_task(self, actor: str, student_id: str | None, task_id: str, title: str) -> dict:
        def mutate(p):
            solved = p["activities"].setdefault("codelab", [])
            if task_id not in solved:
                solved.append(task_id)
                p["xp"] += 40
                add_event(p, "code", f'Solved the Code Lab task "{title}"')
        return self._change(actor, student_id, mutate)

    def reset(self, actor: str, student_id: str | None) -> dict:
        return self._change(actor, student_id, lambda p: None, reset=True)

    # ------------------------------------------------------------ helpers
    def solved_code_tasks(self, student_id: str | None) -> list[str]:
        if student_id is None:
            return []
        return list(self.load(student_id)["activities"].get("codelab", []))
