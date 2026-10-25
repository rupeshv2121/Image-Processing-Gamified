"""The HTTP / RPC layer with a fake MATLAB."""

from __future__ import annotations

import base64

from fastapi.testclient import TestClient

from imagelab.web.app import create_app


def test_status(client):
    s = client.get("/api/status").json()
    assert s["ready"] and s["matlab"] and s["remote"] is False


def test_unknown_operation(api):
    assert api.error("nope")["errorId"] == "ImageLab:unknownOperation"


def test_bad_requests(client):
    assert client.post("/api/run", content=b"not json").status_code == 400
    assert client.post("/api/run", json={"params": {}}).status_code == 400


def test_image_ops_go_to_matlab_without_internal_params(api, matlab):
    api.ok("loadSample", name="peppers.png", track=False)
    op, params = matlab.calls[-1]
    assert op == "loadSample" and params == {"name": "peppers.png"}


def test_internal_import_op_is_not_reachable(api):
    assert api.error("importImage", path="C:/Windows/win.ini")["errorId"] == "ImageLab:unknownOperation"


def test_access_rules(api, teacher):
    assert api.error("profiles", token="")["errorId"] == "ImageLab:auth"                # guests see no students
    assert api.error("classroom", token="", action="overview")["errorId"] == "ImageLab:auth"
    student = api.ok("profiles", action="add", name="Stu", roll="S1")
    s_token = api.ok("auth", token="", action="login", identifier="S1", password=student["password"])["token"]
    assert api.error("classroom", token=s_token, action="overview")["errorId"] == "ImageLab:forbidden"
    assert api.ok("classroom", token=s_token, action="get")["hasPin"] is False
    assert api.ok("auth", token=s_token, action="me")["name"] == "Stu"
    assert api.error("live", token=s_token, action="start")["errorId"] == "ImageLab:forbidden"   # students do not host
    api.ok("auth", token=s_token, action="logout")
    assert api.error("progress", token=s_token)["errorId"] == "ImageLab:auth"


def test_result_cache_and_activity(api, matlab, teacher):
    pw = api.ok("profiles", action="add", name="Stu", roll="S1")["password"]
    tok = api.ok("auth", token="", action="login", identifier="S1", password=pw)["token"]
    img = api.ok("loadSample", token=tok, name="peppers.png")["id"]
    n = len(matlab.calls)
    first = api.raw("filter", token=tok, id=img, name="median", k=3)
    second = api.raw("filter", token=tok, id=img, name="median", k=3)
    assert first["cached"] is False and second["cached"] is True
    assert second["data"] == first["data"] and len(matlab.calls) == n + 1          # MATLAB ran once
    p = api.ok("progress", token=tok)
    assert p["activities"] == {"filters": ["median"]} and p["xp"] == 10
    (matlab.image_dir / f'{first["data"]["id"]}.png').unlink()                    # image cleaned up
    assert api.raw("filter", token=tok, id=img, name="median", k=3)["cached"] is False


def test_syllabus_activities_earn_badges(api, teacher):
    pw = api.ok("profiles", action="add", name="Stu", roll="S1")["password"]
    tok = api.ok("auth", token="", action="login", identifier="S1", password=pw)["token"]
    for t in ("gaussian", "rayleigh", "uniform"):
        api.ok("noise", token=tok, id="x", type=t)
    api.ok("deconvolve", token=tok, id="x", method="wiener")
    api.ok("regions", token=tok, id="x")
    api.ok("edgeLink", token=tok, id="x", method="hough")
    api.ok("describeRegion", token=tok, id="x", region=1)
    p = api.ok("progress", token=tok)
    assert p["activities"]["deblur"] == ["wiener"]
    assert p["activities"]["edgelink"] == ["hough"]
    earned = {b["id"] for b in p["badges"] if b["earned"]}
    assert {"noise_fighter", "region_describer", "shape_analyst"} <= earned
    for gone in ("compare", "morphology", "structuringElement"):
        assert api.error(gone, token=tok)["errorId"] == "ImageLab:unknownOperation"


