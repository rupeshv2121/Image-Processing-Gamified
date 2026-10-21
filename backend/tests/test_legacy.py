"""Import of the MATLAB 1.x data: jsonencode collapses 1-element arrays, which the import undoes."""

from __future__ import annotations

from imagelab.services.auth import new_account
from imagelab.storage.legacy import LegacyImporter


def test_import_normalises_matlab_json(services, settings):
    account = new_account("secret1", False)
    legacy = {
        "profiles": [{"id": "default", "name": "First", "roll": "", "created": ""},
                     {"id": "s0123456789", "name": "Old Student", "roll": "R9", "created": "2026-01-01"}],
        "accounts": {"s0123456789": account},
        "progress": {"s0123456789": {"xp": 50, "experimentsCompleted": 3, "topicsCompleted": ["Intro"],
                                     "categoryStats": {"name": "Noise", "answered": 2, "correct": 1},
                                     "badges": [], "activities": {"filters": "median"}}},
        "submissions": {"s0123456789": {"negative": {"attempts": 2, "passed": True, "lastCode": "out = 1 - img;"}}},
        "classroom": {"pinHash": "abc", "salt": "s", "selfRegister": False,
                      "experiments": {"number": 2, "title": "E2", "status": "locked", "due": "", "note": ""},
                      "codeTasks": []},
        "kernels": {"name": "row", "kernel": {"rows": 1, "cols": 3, "data": [1, 2, 1]}},
        "leaderboard": {"Name": "Old Student", "Roll": "R9", "Score": 300, "Accuracy": 80, "BestStreak": 3,
                        "Mode": "Rapid Fire", "Date": "2026-01-02 10:00"},
        "liveQuizSets": [], "liveQuizResults": {"id": "LQ1", "leaderboard": {"name": "x", "choices": 1},
                                                "questions": []},
    }
    LegacyImporter(services.repos, services.matlab, settings.data_dir, settings.legacy_leaderboard).store(legacy)

    assert [p["name"] for p in services.profiles.roster()] == ["First", "Old Student"]
    assert services.auth.login("R9", "secret1")["name"] == "Old Student"          # password still works
    p = services.progress.load("s0123456789")
    assert p["experimentsCompleted"] == [3] and p["categoryStats"][0]["name"] == "Noise"
    assert p["activities"] == {"filters": ["median"]}
    assert services.submissions.get("s0123456789", "negative")["passed"] is True
    s = services.classroom.settings()
    assert s["experiments"]["2"]["status"] == "locked" and s["selfRegister"] is False
    assert services.kernels.list()[0]["kernel"] == {"rows": 1, "cols": 3, "data": [1.0, 2.0, 1.0]}
    assert services.leaderboard.get()[0]["Score"] == 300
    assert services.repos.live_results.get("LQ1")["leaderboard"][0]["choices"] == [1]


def test_import_runs_once(services, settings):
    importer = LegacyImporter(services.repos, services.matlab, settings.data_dir, settings.legacy_leaderboard)
    assert importer.pending and not importer.needs_matlab                      # no .mat files here
    importer.run()
    assert not importer.pending
