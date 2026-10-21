"""What each lab operation counts as for XP and badges ("tried the median filter").

Rules are data: op -> function(params, result) -> [(area, item), ...].
They run after every successful call, also when the result came from the
cache, so a student's XP never depends on whether somebody else already
ran the same filter.
"""

from __future__ import annotations

from typing import Any, Callable

from ..utils import as_list, as_text_list, param

Rule = Callable[[dict, Any], list[tuple[str, str]]]


def _one(area: str, name: str, default: str) -> Rule:
    return lambda p, data: [(area, str(param(p, name, default)))]


def _fixed(area: str, item: str) -> Rule:
    return lambda p, data: [(area, item)]


RULES: dict[str, Rule] = {
    "noise": _one("noise", "type", "gaussian"),
    "filter": _one("filters", "name", "mean"),
    "histogram": lambda p, data: [] if param(p, "method", "histeq") == "none"
    else [("histogram", str(param(p, "method", "histeq")))],
    "correlation": _one("tools", "mode", "correlation"),
    "steps": _one("animations", "algorithm", "median"),
    "applyKernel": _fixed("tools", "kernelPlayground"),
    "sharpen": _one("sharpening", "method", "laplacian"),
    "edges": lambda p, data: [("edges", m) for m in as_text_list(param(p, "methods", ["sobel"]))],
    "segment": _one("segmentation", "method", "otsu"),
    "morphology": _one("morphology", "operation", "erode"),
    "regions": lambda p, data: [("regions", f"conn{int(data['conn'])}")],
    "color": _one("color", "space", "rgb"),
    "colorEnhance": _fixed("color", "enhance"),
    "neighborhood": _fixed("tools", "neighborhood"),
    "sampling": _fixed("tools", "sampling"),
    "quantize": _fixed("tools", "quantization"),
    "compare": lambda p, data: [("filters", str(r["name"])) for r in as_list(data.get("results"))]
    + [("tools", "compare")],
}


def activities(op: str, params: dict, data: Any) -> list[tuple[str, str]]:
    rule = RULES.get(op)
    return rule(params, data) if rule else []
