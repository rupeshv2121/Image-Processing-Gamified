"""Result cache for deterministic image operations.

The same operation on the same image with the same parameters returns the
stored result instantly - without waiting for MATLAB at all. Image ids
never change their content, so an entry stays valid as long as the
images it refers to still exist (the runtime clean-up deletes old ones).
"""

from __future__ import annotations

import json
import re
import threading
from collections import OrderedDict
from pathlib import Path
from typing import Any

IMAGE_ID = re.compile(r"^[A-Za-z0-9_\-]+$")


def cache_key(op: str, params: dict) -> str:
    return op + "|" + json.dumps(params, sort_keys=True, separators=(",", ":"))


class ResultCache:
    """Least-recently-used, at most `size` entries."""

    def __init__(self, image_dir: Path, size: int = 300):
        self.image_dir = image_dir
        self.size = size
        self._store: OrderedDict[str, Any] = OrderedDict()
        self._lock = threading.Lock()

    def get(self, key: str) -> tuple[bool, Any]:
        with self._lock:
            if key not in self._store:
                return False, None
            self._store.move_to_end(key)
            data = self._store[key]
        if not self.images_exist(data):
            with self._lock:
                self._store.pop(key, None)
            return False, None
        return True, data

    def put(self, key: str, data: Any) -> None:
        with self._lock:
            self._store[key] = data
            self._store.move_to_end(key)
            while len(self._store) > self.size:
                self._store.popitem(last=False)

    def clear(self) -> None:
        with self._lock:
            self._store.clear()

    def images_exist(self, data: Any) -> bool:
        """True if every image id in the result (fields 'id' / '...Id') is still on disk."""
        if isinstance(data, list):
            return all(self.images_exist(v) for v in data)
        if isinstance(data, dict):
            for name, v in data.items():
                if (name == "id" or name.endswith("Id")) and isinstance(v, str) and v:
                    if not IMAGE_ID.match(v) or not (self.image_dir / f"{v}.png").is_file():
                        return False
                elif isinstance(v, (dict, list)) and not self.images_exist(v):
                    return False
        return True
