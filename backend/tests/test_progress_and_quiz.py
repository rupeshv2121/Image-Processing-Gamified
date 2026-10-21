from __future__ import annotations

import random
from datetime import date, timedelta

from imagelab.services.progress import daily_streak, default_progress
from imagelab.services.quiz import score


def _student(services, name="Ann", roll="P1") -> str:
    return services.profiles.add(name, roll)[-1]["id"]


def test_new_activity_earns_xp_once(services):
    sid = _student(services)
    assert services.progress.activity(sid, sid, "filters", "median")["xp"] == 10
    assert services.progress.activity(sid, sid, "filters", "median")["xp"] == 10


def test_guests_and_the_teacher_record_nothing(services):
    assert services.progress.topic("guest", None, "Topic")["xp"] == 0
    p = services.progress.topic("teacher", None, "Topic")
    assert p["xp"] == 0 and p["topicsCompleted"] == [] and p["profileId"] == "teacher"
    assert services.repos.progress.all() == {}


def test_badge_is_awarded_with_bonus_xp(services):
    sid = _student(services)
    services.progress.activities(sid, sid, [("filters", f) for f in ("a", "b", "c", "d", "e")])
    p = services.progress.activity(sid, sid, "filters", "f")
    assert p["newBadges"] == ["Filter Master"]
    assert p["xp"] == 60 + 100
    assert any(e["type"] == "badge" for e in services.progress.load(sid)["events"])


def test_quiz_updates_topic_stats(services):
    sid = _student(services)
    results = [{"category": "Noise", "difficulty": "easy", "correct": True, "timeLeft": 4},
               {"category": "Noise", "difficulty": "hard", "correct": False, "timeLeft": 0}]
    s = {**score(results), "mode": "Rapid Fire"}
    p = services.progress.quiz(sid, sid, s, results)
    assert p["quizzesTaken"] == 1 and p["questionsAnswered"] == 2 and p["questionsCorrect"] == 1
    assert p["categoryStats"] == [{"name": "Noise", "answered": 2, "correct": 1}]


def test_score_formula():
    # 100 x 1.5 + 5 x 4 s, then a streak of 2: 100 x 2 + 0 + 10
    r = score([{"correct": True, "difficulty": "medium", "timeLeft": 4},
               {"correct": True, "difficulty": "hard", "timeLeft": 0}])
    assert r == {"score": 380, "correct": 2, "total": 2, "accuracy": 100.0, "bestStreak": 2}


def test_daily_streak_counts_back_from_yesterday():
    p = default_progress()
    today = date(2026, 10, 21)
    p["dailyChallenges"] = [{"date": (today - timedelta(days=d)).isoformat(), "solved": True} for d in (1, 2, 3)]
    assert daily_streak(p, today) == 3
    p["dailyChallenges"].append({"date": today.isoformat(), "solved": False})
    assert daily_streak(p, today) == 3


def test_weak_topic_quiz_focuses_on_the_weak_category(services):
    services.quiz.rng = random.Random(1)
    stats = [{"name": "Noise", "answered": 20, "correct": 2}, {"name": "Histogram", "answered": 20, "correct": 20}]
    qs, plan = services.quiz.weak(stats, 15)
    assert len(qs) == 15 and len({q["id"] for q in qs}) == 15          # no repeated questions
    assert plan[0]["category"] == "Noise"
    assert sum(q["category"] == "Noise" for q in qs) > sum(q["category"] == "Histogram" for q in qs)


def test_shuffled_options_keep_the_right_answer(services):
    bank = services.content.questions_by_id
    for q in services.quiz.select("mixed", "all", 30):
        original = bank[q["id"]]
        assert q["options"][q["answer"] - 1] == original["options"][original["answer"] - 1]


def test_kernel_questions_use_matlab_presets_once(services, matlab):
    qs = services.quiz.kernel_questions(5) + services.quiz.kernel_questions(5)
    assert len(qs) == 10 and all(len(q["options"]) == 4 for q in qs)
    assert sum(op == "kernelPresets" for op, _ in matlab.calls) == 1      # cached after the first call
