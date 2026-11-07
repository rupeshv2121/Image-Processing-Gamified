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


def error_id(fn, *args) -> str:
    with pytest.raises(AppError) as e:
        fn(*args)
    return e.value.error_id


def test_teacher_side_is_closed_without_a_pin(services):
    auth, room = services.auth, services.classroom
    assert error_id(auth.teacher_login, "") == "ImageLab:noTeacherPin"
    assert error_id(auth.teacher_setup, "123") == "ImageLab:invalidParameter"          # 6 to 32 characters
    first = auth.teacher_setup("654321")
    assert first["role"] == "teacher" and len(first["recoveryCode"]) == 14
    assert error_id(auth.teacher_setup, "999999") == "ImageLab:teacherPin"             # only once
    assert error_id(auth.teacher_login, "000000") == "ImageLab:teacherPin"
    assert error_id(auth.teacher_login, "") == "ImageLab:teacherPin"
    assert auth.teacher_login("654321")["profileId"] == "teacher"
    # the PIN can be changed but not removed; every change issues a new recovery code
    assert error_id(room.set_pin, "654321", "") == "ImageLab:invalidParameter"
    assert error_id(room.set_pin, "000000", "777777") == "ImageLab:teacherPin"
    changed = room.set_pin("654321", "777777")
    assert changed["hasPin"] and changed["recoveryCode"] != first["recoveryCode"]
    assert not room.check_recovery(first["recoveryCode"])
    assert "777777" not in str(room.settings()) and changed["recoveryCode"] not in str(room.settings())   # hashes only


def test_forgotten_pin_with_the_recovery_code(services):
    auth, room = services.auth, services.classroom
    code = auth.teacher_setup("654321")["recoveryCode"]
    assert error_id(auth.teacher_recover, "AAAA-BBBB-CCCC", "111111") == "ImageLab:teacherPin"
    # typed without dashes and in lower case still works; the code is used up
    again = auth.teacher_recover(code.replace("-", "").lower(), "222222")
    assert again["role"] == "teacher" and again["recoveryCode"] != code
    assert error_id(auth.teacher_recover, code, "333333") == "ImageLab:teacherPin"
    assert auth.teacher_login("222222")["role"] == "teacher"
    assert error_id(auth.teacher_login, "654321") == "ImageLab:teacherPin"
    fresh = room.new_recovery("222222")["recoveryCode"]
    assert room.check_recovery(fresh) and not room.check_recovery(again["recoveryCode"])


def test_wrong_recovery_codes_lock(services):
    services.auth.teacher_setup("654321")
    for _ in range(5):
        with pytest.raises(AppError):
            services.auth.teacher_recover("AAAA-BBBB-CCCC", "111111")
    assert error_id(services.auth.teacher_recover, "AAAA-BBBB-CCCC", "111111") == "ImageLab:locked"


def test_pin_from_the_matlab_version_is_upgraded(services):
    room = services.classroom
    s = room.settings()
    s.update(pinHash=hash_pin("ab", "1234"), salt="ab")                    # 4 characters were allowed then
    room._save(s)
    assert room.has_pin() and not room.check_pin("0000")
    assert services.auth.teacher_login("1234")["role"] == "teacher"
    s = room.settings()
    assert s["pinHash"] == "" and s["pin"]["iterations"] > 1000           # now PBKDF2
    assert room.check_pin("1234")


def test_reset_command_clears_only_the_pin(settings, services, monkeypatch):
    from imagelab import reset_pin
    services.auth.teacher_setup("654321")
    services.auth.register("Dee", "R4", "secret1")
    monkeypatch.setenv("IMAGELAB_DATA_DIR", str(settings.data_dir))
    assert reset_pin.main(["--yes"]) == 0
    assert not services.classroom.has_pin()
    assert services.auth.login("R4", "secret1")["role"] == "student"
    assert services.auth.teacher_setup("888888")["role"] == "teacher"


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
