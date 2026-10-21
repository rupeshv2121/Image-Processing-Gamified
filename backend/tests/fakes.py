"""A stand-in for MATLAB: answers the operations the services call with fixed data."""

from __future__ import annotations

import threading
from pathlib import Path

from imagelab.errors import AppError

EXPERIMENTS = [{"number": n, "title": f"Experiment {n}", "aim": "...", "defaultImage": "peppers.png"} for n in (1, 2, 3)]
CODE_TASKS = [
    {"id": "negative", "title": "Image negative", "level": "Easy", "unit": "Unit II", "topic": "Intensity",
     "forbidden": ["imcomplement"]},
    {"id": "gamma", "title": "Gamma correction", "level": "Easy", "unit": "Unit II", "topic": "Intensity",
     "forbidden": []},
]
QUALITY = {"mse": 0.01, "psnr": 20.0, "ssim": 0.5}


class FakeMatlab:
    def __init__(self, image_dir: Path):
        self.image_dir = image_dir
        self.ready = threading.Event()
        self.ready.set()
        self.running = True
        self.error = None
        self.info = {"version": "26.1", "release": "2026a", "ipt": False, "iptLicensed": True, "root": "x"}
        self.calls: list[tuple[str, dict]] = []
        self.counter = 0
        self.grade_passed = True

    def _image(self, tag: str) -> str:
        self.counter += 1
        image_id = f"{tag}_{self.counter:06d}"
        self.image_dir.mkdir(parents=True, exist_ok=True)
        (self.image_dir / f"{image_id}.png").write_bytes(b"png")
        return image_id

    def call_function(self, name, *args):
        raise AppError(f"FakeMatlab has no function {name}", "ImageLab:matlab")

    def cancel(self):
        return {"cancelled": False, "message": "Nothing is running."}

    def call(self, op: str, params: dict | None = None):
        params = params or {}
        self.calls.append((op, params))
        if op == "experimentCatalog":
            return EXPERIMENTS
        if op == "codeTaskList":
            return CODE_TASKS
        if op == "samples":
            return [{"name": n} for n in ("peppers.png", "shapes.png", "coins.png")]
        if op == "kernelPresets":
            return [{"name": n, "kernel": {"rows": 1, "cols": 1, "data": [1]}, "description": f"{n} kernel"}
                    for n in params["names"]]
        if op == "ping":
            return self.info
        if op in ("loadSample", "importImage"):
            return {"id": self._image("orig"), "name": params.get("name", "x")}
        if op == "degrade":
            return {"cleanId": self._image("clean"), "degradedId": self._image("degraded"), "psnr": 15.0, "ssim": 0.4}
        if op == "applyPipeline":
            steps = [{"block": s["block"], "id": self._image("step"), **QUALITY} for s in params["steps"]] \
                if params.get("intermediate") else []
            return {"id": self._image("result"), "steps": steps, "before": {"mse": 0.1, "psnr": 10.0, "ssim": 0.2},
                    "after": QUALITY, "processingMs": 5.0}
        if op == "runCode":
            data = {"output": "", "figures": [], "variables": [], "error": [], "grade": [], "newBadges": []}
            if params.get("taskId"):
                data["grade"] = {"passed": self.grade_passed, "match": 100 if self.grade_passed else 10}
            return data
        if op == "codeTaskSolution":
            return {"code": "out = 1 - img;"}
        if op == "runExperiment":
            return {"number": params["number"], "images": [], "metrics": [], "observations": []}
        if op == "regions":
            return {"id": self._image("labels"), "conn": params.get("conn", 8)}
        if op == "compare":
            return {"results": [{"name": "mean"}, {"name": "median"}]}
        # any other image operation: one result image
        return {"id": self._image(op)}
