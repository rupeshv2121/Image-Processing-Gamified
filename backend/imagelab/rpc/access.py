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
}
SIGNED_IN = {"profiles", "progress", "codeTaskSolution", "quizSubmit", "report", "runExperiment", "live"}

# What a device other than the ImageLab computer may do (classroom network mode)
REMOTE_OPS = {"ping", "auth", "live"}
REMOTE_AUTH = {"options", "login", "register", "logout", "me", "changePassword"}


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


def remote_allowed(op: object, params: dict) -> bool:
    """Students' own devices: sign-in and the live quiz only (Code Lab runs MATLAB code)."""
    if op not in REMOTE_OPS:
        return False
    return op != "auth" or str(param(params, "action", "me")) in REMOTE_AUTH
