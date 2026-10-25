"""End to end with a real MATLAB engine (slow: set IMAGELAB_MATLAB_TESTS=1 to run).

Runs on an isolated COPY of the project's data/ files (the originals are
only read): imports them, checks that passwords hashed by the MATLAB
version still verify, then drives every operation through HTTP like the UI.
"""

from __future__ import annotations

import os
import shutil
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from conftest import Api
from imagelab.config import PROJECT_ROOT, Settings
from imagelab.services.auth import pbkdf2
from imagelab.services.classroom import hash_pin
from imagelab.web.app import create_app

pytestmark = [pytest.mark.matlab,
              pytest.mark.skipif(os.environ.get("IMAGELAB_MATLAB_TESTS") != "1", reason="needs MATLAB")]


@pytest.fixture(scope="module")
def live_app(tmp_path_factory):
    tmp = tmp_path_factory.mktemp("imagelab")
    data = tmp / "data"
    if (PROJECT_ROOT / "data").is_dir():                 # an isolated copy - never the real folder
        shutil.copytree(PROJECT_ROOT / "data", data, ignore=shutil.ignore_patterns("imagelab.db*"))
    board = PROJECT_ROOT / "quizzes" / "leaderboard.mat"
    if board.is_file():
        shutil.copy2(board, tmp / "leaderboard.mat")
    # MATLAB's generateReport.m always writes to the project's reports/output
    settings = Settings(data_dir=data, runtime_dir=tmp / "runtime", report_dir=PROJECT_ROOT / "reports" / "output",
                        legacy_leaderboard=tmp / "leaderboard.mat", keep_hours=0, open_browser=False)
    app = create_app(settings)
    with TestClient(app) as client:
        assert app.state.dispatcher.data_ready.wait(300), "MATLAB start / import timed out"
        yield client, app, settings


def test_hashes_match_the_matlab_version(live_app):
    _, app, _ = live_app
    eng = app.state.services.matlab.engine
    eng.eval("f = javax.crypto.SecretKeyFactory.getInstance('PBKDF2WithHmacSHA256');"
             "salt = typecast(uint8(sscanf('00112233445566778899aabbccddeeff', '%2x')'), 'int8');"
             "spec = javax.crypto.spec.PBEKeySpec(java.lang.String('pässword1').toCharArray(), salt, 1000, 256);"
             "k = typecast(f.generateSecret(spec).getEncoded(), 'uint8');"
             "h = lower(reshape(dec2hex(k, 2).', 1, []));"
             "md = java.security.MessageDigest.getInstance('SHA-256');"
             "d = typecast(md.digest(uint8(unicode2native('imagelab:ab:1234', 'UTF-8'))), 'uint8');"
             "pin = lower(reshape(dec2hex(d, 2).', 1, []));", nargout=0)
    assert pbkdf2("pässword1", "00112233445566778899aabbccddeeff", 1000) == eng.workspace["h"]
    assert hash_pin("ab", "1234") == eng.workspace["pin"]


def test_legacy_data_was_imported(live_app):
    _, app, settings = live_app
    services = app.state.services
    assert services.repos.db.meta("legacyImported")
    old = settings.data_dir / "profiles.mat"
    if old.is_file():
        eng = services.matlab.engine
        n = int(eng.eval(f"numel(getfield(load('{old.as_posix()}'), 'profiles'))", nargout=1))
        assert len(services.profiles.roster()) == n


