from __future__ import annotations

import pytest

from imagelab.errors import AppError
from imagelab.services.auth import pbkdf2
from imagelab.services.classroom import hash_pin


def test_pbkdf2_matches_the_standard_test_vector():
    # RFC 7914 section 11: PBKDF2-HMAC-SHA256("passwd", "salt", 1, 64) - first 32 bytes
    assert pbkdf2("passwd", b"salt".hex(), 1) == "55ac046e56e3089fec1691c22544b605f94185216dde0465e68b9d57c20dacbc"


def test_pin_hash_is_salted_sha256():
    import hashlib

    assert hash_pin("ab", "1234") == hashlib.sha256(b"imagelab:ab:1234").hexdigest()
    assert hash_pin("ab", "1234") != hash_pin("cd", "1234")


def test_first_sign_in_claims_the_account(services):
    services.profiles.add("Ada Lovelace", "R1")
    with pytest.raises(AppError) as e:
        services.auth.login("r1", "secret1")
    assert e.value.error_id == "ImageLab:needsPassword"
    s = services.auth.login("r1", "secret1", claim=True)
    assert s["role"] == "student" and s["name"] == "Ada Lovelace"
    assert services.auth.resolve(s["token"]).profile_id == s["profileId"]
    assert services.auth.login("ada lovelace", "secret1")["profileId"] == s["profileId"]   # by name too


def test_wrong_passwords_lock_the_account(services):
    services.profiles.add("Bob", "R2")
    services.auth.login("R2", "secret1", claim=True)
    for _ in range(5):
        with pytest.raises(AppError) as e:
            services.auth.login("R2", "wrong!!")
        assert e.value.error_id == "ImageLab:badLogin"
    with pytest.raises(AppError) as e:
        services.auth.login("R2", "secret1")
    assert e.value.error_id == "ImageLab:locked"


def test_unknown_student_gets_the_generic_message(services):
    with pytest.raises(AppError) as e:
        services.auth.login("nobody", "whatever1")
    assert e.value.error_id == "ImageLab:badLogin"


def test_reset_password_ends_sessions_and_forces_a_change(services):
    students = services.profiles.add("Cy", "R3")
    sid = students[-1]["id"]
    token = services.auth.login("R3", "secret1", claim=True)["token"]
    pw = services.auth.reset_password(sid)["password"]
    assert len(pw) == 8
    assert services.auth.resolve(token) is None
    s = services.auth.login("R3", pw)
    assert s["mustChange"] is True
    assert services.auth.change_password(sid, "", "brand-new-1")
    assert services.auth.login("R3", "brand-new-1")["mustChange"] is False


def test_teacher_pin(services):
    assert services.auth.teacher_login("")["role"] == "teacher"        # no PIN set yet
    services.classroom.set_pin("", "4321")
    with pytest.raises(AppError) as e:
        services.auth.teacher_login("0000")
    assert e.value.error_id == "ImageLab:teacherPin"
    assert services.auth.teacher_login("4321")["profileId"] == "teacher"


def test_self_registration_can_be_switched_off(services):
    services.auth.register("Dee", "R4", "secret1")
    services.classroom.set_self_register(False)
    with pytest.raises(AppError):
        services.auth.register("Eve", "R5", "secret1")


def test_malformed_tokens_give_no_session(services):
    for token in ("", "a" * 64, "x' OR 1=1", None):
        assert services.auth.resolve(token) is None


def test_removing_a_profile_removes_its_account_and_data(services):
    sid = services.profiles.add("Fay", "R6")[-1]["id"]
    token = services.auth.login("R6", "secret1", claim=True)["token"]
    services.progress.topic(sid, sid, "Topic")
    services.submissions.record(sid, "negative", "out = img;", {"passed": False, "match": 1})
    services.profiles.remove(sid)
    assert services.auth.resolve(token) is None
    assert services.repos.accounts.get(sid) is None
    assert services.repos.progress.get(sid) is None
    assert services.submissions.summary(sid) == {}
