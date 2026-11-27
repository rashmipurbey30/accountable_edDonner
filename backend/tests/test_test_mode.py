from fastapi.testclient import TestClient
from sqlalchemy import func, select

from backend.app.main import create_app
from backend.app.schema import organizations


def test_reset_is_404_without_test_mode(client):
    assert client.post("/api/test/reset").status_code == 404


def test_reset_reseeds_in_test_mode(monkeypatch, db_file, engine, make_org):
    make_org(name="Only one")
    monkeypatch.setenv("ACCOUNTABLE_TEST_MODE", "1")
    app = create_app(db_file)
    with TestClient(app) as client:
        assert client.post("/api/test/reset").json() == {"ok": True}
    app.state.engine.dispose()
    with engine.connect() as conn:
        assert conn.execute(select(func.count()).select_from(organizations)).scalar_one() == 20
