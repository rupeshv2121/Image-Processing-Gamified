"""Image labs: MATLAB answers these on its own; Python adds caching and XP."""

from __future__ import annotations

import re

from ...errors import AppError, invalid
from ...utils import param
from ..registry import Call, Registry

# Deterministic: cached by (op, parameters) - see rpc/cache.py
CACHEABLE = ("filter", "histogram", "sharpen", "edges", "segment", "regions", "errorMap",
             "applyKernel", "color", "colorEnhance", "histogramOf", "bitPlanes", "edgeLink", "describeRegion",
             "pseudocolor", "deconvolve", "perception", "spectrum")
# Random (noise, sampling of options) or cheap - always computed
COMPUTED = ("samples", "loadSample", "imageInfo", "grayscale", "noise", "gaussianKernel", "correlation", "steps",
            "kernelPreset", "neighborhood", "sampling", "quantize", "guessFilter",
            "lpiDegrade")

FUNCTION_NAME = re.compile(r"^[A-Za-z]\w*$")


def register(r: Registry) -> None:
    r.matlab(*CACHEABLE, cacheable=True)
    r.matlab(*COMPUTED)

    @r.op("ping")
    def ping(call: Call):
        info = call.app.matlab_info()
        if not info:
            raise AppError("MATLAB is not running.", "ImageLab:matlab")
        return info

    @r.op("source")
    def source(call: Call):
        """The .m file of an ImageLab function (the "show the MATLAB code" buttons)."""
        name = str(param(call.params, "name", ""))
        if not FUNCTION_NAME.match(name):
            raise invalid("Invalid function name.")
        file = call.app.find_matlab_source(name)
        if file is None:
            raise invalid(f'No ImageLab function called "{name}".')
        rel = file.relative_to(call.app.settings.root).as_posix()
        return {"name": name, "file": rel, "code": file.read_text(encoding="utf-8", errors="replace")}

    @r.op("saveKernel")
    def save_kernel(call: Call):
        return call.app.kernels.save(str(param(call.params, "name", "my kernel")), param(call.params, "kernel", []))

    @r.op("listKernels")
    def list_kernels(call: Call):
        return call.app.kernels.list()
