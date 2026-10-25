"""Code Lab tasks written by the teacher.

Students only see the tasks the teacher has prepared and published - there
are no ready-made tasks in the class. A task is

    title, level, topic, instructions, starter code, hints, forbidden functions
    input: a sample image and how it is prepared (gray / color / salt & pepper / binary)
    model solution: MATLAB code that stores the expected result in `out`
    check: how out is compared with the model solution's out (image / normalized /
           binary / vector) and the tolerance; border = edge pixels ignored
    status: draft (students do not see it) | open | assigned (due date, note) | locked

MATLAB runs the model solution on the input to get the expected result and
grades the student's out against it (codelab/codeTasks.m). The built-in
examples of codeTasks.m are only templates the teacher can start from.
"""

from __future__ import annotations

import re
import secrets
from typing import Any

from ..errors import AppError, invalid
from ..storage.repositories import OrderedDocuments
from ..utils import DATE_PATTERN, as_text_list, clean_text, now_text, to_float
from .catalog import MatlabCatalog

STATUSES = ("draft", "open", "assigned", "locked")
PUBLISHED = ("open", "assigned", "locked")
LEVELS = ("Easy", "Medium", "Hard")
PREPS = ("gray", "color", "saltpepper", "binary")
COMPARES = ("image", "normalized", "binary", "vector")
MAX_TASKS = 200
MAX_CODE = 20_000
FUNCTION_NAME = re.compile(r"^[A-Za-z]\w{0,62}$")
TASK_ID = re.compile(r"^[a-z0-9]{1,16}$")
# Fields only the teacher sees
PRIVATE = ("solution",)


def _lines(value: Any, max_items: int, max_len: int) -> list[str]:
    """A list of non-empty lines from a list or one text (one item per line)."""
    items = value.split("\n") if isinstance(value, str) else as_text_list(value)
    out = [clean_text(x, max_len) for x in items]
    return [x for x in out if x][:max_items]


def public(task: dict) -> dict:
    return {k: v for k, v in task.items() if k not in PRIVATE}


