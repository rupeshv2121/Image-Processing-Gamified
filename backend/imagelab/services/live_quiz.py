"""Live classroom quiz (Mentimeter / Kahoot style).

The teacher builds a quiz (bank questions and/or their own, a timer per
question, instructions, rules), opens it with a 6-digit code and sets the
pace from the projector. Students join on their own devices and poll.

Timing: a question opens when the teacher starts it and closes after its
time limit (answers up to GRACE s late still count - network delay). A
student's response time runs from the moment the server first sent them
the question, so a slow poll never costs time. When every connected
student has answered, the answer is revealed at once (autoReveal).
Points: 1000 for a correct answer; with speed scoring
round(1000 x (1 - 0.5 x time / limit)), i.e. 500 to 1000.
Ranking: points, then total answer time (unanswered = full limit), then name.

The running session lives in memory (one per server). Finished sessions
are saved and recorded in every participant's progress (mode "Live Quiz").
"""

from __future__ import annotations

import random
import re
import secrets
import threading
import time
from datetime import datetime
from typing import Any

from ..errors import forbidden, invalid, quiz_state
from ..storage.repositories import OrderedDocuments
from ..utils import clean_text, matlab_round, mean, now_text, param, round_to
from .content import Content
from .exports import ExportService
from .profiles import ProfileService
from .progress import ProgressService
from .quiz import QuizService, score

GRACE = 1.0          # s - late answers still accepted
ONLINE = 8.0         # s - a student whose last poll is older is "offline"
MAX_QUESTIONS = 50
MAX_RESULTS, MAX_SETS = 100, 50
BOARD_SIZES = {"top5": 5, "top10": 10}
SET_ID = re.compile(r"^[A-Za-z0-9_]{1,40}$")


# ----------------------------------------------------------------- definitions
def _flag(s: dict, name: str, default: bool) -> bool:
    v = s.get(name, default) if isinstance(s, dict) else default
    return bool(v) if isinstance(v, (bool, int, float)) else default


def _clamp_time(value: Any, default: int) -> int:
    try:
        v = float(value)
    except (TypeError, ValueError):
        return default
    if v != v or v <= 0 or v == float("inf"):
        return default
    return min(max(matlab_round(v), 5), 300)


def settings_from(s: Any) -> dict:
    s = s if isinstance(s, dict) else {}
    board = str(s.get("leaderboard") or "top5").lower()
    return {"timeLimit": _clamp_time(s.get("timeLimit", 20), 20), "speedPoints": _flag(s, "speedPoints", True),
            "leaderboard": board if board in ("top5", "top10", "all") else "top5",
            "showLeaderboard": _flag(s, "showLeaderboard", True), "autoReveal": _flag(s, "autoReveal", True),
            "lateJoin": _flag(s, "lateJoin", True), "shuffleQuestions": _flag(s, "shuffleQuestions", False),
            "shuffleOptions": _flag(s, "shuffleOptions", False)}


def item(bank_id: str, question: str, options: list, answer: int, category: str, difficulty: str,
         explanation: str, time_limit: int) -> dict:
    return {"bankId": bank_id, "question": question, "options": list(options), "answer": answer,
            "category": category, "difficulty": difficulty, "explanation": explanation, "timeLimit": time_limit}


def points(correct: bool, rt: float, limit: float, speed: bool) -> int:
    if not correct:
        return 0
    return matlab_round(1000 * (1 - 0.5 * min(rt / limit, 1))) if speed else 1000


