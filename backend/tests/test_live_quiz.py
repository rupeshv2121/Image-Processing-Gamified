from __future__ import annotations

import pytest

from imagelab.errors import AppError
from imagelab.services.auth import Session


class Clock:
    def __init__(self):
        self.t = 1000.0

    def __call__(self):
        return self.t


def _student(services, name, roll) -> Session:
    pid = services.profiles.add(name, roll)[-1]["id"]
    return Session("tok-" + pid, "student", pid, name, 1e12, 0)


@pytest.fixture
def live(services):
    services.live.clock = Clock()
    return services.live


QUIZ = {"title": "Quiz", "settings": {"timeLimit": 10},
        "questions": [{"bankId": "FUN2"}, {"question": "Is 2 + 2 = 4?", "options": ["Yes", "No"], "answer": 1,
                                            "timeLimit": 5}]}


def test_full_live_quiz(services, live):
    teacher = Session("t", "teacher", "teacher", "Teacher", 1e12, 0)
    ann, bob = _student(services, "Ann", "L1"), _student(services, "Bob", "L2")
    host = live.handle("create", teacher, {"quiz": QUIZ})
    code = host["code"]
    with pytest.raises(AppError):
        live.handle("join", ann, {"code": "000000"})
    for s in (ann, bob):
        assert live.handle("join", s, {"code": code})["joined"]
    live.handle("start", teacher, {"qIndex": 0})
    state = live.handle("state", ann, {})
    assert "answer" not in state["question"]                             # never before the reveal
    live.clock.t += 2
    live.handle("answer", ann, {"qIndex": 1, "choice": 3})              # correct (256)
    with pytest.raises(AppError):
        live.handle("answer", ann, {"qIndex": 1, "choice": 1})          # only once
    live.clock.t += 4
    after = live.handle("answer", bob, {"qIndex": 1, "choice": 1})      # wrong; everyone answered -> reveal
    assert after["phase"] == "reveal" and after["mine"]["correct"] is False
    board = live.handle("host", teacher, {})["leaderboard"]
    assert [b["name"] for b in board] == ["Ann", "Bob"]
    assert board[0]["score"] == 1000 * (1 - 0.5 * 2 / 10)
    live.handle("next", teacher, {"qIndex": 1})
    live.handle("answer", bob, {"qIndex": 2, "choice": 1})
    done = live.handle("finish", teacher, {})
    assert done["phase"] == "finished"
    history = live.handle("history", teacher, {})
    assert history[0]["playerCount"] == 2 and "leaderboard" not in history[0]
    assert services.progress.load(ann.profile_id)["quizHistory"][-1]["mode"] == "Live Quiz"
    files = live.handle("export", teacher, {"id": history[0]["id"]})
    assert (services.settings.report_dir / files["xlsx"]).is_file()
    live.handle("close", teacher, {})
    assert live.handle("host", teacher, {}) == {"active": False}


def test_time_limit_closes_the_question(services, live):
    teacher = Session("t", "teacher", "teacher", "Teacher", 1e12, 0)
    ann = _student(services, "Ann", "L1")
    live.handle("create", teacher, {"quiz": QUIZ})
    live.handle("join", ann, {"code": live.session.code})
    live.handle("start", teacher, {})
    live.clock.t += 11.5                                               # 10 s limit + 1 s grace
    assert live.handle("host", teacher, {})["phase"] == "reveal"
    with pytest.raises(AppError):
        live.handle("answer", ann, {"qIndex": 1, "choice": 3})


def test_invalid_quiz_definitions_are_rejected(services, live):
    teacher = Session("t", "teacher", "teacher", "Teacher", 1e12, 0)
    for bad in ({"questions": []}, {"questions": [{"question": "Q", "options": ["only one"], "answer": 1}]},
                {"questions": [{"bankId": "NOPE"}]}):
        with pytest.raises(AppError):
            live.handle("create", teacher, {"quiz": bad})


def test_saved_sets_newest_first(services, live):
    teacher = Session("t", "teacher", "teacher", "Teacher", 1e12, 0)
    live.handle("saveSet", teacher, {"set": {"id": "a", "title": "A", "questions": QUIZ["questions"]}})
    sets = live.handle("saveSet", teacher, {"set": {"id": "b", "title": "B", "questions": QUIZ["questions"]}})
    assert [s["id"] for s in sets] == ["b", "a"]
    assert [s["id"] for s in live.handle("deleteSet", teacher, {"id": "b"})] == ["a"]
