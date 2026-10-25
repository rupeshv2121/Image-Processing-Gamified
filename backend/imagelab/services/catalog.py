"""Catalogues that belong to MATLAB code and are read from MATLAB once.

The experiments (experimentCatalog.m) describe MATLAB code that
runExperiment.m executes, the example Code Lab tasks (codeTasks.m) are
templates for the teacher's own tasks, and the kernel presets come from
kernelPresets.m. The backend
asks MATLAB for them on first use and keeps them in memory - they only
change when the .m files change (restart the server).
"""

from __future__ import annotations

import threading
from typing import Any, Callable

from ..matlab import MatlabGateway
from ..utils import as_list

KERNEL_QUIZ_PRESETS = (
    ("mean", "Mean (box)"), ("weighted", "Weighted mean"), ("sobelx", "Sobel X"), ("sobely", "Sobel Y"),
    ("prewittx", "Prewitt X"), ("prewitty", "Prewitt Y"), ("laplacian", "Laplacian (4-neighbour)"),
    ("laplacian8", "Laplacian (8-neighbour)"), ("sharpen", "Sharpening"), ("pointdetect", "Point detection"),
    ("identity", "Identity"), ("emboss", "Emboss"),
)


class MatlabCatalog:
    def __init__(self, matlab: MatlabGateway):
        self.matlab = matlab
        self._cache: dict[str, Any] = {}
        self._lock = threading.Lock()

    def _get(self, key: str, load: Callable[[], Any]) -> Any:
        with self._lock:
            if key not in self._cache:
                self._cache[key] = load()
            return self._cache[key]

    # ------------------------------------------------------------ experiments
    def experiments(self) -> list[dict]:
        return self._get("experiments", lambda: as_list(self.matlab.call("experimentCatalog")))

    def experiment_numbers(self) -> list[int]:
        return [int(e["number"]) for e in self.experiments()]

    # ------------------------------------------------------------ Code Lab
    def code_task_templates(self) -> list[dict]:
        """The built-in example tasks (with model solution) a teacher can start a task from."""
        def load() -> list[dict]:
            out = []
            for t in as_list(self.matlab.call("codeTaskTemplates")):
                t = dict(t)
                for key in ("instructions", "hints", "forbidden"):
                    t[key] = [str(x) for x in as_list(t.get(key))]
                out.append(t)
            return out
        return self._get("codeTaskTemplates", load)

    # ------------------------------------------------------------ kernels
    def kernel_presets(self) -> dict[str, dict]:
        """name -> {kernel {rows, cols, data}, description} for the kernel quiz (3x3)."""
        def load() -> dict[str, dict]:
            names = [name for name, _ in KERNEL_QUIZ_PRESETS]
            items = as_list(self.matlab.call("kernelPresets", {"names": names, "size": 3}))
            return {item["name"]: item for item in items}
        return self._get("kernelPresets", load)

    # ------------------------------------------------------------ samples
    def sample_names(self) -> list[str]:
        return self._get("samples", lambda: [s["name"] for s in as_list(self.matlab.call("samples"))])