# ----------------------------------------------------------------- session model
class LiveSession:
    """One running quiz: its questions, phase and players."""

    def __init__(self, title: str, instructions: str, settings: dict, questions: list[dict], clock):
        self.clock = clock
        self.id = "LQ" + datetime.now().strftime("%Y%m%d%H%M%S")
        self.code = f"{100000 + secrets.randbelow(900000):06d}"
        self.title, self.instructions, self.settings = title, instructions, settings
        self.questions = questions
        self.phase = "lobby"                  # lobby | question | reveal | finished
        self.q_index = 0                      # 1-based, 0 = not started
        self.q_start = self.deadline = 0.0
        self.players: list[dict] = []
        self.kicked: set[str] = set()
        self.created = now_text()

    # -------------------------------------------------------- state machine
    def open_question(self, k: int) -> None:
        self.q_index, self.phase = k, "question"
        self.q_start = self.clock()
        self.deadline = self.q_start + self.questions[k - 1]["timeLimit"]

    def tick(self) -> None:
        """Close the open question when time is up, or when every connected student answered."""
        if self.phase != "question":
            return
        now = self.clock()
        if now > self.deadline + GRACE:
            self.phase = "reveal"
        elif self.settings["autoReveal"] and self.players:
            answered = [pl["choice"][self.q_index - 1] > 0 for pl in self.players]
            online = [now - pl["lastSeen"] <= ONLINE for pl in self.players]
            if any(answered) and all(a for a, on in zip(answered, online) if on):
                self.phase = "reveal"

    def same_step(self, params: dict, phase: str) -> bool:
        """In this phase and (if the teacher's screen says which) still on that question."""
        q = params.get("qIndex")
        return self.phase == phase and (q is None or q == [] or float(q) == self.q_index)

    def scored_up_to(self) -> int:
        """Questions whose points count: the open one only after its reveal."""
        return self.q_index - (1 if self.phase == "question" else 0)

    def remaining_ms(self, now: float) -> int:
        return matlab_round(1000 * max(self.deadline - now, 0)) if self.phase == "question" else 0

    def player(self, profile_id: str) -> dict | None:
        return next((pl for pl in self.players if pl["id"] == profile_id), None)

    def new_player(self, profile_id: str, name: str, roll: str) -> dict:
        n, now = len(self.questions), self.clock()
        pl = {"id": profile_id, "name": name, "roll": roll, "joined": now, "lastSeen": now,
              "choice": [0] * n, "time": [None] * n, "points": [0] * n, "seen": [None] * n}
        self.players.append(pl)
        return pl

    # -------------------------------------------------------- ranking
    def fill_time(self, pl: dict, n: int) -> list[float]:
        """Answer times of questions 1..n; an unanswered question counts its full limit."""
        return [pl["time"][k] if pl["choice"][k] > 0 else self.questions[k]["timeLimit"] for k in range(n)]

    def ranking(self, n: int) -> tuple[list[int], list[float], list[float]]:
        m = len(self.players)
        scores = [float(sum(pl["points"][:n])) if n > 0 else 0.0 for pl in self.players]
        totals = [float(sum(self.fill_time(pl, n))) if n > 0 else 0.0 for pl in self.players]
        order = sorted(range(m), key=lambda j: self.players[j]["name"].lower())
        order.sort(key=lambda j: totals[j])
        order.sort(key=lambda j: -scores[j])
        return order, scores, totals

    def leaderboard(self, n: int) -> list[dict]:
        if not self.players:
            return []
        order, scores, totals = self.ranking(n)
        prev = self.ranking(n - 1)[0]
        board = []
        for rank, j in enumerate(order, start=1):
            pl = self.players[j]
            asked = range(max(n, 0))
            times = [pl["time"][k] for k in asked if pl["choice"][k] > 0]
            last = {"choice": 0, "time": [], "points": 0, "correct": False}
            if n > 0:
                last = {"choice": pl["choice"][n - 1], "time": pl["time"][n - 1], "points": pl["points"][n - 1],
                        "correct": pl["choice"][n - 1] == self.questions[n - 1]["answer"]}
            avg = mean(times)
            board.append({"rank": rank, "id": pl["id"], "name": pl["name"], "roll": pl["roll"], "score": scores[j],
                          "correct": sum(1 for k in asked if pl["choice"][k] == self.questions[k]["answer"]),
                          "answered": len(times), "avgTime": [] if avg is None else round_to(avg, 2),
                          "totalTime": round_to(totals[j], 2), "move": prev.index(j) + 1 - rank, "last": last})
        return board

    def distribution(self, k: int) -> list[int]:
        q = self.questions[k - 1]
        return [sum(1 for pl in self.players if pl["choice"][k - 1] == o) for o in range(1, len(q["options"]) + 1)]

    def answer_times(self, k: int) -> list[dict]:
        answered = sorted((pl for pl in self.players if pl["choice"][k - 1] > 0), key=lambda pl: pl["time"][k - 1])
        q = self.questions[k - 1]
        return [{"id": pl["id"], "name": pl["name"], "roll": pl["roll"], "time": pl["time"][k - 1],
                 "choice": pl["choice"][k - 1], "correct": pl["choice"][k - 1] == q["answer"],
                 "points": pl["points"][k - 1]} for pl in answered]

    def question_stats(self, n: int) -> list[dict]:
        out = []
        for k in range(1, n + 1):
            q = self.questions[k - 1]
            choices = [pl["choice"][k - 1] for pl in self.players]
            times = [pl["time"][k - 1] for pl in self.players if pl["choice"][k - 1] > 0]
            right = sum(1 for c in choices if c == q["answer"])
            avg = mean(times)
            out.append({"index": k, "question": q["question"], "category": q["category"], "options": q["options"],
                        "answer": q["answer"], "timeLimit": q["timeLimit"], "answered": len(times), "correct": right,
                        "correctPct": round_to(100 * right / len(choices), 1) if choices else [],
                        "avgTime": [] if avg is None else round_to(avg, 2),
                        "counts": [sum(1 for c in choices if c == o) for o in range(1, len(q["options"]) + 1)]})
        return out

    def result_record(self) -> dict:
        n = self.scored_up_to()
        board = []
        for b in self.leaderboard(n):
            pl = self.player(b["id"])
            entry = {k: v for k, v in b.items() if k not in ("move", "last")}
            entry.update(choices=pl["choice"][:n], times=pl["time"][:n], points=pl["points"][:n])
            board.append(entry)
        acc = avg_time = []
        if n > 0 and self.players:
            right = sum(1 for pl in self.players for k in range(n) if pl["choice"][k] == self.questions[k]["answer"])
            acc = round_to(100 * right / (n * len(self.players)), 1)
            times = [t for pl in self.players for t in pl["time"][:n] if t is not None]
            avg_time = round_to(mean(times), 2) if times else []
        return {"id": self.id, "code": self.code, "title": self.title, "date": self.created, "questionCount": n,
                "plannedQuestions": len(self.questions), "playerCount": len(self.players), "accuracy": acc,
                "avgTime": avg_time, "winner": board[0]["name"] if board else "", "questions": self.question_stats(n),
                "leaderboard": board}


