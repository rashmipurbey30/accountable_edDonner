from datetime import datetime


def test_health_returns_ok__G1(client):
    assert client.get("/api/health").json() == {"ok": True}


def test_meta_gives_today_and_now(client):
    body = client.get("/api/meta").json()
    assert body["today"] == "2026-11-26"
    assert datetime.fromisoformat(body["now"]).date().isoformat() == "2026-11-26"
