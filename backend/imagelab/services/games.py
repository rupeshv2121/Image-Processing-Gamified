"""Games: Build the Pipeline, Daily Challenge, Challenge Mode.

Python owns the rules (problems, verdicts, scores, streaks); MATLAB
degrades and restores the images (ops 'degrade' and 'applyPipeline').
PSNR of identical images is infinite - MATLAB sends it as null.
"""

from __future__ import annotations

import math
import random

from ..caller import Caller
from ..errors import invalid
from ..matlab import MatlabGateway
from ..utils import as_text_list, check_date, matlab_round, param, to_float
from .catalog import MatlabCatalog
from .content import Content
from .progress import ProgressService

DAILY_SAMPLES = ("peppers.png", "shapes.png", "lowcontrast.png", "unevenlight.png", "cameraman.tif",
                 "coins.png", "moon.tif", "pout.tif")

CHALLENGE_LEVELS = {
    "easy": ([{"op": "saltpepper", "value": 0.04}], "The image has salt & pepper noise. Restore it!", 90),
    "medium": ([{"op": "gaussian", "value": 0.008}, {"op": "saltpepper", "value": 0.02}],
               "A mixture of Gaussian and salt & pepper noise. Restore it!", 60),
    "hard": ([{"op": "blur", "value": 1.2}, {"op": "gaussian", "value": 0.005}, {"op": "saltpepper", "value": 0.03},
              {"op": "contrast", "value": 0.6}], "Blur, Gaussian noise, impulse noise AND low contrast. Good luck!", 60),
}


def psnr(quality: dict) -> float:
    v = quality.get("psnr")
    return math.inf if v is None else float(v)


def verdict(problem: dict, steps: list[str]) -> tuple[str, str]:
    lowered = [s.lower() for s in steps]
    if any(lowered == [s.lower() for s in seq] for seq in [problem["expected"], *problem["accepted"]]):
        return "correct", "Excellent! That is the right pipeline."
    if any(s in [e.lower() for e in problem["expected"]] for s in lowered):
        return "partial", "Partly right - you used a correct block, but the sequence is not ideal."
    return "wrong", "Not quite. Think about which degradation is present and which filter targets it."


class GameService:
    def __init__(self, matlab: MatlabGateway, content: Content, catalog: MatlabCatalog, progress: ProgressService):
        self.matlab, self.content, self.catalog, self.progress = matlab, content, catalog, progress

    def _degrade(self, source: dict, steps: list[dict], seed) -> dict:
        return self.matlab.call("degrade", {**source, "steps": steps, "seed": seed})

    # ------------------------------------------------------------ pipeline
    def problems(self) -> list[dict]:
        return [{"id": p["id"], "title": p["title"], "description": p["description"]} for p in self.content.problems]

    def pipeline_start(self, p: dict) -> dict:
        problem = self.content.problem(str(param(p, "problemId", "sp")))
        d = self._degrade({"id": p.get("id")}, problem["degrade"], param(p, "seed"))
        return {"degradedId": d["degradedId"], "cleanId": d["cleanId"], "psnr": d["psnr"]}

    def pipeline_run(self, caller: Caller, p: dict) -> dict:
        problem = self.content.problem(str(param(p, "problemId", "sp")))
        steps = as_text_list(param(p, "steps", []))
        if not steps:
            raise invalid("Add at least one block to your pipeline.")
        r = self.matlab.call("applyPipeline", {"cleanId": p.get("cleanId"), "degradedId": p.get("degradedId"),
                                               "steps": [{"block": s} for s in steps], "intermediate": True})
        result, feedback = verdict(problem, steps)
        data = {"steps": r["steps"], "before": r["before"], "after": r["after"], "verdict": result,
                "feedback": feedback, "expected": problem["expected"], "explanation": problem["explanation"],
                "points": {"correct": 100, "partial": 40}.get(result, 0)}
        day = str(param(p, "daily", ""))
        if day:
            check_date(day)
            # Bonus: 10 points per dB of PSNR gained (a perfect match has PSNR = Inf)
            gain = psnr(r["after"]) - psnr(r["before"])
            bonus = 200 if gain == math.inf else min(200, max(0, matlab_round(10 * gain)))
            data["points"] += bonus * (result != "wrong")
            data["psnrBonus"] = bonus
            data["progress"] = self.progress.daily(caller.actor, caller.student_id, day, data["points"],
                                                   result == "correct")
        return data

    # ------------------------------------------------------------ daily
    def daily_start(self, caller: Caller, day: str) -> dict:
        """The same puzzle for everybody on a given date (the date seeds every random choice)."""
        check_date(day)
        seed = int(day.replace("-", ""))
        rng = random.Random(seed)
        problem = rng.choice(self.content.problems)
        names = set(self.catalog.sample_names())
        sample = rng.choice([s for s in DAILY_SAMPLES if s in names])
        d = self._degrade({"sample": sample, "maxSide": 400}, problem["degrade"], seed)
        prog = self.progress.summary(caller.actor, caller.student_id)
        history = prog["dailyHistory"]
        today = next((h for h in history if h["date"] == day), {"solved": False, "points": 0, "attempts": 0})
        return {"date": day, "problemId": problem["id"], "title": problem["title"],
                "description": problem["description"], "sample": sample, "cleanId": d["cleanId"],
                "degradedId": d["degradedId"], "psnr": d["psnr"], "solved": today["solved"],
                "bestPoints": today["points"], "attempts": today["attempts"], "streak": prog["dailyStreak"],
                "history": history}

    # ------------------------------------------------------------ challenge
    def challenge_start(self, p: dict) -> dict:
        steps, text, limit = CHALLENGE_LEVELS.get(str(param(p, "level", "medium")), CHALLENGE_LEVELS["medium"])
        d = self._degrade({"id": p.get("id")}, steps, param(p, "seed"))
        return {"cleanId": d["cleanId"], "degradedId": d["degradedId"], "description": text, "timeLimit": limit,
                "psnr": d["psnr"]}

    def challenge_score(self, p: dict) -> dict:
        """Score: PSNR gain (dB) x 60 + time bonus (only with a PSNR gain), minimum 0."""
        steps = param(p, "steps", [])
        steps = [steps] if isinstance(steps, dict) else [s for s in steps if isinstance(s, dict)]
        r = self.matlab.call("applyPipeline", {"cleanId": p.get("cleanId"), "degradedId": p.get("degradedId"),
                                               "steps": steps, "intermediate": False})
        gain_psnr = psnr(r["after"]) - psnr(r["before"])
        time_limit = to_float(param(p, "timeLimit", 60), 60) or 60
        time_bonus = matlab_round(200 * max(0.0, 1 - to_float(param(p, "timeUsed", 0)) / time_limit))
        raw = 60 * gain_psnr
        points = math.inf if raw == math.inf else matlab_round(raw)
        return {"id": r["id"], "before": r["before"], "after": r["after"], "psnrGain": gain_psnr,
                "timeBonus": time_bonus, "processingMs": r["processingMs"],
                "score": max(0, points + time_bonus * (gain_psnr > 0))}
