"""Sign-in, profiles, progress and the classroom (no MATLAB involved)."""

from __future__ import annotations

from ...errors import invalid, session_ended
from ...utils import is_true, param
from ..registry import Call, Registry


def register(r: Registry) -> None:
    @r.op("auth")
    def auth(call: Call):
        p, a, s = call.params, call.app.auth, call.caller.session
        action = str(param(p, "action", "me"))
        if action == "options":                      # public: what the sign-in page may offer
            return call.app.classroom.options()
        if action == "login":
            return a.login(str(param(p, "identifier", "")), str(param(p, "password", "")), is_true(p.get("claim")))
        if action == "register":
            return a.register(str(param(p, "name", "")), str(param(p, "roll", "")), str(param(p, "password", "")))
        if action == "teacherLogin":
            return a.teacher_login(str(param(p, "pin", "")))
        if action == "logout":
            return a.logout(call.token)
        if action == "me":
            if s is None:
                raise session_ended()
            return {"role": s.role, "profileId": s.profile_id, "name": s.name}
        if action == "changePassword":
            if s is None or s.role != "student":
                raise session_ended("Please sign in as a student to change your password.")
            return a.change_password(s.profile_id, str(param(p, "oldPassword", "")), str(param(p, "newPassword", "")))
        raise invalid(f'Unknown sign-in action "{action}".')

    @r.op("profiles")
    def profiles(call: Call):
        """Everything except 'list' is for the teacher (rpc/access.py)."""
        p, svc = call.params, call.app.profiles
        action = str(param(p, "action", "list"))
        pid = str(param(p, "id", ""))
        if action == "add":
            # New students get a password right away: the teacher's or a generated one
            students = svc.add(str(param(p, "name", "")), str(param(p, "roll", "")))
            new_id = students[-1]["id"]
            password = call.app.auth.reset_password(new_id, str(param(p, "password", "")))["password"]
            return {"students": students, "id": new_id, "password": password}
        if action == "resetPassword":
            return call.app.auth.reset_password(pid, str(param(p, "password", "")))
        if action == "accounts":
            return call.app.auth.status()
        if action == "update":
            return svc.update(pid, str(param(p, "name", "")), str(param(p, "roll", "")))
        if action == "remove":
            return svc.remove(pid)
        return svc.list()

    @r.op("progress")
    def progress(call: Call):
        p, svc, c = call.params, call.app.progress, call.caller
        action = str(param(p, "action", "get"))
        if action == "topic":
            return svc.topic(c.actor, c.student_id, str(param(p, "value", "")))
        if action == "experiment":
            return svc.experiment(c.actor, c.student_id, param(p, "value", 0))
        if action == "reset":
            return svc.reset(c.actor, c.student_id)
        return svc.summary(c.actor, c.student_id)

    @r.op("classroom")
    def classroom(call: Call):
        """Teacher views; everything except 'get' needs a teacher session (rpc/access.py)."""
        p, room, stats = call.params, call.app.classroom, call.app.analytics
        action = str(param(p, "action", "get"))
        actions = {
            "get": lambda: room.public_view(),
            "setSelfRegister": lambda: room.set_self_register(param(p, "value", True) is True),
            "report": stats.report,
            "overview": stats.overview,
            "submissions": stats.submissions_matrix,
            "student": lambda: stats.student(str(param(p, "id", ""))),
            "submission": lambda: stats.submission(str(param(p, "id", "")), str(param(p, "taskId", ""))),
            "export": stats.export,
            "setPin": lambda: room.set_pin(str(param(p, "pin", "")), str(param(p, "newPin", ""))),
            "setExperiment": lambda: room.set_experiment(param(p, "number", 0), str(param(p, "status", "open")),
                                                         str(param(p, "due", "")), str(param(p, "note", ""))),
        }
        if action not in actions:
            raise invalid(f'Unknown classroom action "{action}".')
        return actions[action]()

    @r.op("leaderboard")
    def leaderboard(call: Call):
        board = call.app.leaderboard
        action = str(param(call.params, "action", "get"))
        if action == "add":
            # The signed-in student's own name, roll number and id - never what the browser says
            profile = call.app.profiles.get(call.caller.student_id or "")
            if profile is None:                        # the teacher demonstrating a game
                return board.get()
            entry = call.params.get("entry")
            entry = entry if isinstance(entry, dict) else {}
            return board.add({**entry, "name": profile["name"], "roll": profile["roll"], "profileId": profile["id"]})
        if action == "clear":                          # teacher only (rpc/access.py)
            return board.clear()
        if action == "get":
            return board.get()
        raise invalid(f'Unknown leaderboard action "{action}".')

