"""Who may call what.

Image operations stay open: the landing-page demo runs them before anybody
signs in. Teacher-only and sign-in-only operations are listed here, in one
place, instead of being checked inside every handler.
"""

from __future__ import annotations

from ..caller import Caller
from ..errors import forbidden, session_ended
from ..utils import param

# op -> actions everybody may use (any other action is for the teacher)
TEACHER_UNLESS = {
    "classroom": ("", "get"),
    "profiles": ("", "list"),
    "leaderboard": ("", "get", "add"),
    "live": ("", "join", "state", "answer", "leave"),
    "codeTaskEdit": (),
}
SIGNED_IN = {"profiles", "progress", "codeTaskSolution", "quizSubmit", "report", "runExperiment", "live"}

# Classroom network mode: a device other than the Spatia computer (a student's
# phone or laptop). Before signing in it may only ping and sign in; a signed-in
# STUDENT may then use the student side of the app (labs, quizzes, experiments,
# reports, live quiz) - except the Code Lab, which runs arbitrary MATLAB code on
# the Spatia computer (runStudentCode.m is not a security sandbox).
REMOTE_ANONYMOUS = {"ping", "auth"}
REMOTE_FORBIDDEN = {"runCode", "codeWarmup", "codeTaskStart", "codeTaskSolution", "codeTaskEdit"}
REMOTE_AUTH = {"options", "login", "register", "logout", "me", "changePassword"}
REMOTE_MESSAGE = ("Sign in with your student account first. The Code Lab and teacher mode "
                  "only work on the Spatia computer itself.")


def check(op: str, params: dict, caller: Caller) -> None:
    action = str(param(params, "action", ""))
    teacher_only = op in TEACHER_UNLESS and action not in TEACHER_UNLESS[op]
    signed_in = op in SIGNED_IN or (op == "leaderboard" and action == "add")
    if teacher_only and not caller.is_teacher:
        if caller.session is None:
            raise session_ended()
        raise forbidden()
    if signed_in and caller.session is None:
        raise session_ended()


def remote_allowed(op: object, params: dict, caller: Caller | None) -> bool:
    """Students' own devices: sign-in, then the student side of the app without the Code Lab."""
    if op == "auth":
        return str(param(params, "action", "me")) in REMOTE_AUTH
    if op in REMOTE_ANONYMOUS:
        return True
    student = caller is not None and caller.session is not None and not caller.is_teacher
    return student and op not in REMOTE_FORBIDDEN
