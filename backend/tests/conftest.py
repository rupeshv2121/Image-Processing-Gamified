"""Shared fixtures: an isolated data folder per test (never the real data/)."""

from __future__ import annotations

import random
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from fakes import FakeMatlab  # noqa: E402
from imagelab.config import Settings  # noqa: E402
from imagelab.container import Services  # noqa: E402
from imagelab.storage.database import Database  # noqa: E402
from imagelab.web.app import create_app  # noqa: E402


@pytest.fixture
def settings(tmp_path: Path) -> Settings:
    return Settings(data_dir=tmp_path / "data", runtime_dir=tmp_path / "runtime",
                    report_dir=tmp_path / "reports", frontend_dist=tmp_path / "dist", keep_hours=0,
                    legacy_leaderboard=tmp_path / "leaderboard.mat",
                    open_browser=False)


@pytest.fixture
def matlab(settings: Settings) -> FakeMatlab:
    return FakeMatlab(settings.image_dir)


@pytest.fixture
def services(settings: Settings, matlab: FakeMatlab):
    db = Database(settings.database_file)
    yield Services(settings, matlab, db, rng=random.Random(1))
    db.close()


@pytest.fixture
def client(settings: Settings, matlab: FakeMatlab):
    with TestClient(create_app(settings, matlab)) as c:
        c.app.state.dispatcher.data_ready.wait(5)
        yield c


class Api:
    """Calls /api/run like the React UI does (token in params)."""

    def __init__(self, client: TestClient):
        self.client = client
        self.token = ""

    def raw(self, op: str, token: str | None = None, **params) -> dict:
        tok = self.token if token is None else token
        if tok:
            params["token"] = tok
        return self.client.post("/api/run", json={"op": op, "params": params}).json()

    def ok(self, op: str, token: str | None = None, **params):
        r = self.raw(op, token, **params)
        assert r["ok"], r
        return r["data"]

    def error(self, op: str, token: str | None = None, **params) -> dict:
        r = self.raw(op, token, **params)
        assert not r["ok"], r
        return r


@pytest.fixture
def api(client: TestClient) -> Api:
    return Api(client)


@pytest.fixture
def teacher(api: Api) -> str:
    """A teacher session (no PIN set yet)."""
    api.token = api.ok("auth", action="teacherLogin", pin="")["token"]
    return api.token