def question_view(q: dict, with_answer: bool, k: int) -> dict:
    v = {"index": k, "question": q["question"], "options": q["options"], "category": q["category"],
         "difficulty": q["difficulty"], "type": q["type"], "timeLimit": q["timeLimit"]}
    if with_answer:
        v.update(answer=q["answer"], explanation=q["explanation"])
    return v


def summary_of(record: dict) -> dict:
    return {k: v for k, v in record.items() if k not in ("questions", "leaderboard")}


# ----------------------------------------------------------------- service
class LiveQuizService:
    def __init__(self, content: Content, quiz: QuizService, progress: ProgressService, profiles: ProfileService,
                 sets: OrderedDocuments, results: OrderedDocuments, exports: ExportService,
                 clock=time.monotonic, rng: random.Random | None = None):
        self.content, self.quiz, self.progress, self.profiles = content, quiz, progress, profiles
        self.sets, self.results, self.exports = sets, results, exports
        self.clock = clock
        self.rng = rng or random.Random()
        self.session: LiveSession | None = None
        self._lock = threading.RLock()

    def handle(self, action: str, who, p: dict) -> Any:
        """who: the caller's Session (identity never comes from p)."""
        handler = getattr(self, "_" + action, None) if re.match(r"^[a-zA-Z]+$", action or "") else None
        if handler is None or action in ("handle",):
            raise invalid(f'Unknown live quiz action "{action}".')
        with self._lock:
            if self.session is not None:
                self.session.tick()
            return handler(who, p)

    # ============================================================ teacher
    def _create(self, who, p):
        if self.session is not None and self.session.phase != "finished":
            raise quiz_state(f"A live quiz is already open (code {self.session.code}). "
                             "End it before starting a new one.")
        q = param(p, "quiz", {})
        q = q if isinstance(q, dict) else {}
        st = settings_from(q.get("settings"))
        questions = self._build(self._normalise(q.get("questions")), st["timeLimit"])
        if st["shuffleQuestions"]:
            self.rng.shuffle(questions)
        if st["shuffleOptions"]:
            for qu in questions:
                if qu["type"] != "truefalse":
                    order = list(range(len(qu["options"])))
                    self.rng.shuffle(order)
                    qu["answer"] = order.index(qu["answer"] - 1) + 1
                    qu["options"] = [qu["options"][i] for i in order]
        title = clean_text(q.get("title"), 80) or "Live quiz"
        self.session = LiveSession(title, clean_text(q.get("instructions"), 1500, True), st, questions, self.clock)
        return self._host_view()

    def _host(self, who, p):
        return self._host_view()

    def _start(self, who, p):
        s = self._require()
        if s.same_step(p, "lobby"):
            s.open_question(1)
        return self._host_view()

    def _reveal(self, who, p):
        s = self._require()
        if s.same_step(p, "question"):
            s.phase = "reveal"
        return self._host_view()

    def _next(self, who, p):
        s = self._require()
        if s.same_step(p, "reveal"):
            if s.q_index >= len(s.questions):
                self._finish()
            else:
                s.open_question(s.q_index + 1)
        return self._host_view()

    def _finish(self, who=None, p=None):
        s = self._require()
        if s.phase != "finished":
            s.phase = "finished"
            self.results.put_first(s.result_record(), MAX_RESULTS)
            self._record_progress(s)
        return self._host_view()

    def _close(self, who, p):
        s = self.session
        # answers given so far are never lost: an unfinished quiz is saved first
        if s is not None and s.phase != "finished" and any(c > 0 for pl in s.players for c in pl["choice"]):
            self._finish()
        self.session = None
        return self._host_view()

    def _kick(self, who, p):
        s = self._require()
        profile_id = str(param(p, "id", ""))
        pl = s.player(profile_id)
        if pl is not None:
            s.players.remove(pl)
            s.kicked.add(profile_id)
        return self._host_view()

    def _bank(self, who, p):
        return [self._bank_item(q) for q in self.content.questions]

    def _pick(self, who, p):
        cats = param(p, "categories", "all")
        n = min(max(matlab_round(float(param(p, "n", 5))), 1), MAX_QUESTIONS)
        chosen = self.quiz.select(str(param(p, "difficulty", "mixed")), cats, n, shuffle=False)
        return [self._bank_item(q) for q in chosen]                # the bank's own option order

    def _sets(self, who, p):
        return self.sets.all()

    def _saveSet(self, who, p):  # noqa: N802 - action names come from the UI
        s = param(p, "set", {})
        s = s if isinstance(s, dict) else {}
        title = clean_text(s.get("title"), 80)
        if not title:
            raise invalid("Give the quiz a title before saving it.")
        items = self._normalise(s.get("questions"))
        self._build(items, 20)                                     # same checks as when it is opened
        set_id = str(s.get("id") or "")
        if not SET_ID.match(set_id):
            set_id = "set" + datetime.now().strftime("%Y%m%d%H%M%S%f")[:-3]
        self.sets.put_first({"id": set_id, "title": title, "instructions": clean_text(s.get("instructions"), 1500, True),
                             "settings": settings_from(s.get("settings")), "questions": items, "updated": now_text()},
                            MAX_SETS)
        return self.sets.all()

    def _deleteSet(self, who, p):  # noqa: N802
        self.sets.remove(str(param(p, "id", "")))
        return self.sets.all()

    def _history(self, who, p):
        return [summary_of(r) for r in self.results.all()]

    def _result(self, who, p):
        return self._find_result(str(param(p, "id", "")))

    def _deleteResult(self, who, p):  # noqa: N802
        self.results.remove(str(param(p, "id", "")))
        return self._history(who, p)

    def _export(self, who, p):
        result_id = str(param(p, "id", ""))
        record = self._require().result_record() if not result_id else self._find_result(result_id)
        return self.exports.live_result(record)

    # ============================================================ student
    def _join(self, who, p):
        self._require_student(who)
        s = self.session
        if s is None or s.phase == "finished":
            raise quiz_state("There is no live quiz open right now.")
        if re.sub(r"\s", "", str(param(p, "code", ""))) != s.code:
            raise invalid("Wrong code - check the code on the teacher's screen.")
        if who.profile_id in s.kicked:
            raise forbidden("The teacher removed you from this quiz.")
        if s.player(who.profile_id) is None:
            if s.phase != "lobby" and not s.settings["lateJoin"]:
                raise quiz_state("This quiz has already started - late joining is switched off.")
            profile = self.profiles.get(who.profile_id) or {}
            s.new_player(who.profile_id, who.name, profile.get("roll", ""))
        return self._student_view(who)

    def _state(self, who, p):
        self._require_student(who)
        return self._student_view(who)

    def _answer(self, who, p):
        self._require_student(who)
        s = self.session
        if s is None:
            raise quiz_state("The live quiz has ended.")
        pl = s.player(who.profile_id)
        if pl is None:
            raise quiz_state("Join the quiz first.")
        k = s.q_index
        if float(param(p, "qIndex", -1)) != k or k == 0:
            raise quiz_state("Time is up - this question is closed.")
        if pl["choice"][k - 1] > 0:
            raise quiz_state("You have already answered this question.")
        if s.phase != "question":
            raise quiz_state("Time is up - this question is closed.")
        q = s.questions[k - 1]
        try:
            choice = matlab_round(float(param(p, "choice", 0)))
        except (TypeError, ValueError):
            choice = 0
        if not 1 <= choice <= len(q["options"]):
            raise invalid("Choose one of the answers.")
        now = self.clock()
        seen = pl["seen"][k - 1] if pl["seen"][k - 1] is not None else s.q_start
        rt = min(max(now - max(seen, s.q_start), 0), q["timeLimit"])
        pl["choice"][k - 1] = choice
        pl["time"][k - 1] = round_to(rt, 2)
        pl["points"][k - 1] = points(choice == q["answer"], rt, q["timeLimit"], s.settings["speedPoints"])
        pl["lastSeen"] = now
        s.tick()                                                  # the last answer reveals at once
        return self._student_view(who)

    def _leave(self, who, p):
        self._require_student(who)
        s = self.session
        if s is not None and s.phase == "lobby":
            s.players = [pl for pl in s.players if pl["id"] != who.profile_id]
        return True

    # ============================================================ views
    def _host_view(self) -> dict:
        s = self.session
        if s is None:
            return {"active": False}
        now = self.clock()
        k = s.q_index
        upto = s.scored_up_to()
        online = [now - pl["lastSeen"] <= ONLINE for pl in s.players]
        players = [{"id": pl["id"], "name": pl["name"], "roll": pl["roll"], "online": on,
                    "answered": k > 0 and pl["choice"][k - 1] > 0, "score": float(sum(pl["points"][:upto]))}
                   for pl, on in zip(s.players, online)]
        v = {"active": True, "id": s.id, "code": s.code, "title": s.title, "instructions": s.instructions,
             "settings": s.settings, "phase": s.phase, "qIndex": k, "qCount": len(s.questions),
             "remainingMs": s.remaining_ms(now), "question": [], "answered": 0, "online": sum(online),
             "players": players, "distribution": [], "answerTimes": [], "leaderboard": [], "questionStats": [],
             "created": s.created}
        if k > 0:
            v["question"] = question_view(s.questions[k - 1], True, k)
            v["answered"] = sum(1 for pl in s.players if pl["choice"][k - 1] > 0)
            if s.phase != "question":                      # nothing about the answers before the reveal
                v["distribution"] = s.distribution(k)
                v["answerTimes"] = s.answer_times(k)
        v["leaderboard"] = s.leaderboard(upto)
        if s.phase in ("finished", "reveal"):
            v["questionStats"] = s.question_stats(upto)
        return v

    def _student_view(self, who) -> dict:
        s = self.session
        v: dict[str, Any] = {"active": s is not None, "joined": False}
        if s is None:
            return v
        now = self.clock()
        v.update(title=s.title, phase=s.phase,
                 canJoin=s.phase != "finished" and (s.phase == "lobby" or s.settings["lateJoin"])
                 and who.profile_id not in s.kicked)
        pl = s.player(who.profile_id)
        if pl is None:
            return v
        pl["lastSeen"] = now
        k = s.q_index
        if s.phase == "question" and pl["seen"][k - 1] is None:
            pl["seen"][k - 1] = now                        # this student's clock starts now
        board = s.leaderboard(s.scored_up_to())
        v.update(joined=True, name=pl["name"], instructions=s.instructions, settings=s.settings, qIndex=k,
                 qCount=len(s.questions), playerCount=len(s.players), remainingMs=s.remaining_ms(now),
                 me=next(b for b in board if b["id"] == pl["id"]), question=[], mine=[], leaderboard=[])
        if k > 0:
            q = s.questions[k - 1]
            reveal = s.phase != "question"
            v["question"] = question_view(q, reveal, k)
            # points and correctness only after the reveal
            v["mine"] = {"choice": pl["choice"][k - 1], "time": pl["time"][k - 1],
                         "points": pl["points"][k - 1] if reveal else 0,
                         "correct": reveal and pl["choice"][k - 1] == q["answer"]}
            if reveal:
                v["distribution"] = s.distribution(k)
        if s.settings["showLeaderboard"] and s.phase not in ("lobby", "question"):
            v["leaderboard"] = board[:BOARD_SIZES.get(s.settings["leaderboard"], len(board))]
        return v

    # ============================================================ helpers
    def _record_progress(self, s: LiveSession) -> None:
        """Every participant's own progress gets the quiz like any other quiz mode."""
        n = s.q_index
        for pl in s.players:
            if n == 0 or not any(c > 0 for c in pl["choice"][:n]):
                continue
            if self.profiles.get(pl["id"]) is None:          # student deleted meanwhile
                continue
            times = s.fill_time(pl, n)
            results = [{"id": q["id"], "category": q["category"], "difficulty": q["difficulty"],
                        "correct": pl["choice"][k] == q["answer"], "timeLeft": max(q["timeLimit"] - times[k], 0)}
                       for k, q in enumerate(s.questions[:n])]
            summary = {**score(results), "mode": "Live Quiz"}
            try:
                self.progress.quiz(pl["id"], pl["id"], summary, results)
            except Exception:  # noqa: BLE001 - one bad progress record must not lose the results
                pass

    def _normalise(self, raw: Any) -> list[dict]:
        """Questions as sent by the browser -> items. A bank question is {bankId, timeLimit}."""
        raw = raw if isinstance(raw, list) else ([raw] if isinstance(raw, dict) else [])
        if len(raw) > MAX_QUESTIONS:
            raise invalid(f"A live quiz can have at most {MAX_QUESTIONS} questions.")
        items = []
        for k, r in enumerate(raw, start=1):
            if not isinstance(r, dict):
                raise invalid(f"Question {k} is malformed.")
            tl = _clamp_time(r.get("timeLimit", 0), 0)
            bank_id = str(r.get("bankId") or "")
            if bank_id:
                b = self.content.questions_by_id.get(bank_id)
                if b is None:
                    raise invalid(f'Question {k}: "{bank_id}" is not in the question bank.')
                items.append(item(b["id"], b["question"], b["options"], b["answer"], b["category"],
                                  b["difficulty"], b["explanation"], tl))
                continue
            text = clean_text(r.get("question"), 300, True)
            opts = r.get("options") or []
            opts = [opts] if isinstance(opts, str) else (opts if isinstance(opts, list) else [])
            opts = [clean_text(o, 120) for o in opts]
            if not text:
                raise invalid(f"Question {k} has no text.")
            if not 2 <= len(opts) <= 6 or any(not o for o in opts):
                raise invalid(f"Question {k} needs 2 to 6 answers, none of them empty.")
            ans = r.get("answer", 0)
            if not isinstance(ans, (int, float)) or isinstance(ans, bool) or ans != int(ans) or not 1 <= ans <= len(opts):
                raise invalid(f"Question {k}: mark the correct answer.")
            cat = str(r.get("category") or "")
            cat = cat if cat in self.content.categories else "General"
            diff = str(r.get("difficulty") or "medium").lower()
            diff = diff if diff in ("easy", "medium", "hard") else "medium"
            items.append(item("", text, opts, int(ans), cat, diff, clean_text(r.get("explanation"), 400, True), tl))
        return items

    @staticmethod
    def _build(items: list[dict], default_time: int) -> list[dict]:
        if not items:
            raise invalid("Add at least one question to the quiz.")
        out = []
        for k, it in enumerate(items, start=1):
            truefalse = len(it["options"]) == 2 and [o.lower() for o in it["options"]] == ["true", "false"]
            out.append({"id": it["bankId"] or f"LIVE{k}", "category": it["category"], "difficulty": it["difficulty"],
                        "type": "truefalse" if truefalse else "mcq", "question": it["question"],
                        "options": list(it["options"]), "answer": it["answer"], "explanation": it["explanation"],
                        "timeLimit": it["timeLimit"] if it["timeLimit"] > 0 else default_time})
        return out

    @staticmethod
    def _bank_item(q: dict) -> dict:
        return item(q["id"], q["question"], q["options"], q["answer"], q["category"], q["difficulty"],
                    q["explanation"], 0)

    def _find_result(self, result_id: str) -> dict:
        r = self.results.get(result_id)
        if r is None:
            raise invalid("That live quiz result no longer exists.")
        return r

    def _require(self) -> LiveSession:
        if self.session is None:
            raise quiz_state("No live quiz is open.")
        return self.session

    @staticmethod
    def _require_student(who) -> None:
        if who is None or who.role != "student":
            raise forbidden("Sign in with your student account to join a live quiz.")
