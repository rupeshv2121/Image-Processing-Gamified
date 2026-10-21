"""Code Lab and experiments: access rules and progress around MATLAB runs.

MATLAB runs and grades the student's code (codelab/runStudentCode.m,
codeTasks.m) and executes experiments (runExperiment.m). Python decides
who may run what (locked assignments, model solutions only after solving)
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
from .progress import ProgressService
from .records import SubmissionService


class CodeLabService:
    def __init__(self, matlab: MatlabGateway, catalog: MatlabCatalog, classroom: ClassroomService,
                 progress: ProgressService, submissions: SubmissionService, ipt: Callable[[], bool]):
        self.matlab, self.catalog, self.classroom = matlab, catalog, classroom
        self.progress, self.submissions = progress, submissions
        self.ipt = ipt

    def tasks(self, caller: Caller) -> dict:
        """Tasks with the teacher's open / assigned / locked state, due date and note."""
        states = {s["id"]: s for s in self.classroom.code_task_states()}
        tasks = [{**t, "status": states[t["id"]]["status"], "due": states[t["id"]]["due"],
                  "teacherNote": states[t["id"]]["note"]} for t in self.catalog.code_tasks()]
        return {"tasks": tasks, "solved": self.progress.solved_code_tasks(caller.student_id), "ipt": self.ipt(),
                "teacher": caller.is_teacher}

    def solution(self, caller: Caller, task_id: str) -> dict:
        if task_id not in self.progress.solved_code_tasks(caller.student_id) and not caller.is_teacher:
            raise invalid("Solve the task first - then the model solution is shown.")
        return self.matlab.call("codeTaskSolution", {"taskId": task_id})

    def run(self, caller: Caller, p: dict) -> dict:
        task_id = str(param(p, "taskId", ""))
        code = str(param(p, "code", ""))
        if not task_id:
            return self.matlab.call("runCode", {"code": code, "id": param(p, "id", "")})
        task = self.catalog.code_task(task_id)
        if not caller.is_teacher:
            self.classroom.assert_code_runnable(task_id, task["title"])
        data = self.matlab.call("runCode", {"code": code, "taskId": task_id})
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
