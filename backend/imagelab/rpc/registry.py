"""Operation registry: op name -> handler (command pattern).

Each handler module exposes `register(registry)`; nothing is registered
as an import side effect, so tests can build a registry with any subset.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Any, Callable

from ..caller import Caller

if TYPE_CHECKING:  # pragma: no cover
    from ..container import Services

# Keys the browser adds to every request; MATLAB never sees them
INTERNAL_PARAMS = ("token", "track", "noCache", "profileId")


@dataclass
class Call:
    op: str
    params: dict             # without INTERNAL_PARAMS
    caller: Caller
    token: str
    app: "Services"

    def matlab(self, op: str | None = None, params: dict | None = None) -> Any:
        return self.app.matlab.call(op or self.op, self.params if params is None else params)


Handler = Callable[[Call], Any]


@dataclass(frozen=True)
class Operation:
    name: str
    handler: Handler
    # Deterministic image operation: same image + parameters -> same result
    cacheable: bool = False


class Registry:
    def __init__(self):
        self._ops: dict[str, Operation] = {}

    def add(self, name: str, handler: Handler, cacheable: bool = False) -> None:
        if name in self._ops:
            raise ValueError(f"Operation {name!r} is registered twice.")
        self._ops[name] = Operation(name, handler, cacheable)

    def op(self, name: str, cacheable: bool = False) -> Callable[[Handler], Handler]:
        def decorate(handler: Handler) -> Handler:
            self.add(name, handler, cacheable)
            return handler
        return decorate

    def matlab(self, *names: str, cacheable: bool = False) -> None:
        """Operations MATLAB answers on its own (image in, result out)."""
        for name in names:
            self.add(name, lambda call: call.matlab(), cacheable)

    def get(self, name: str) -> Operation | None:
        return self._ops.get(name)

    def __contains__(self, name: str) -> bool:
        return name in self._ops

    @property
    def names(self) -> list[str]:
        return sorted(self._ops)
