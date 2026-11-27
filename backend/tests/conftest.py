"""Shared fixtures. Every test gets its own temporary database file and today = 2026-11-26."""

import os
import tempfile
from datetime import date, datetime
from pathlib import Path

import pytest

# Point the app away from your real data before anything imports it.
_session_dir = Path(tempfile.mkdtemp(prefix="accountable-tests-"))
os.environ["ACCOUNTABLE_DB"] = str(_session_dir / "default.db")
os.environ["ACCOUNTABLE_TODAY"] = "2026-11-26"
os.environ.pop("ACCOUNTABLE_TEST_MODE", None)

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import insert  # noqa: E402

from backend.app import config  # noqa: E402
from backend.app.db import make_engine  # noqa: E402
from backend.app.main import create_app  # noqa: E402
from backend.app.schema import activities, contacts, metadata, organizations  # noqa: E402
from backend.app.services.deals import create_deal  # noqa: E402

REAL_DB = (config.REPO_ROOT / "data" / "accountable.db").resolve()
if config.db_path().resolve() == REAL_DB:
    raise RuntimeError("Tests must never run against data/accountable.db")

TODAY = date(2026, 11, 26)


@pytest.fixture(autouse=True)
def _fixed_today(monkeypatch):
    monkeypatch.setenv("ACCOUNTABLE_TODAY", TODAY.isoformat())
    monkeypatch.delenv("ACCOUNTABLE_TEST_MODE", raising=False)


@pytest.fixture
def today() -> date:
    return TODAY


@pytest.fixture
def db_file(tmp_path) -> Path:
    path = tmp_path / "test.db"
    assert path.resolve() != REAL_DB
    return path


@pytest.fixture
def engine(db_file):
    """An empty database with the tables made (so the app won't seed it)."""
    eng = make_engine(db_file)
    metadata.create_all(eng)
    yield eng
    eng.dispose()


@pytest.fixture
def app(engine, db_file):
    application = create_app(db_file)
    yield application
    application.state.engine.dispose()


@pytest.fixture
def client(app):
    with TestClient(app) as c:
        yield c


def _stamp() -> datetime:
    return config.now()


@pytest.fixture
def make_org(engine):
    def make(**fields) -> int:
        at = _stamp()
        values = {"name": "Acme", "created_at": at, "updated_at": at, **fields}
        with engine.begin() as conn:
            return conn.execute(insert(organizations).values(**values)).inserted_primary_key[0]

    return make


@pytest.fixture
def make_contact(engine):
    def make(**fields) -> int:
        at = _stamp()
        values = {"name": "Pat Lee", "status": "lead", "created_at": at, "updated_at": at, **fields}
        with engine.begin() as conn:
            return conn.execute(insert(contacts).values(**values)).inserted_primary_key[0]

    return make


@pytest.fixture
def make_deal(engine, make_org):
    def make(at: datetime | None = None, **fields) -> int:
        if "organization_id" not in fields:
            fields["organization_id"] = make_org()
        data = {"name": "Deal", "stage": "new", "value": 1000, **fields}
        with engine.begin() as conn:
            return create_deal(conn, data, at=at)

    return make


@pytest.fixture
def make_activity(engine):
    def make(**fields) -> int:
        at = _stamp()
        values = {
            "type": "note",
            "description": "Called",
            "occurred_at": at,
            "done": False,
            "created_at": at,
            "updated_at": at,
            **fields,
        }
        with engine.begin() as conn:
            return conn.execute(insert(activities).values(**values)).inserted_primary_key[0]

    return make