class CodeTaskService:
    def __init__(self, repo: OrderedDocuments, catalog: MatlabCatalog):
        self.repo = repo
        self.catalog = catalog

    # ------------------------------------------------------------ reading
    def all(self) -> list[dict]:
        """Every task, in the order the teacher created them."""
        return list(reversed(self.repo.all()))

    def published(self) -> list[dict]:
        return [t for t in self.all() if t["status"] in PUBLISHED]

    def get(self, task_id: str) -> dict | None:
        return self.repo.get(task_id) if isinstance(task_id, str) and TASK_ID.match(task_id) else None

    def require(self, task_id: str, include_drafts: bool = False) -> dict:
        task = self.get(task_id)
        if task is None or (task["status"] == "draft" and not include_drafts):
            raise invalid("This Code Lab task does not exist (any more).")
        return task

    def states(self) -> list[dict]:
        """Published tasks with their assignment state (class views)."""
        return [{"id": t["id"], "title": t["title"], "status": t["status"], "due": t["due"], "note": t["note"]}
                for t in self.published()]

    def templates(self) -> list[dict]:
        return self.catalog.code_task_templates()

    @staticmethod
    def matlab_task(task: dict) -> dict:
        """What MATLAB needs to prepare the input and grade (codeLabOps.m)."""
        return {k: task[k] for k in ("sample", "prep", "compare", "tol", "border", "forbidden", "solution")}

    # ------------------------------------------------------------ writing
    def save(self, raw: Any) -> dict:
        raw = raw if isinstance(raw, dict) else {}
        old = self.get(str(raw.get("id") or ""))
        if old is None and self.repo.count() >= MAX_TASKS:
            raise invalid(f"At most {MAX_TASKS} Code Lab tasks are supported - delete old ones first.")
        task = self.validate(raw)
        task["id"] = old["id"] if old else "t" + secrets.token_hex(5)
        task["created"] = old["created"] if old else now_text()
        task["updated"] = now_text()
        self.repo.save(task)
        return task

    def validate(self, raw: dict) -> dict:
        title = clean_text(raw.get("title"), 80)
        if not title:
            raise invalid("Give the task a title.")
        instructions = _lines(raw.get("instructions"), 30, 600)
        if not instructions:
            raise invalid("Write the instructions for the students.")
        solution = self._code(raw.get("solution"), "model solution")
        if not solution.strip():
            raise invalid("Write the model solution: MATLAB code that stores the expected result in out.")
        sample = str(raw.get("sample") or "")
        if sample not in self.catalog.sample_names():
            raise invalid("Choose one of the sample images as the task's input.")
        compare = self._choice(raw.get("compare"), COMPARES, "image")
        tol = to_float(raw.get("tol"), -1)
        tol_max = 1e6 if compare == "vector" else 1
        if not 0 <= tol <= tol_max:
            raise invalid(f"The tolerance must be between 0 and {tol_max:g}.")
        border = to_float(raw.get("border"), 0)
        if border != int(border) or not 0 <= border <= 10:
            raise invalid("The ignored border must be 0 to 10 pixels.")
        forbidden = _lines(raw.get("forbidden"), 30, 63) if not isinstance(raw.get("forbidden"), str) \
            else [x for x in re.split(r"[\s,;]+", raw["forbidden"]) if x][:30]
        bad = [f for f in forbidden if not FUNCTION_NAME.match(f)]
        if bad:
            raise invalid(f'"{bad[0]}" is not a MATLAB function name.')
        status = self._choice(raw.get("status"), STATUSES, "draft")
        due = str(raw.get("due") or "")
        if due and not DATE_PATTERN.match(due):
            raise invalid("The due date must look like 2026-10-31.")
        return {"title": title, "level": self._choice(raw.get("level"), LEVELS, "Easy"),
                "topic": clean_text(raw.get("topic"), 60), "instructions": instructions,
                "starter": self._code(raw.get("starter"), "starter code"), "solution": solution,
                "hints": _lines(raw.get("hints"), 10, 300), "forbidden": forbidden,
                "sample": sample, "prep": self._choice(raw.get("prep"), PREPS, "gray"),
                "compare": compare, "tol": tol, "border": int(border), "status": status,
                "due": due if status == "assigned" else "", "note": clean_text(raw.get("note"), 120)}

    def set_state(self, task_id: str, status: str, due: str = "", note: str = "") -> dict:
        task = self.require(task_id, include_drafts=True)
        status = (status or "").lower()
        if status not in STATUSES:
            raise invalid("Status must be draft, open, assigned or locked.")
        due = due or ""
        if due and not DATE_PATTERN.match(due):
            raise invalid("The due date must look like 2026-10-31.")
        task.update(status=status, due=due if status == "assigned" else "", note=clean_text(note, 120),
                    updated=now_text())
        self.repo.save(task)
        return task

    def remove(self, task_id: str) -> None:
        self.repo.remove(task_id)

    # ------------------------------------------------------------ rules
    def assert_runnable(self, task: dict) -> None:
        if task["status"] == "locked":
            raise AppError(f'The task "{task["title"]}" is locked by your teacher. Ask your teacher to unlock it.',
                           "ImageLab:taskLocked")

    @staticmethod
    def _code(value: Any, what: str) -> str:
        text = value if isinstance(value, str) else ""
        text = re.sub(r"\r\n?", "\n", text)
        if len(text) > MAX_CODE:
            raise invalid(f"The {what} is too long (max {MAX_CODE:,} characters).")
        return text

    @staticmethod
    def _choice(value: Any, allowed: tuple, default: str) -> str:
        text = str(value or default)
        match = next((a for a in allowed if a.lower() == text.lower()), None)
        if match is None:
            raise invalid(f'"{text}" must be one of: {", ".join(allowed)}.')
        return match
