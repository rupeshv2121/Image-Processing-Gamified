"""Question selection and scoring (Rapid Fire, weak-topic practice, kernel quiz)."""

from __future__ import annotations

import random

from ..errors import quiz_state
from ..utils import matlab_round
from .catalog import KERNEL_QUIZ_PRESETS, MatlabCatalog
from .content import Content

DIFFICULTY_MULTIPLIER = {"easy": 1.0, "medium": 1.5, "hard": 2.0}


def shuffle_options(q: dict, rng: random.Random) -> dict:
    """A copy of q with shuffled options (answer index follows); true/false keeps its order."""
    q = dict(q)
    if q["type"] == "truefalse":
        return q
    order = list(range(len(q["options"])))
    rng.shuffle(order)
    q["options"] = [q["options"][i] for i in order]
    q["answer"] = order.index(q["answer"] - 1) + 1
    return q


def public_question(q: dict) -> dict:
    return {key: q.get(key, []) for key in
            ("id", "category", "difficulty", "type", "question", "options", "answer", "explanation", "kernel")}


def score(results: list[dict]) -> dict:
    """Per correct answer: 100 x difficulty multiplier + 5 points per second left + 10 x (streak - 1)."""
    if not results:
        return {"score": 0, "correct": 0, "total": 0, "accuracy": 0, "bestStreak": 0}
    total_score = streak = best = 0
    for r in results:
        if r.get("correct"):
            streak += 1
            best = max(best, streak)
            m = DIFFICULTY_MULTIPLIER.get(r.get("difficulty"), 1.0)
            total_score += matlab_round(100 * m + 5 * max(float(r.get("timeLeft") or 0), 0) + 10 * (streak - 1))
        else:
            streak = 0
    correct = sum(1 for r in results if r.get("correct"))
    return {"score": total_score, "correct": correct, "total": len(results),
            "accuracy": 100 * correct / len(results), "bestStreak": best}


class QuizService:
    def __init__(self, content: Content, catalog: MatlabCatalog, rng: random.Random | None = None):
        self.content = content
        self.catalog = catalog
        self.rng = rng or random.Random()

    def categories(self) -> list[str]:
        return self.content.categories

    def select(self, difficulty: str = "mixed", categories="all", n: int = 10, shuffle: bool = True) -> list[dict]:
        bank = self.content.questions
        if isinstance(categories, str):
            categories = {q["category"] for q in bank} if categories.lower() == "all" else {categories}
        in_cat = [q for q in bank if q["category"] in set(categories)]
        if not in_cat:
            raise quiz_state("No questions found for the selected categories.")
        if difficulty.lower() == "mixed":
            pool, extra = in_cat, []
        else:                                          # top up with other difficulties if needed
            pool = [q for q in in_cat if q["difficulty"].lower() == difficulty.lower()]
            extra = [q for q in in_cat if q["difficulty"].lower() != difficulty.lower()]
        pool, extra = self.rng.sample(pool, len(pool)), self.rng.sample(extra, len(extra))
        chosen = (pool + extra)[:max(int(n), 0)]
        return [shuffle_options(q, self.rng) for q in chosen] if shuffle else [dict(q) for q in chosen]

    def weak(self, stats: list[dict], n: int = 10) -> tuple[list[dict], list[dict]]:
        """Weak-topic practice: categories weighted by their estimated error rate.

        weight = ((wrong + 1) / (answered + 2))^2 - Laplace smoothing gives unseen
        categories 0.5 so they are still practised; squaring focuses on the weakest.
        Weighted sampling without replacement (Efraimidis-Spirakis: key = u^(1/w)).
        """
        bank = self.content.questions
        cats = list(dict.fromkeys(q["category"] for q in bank))
        by_name = {s["name"]: s for s in stats or []}
        weight, acc, answered = {}, {}, {}
        for c in cats:
            s = by_name.get(c, {})
            a, ok = float(s.get("answered", 0)), float(s.get("correct", 0))
            answered[c] = a
            acc[c] = 100 * ok / a if a > 0 else None
            weight[c] = ((a - ok + 1) / (a + 2)) ** 2
        keys = [(self.rng.random() ** (1 / weight[q["category"]]), i) for i, q in enumerate(bank)]
        keys.sort(reverse=True)
        chosen = [shuffle_options(bank[i], self.rng) for _, i in keys[:max(int(n), 0)]]
        total = sum(weight.values())
        plan = [{"category": c, "accuracy": acc[c], "answered": answered[c], "weight": weight[c] / total,
                 "questions": sum(1 for q in chosen if q["category"] == c)} for c in cats]
        plan.sort(key=lambda p: -p["weight"])
        return chosen, plan

    def kernel_questions(self, n: int = 10) -> list[dict]:
        presets = self.catalog.kernel_presets()
        names = [name for name, _ in KERNEL_QUIZ_PRESETS]
        labels = dict(KERNEL_QUIZ_PRESETS)
        out = []
        for k in range(1, max(int(n), 0) + 1):
            name = self.rng.choice(names)
            options = [name] + self.rng.sample([x for x in names if x != name], 3)
            self.rng.shuffle(options)
            out.append({"id": f"KER{k}", "category": "Linear Filters", "difficulty": "medium", "type": "kernel",
                        "question": "Identify this kernel:", "options": [labels[o] for o in options],
                        "answer": options.index(name) + 1, "explanation": presets[name]["description"],
                        "kernel": presets[name]["kernel"]})
        return out

    @staticmethod
    def score(results: list[dict]) -> dict:
        return score(results)
