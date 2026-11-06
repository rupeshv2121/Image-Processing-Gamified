from __future__ import annotations

import base64

PNG = base64.b64encode(b"\x89PNG fake bytes").decode()


def names(items):
    return [s["name"] for s in items]


def test_teacher_library(api, teacher, client, settings, matlab):
    lib = api.ok("sampleLibrary", action="add", name="My Leaf.PNG", data=PNG, description="Leaf on a table")
    leaf = lib[0]
    assert leaf["name"] == "My_Leaf.png" and leaf["custom"] and leaf["description"] == "Leaf on a table"
    assert client.get(leaf["preview"]).status_code == 200
    # a second upload with the same name gets its own name; built-in names are never reused
    assert api.ok("sampleLibrary", action="add", name="My Leaf.png", data=PNG)[0]["name"] == "My_Leaf_2.png"
    assert api.ok("sampleLibrary", action="add", name="peppers.png", data=PNG)[0]["name"] == "peppers_2.png"

    # loading a teacher sample reads the stored file in MATLAB
    api.ok("loadSample", name="My_Leaf.png")
    op, params = matlab.calls[-1]
    assert op == "importImage" and params["path"].startswith(str(settings.sample_dir))
    api.ok("loadSample", name="coins.png")
    assert matlab.calls[-1] == ("loadSample", {"name": "coins.png"})

    # hiding a built-in removes it from everybody's list, not from the teacher's full list
    api.ok("sampleLibrary", action="update", name="coins.png", hidden=True)
    assert "coins.png" not in names(api.ok("samples"))
    assert next(s for s in api.ok("samples", all=True) if s["name"] == "coins.png")["hidden"]
    api.ok("sampleLibrary", action="update", name="coins.png", hidden=False)
    assert "coins.png" in names(api.ok("samples"))

    api.ok("sampleLibrary", action="update", name="My_Leaf.png", description="Renamed")
    lib = api.ok("sampleLibrary", action="remove", name="My_Leaf.png")
    assert "My_Leaf.png" not in names(lib)
    assert client.get(leaf["preview"]).status_code == 404


def test_bad_uploads_and_access(api, teacher, matlab):
    assert api.error("sampleLibrary", action="add", name="notes.txt", data=PNG)["errorId"] == "ImageLab:invalidParameter"
    assert api.error("sampleLibrary", action="add", name="a.png", data="%%%")["errorId"] == "ImageLab:invalidParameter"
    assert api.error("sampleLibrary", action="remove", name="peppers.png")["errorId"] == "ImageLab:invalidParameter"
    student = api.ok("profiles", action="add", name="Stu", roll="S1")
    s_token = api.ok("auth", token="", action="login", identifier="S1", password=student["password"])["token"]
    assert api.error("sampleLibrary", token=s_token, action="list")["errorId"] == "ImageLab:forbidden"
    assert api.error("sampleLibrary", token=s_token, action="add", name="a.png", data=PNG)["errorId"] == "ImageLab:forbidden"
    # students never see hidden samples, even when they ask
    api.ok("sampleLibrary", action="update", name="shapes.png", hidden=True)
    assert "shapes.png" not in names(api.ok("samples", token=s_token, all=True))
