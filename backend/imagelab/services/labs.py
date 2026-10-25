"""Code Lab and experiments: access rules and progress around MATLAB runs.

MATLAB runs and grades the student's code (codelab/runStudentCode.m,
codeTasks.m) against the teacher's model solution and executes experiments
(runExperiment.m). Python keeps the teacher's tasks (code_tasks.py), decides
who may run what (drafts, locked tasks, model solutions only after solving)
and records submissions, XP and badges.
"""

from __future__ import annotations

from typing import Callable

from ..caller import Caller
from ..errors import invalid
from ..matlab import MatlabGateway
from ..utils import param
from .catalog import MatlabCatalog
from .classroom import ClassroomService
from .code_tasks import CodeTaskService, public
from .progress import ProgressService
from .records import SubmissionService


class CodeLabService:
    def __init__(self, matlab: MatlabGateway, tasks: CodeTaskService, progress: ProgressService,
                 submissions: SubmissionService, ipt: Callable[[], bool]):
        self.matlab, self.code_tasks = matlab, tasks
        self.progress, self.submissions = progress, submissions
        self.ipt = ipt

    def tasks(self, caller: Caller) -> dict:
        """The teacher's published tasks (the teacher also sees drafts) - never the model solutions."""
        tasks = self.code_tasks.all() if caller.is_teacher else self.code_tasks.published()
        return {"tasks": [{**public(t), "teacherNote": t["note"]} for t in tasks],
                "solved": self.progress.solved_code_tasks(caller.student_id), "ipt": self.ipt(),
                "teacher": caller.is_teacher}

    # ------------------------------------------------------------ teacher: writing tasks
    def edit(self, action: str, p: dict):
        """op codeTaskEdit (teacher only, rpc/access.py)."""
        tasks = self.code_tasks
        if action == "list":
            return tasks.all()
        if action == "templates":
            return tasks.templates()
        if action == "save":
            return {"task": tasks.save(param(p, "task", {})), "tasks": tasks.all()}
        if action == "setState":
            tasks.set_state(str(param(p, "id", "")), str(param(p, "status", "draft")),
                            str(param(p, "due", "")), str(param(p, "note", "")))
            return tasks.all()
        if action == "remove":
            task_id = str(param(p, "id", ""))
            tasks.remove(task_id)
            self.submissions.remove_task(task_id)
            return tasks.all()
        if action == "check":
            # Try the model solution before saving: its result on the task's input
            raw = param(p, "task", {})
            raw = dict(raw) if isinstance(raw, dict) else {}
            raw["title"] = raw.get("title") or "Untitled"            # not needed for the check
            raw["instructions"] = raw.get("instructions") or "-"
            task = tasks.validate(raw)
            return self.matlab.call("codeTaskCheck", {"task": tasks.matlab_task(task)})
        raise invalid(f'Unknown Code Lab task action "{action}".')

    # ------------------------------------------------------------ students
    def _task(self, caller: Caller, task_id: str) -> dict:
        return self.code_tasks.require(task_id, include_drafts=caller.is_teacher)

    def start(self, caller: Caller, task_id: str) -> dict:
        """The task's input image img."""
        task = self._task(caller, task_id)
        return self.matlab.call("codeTaskStart", {"task": self.code_tasks.matlab_task(task)})

    def solution(self, caller: Caller, task_id: str) -> dict:
        task = self._task(caller, task_id)
        if task_id not in self.progress.solved_code_tasks(caller.student_id) and not caller.is_teacher:
            raise invalid("Solve the task first - then the model solution is shown.")
        return {"code": task["solution"]}

    def run(self, caller: Caller, p: dict) -> dict:
        task_id = str(param(p, "taskId", ""))
        code = str(param(p, "code", ""))
        if not task_id:
            return self.matlab.call("runCode", {"code": code, "id": param(p, "id", "")})
        task = self._task(caller, task_id)
        if not caller.is_teacher:
            self.code_tasks.assert_runnable(task)
        data = self.matlab.call("runCode", {"code": code, "task": self.code_tasks.matlab_task(task)})
        data["newBadges"] = []
        student = caller.tracked_student                    # only signed-in students' runs are submissions
        if student is None:
            return data
        error = data.get("error")
        if error:
            self.submissions.record(student, task_id, code, None, error.get("message", ""))
            return data
        grade = data["grade"]
        self.submissions.record(student, task_id, code, grade)
        if grade["passed"]:
            data["newBadges"] = self.progress.code_task(caller.actor, student, task_id, task["title"])["newBadges"]
        return data


class ExperimentService:
    def __init__(self, matlab: MatlabGateway, catalog: MatlabCatalog, classroom: ClassroomService,
                 progress: ProgressService):
        self.matlab, self.catalog, self.classroom, self.progress = matlab, catalog, classroom, progress

    def list(self) -> list[dict]:
        states = {s["number"]: s for s in self.classroom.experiment_states()}
        return [{**e, "status": states[e["number"]]["status"], "due": states[e["number"]]["due"],
                 "teacherNote": states[e["number"]]["note"]} for e in self.catalog.experiments()]

    def run(self, caller: Caller, p: dict) -> dict:
        number = param(p, "number", 1)
        if not caller.is_teacher:                           # teachers may demo locked experiments
            self.classroom.assert_experiment_runnable(number)
        data = self.matlab.call("runExperiment", {"number": number, "id": param(p, "id", "")})
        self.progress.experiment(caller.actor, caller.tracked_student, number)
        return data
