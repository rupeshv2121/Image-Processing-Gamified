"""Every operation the UI can call, grouped by area."""

from __future__ import annotations

from ..registry import Registry
from . import accounts, labs, learning

MODULES = (labs, accounts, learning)


def build_registry() -> Registry:
    registry = Registry()
    for module in MODULES:
        module.register(registry)
    return registry
