"""Runs one {op, params} request and builds the response envelope.

    {"ok": true,  "op": ..., "data": ..., "elapsedMs": ..., "cached": ..., "xp": {"xp": ..., "level": ...}}
    {"ok": false,

"xp" is only sent to signed-in students: the level bar in the top bar
follows every XP change (labs, quizzes, Code Lab, live quiz) without a reload. "op": ..., "error": "message for the user", "errorId": "ImageLab:..."}

Order of work: resolve the session from the token -> access rules ->
result cache or handler -> activity (XP) for the student.
"""

from __future__ import annotations

import logging
import threading
import time
from typing import TYPE_CHECKING, Any

from ..caller import Caller
from ..errors import AppError
from ..services.progress import level
from ..utils import is_true
from . import access, activity
from .cache import ResultCache, cache_key
from .registry import INTERNAL_PARAMS, Call, Registry

if TYPE_CHECKING:  # pragma: no cover
    from ..container import Services

log = logging.getLogger("imagelab.rpc")


class Dispatcher:
    def __init__(self, app: "Services", registry: Registry, cache: ResultCache, data_ready: threading.Event):
        self.app = app
        self.registry = registry
        self.cache = cache
        # Set once the old MATLAB data files are imported (immediately if there are none)
        self.data_ready = data_ready

    def run(self, op: Any, params: Any, remote: bool = False) -> dict:
        """remote: the request comes from another device on the classroom network."""
        t0 = time.perf_counter()
        op = op if isinstance(op, str) else ""
        try:
            data, cached, student = self._run(op, params if isinstance(params, dict) else {}, remote)
        except AppError as exc:
            return {"ok": False, "op": op, "error": exc.message, "errorId": exc.error_id, **exc.extra}
        except Exception as exc:  # noqa: BLE001 - never leak a traceback to the browser
            log.exception("Operation %s failed", op)
            return {"ok": False, "op": op, "error": f"Server error: {exc}", "errorId": "ImageLab:internal"}
        out = {"ok": True, "op": op, "data": data, "elapsedMs": 1000 * (time.perf_counter() - t0), "cached": cached}
        if student is not None:
            out["xp"] = self._xp(student)
        return out

    def _xp(self, student: str) -> dict | None:
        try:
            xp = self.app.progress.load(student)["xp"]
        except Exception:  # noqa: BLE001 - the level bar must never break a request
            log.exception("Could not read the XP of %s", student)
            return None
        return {"xp": xp, "level": level(xp)}

    def _run(self, op: str, raw: dict, remote: bool) -> tuple[Any, bool, str | None]:
        operation = self.registry.get(op)
        if operation is None:
            raise AppError(f'Unknown operation "{op}".', "ImageLab:unknownOperation")
        self.data_ready.wait()
        token = raw.get("token") if isinstance(raw.get("token"), str) else ""
        caller = Caller(self.app.auth.resolve(token), tracking=raw.get("track") is not False)
        params = {k: v for k, v in raw.items() if k not in INTERNAL_PARAMS}
        if remote and not access.remote_allowed(op, params, caller):
            raise AppError(access.REMOTE_MESSAGE, "ImageLab:remote")
        access.check(op, params, caller)

        call = Call(op, params, caller, token, self.app)
        cached = False
        if operation.cacheable and not is_true(raw.get("noCache")):
            key = cache_key(op, params)
            cached, data = self.cache.get(key)
            if not cached:
                data = operation.handler(call)
                self.cache.put(key, data)
        else:
            data = operation.handler(call)
        self._record_activity(call, data)
        return data, cached, caller.student_id

    def _record_activity(self, call: Call, data: Any) -> None:
        student = call.caller.tracked_student
        if student is None:
            return
        done = activity.activities(call.op, call.params, data)
        if not done:
            return
        try:
            self.app.progress.activities(student, student, done)
        except Exception:  # noqa: BLE001 - progress tracking must never break an image operation
            log.exception("Could not record activity for %s", call.op)