def test_every_operation_end_to_end(live_app):
    client, app, _ = live_app
    api = Api(client)
    # a fresh teacher PIN on the copy, so the test does not need the real one
    app.state.services.repos.settings.put("classroom", {**app.state.services.classroom.settings(),
                                                        "pinHash": hash_pin("t", "9999"), "salt": "t"})
    api.token = api.ok("auth", action="teacherLogin", pin="9999")["token"]

    pid = api.ok("loadSample", name="peppers.png")["id"]
    gid = api.ok("loadSample", name="shapes.png")["id"]
    for op, params in [("ping", {}), ("samples", {}), ("imageInfo", {"id": pid}), ("grayscale", {"id": pid}),
                       ("histogramOf", {"id": pid}), ("gaussianKernel", {"k": 5, "sigma": 1}),
                       ("kernelPreset", {"name": "sobelx", "size": 5}), ("sampling", {"id": pid}),
                       ("quantize", {"id": pid}), ("guessFilter", {"id": pid}), ("experiments", {}),
                       ("codeTasks", {}), ("codeWarmup", {}), ("quizCategories", {}), ("pipelineProblems", {}),
                       ("listKernels", {})]:
        api.ok(op, **params)
    noisy = api.ok("noise", id=pid, type="saltpepper", density=0.05, seed=1)["id"]
    for f in ("mean", "median", "sobel", "adaptivemedian"):
        api.ok("filter", id=gid, name=f, k=3, refId=gid)
    assert api.raw("filter", id=gid, name="median", k=3, refId=gid)["cached"] is True
    api.ok("errorMap", id=noisy, refId=pid)
    api.ok("histogram", id=pid, method="histeq")
    api.ok("correlation", matrix=[[1, 2, 3], [4, 5, 6], [7, 8, 9]], kernel=[[1, 0, -1]] * 3)
    api.ok("applyKernel", id=pid, kernel=[[0, -1, 0], [-1, 5, -1], [0, -1, 0]])
    api.ok("saveKernel", name="integration test", kernel=[[1, 1, 1]] * 3)
    api.ok("sharpen", id=pid, method="unsharp")
    api.ok("edges", id=gid, methods=["sobel", "canny"])
    api.ok("segment", id=gid, method="otsu")
    api.ok("regions", id=gid)
    api.ok("color", id=pid, space="hsv")
    api.ok("colorEnhance", id=pid, space="hsv", channel=2, operation="gain", amount=1.4)
    api.ok("neighborhood", matrix=[[0, 1, 1], [0, 1, 0], [0, 0, 1]], row=2, col=2, valueSet=1)
    api.ok("steps", algorithm="median", matrix=[[1, 2, 3], [4, 5, 6], [7, 8, 9]])
    # syllabus additions
    api.ok("perception", kind="machbands", steps=6)
    api.ok("spectrum", wavelength=520)
    assert len(api.ok("noise", id=pid, type="rayleigh", a=0, b=0.01, seed=2)["pdf"]) == 256
    api.ok("filter", id=noisy, name="contraharmonic", k=3, Q=1.5, refId=pid)
    assert len(api.ok("histogram", id=pid, method="match", shape="gaussian")["target"]) == 256
    assert len(api.ok("bitPlanes", id=pid, keep=[7, 8])["planes"]) == 8
    blurred = api.ok("lpiDegrade", id=pid, psf="motion", length=9, angle=30, noiseVar=0.0001, seed=4)
    restored = api.ok("deconvolve", id=blurred["id"], refId=blurred["cleanId"], psf="motion", length=9, angle=30,
                      method="cls", iterations=5)
    assert restored["psnr"] > blurred["psnr"]
    api.ok("pseudocolor", id=gid, method="slicing", slices=6, map="hot")
    assert api.ok("edgeLink", id=gid, method="hough", peaks=4)["method"] == "hough"
    assert len(api.ok("describeRegion", id=gid, region=1)["hu"]) == 7
    assert len(api.ok("quizQuestions", mode="kernel", n=5)) == 5
    api.ok("runExperiment", number=1)
    report = api.ok("report", title="Integration report", images=[{"label": "Original", "id": pid}],
                    metrics=[{"name": "PSNR", "value": 30}], observations=["ok"])
    assert client.get(f"/reports/{report['name']}").status_code == 200
    for name in (report["name"], report["pdf"], report["docx"]):            # remove the test's report again
        if name:
            (PROJECT_ROOT / "reports" / "output" / Path(name).name).unlink(missing_ok=True)

    # games
    d = api.ok("pipelineStart", id=pid, problemId="spcontrast")
    assert api.ok("pipelineRun", problemId="spcontrast", cleanId=d["cleanId"], degradedId=d["degradedId"],
                  steps=["median", "histeq"])["verdict"] == "correct"
    daily = api.ok("dailyStart", date="2026-01-01")
    api.ok("pipelineRun", problemId=daily["problemId"], cleanId=daily["cleanId"], degradedId=daily["degradedId"],
           steps=["median"], daily="2026-01-01")
    c = api.ok("challengeStart", id=pid, level="medium")
    api.ok("challengeScore", cleanId=c["cleanId"], degradedId=c["degradedId"], timeUsed=20, timeLimit=60,
           steps=[{"block": "median", "k": 3}, {"block": "gaussian", "k": 5}])

    # Code Lab: every built-in example works as a teacher's task, and its own model solution passes
    templates = api.ok("codeTaskEdit", action="templates")
    assert len(templates) >= 10
    tasks = []
    for t in templates:
        check = api.ok("codeTaskEdit", action="check", task=t)
        assert check["ok"], (t["id"], check["message"])
        tasks.append(api.ok("codeTaskEdit", action="save", task={**t, "status": "open"})["task"])

    # classroom + a temporary student's whole cycle
    api.ok("classroom", action="overview")
    new = api.ok("profiles", action="add", name="Integration Student", roll="INT-1")
    st = api.ok("auth", token="", action="login", identifier="int-1", password=new["password"])["token"]
    api.ok("auth", token=st, action="changePassword", oldPassword="", newPassword="int-pass-2")
    for task in tasks:
        run = api.ok("runCode", token=st, taskId=task["id"], code=task["solution"])
        assert run["grade"]["passed"] is True, (task["title"], run["grade"]["message"])
    wrong = api.ok("runCode", token=st, taskId=tasks[0]["id"], code="out = img;")
    assert wrong["grade"]["passed"] is False and wrong["grade"]["diffId"]
    tid = tasks[0]["id"]
    assert tid in api.ok("codeTasks", token=st)["solved"]
    assert api.ok("classroom", action="submission", id=new["id"], taskId=tid)["entry"]["passed"]
    for task in tasks:
        api.ok("codeTaskEdit", action="remove", id=task["id"])
    api.ok("runCode", token=st, id=pid, code="J = rgb2gray(img);\nimshow(J)\nout = J;")
    lq = api.ok("live", action="create", quiz={"title": "Integration", "questions": [{"bankId": "FUN2"}]})
    api.ok("live", token=st, action="join", code=lq["code"])
    api.ok("live", action="start", qIndex=0)
    api.ok("live", token=st, action="answer", qIndex=1, choice=3)
    api.ok("live", action="finish")
    api.ok("live", action="close")
    assert api.ok("progress", token=st)["quizzesTaken"] == 1
    api.ok("profiles", action="remove", id=new["id"])
    assert api.error("progress", token=st)["errorId"] == "ImageLab:auth"

    # expected errors
    assert api.error("morphology", id=gid)                        # removed from the site
    assert api.error("filter", id=pid, name="mean", k=4)
    assert api.error("imageInfo", id="../../etc")
    assert api.error("runCode", code="system('dir')")
