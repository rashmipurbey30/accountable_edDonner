from datetime import date

import pytest
from sqlalchemy import func, select

from backend.app.schema import activities, stage_changes


def count(engine, table, *where):
    with engine.connect() as conn:
        return conn.execute(select(func.count()).select_from(table).where(*where)).scalar_one()


@pytest.fixture
def org(make_org):
    return make_org(name="Acme")


@pytest.mark.parametrize("missing", ["name", "organization_id", "stage", "value"])
def test_required_fields__D2(client, org, missing):
    body = {"name": "Linen", "organization_id": org, "stage": "new", "value": 1000}
    del body[missing]
    r = client.post("/api/deals", json=body)
    assert r.status_code == 422
    assert r.json()["detail"][0]["loc"][-1] == missing


def test_required_fields_cannot_be_cleared__D2(client, make_deal):
    deal = make_deal()
    for field in ("name", "organization_id", "stage", "value"):
        assert client.patch(f"/api/deals/{deal}", json={field: None}).status_code == 422


def test_value_and_probability_are_checked_by_the_api(client, org):
    base = {"name": "Linen", "organization_id": org, "stage": "new"}
    assert client.post("/api/deals", json={**base, "value": -1}).status_code == 422
    assert client.post("/api/deals", json={**base, "value": 10, "probability": 101}).status_code == 422
    assert client.post("/api/deals", json={**base, "value": 10.5}).status_code == 422
    assert client.post("/api/deals", json={**base, "value": 0}).status_code == 201


def test_unknown_organization_or_contact_is_422(client, org):
    base = {"name": "Linen", "stage": "new", "value": 1}
    assert client.post("/api/deals", json={**base, "organization_id": 999}).status_code == 422
    assert client.post("/api/deals", json={**base, "organization_id": org, "main_contact_id": 999}).status_code == 422


def test_lost_reason_is_limited_to_200_characters__D2(client, org):
    base = {"name": "Linen", "organization_id": org, "stage": "lost", "value": 1}
    assert client.post("/api/deals", json={**base, "lost_reason": "x" * 201}).status_code == 422
    r = client.post("/api/deals", json={**base, "lost_reason": "x" * 200})
    assert r.status_code == 201 and len(r.json()["lost_reason"]) == 200


def test_search_matches_organization_and_contact_names__D1(client, make_org, make_contact, make_deal):
    hotel = make_org(name="Brightwell Hotels")
    pat = make_contact(name="Pat Lee")
    make_deal(name="Linen", organization_id=hotel)
    make_deal(name="Cups", main_contact_id=pat)
    make_deal(name="Brightwell towels")
    make_deal(name="Other")
    def found(q):
        return {i["name"] for i in client.get("/api/deals", params={"q": q}).json()["items"]}
    assert found("brightwell") == {"Linen", "Brightwell towels"}
    assert found("pat l") == {"Cups"}


def test_default_sort_is_close_date_ascending_nulls_last__T2(client, make_deal):
    make_deal(name="none")
    make_deal(name="later", close_date=date(2027, 6, 1))
    make_deal(name="sooner", close_date=date(2027, 1, 1))
    names = [i["name"] for i in client.get("/api/deals").json()["items"]]
    assert names == ["sooner", "later", "none"]


@pytest.mark.parametrize(
    "stage,close_date,late",
    [
        ("negotiation", date(2026, 11, 25), True),
        ("new", date(2026, 1, 1), True),
        ("proposal", date(2026, 11, 26), False),  # today isn't late
        ("qualified", None, False),
        ("proposal", date(2026, 12, 1), False),
    ],
)
def test_is_late_only_for_open_deals_before_today__D6(client, make_deal, stage, close_date, late):
    deal = make_deal(stage=stage, close_date=close_date)
    assert client.get(f"/api/deals/{deal}").json()["is_late"] is late
    assert client.get("/api/deals").json()["items"][0]["is_late"] is late


@pytest.mark.parametrize("stage", ["won", "lost"])
def test_closed_deals_are_never_late__D6(client, make_deal, stage):
    deal = make_deal(stage=stage)
    client.patch(f"/api/deals/{deal}", json={"close_date": "2026-01-01"})
    assert client.get(f"/api/deals/{deal}").json()["is_late"] is False


def test_delete_removes_activities_and_stage_changes__D9(client, engine, make_deal, make_activity):
    deal = make_deal()
    make_activity(deal_id=deal)
    client.patch(f"/api/deals/{deal}", json={"stage": "proposal"})
    assert client.get(f"/api/deals/{deal}/delete-impact").json() == {"activities": 1}
    assert client.delete(f"/api/deals/{deal}").status_code == 204
    assert count(engine, activities, activities.c.deal_id == deal) == 0
    assert count(engine, stage_changes, stage_changes.c.deal_id == deal) == 0
    assert client.get(f"/api/deals/{deal}").status_code == 404
    assert client.delete(f"/api/deals/{deal}").status_code == 404


def test_detail_has_names_and_lost_reason__D8(client, make_org, make_contact, make_deal):
    org = make_org(name="Acme")
    pat = make_contact(name="Pat Lee")
    deal = make_deal(organization_id=org, main_contact_id=pat, stage="lost", lost_reason="Budget cut")
    body = client.get(f"/api/deals/{deal}").json()
    assert body["organization_name"] == "Acme"
    assert body["main_contact_name"] == "Pat Lee"
    assert body["lost_reason"] == "Budget cut"
    assert body["close_date"] == "2026-11-26"
    assert client.get("/api/deals/999").json() == {"detail": "Deal not found"}


def test_patch_with_stage_change_applies_rules__D3_D4_D7(client, make_deal):
    deal = make_deal(stage="proposal")
    body = client.patch(f"/api/deals/{deal}", json={"stage": "negotiation"}).json()
    assert body["probability"] == 75
    body = client.patch(f"/api/deals/{deal}", json={"stage": "qualified", "probability": 30}).json()
    assert body["probability"] == 30
    texts = [i["text"] for i in client.get(f"/api/deals/{deal}/timeline").json()]
    assert texts[:2] == ["Moved from Negotiation to Qualified", "Moved from Proposal to Negotiation"]
