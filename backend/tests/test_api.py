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
    assert {"noise_fighter", "morphologist", "shape_analyst"} <= earned
    for gone in ("compare", "morphology", "structuringElement"):
        assert api.error(gone, token=tok)["errorId"] == "ImageLab:unknownOperation"


def test_quiz_submit_with_leaderboard(api, teacher):
    pw = api.ok("profiles", action="add", name="Stu", roll="S1")["password"]
    tok = api.ok("auth", token="", action="login", identifier="S1", password=pw)["token"]
    qs = api.ok("quizQuestions", token=tok, n=3)
    assert len(qs) == 3 and {"id", "options", "answer", "kernel"} <= set(qs[0])
    res = [{"category": "Noise", "difficulty": "easy", "correct": True, "timeLeft": 2}]
    data = api.ok("quizSubmit", token=tok, results=res, name="Stu", roll="S1")
    assert data["summary"]["score"] == 110 and data["leaderboard"][0]["Rank"] == 1
    assert api.ok("leaderboard", token="")[0]["Name"] == "Stu"
    assert api.error("leaderboard", token=tok, action="clear")["errorId"] == "ImageLab:forbidden"
    assert api.ok("leaderboard", action="clear") == []


def test_code_lab_records_submissions_and_badges(api, matlab, teacher):
    pw = api.ok("profiles", action="add", name="Stu", roll="S1")["password"]
    tok = api.ok("auth", token="", action="login", identifier="S1", password=pw)["token"]
    assert api.error("codeTaskSolution", token=tok, taskId="negative")["errorId"] == "ImageLab:invalidParameter"
    api.ok("runCode", token=tok, taskId="negative", code="out = 1 - img;")
    assert api.ok("codeTasks", token=tok)["solved"] == ["negative"]
    assert api.ok("codeTaskSolution", token=tok, taskId="negative")["code"]
    sid = api.ok("auth", token=tok, action="me")["profileId"]
    sub = api.ok("classroom", action="submission", id=sid, taskId="negative")
    assert sub["entry"]["passed"] and sub["entry"]["passedCode"] == "out = 1 - img;"
    api.ok("classroom", action="setCodeTask", taskId="gamma", status="locked")
    assert api.error("runCode", token=tok, taskId="gamma", code="x")["errorId"] == "ImageLab:taskLocked"


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
               steps=["median", "clahe"])
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
    assert s["score"] == round(40 * 10 + 600 * 0.3) + 100


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


def test_remote_devices_only_get_the_live_quiz(settings, matlab):
    with TestClient(create_app(settings, matlab), client=("192.168.1.50", 5000)) as c:
        c.app.state.dispatcher.data_ready.wait(5)
        assert c.get("/api/status").json()["remote"] is True
        assert c.post("/api/run", json={"op": "auth", "params": {"action": "options"}}).json()["ok"]
        r = c.post("/api/run", json={"op": "runCode", "params": {"code": "x"}})
        assert r.status_code == 403 and r.json()["errorId"] == "ImageLab:remote"
        assert c.post("/api/run", json={"op": "auth", "params": {"action": "teacherLogin"}}).status_code == 403
        assert c.get("/api/image/x.png").status_code == 403
        assert c.post("/api/upload", json={}).status_code == 403


def test_nan_and_inf_become_null(api, matlab, monkeypatch):
    monkeypatch.setattr(matlab, "call", lambda op, params=None: {"psnr": float("inf"), "x": float("nan")})
    assert api.ok("noise", id="x") == {"psnr": None, "x": None}
