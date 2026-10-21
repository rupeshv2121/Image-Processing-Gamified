"""Small record stores: quiz leaderboard, kernel library, Code Lab submissions."""

from __future__ import annotations

from ..errors import invalid
from ..storage.repositories import KernelRepository, LeaderboardRepository, SubmissionRepository
from ..utils import mat, now_text, to_float, to_matrix

MAX_KERNEL_SIZE = 31


# ----------------------------------------------------------------- leaderboard
class LeaderboardService:
    """Ranked by score, then accuracy (ties keep the order they were added)."""

    def __init__(self, repo: LeaderboardRepository):
        self.repo = repo

    def get(self) -> list[dict]:
        board = sorted(self.repo.all(), key=lambda e: (-e["Score"], -e["Accuracy"]))
        return [{**e, "Rank": rank} for rank, e in enumerate(board, start=1)]

    def add(self, entry: dict) -> list[dict]:
        name = str(entry.get("name") or "").strip()
        if not name:
            raise invalid("Please enter your name for the leaderboard.")
        self.repo.add({"Name": name, "Roll": str(entry.get("roll") or "").strip(),
                       "Score": to_float(entry.get("score")), "Accuracy": to_float(entry.get("accuracy")),
                       "BestStreak": to_float(entry.get("bestStreak")), "Mode": str(entry.get("mode") or "Rapid Fire"),
                       "Date": now_text()})
        return self.get()

    def clear(self) -> list[dict]:
        self.repo.clear()
        return []


# ----------------------------------------------------------------- kernels
def validate_kernel(value) -> list[list[float]]:
    """A real, finite, non-empty matrix with odd dimensions of at most 31 (see core/validateKernel.m)."""
    try:
        k = to_matrix(value)
    except (TypeError, ValueError):
        k = []
    finite = all(x == x and abs(x) != float("inf") for row in k for x in row)
    if not k or not k[0] or not finite or any(len(row) != len(k[0]) for row in k):
        raise invalid("The kernel must be a non-empty matrix of finite real numbers.")
    rows, cols = len(k), len(k[0])
    if rows % 2 == 0 or cols % 2 == 0 or rows > MAX_KERNEL_SIZE or cols > MAX_KERNEL_SIZE:
        raise invalid(f"Kernel dimensions must be odd and at most {MAX_KERNEL_SIZE} (got {rows}x{cols}).")
    return k


class KernelLibrary:
    def __init__(self, repo: KernelRepository):
        self.repo = repo

    def list(self) -> list[dict]:
        return [{"name": e["name"], "kernel": mat(e["kernel"])} for e in self.repo.all()]

    def save(self, name: str, kernel) -> list[dict]:
        matrix = validate_kernel(kernel)
        if not (name or "").strip():
            raise invalid("Please give the kernel a name.")
        self.repo.save(name, matrix)
        return self.list()


# ----------------------------------------------------------------- submissions
def empty_submission() -> dict:
    return {"attempts": 0, "passed": False, "bestMatch": 0, "lastMatch": 0, "lastRun": "", "firstSolved": "",
            "attemptsToSolve": 0, "lastCode": "", "passedCode": "", "lastError": ""}


def without_code(entry: dict) -> dict:
    return {k: v for k, v in entry.items() if k not in ("lastCode", "passedCode")}


class SubmissionService:
    """Students' Code Lab runs. Only the latest and the latest PASSING code are kept."""

    def __init__(self, repo: SubmissionRepository):
        self.repo = repo

    def record(self, profile_id: str, task_id: str, code: str, grade: dict | None, error_text: str = "") -> dict:
        def change(old: dict | None) -> dict:
            e = {**empty_submission(), **(old or {})}
            now = now_text()
            e["attempts"] += 1
            e["lastRun"] = now
            e["lastCode"] = code
            if grade is None:                              # the code stopped with an error
                e["lastMatch"], e["lastError"] = 0, error_text
            else:
                e["lastMatch"], e["lastError"] = grade["match"], ""
                e["bestMatch"] = max(e["bestMatch"], grade["match"])
                if grade["passed"]:
                    if not e["passed"]:
                        e["firstSolved"], e["attemptsToSolve"] = now, e["attempts"]
                    e["passed"], e["passedCode"] = True, code
            return e

        self.repo.update(profile_id, task_id, change)
        return self.summary(profile_id)

    def summary(self, profile_id: str) -> dict[str, dict]:
        """Per task: attempts, passed, matches and times - no code (small enough for a whole class)."""
        return {task: without_code({**empty_submission(), **e}) for task, e in self.repo.of(profile_id).items()}

    def summaries(self) -> dict[str, dict[str, dict]]:
        return {pid: {task: without_code({**empty_submission(), **e}) for task, e in subs.items()}
                for pid, subs in self.repo.all().items()}

    def get(self, profile_id: str, task_id: str) -> dict:
        return {**empty_submission(), **self.repo.of(profile_id).get(task_id, {})}

    def remove(self, profile_id: str) -> None:
        self.repo.remove_profile(profile_id)
