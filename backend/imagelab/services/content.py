"""Static learning content shipped with the backend (content/*.json).

question_bank.json      every quiz question (id, category, difficulty, type,
                        question, options, answer = 1-based index, explanation,
                        kernel = {rows, cols, data} or [])
pipeline_problems.json  "Build the Pipeline" problems: how the clean image is
                        degraded (MATLAB does it) and which blocks repair it
"""

from __future__ import annotations

import json
from functools import cached_property
from pathlib import Path

from ..errors import invalid

CONTENT_DIR = Path(__file__).resolve().parent.parent / "content"

QUIZ_CATEGORIES = (
    "Fundamentals", "Histogram", "Spatial Filters", "Linear Filters", "Non-Linear Filters", "Noise",
    "Correlation", "Convolution", "Sharpening", "Edge Detection", "Segmentation", "Color Processing",
    "Morphology", "Representation",
)


class Content:
    def __init__(self, folder: Path = CONTENT_DIR):
        self.folder = folder

    def _load(self, name: str) -> list[dict]:
        with open(self.folder / name, encoding="utf-8") as fh:
            return json.load(fh)

    @cached_property
    def questions(self) -> list[dict]:
        return self._load("question_bank.json")

    @cached_property
    def questions_by_id(self) -> dict[str, dict]:
        return {q["id"]: q for q in self.questions}

    @cached_property
    def problems(self) -> list[dict]:
        return self._load("pipeline_problems.json")

    @property
    def categories(self) -> list[str]:
        return list(QUIZ_CATEGORIES)

    def problem(self, problem_id: str) -> dict:
        for p in self.problems:
            if p["id"] == problem_id:
                return p
        raise invalid(f'Unknown pipeline problem "{problem_id}".')