def test_quiz_submit_with_leaderboard(api, teacher):
    pw = api.ok("profiles", action="add", name="Stu", roll="S1")["password"]
    tok = api.ok("auth", token="", action="login", identifier="S1", password=pw)["token"]
    qs = api.ok("quizQuestions", token=tok, n=3)
    assert len(qs) == 3 and {"id", "options", "answer", "kernel"} <= set(qs[0])
    res = [{"category": "Noise", "difficulty": "easy", "correct": True, "timeLeft": 2}]
    data = api.ok("quizSubmit", token=tok, results=res, name="Somebody else", roll="X9")
    assert data["summary"]["score"] == 110 and data["leaderboard"][0]["Rank"] == 1
    entry = api.ok("leaderboard", token="")[0]
    assert (entry["Name"], entry["Roll"]) == ("Stu", "S1") and entry["ProfileId"]   # always the student's own name
    assert api.ok("quizSubmit", token=tok, results=res)["leaderboard"] == []        # no name: not posted
    assert api.error("leaderboard", token=tok, action="clear")["errorId"] == "ImageLab:forbidden"
    assert api.ok("leaderboard", action="clear") == []


def test_leaderboard_follows_renamed_and_deleted_students(api, teacher):
    added = api.ok("profiles", action="add", name="Stu", roll="S1")
    tok = api.ok("auth", token="", action="login", identifier="S1", password=added["password"])["token"]
    res = [{"category": "Noise", "difficulty": "easy", "correct": True, "timeLeft": 2}]
    for _ in range(2):
        api.ok("quizSubmit", token=tok, results=res, name="x")
    api.ok("leaderboard", token=tok, action="add", entry={"name": "Fake", "score": 5, "mode": "Challenge (easy)"})
    board = api.ok("leaderboard")
    assert len(board) == 3 and {e["Name"] for e in board} == {"Stu"}
    api.ok("profiles", action="update", id=added["id"], name="Stuart", roll="S1")
    assert {e["Name"] for e in api.ok("leaderboard")} == {"Stuart"}
    api.ok("profiles", action="remove", id=added["id"])
    assert api.ok("leaderboard") == []


def test_students_get_their_xp_with_every_answer(api, teacher):
    pw = api.ok("profiles", action="add", name="Stu", roll="S1")["password"]
    tok = api.ok("auth", token="", action="login", identifier="S1", password=pw)["token"]
    r = api.raw("filter", token=tok, id="x", name="median", k=3)
    assert r["xp"] == {"xp": 10, "level": 1}
    assert "xp" not in api.raw("filter", id="x", name="mean", k=3)             # the teacher has no XP


def _task(**extra):
    return {"title": "Negative", "level": "Easy", "instructions": "Line one\nLine two", "starter": "out = img;",
            "solution": "out = 1 - img;", "hints": "Use 1 - img", "forbidden": "imcomplement, conv2",
            "sample": "peppers.png", "prep": "gray", "compare": "image", "tol": 0.001, "border": 0, **extra}


