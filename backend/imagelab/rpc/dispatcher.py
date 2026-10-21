"""Runs one {op, params} request and builds the response envelope.

    {"ok": true,  "op": ..., "data": ..., "elapsedMs": ..., "cached": ...}
    {"ok": false, "op": ..., "error": "message for the user", "errorId": "ImageLab:..."}

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

    def run(self, op: Any, params: Any) -> dict:
        t0 = time.perf_counter()
        op = op if isinstance(op, str) else ""
        try:
            data, cached = self._run(op, params if isinstance(params, dict) else {})
        except AppError as exc:
            return {"ok": False, "op": op, "error": exc.message, "errorId": exc.error_id, **exc.extra}
        except Exception as exc:  # noqa: BLE001 - never leak a traceback to the browser
            log.exception("Operation %s failed", op)
            return {"ok": False, "op": op, "error": f"Server error: {exc}", "errorId": "ImageLab:internal"}
        return {"ok": True, "op": op, "data": data, "elapsedMs": 1000 * (time.perf_counter() - t0), "cached": cached}

    def _run(self, op: str, raw: dict) -> tuple[Any, bool]:
        operation = self.registry.get(op)
        if operation is None:
            raise AppError(f'Unknown operation "{op}".', "ImageLab:unknownOperation")
        self.data_ready.wait()
        token = raw.get("token") if isinstance(raw.get("token"), str) else ""
        caller = Caller(self.app.auth.resolve(token), tracking=raw.get("track") is not False)
        params = {k: v for k, v in raw.items() if k not in INTERNAL_PARAMS}
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
        return data, cached

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
