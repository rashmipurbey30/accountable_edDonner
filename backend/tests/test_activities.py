import pytest


@pytest.fixture
def contact(make_contact):
    return make_contact()


@pytest.fixture
def deal(make_deal):
    return make_deal()


def new_activity(**fields):
    return {"type": "call", "description": "Talked prices", "occurred_at": "2026-11-20T10:30:00", **fields}


def test_create_on_contact_and_on_deal__A2(client, contact, deal):
    r = client.post("/api/activities", json=new_activity(contact_id=contact))
    assert r.status_code == 201
    assert r.json()["contact_id"] == contact and r.json()["deal_id"] is None
    assert r.json()["done"] is False
    r = client.post("/api/activities", json=new_activity(deal_id=deal, follow_up_date="2026-12-01"))
    assert r.status_code == 201
    assert r.json()["deal_id"] == deal and r.json()["follow_up_date"] == "2026-12-01"


def test_needs_exactly_one_owner__A2(client, contact, deal):
    assert client.post("/api/activities", json=new_activity()).status_code == 422
    assert client.post("/api/activities", json=new_activity(contact_id=contact, deal_id=deal)).status_code == 422


@pytest.mark.parametrize("missing", ["type", "description", "occurred_at"])
def test_required_fields__A1(client, contact, missing):
    body = new_activity(contact_id=contact)
    del body[missing]
    r = client.post("/api/activities", json=body)
    assert r.status_code == 422
    assert r.json()["detail"][0]["loc"][-1] == missing


def test_description_limits__A1(client, contact):
    assert client.post("/api/activities", json=new_activity(contact_id=contact, description="x" * 2001)).status_code == 422
    assert client.post("/api/activities", json=new_activity(contact_id=contact, description="x" * 2000)).status_code == 201
    assert client.post("/api/activities", json=new_activity(contact_id=contact, description="  ")).status_code == 422
    assert client.post("/api/activities", json=new_activity(contact_id=contact, type="meeting")).status_code == 422


def test_edit_and_delete__A5(client, contact):
    activity = client.post("/api/activities", json=new_activity(contact_id=contact)).json()
    r = client.patch(
        f"/api/activities/{activity['id']}",
        json={"type": "email", "description": "Sent the catalogue", "follow_up_date": "2026-12-03"},
    )
    body = r.json()
    assert (body["type"], body["description"], body["follow_up_date"]) == ("email", "Sent the catalogue", "2026-12-03")
    assert body["occurred_at"] == "2026-11-20T10:30:00"
    assert client.patch(f"/api/activities/{activity['id']}", json={"description": None}).status_code == 422
    assert client.delete(f"/api/activities/{activity['id']}").status_code == 204
    assert client.patch(f"/api/activities/{activity['id']}", json={"done": True}).status_code == 404


def test_marking_done_keeps_the_activity__A6(client, contact):
    activity = client.post("/api/activities", json=new_activity(contact_id=contact, follow_up_date="2026-11-28")).json()
    r = client.patch(f"/api/activities/{activity['id']}", json={"done": True})
    assert r.status_code == 200 and r.json()["done"] is True
    timeline = client.get(f"/api/contacts/{contact}/timeline").json()
    assert [i["id"] for i in timeline] == [activity["id"]]
    assert timeline[0]["done"] is True


def test_unknown_contact_or_deal_is_404(client):
    r = client.post("/api/activities", json=new_activity(contact_id=999))
    assert r.status_code == 404 and r.json() == {"detail": "Contact not found"}
    r = client.post("/api/activities", json=new_activity(deal_id=999))
    assert r.status_code == 404 and r.json() == {"detail": "Deal not found"}