def test_teacher_writes_code_lab_tasks(api, matlab, teacher):
    pw = api.ok("profiles", action="add", name="Stu", roll="S1")["password"]
    tok = api.ok("auth", token="", action="login", identifier="S1", password=pw)["token"]
    assert api.ok("codeTasks", token=tok)["tasks"] == []                         # nothing ready-made
    assert api.ok("codeTaskEdit", action="templates")[0]["solution"] == "out = 1 - img;"
    assert api.ok("codeTaskEdit", action="check", task=_task(title=""))["ok"]
    assert api.error("codeTaskEdit", action="save", task=_task(sample="nope.png"))["errorId"] == "ImageLab:invalidParameter"
    assert api.error("codeTaskEdit", action="save", task=_task(forbidden="rm -rf"))["errorId"] == "ImageLab:invalidParameter"
    task = api.ok("codeTaskEdit", action="save", task=_task())["task"]
    assert task["status"] == "draft" and task["instructions"] == ["Line one", "Line two"]
    assert task["forbidden"] == ["imcomplement", "conv2"]
    assert api.ok("codeTasks", token=tok)["tasks"] == []                         # drafts are hidden
    assert api.error("codeTaskEdit", token=tok, action="list")["errorId"] == "ImageLab:forbidden"
    tid = task["id"]
    api.ok("codeTaskEdit", action="setState", id=tid, status="assigned", due="2020-01-01", note="soon")

    listed = api.ok("codeTasks", token=tok)["tasks"]
    assert [t["id"] for t in listed] == [tid] and "solution" not in listed[0] and listed[0]["teacherNote"] == "soon"
    assert api.ok("codeTaskStart", token=tok, taskId=tid)["inputId"]
    assert api.error("codeTaskSolution", token=tok, taskId=tid)["errorId"] == "ImageLab:invalidParameter"
    api.ok("runCode", token=tok, taskId=tid, code="out = 1 - img;")
    op, params = matlab.calls[-1]
    assert op == "runCode" and params["task"]["solution"] == "out = 1 - img;"      # MATLAB grades against it
    assert api.ok("codeTasks", token=tok)["solved"] == [tid]
    assert api.ok("codeTaskSolution", token=tok, taskId=tid)["code"] == "out = 1 - img;"
    sid = api.ok("auth", token=tok, action="me")["profileId"]
    sub = api.ok("classroom", action="submission", id=sid, taskId=tid)
    assert sub["entry"]["passed"] and sub["entry"]["passedCode"] == "out = 1 - img;"
    o = api.ok("classroom", action="overview")
    assert o["codeTasks"][0]["solvedBy"] == 1 and o["dashboard"]["overdueCount"] == 1
    assert api.ok("classroom", action="student", id=sid)["code"][0]["passed"]

    edited = api.ok("codeTaskEdit", action="save", task={**_task(title="Negative 2"), "id": tid, "status": "locked"})
    assert edited["task"]["id"] == tid and edited["task"]["created"] == task["created"]
    assert api.error("runCode", token=tok, taskId=tid, code="x")["errorId"] == "ImageLab:taskLocked"
    api.ok("codeTaskEdit", action="remove", id=tid)
    assert api.ok("codeTasks", token=tok)["tasks"] == []
    assert api.ok("classroom", action="submissions")["tasks"] == []


def test_classroom_views(api, teacher):
    api.ok("profiles", action="add", name="Stu", roll="S1")
    api.ok("classroom", action="setExperiment", number=2, status="assigned", due="2020-01-01", note="<b>hi</b>")
    view = api.ok("classroom", action="get")
    assert view["experiments"][1] == {"number": 2, "title": "Experiment 2", "status": "assigned",
                                      "due": "2020-01-01", "note": "bhi/b"}
    o = api.ok("classroom", action="overview")
    assert o["studentCount"] == 2 and o["dashboard"]["overdueCount"] == 1
    assert any("overdue" in i for a in o["dashboard"]["attention"] for i in a["issues"])
    assert len(api.ok("classroom", action="submissions")["students"]) == 2
    files = api.ok("classroom", action="export")
    assert files["csv"].endswith(".csv")
    assert api.error("classroom", action="setExperiment", number=99)["errorId"] == "ImageLab:invalidParameter"


