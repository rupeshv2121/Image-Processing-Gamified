"""Small helpers shared by every layer: parameters, matrices, time, text."""

from __future__ import annotations

import math
import re
from datetime import date, datetime
from typing import Any, Iterable

from .errors import invalid

_CONTROL = re.compile(r"[\x00-\x1F<>]")


# ----------------------------------------------------------------- parameters
def is_empty(value: Any) -> bool:
    """MATLAB's isempty for decoded JSON: None, '', [] and {} are empty; 0 and False are not."""
    return value is None or (isinstance(value, (str, list, dict, tuple)) and len(value) == 0)


def param(params: dict | None, name: str, default: Any = None) -> Any:
    """params[name], or default when it is missing or empty."""
    if not isinstance(params, dict):
        return default
    value = params.get(name)
    return default if is_empty(value) else value


def as_list(value: Any) -> list:
    """MATLAB's jsonencode turns 1-element arrays into scalars - undo that."""
    if value is None:
        return []
    if isinstance(value, list):
        return value
    return [value]


def as_text_list(value: Any) -> list[str]:
    """A string or a list of strings as a list (MATLAB cellstr)."""
    return [str(v) for v in as_list(value)]


def to_float(value: Any, default: float = 0.0) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return default
    return number


def is_true(value: Any) -> bool:
    return value is True or (isinstance(value, (int, float)) and not isinstance(value, bool) and value != 0)


# ----------------------------------------------------------------- matrices
def to_matrix(value: Any) -> list[list[float]]:
    """Decode a matrix as MATLAB's jsondecode does: [[..],[..]] rows, a flat list = column."""
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return [[float(value)]]
    if not isinstance(value, list) or not value:
        return []
    if all(isinstance(row, list) for row in value):
        return [[float(x) for x in row] for row in value]
    return [[float(x)] for x in value]


def mat(matrix: list[list[float]]) -> dict:
    """Encode a matrix for the UI as {rows, cols, data (row-major)} - see api/ilab_mat.m."""
    rows = len(matrix)
    cols = len(matrix[0]) if rows else 0
    return {"rows": rows, "cols": cols, "data": [x for row in matrix for x in row]}


# ----------------------------------------------------------------- text
def clean_text(value: Any, max_len: int, keep_newlines: bool = False) -> str:
    if not isinstance(value, str):
        return ""
    if keep_newlines:
        text = re.sub(r"\r\n?", "\n", value)
        text = re.sub(r"[\x00-\x09\x0B-\x1F]", "", text)
    else:
        text = re.sub(r"[\x00-\x1F]", " ", value)
    return text.strip()[:max_len]


def clean_name(value: Any, max_len: int) -> str:
    """Strip control characters and angle brackets (names shown in HTML)."""
    return _CONTROL.sub("", str(value or "")).strip()[:max_len]


def plural(n: int) -> str:
    return "" if n == 1 else "s"


# ----------------------------------------------------------------- numbers
def round_to(value: float | None, digits: int) -> float | None:
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return None
    factor = 10 ** digits
    return math.floor(value * factor + 0.5) / factor


def matlab_round(value: float) -> int:
    """MATLAB rounds halves away from zero (Python rounds them to even)."""
    return int(math.floor(abs(value) + 0.5)) * (1 if value >= 0 else -1)


def mean(values: Iterable[float]) -> float | None:
    items = list(values)
    return sum(items) / len(items) if items else None


# ----------------------------------------------------------------- time
MINUTE_FORMAT = "%Y-%m-%d %H:%M"
DATE_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def now_text() -> str:
    """Current local time as 'yyyy-MM-dd HH:mm' (the format stored everywhere)."""
    return datetime.now().strftime(MINUTE_FORMAT)


def today_text() -> str:
    return date.today().isoformat()


def stamp() -> str:
    """Compact timestamp for file names and ids."""
    return datetime.now().strftime("%Y%m%d_%H%M%S")


def check_date(text: str) -> str:
    if not DATE_PATTERN.match(text or ""):
        raise invalid(f'Invalid date "{text}" (expected YYYY-MM-DD).')
    return text


def days_since(text: str) -> float:
    if not text:
        return math.inf
    try:
        then = datetime.strptime(text, MINUTE_FORMAT)
    except ValueError:
        return math.inf
    return (datetime.now() - then).total_seconds() / 86400
