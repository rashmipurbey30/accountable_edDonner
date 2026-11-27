from sqlalchemy import func, select

from backend.app.schema import activities, contacts, deals


def count(engine, table, *where):
    with engine.connect() as conn:
        return conn.execute(select(func.count()).select_from(table).where(*where)).scalar_one()


def test_name_is_required__C3(client):
    assert client.post("/api/contacts", json={"name": ""}).status_code == 422
    assert client.post("/api/contacts", json={"email": "a@b.com"}).status_code == 422


def test_status_defaults_to_lead__C3(client):
    assert client.post("/api/contacts", json={"name": "Pat"}).json()["status"] == "lead"


def test_invalid_email_is_422_and_empty_email_is_null__C3(client):
    r = client.post("/api/contacts", json={"name": "Pat", "email": "abc"})
    assert r.status_code == 422
    assert r.json()["detail"][0]["loc"][-1] == "email"
    r = client.post("/api/contacts", json={"name": "Pat", "email": ""})
    assert r.status_code == 201 and r.json()["email"] is None
    r = client.post("/api/contacts", json={"name": "Pat", "email": "pat@example.com"})
    assert r.json()["email"] == "pat@example.com"


def test_unknown_organization_is_422(client):
    assert client.post("/api/contacts", json={"name": "Pat", "organization_id": 999}).status_code == 422


def test_status_filter_combines_with_search_and_counts_ignore_filter__C2(client, make_contact):
    make_contact(name="Ann Smith", status="lead")
    make_contact(name="Ann Jones", status="customer")
    make_contact(name="Annabel Lee", status="customer")
    make_contact(name="Bob Smith", status="lead")
    body = client.get("/api/contacts", params={"q": "ann", "status": "customer"}).json()
    assert {i["name"] for i in body["items"]} == {"Ann Jones", "Annabel Lee"}
    assert body["total"] == 2
    assert body["status_counts"] == {"all": 3, "lead": 1, "qualified": 0, "customer": 2}
    everyone = client.get("/api/contacts").json()
    assert everyone["status_counts"] == {"all": 4, "lead": 2, "qualified": 0, "customer": 2}


def test_search_matches_organization_name_and_other_columns__C1(client, make_org, make_contact):
    org = make_org(name="Brightwell Hotels")
    make_contact(name="Pat", organization_id=org)
    make_contact(name="Sam", email="sam@brightwell.example.com")
    make_contact(name="Lou", phone="555-0199")
    make_contact(name="Kim", job_title="Head Chef")
    def found(q):
        return {i["name"] for i in client.get("/api/contacts", params={"q": q}).json()["items"]}
    assert found("brightwell") == {"Pat", "Sam"}
    assert found("0199") == {"Lou"}
    assert found("chef") == {"Kim"}


def test_detail_has_organization_name_and_deals(client, make_org, make_contact, make_deal):
    org = make_org(name="Acme")
    person = make_contact(name="Pat", organization_id=org)
    deal = make_deal(organization_id=org, main_contact_id=person, name="Linen")
    make_deal(organization_id=org, name="Not theirs")
    body = client.get(f"/api/contacts/{person}").json()
    assert body["organization_name"] == "Acme"
    assert [d["id"] for d in body["deals"]] == [deal]
    assert client.get("/api/contacts/999").json() == {"detail": "Contact not found"}


def test_delete_keeps_deals_and_their_activities__C5(client, engine, make_contact, make_deal, make_activity):
    person = make_contact()
    deal = make_deal(main_contact_id=person)
    make_activity(contact_id=person)
    make_activity(contact_id=person)
    on_deal = make_activity(deal_id=deal)
    assert client.get(f"/api/contacts/{person}/delete-impact").json() == {"deals": 1, "activities": 2}

    assert client.delete(f"/api/contacts/{person}").status_code == 204

    assert count(engine, contacts, contacts.c.id == person) == 0
    assert count(engine, activities, activities.c.contact_id == person) == 0
    assert count(engine, activities, activities.c.id == on_deal) == 1
    with engine.connect() as conn:
        assert conn.execute(select(deals.c.main_contact_id).where(deals.c.id == deal)).scalar_one() is None


def test_options_list_the_organizations_contacts_first(client, make_org, make_contact):
    a = make_org(name="A")
    b = make_org(name="B")
    make_contact(name="Aaron", organization_id=a)
    zed = make_contact(name="Zed", organization_id=b)
    body = client.get("/api/contacts/options", params={"organization_id": b}).json()
    assert body[0] == {"id": zed, "name": "Zed", "organization_name": "B"}


def test_patch_can_clear_organization_but_not_name(client, make_org, make_contact):
    person = make_contact(organization_id=make_org())
    assert client.patch(f"/api/contacts/{person}", json={"organization_id": None}).json()["organization_id"] is None
    assert client.patch(f"/api/contacts/{person}", json={"name": None}).status_code == 422