def test_games(api):
    d = api.ok("pipelineStart", id="x", problemId="spcontrast")
    r = api.ok("pipelineRun", problemId="spcontrast", cleanId=d["cleanId"], degradedId=d["degradedId"],
               steps=["median", "histeq"])
    assert r["verdict"] == "correct" and r["points"] == 100 and len(r["steps"]) == 2
    assert api.ok("pipelineRun", problemId="spcontrast", cleanId=d["cleanId"], degradedId=d["degradedId"],
                  steps=["mean"])["verdict"] == "wrong"
    a = api.ok("dailyStart", date="2026-01-01")
    b = api.ok("dailyStart", date="2026-01-01")
    assert (a["problemId"], a["sample"]) == (b["problemId"], b["sample"])        # same puzzle for everybody
    assert api.error("dailyStart", date="not-a-date")["errorId"] == "ImageLab:invalidParameter"
    c = api.ok("challengeStart", id="x", level="hard")
    s = api.ok("challengeScore", cleanId=c["cleanId"], degradedId=c["degradedId"], timeUsed=30, timeLimit=60,
               steps=[{"block": "median", "k": 3}])
    assert s["score"] == 60 * 10 + 100                    # 60 x PSNR gain + time bonus


def test_kernels(api):
    assert api.ok("saveKernel", name="box", kernel=[[1, 1, 1], [1, 1, 1], [1, 1, 1]])[0]["kernel"]["rows"] == 3
    assert api.error("saveKernel", name="even", kernel=[[1, 1], [1, 1]])["errorId"] == "ImageLab:invalidParameter"
    assert api.ok("listKernels")[0]["name"] == "box"


def test_source_lookup(api):
    d = api.ok("source", name="medianFilterManual")
    assert d["file"].endswith("medianFilterManual.m") and "function" in d["code"]
    assert api.error("source", name="../secret")["errorId"] == "ImageLab:invalidParameter"


def test_upload(client, matlab):
    data = base64.b64encode(b"\x89PNG fake").decode()
    r = client.post("/api/upload", json={"name": "a.png", "data": data}).json()
    assert r["ok"] and matlab.calls[-1][0] == "importImage"
    assert not client.post("/api/upload", json={"name": "a.exe", "data": data}).json()["ok"]
    assert list(matlab.image_dir.parent.joinpath("uploads").iterdir()) == []      # temporary file removed


def test_students_devices_get_everything_but_the_code_lab(settings, matlab, api, teacher):
    pw = api.ok("profiles", action="add", name="Stu", roll="S1")["password"]
    with TestClient(create_app(settings, matlab), client=("192.168.1.50", 5000)) as c:
        c.app.state.dispatcher.data_ready.wait(5)

        def run(op, **params):
            return c.post("/api/run", json={"op": op, "params": params}).json()

        assert c.get("/api/status").json()["remote"] is True
        assert run("auth", action="options")["ok"]
        assert run("filter", id="x", name="mean")["errorId"] == "ImageLab:remote"         # sign in first
        assert run("auth", action="teacherLogin")["errorId"] == "ImageLab:remote"         # no teacher mode
        tok = run("auth", action="login", identifier="S1", password=pw)["data"]["token"]
        assert run("filter", id="x", name="mean", token=tok)["ok"]
        assert run("progress", token=tok)["ok"] and run("live", action="state", token=tok)["ok"]
        assert run("runCode", code="x", token=tok)["errorId"] == "ImageLab:remote"         # arbitrary MATLAB code
        assert run("codeWarmup", token=tok)["errorId"] == "ImageLab:remote"
        assert run("filter", id="x", name="mean", token=teacher)["errorId"] == "ImageLab:remote"
        image_id = run("loadSample", name="peppers.png", token=tok)["data"]["id"]
        assert c.get(f"/api/image/{image_id}.png").status_code == 200
        data = base64.b64encode(b"\x89PNG fake").decode()
        assert c.post("/api/upload", json={"name": "a.png", "data": data}).status_code == 403
        assert c.post("/api/upload", json={"name": "a.png", "data": data, "token": tok}).json()["ok"]


def test_nan_and_inf_become_null(api, matlab, monkeypatch):
    monkeypatch.setattr(matlab, "call", lambda op, params=None: {"psnr": float("inf"), "x": float("nan")})
    assert api.ok("noise", id="x") == {"psnr": None, "x": None}
