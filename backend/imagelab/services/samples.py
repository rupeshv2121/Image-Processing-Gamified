"""Sample image library: MATLAB's built-in samples plus the teacher's own.

The teacher uploads images (kept in data/samples/ with a PNG preview), names
and describes them, and hides built-in samples the class does not need. Every
lab's "load a sample" lists the visible ones. MATLAB still reads every image
(importImage), so a file MATLAB cannot decode is never added.

Labs, code tasks and games that name a built-in sample keep working when the
teacher hides it: hiding only removes it from the lists.
"""

from __future__ import annotations

import base64
import binascii
import re
import shutil
import threading
import uuid
from pathlib import Path
from typing import Any

from ..errors import AppError, invalid
from ..storage.repositories import SettingsRepository
from ..utils import as_list, clean_text, now_text

KEY = "sampleLibrary"
TYPES = {".png", ".jpg", ".jpeg", ".tif", ".tiff", ".bmp", ".gif"}
MAX_CUSTOM = 100
STEM = re.compile(r"[^A-Za-z0-9_-]+")


class SampleLibrary:
    def __init__(self, settings: SettingsRepository, matlab, sample_dir: Path, image_dir: Path, upload_dir: Path,
                 max_bytes: int):
        self.settings, self.matlab = settings, matlab
        self.dir, self.image_dir, self.upload_dir = sample_dir, image_dir, upload_dir
        self.max_bytes = max_bytes
        self._builtin: list[dict] | None = None
        self._lock = threading.RLock()

    # ------------------------------------------------------------ reading
    def _state(self) -> dict:
        s = self.settings.get(KEY, {}) or {}
        return {"custom": [c for c in as_list(s.get("custom")) if isinstance(c, dict)],
                "hidden": [h for h in as_list(s.get("hidden")) if isinstance(h, str)]}

    def builtin(self) -> list[dict]:
        if self._builtin is None:                      # MATLAB's list never changes while it runs
            self._builtin = [{"name": s["name"], "description": s.get("description", "")}
                             for s in as_list(self.matlab.call("samples"))]
        return self._builtin

    def list(self, everything: bool = False) -> list[dict]:
        """Visible samples, the teacher's first; everything=True adds the hidden built-ins (flagged)."""
        st = self._state()
        hidden = set(st["hidden"])
        custom = [{"name": c["name"], "description": c.get("description", ""), "custom": True,
                   "preview": f"/api/sample/{c['preview']}", "width": c.get("width"), "height": c.get("height"),
                   "added": c.get("added", "")} for c in st["custom"]]
        builtin = [{**b, "custom": False, "hidden": b["name"] in hidden} for b in self.builtin()
                   if everything or b["name"] not in hidden]
        return custom + builtin

    def file_of(self, name: str) -> Path | None:
        c = next((c for c in self._state()["custom"] if c["name"] == name), None)
        return self.dir / c["file"] if c else None

    def preview_file(self, name: str) -> Path | None:
        if not re.fullmatch(r"[A-Za-z0-9_-]+\.preview\.png", name or ""):
            return None
        path = self.dir / name
        return path if path.is_file() else None

    def load(self, name: str) -> Any:
        """The sample as a new working image (op loadSample)."""
        file = self.file_of(name)
        if file is None:
            return self.matlab.call("loadSample", {"name": name})
        if not file.is_file():
            raise invalid(f'The file of "{name}" is missing - upload it again.')
        return self.matlab.call("importImage", {"path": str(file), "name": name})

    # ------------------------------------------------------------ teacher
    def add(self, name: Any, data: Any, description: Any) -> list[dict]:
        original = Path(str(name or "")).name
        ext = Path(original).suffix.lower()
        if ext not in TYPES:
            raise invalid("Unsupported file type. Use PNG, JPG, TIF, BMP or GIF.")
        try:
            raw = base64.b64decode(str(data or ""), validate=True)
        except (binascii.Error, ValueError):
            raise invalid("The uploaded file is corrupted.") from None
        if not raw:
            raise invalid("The uploaded file is empty.")
        if len(raw) > self.max_bytes:
            raise invalid(f"Image too large (max {self.max_bytes // (1024 * 1024)} MB).")
        with self._lock:
            st = self._state()
            if len(st["custom"]) >= MAX_CUSTOM:
                raise invalid(f"The library holds at most {MAX_CUSTOM} of your own images - delete some first.")
            stem = STEM.sub("_", Path(original).stem).strip("_")[:40] or "image"
            taken = {c["name"].lower() for c in st["custom"]} | {b["name"].lower() for b in self.builtin()}
            label, k = stem + ext, 2
            while label.lower() in taken:
                label, k = f"{stem}_{k}{ext}", k + 1
            self.dir.mkdir(parents=True, exist_ok=True)
            key = uuid.uuid4().hex[:12]
            file, preview = self.dir / f"{key}{ext}", f"{key}.preview.png"
            file.write_bytes(raw)
            try:
                img = self.matlab.call("importImage", {"path": str(file), "name": label})   # MATLAB checks it
                shutil.copyfile(self.image_dir / f"{img['id']}.png", self.dir / preview)
            except AppError:
                file.unlink(missing_ok=True)
                raise
            except OSError as exc:
                file.unlink(missing_ok=True)
                raise invalid("Could not store the image.") from exc
            size = img.get("original") or {}
            st["custom"].insert(0, {"name": label, "file": file.name, "preview": preview,
                                    "description": clean_text(description, 120) or "Uploaded by the teacher",
                                    "width": size.get("width"), "height": size.get("height"), "added": now_text()})
            self.settings.put(KEY, st)
        return self.list(True)

    def update(self, name: str, description: Any = None, hidden: Any = None) -> list[dict]:
        with self._lock:
            st = self._state()
            c = next((c for c in st["custom"] if c["name"] == name), None)
            if c is not None and description is not None:
                c["description"] = clean_text(description, 120) or c.get("description", "")
            elif c is None and hidden is not None:
                if name not in {b["name"] for b in self.builtin()}:
                    raise invalid(f'"{name}" is not a sample image.')
                st["hidden"] = [h for h in st["hidden"] if h != name] + ([name] if hidden else [])
            elif c is None:
                raise invalid(f'"{name}" is not one of your images.')
            self.settings.put(KEY, st)
        return self.list(True)

    def remove(self, name: str) -> list[dict]:
        with self._lock:
            st = self._state()
            c = next((c for c in st["custom"] if c["name"] == name), None)
            if c is None:
                raise invalid(f'"{name}" is not one of your images.')
            st["custom"].remove(c)
            self.settings.put(KEY, st)
            for f in (c["file"], c["preview"]):
                (self.dir / f).unlink(missing_ok=True)
        return self.list(True)
