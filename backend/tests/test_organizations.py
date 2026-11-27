from sqlalchemy import func, select

from backend.app.schema import activities, contacts, deals, stage_changes


def count(engine, table, *where):
    with engine.connect() as conn:
        return conn.execute(select(func.count()).select_from(table).where(*where)).scalar_one()


def test_create_with_only_a_name__O2(client):
    r = client.post("/api/organizations", json={"name": "Seaview Inn"})
    assert r.status_code == 201
    body = r.json()
    assert body["name"] == "Seaview Inn"
    assert body["website"] is None and body["industry"] is None and body["notes"] is None


def test_empty_name_is_422__O2(client):
    assert client.post("/api/organizations", json={"name": ""}).status_code == 422
    assert client.post("/api/organizations", json={"name": "   "}).status_code == 422
    assert client.post("/api/organizations", json={}).status_code == 422


def test_empty_optional_text_is_stored_as_null(client):
    org = client.post("/api/organizations", json={"name": "X", "website": "", "industry": " "}).json()
    assert org["website"] is None and org["industry"] is None


def test_patch_changes_only_sent_fields_and_cannot_clear_name(client, make_org):
    org = make_org(name="Old", industry="Hotels", website="w.example.com")
    r = client.patch(f"/api/organizations/{org}", json={"industry": "Retail"})
    assert r.json()["industry"] == "Retail" and r.json()["website"] == "w.example.com"
    r = client.patch(f"/api/organizations/{org}", json={"website": None})
    assert r.json()["website"] is None
    assert client.patch(f"/api/organizations/{org}", json={"name": None}).status_code == 422
    assert client.patch("/api/organizations/999", json={"name": "x"}).status_code == 404


def test_list_shows_counts_and_open_value__O1(client, make_org, make_contact, make_deal):
    org = make_org(name="Acme")
    make_contact(organization_id=org)
    make_contact(organization_id=org)
    make_deal(organization_id=org, stage="new", value=1000)
    make_deal(organization_id=org, stage="negotiation", value=2500)
    make_deal(organization_id=org, stage="won", value=9999)
    item = client.get("/api/organizations").json()["items"][0]
    assert item == {
        "id": org, "name": "Acme", "industry": None, "website": None,
        "contacts_count": 2, "deals_count": 3, "open_value": 3500,
    }


def test_search_covers_name_industry_and_website__O1(client, make_org):
    make_org(name="Alpha", industry="Fitness")
    make_org(name="Bravo", website="bravo-gym.example.com")
    make_org(name="Gymnasium Ltd")
    make_org(name="Other")
    found = {i["name"] for i in client.get("/api/organizations", params={"q": "gym"}).json()["items"]}
    assert found == {"Bravo", "Gymnasium Ltd"}
    found = {i["name"] for i in client.get("/api/organizations", params={"q": "fitn"}).json()["items"]}
    assert found == {"Alpha"}


def test_detail_includes_contacts_and_deals__O3(client, make_org, make_contact, make_deal):
    org = make_org(name="Acme", notes="Good people")
    person = make_contact(name="Pat Lee", organization_id=org, job_title="Owner", status="customer")
    deal = make_deal(organization_id=org, name="Linen", stage="proposal", value=1200)
    body = client.get(f"/api/organizations/{org}").json()
    assert body["notes"] == "Good people"
    assert body["contacts"] == [{"id": person, "name": "Pat Lee", "job_title": "Owner", "status": "customer"}]
    assert body["deals"] == [
        {"id": deal, "name": "Linen", "stage": "proposal", "value": 1200, "close_date": None, "is_late": False}
    ]
    r = client.get("/api/organizations/999")
    assert r.status_code == 404 and r.json() == {"detail": "Organization not found"}


def test_delete_impact_counts__O4_T6(client, make_org, make_contact, make_deal, make_activity):
    org = make_org()
    c1 = make_contact(organization_id=org)
    make_contact(organization_id=org)
    d1 = make_deal(organization_id=org)
    d2 = make_deal(organization_id=org)
    make_activity(deal_id=d1)
    make_activity(deal_id=d1)
    make_activity(deal_id=d2)
    make_activity(contact_id=c1)  # on a contact who stays: not counted
    assert client.get(f"/api/organizations/{org}/delete-impact").json() == {
        "contacts": 2, "deals": 2, "activities": 3,
    }


def test_delete_cascades_deals_and_keeps_contacts__O4(client, engine, make_org, make_contact, make_deal, make_activity):
    org = make_org()
    other = make_org()
    person = make_contact(organization_id=org)
    deal = make_deal(organization_id=org, main_contact_id=person)
    kept_deal = make_deal(organization_id=other, stage="new")
    make_activity(deal_id=deal)
    make_activity(contact_id=person)
    client.patch(f"/api/deals/{deal}", json={"stage": "proposal"})

    assert client.delete(f"/api/organizations/{org}").status_code == 204

    assert count(engine, deals, deals.c.organization_id == org) == 0
    assert count(engine, activities, activities.c.deal_id == deal) == 0
    assert count(engine, stage_changes, stage_changes.c.deal_id == deal) == 0
    assert count(engine, contacts, contacts.c.id == person) == 1
    assert count(engine, activities, activities.c.contact_id == person) == 1
    with engine.connect() as conn:
        assert conn.execute(select(contacts.c.organization_id).where(contacts.c.id == person)).scalar_one() is None
        assert conn.execute(select(deals.c.position).where(deals.c.id == kept_deal)).scalar_one() == 0
    assert client.get(f"/api/organizations/{org}").status_code == 404


def test_options_up_to_20_by_name(client, make_org):
    for i in range(25):
        make_org(name=f"Shop {i:02d}")
    make_org(name="Alpha")
    body = client.get("/api/organizations/options").json()
    assert len(body) == 20
    assert body[0]["name"] == "Alpha"
    assert set(body[0]) == {"id", "name"}
    assert [o["name"] for o in client.get("/api/organizations/options", params={"q": "alp"}).json()] == ["Alpha"]
