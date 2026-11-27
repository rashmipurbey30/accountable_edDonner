import pytest


def names(response):
    assert response.status_code == 200, response.text
    return [i["name"] for i in response.json()["items"]]


def test_search_ignores_case_and_matches_inside_words__T1(client, make_org):
    make_org(name="Harbor Street Café")
    make_org(name="Northwind")
    assert names(client.get("/api/organizations", params={"q": "STREET"})) == ["Harbor Street Café"]
    assert names(client.get("/api/organizations", params={"q": "rbor st"})) == ["Harbor Street Café"]


def test_percent_and_underscore_match_literally__T1(client, make_org):
    make_org(name="100% Cotton")
    make_org(name="1000 Cotton")
    make_org(name="snake_case Ltd")
    make_org(name="snakeXcase Ltd")
    assert names(client.get("/api/organizations", params={"q": "0%"})) == ["100% Cotton"]
    assert names(client.get("/api/organizations", params={"q": "e_c"})) == ["snake_case Ltd"]


ORG_SORTS = ["name", "industry", "website", "contacts_count", "deals_count", "open_value"]


@pytest.mark.parametrize("sort", ORG_SORTS)
def test_every_organization_sort_works_both_ways_with_nulls_last__T2(client, make_org, make_contact, make_deal, sort):
    a = make_org(name="Alpha", industry="Hotels", website="a.example.com")
    b = make_org(name="Bravo", industry="Retail", website="b.example.com")
    make_org(name="Charlie")  # no industry or website
    make_contact(organization_id=b)
    make_deal(organization_id=b, value=500)
    make_deal(organization_id=b, value=700)
    make_deal(organization_id=a, value=100)
    make_contact(organization_id=a)
    make_contact(organization_id=a)

    asc = names(client.get("/api/organizations", params={"sort": sort, "dir": "asc"}))
    desc = names(client.get("/api/organizations", params={"sort": sort, "dir": "desc"}))
    expected = {
        "name": (["Alpha", "Bravo", "Charlie"], ["Charlie", "Bravo", "Alpha"]),
        "industry": (["Alpha", "Bravo", "Charlie"], ["Bravo", "Alpha", "Charlie"]),
        "website": (["Alpha", "Bravo", "Charlie"], ["Bravo", "Alpha", "Charlie"]),
        "contacts_count": (["Charlie", "Bravo", "Alpha"], ["Alpha", "Bravo", "Charlie"]),
        "deals_count": (["Charlie", "Alpha", "Bravo"], ["Bravo", "Alpha", "Charlie"]),
        "open_value": (["Charlie", "Alpha", "Bravo"], ["Bravo", "Alpha", "Charlie"]),
    }[sort]
    assert (asc, desc) == expected


CONTACT_SORTS = ["name", "organization_name", "job_title", "email", "phone", "status"]


@pytest.mark.parametrize("sort", CONTACT_SORTS)
def test_every_contact_sort_works_both_ways_with_nulls_last__T2(client, make_org, make_contact, sort):
    org_a = make_org(name="Aardvark")
    org_b = make_org(name="Zebra")
    make_contact(name="Ann", organization_id=org_a, job_title="Buyer", email="ann@x.com", phone="111", status="customer")
    make_contact(name="Bob", organization_id=org_b, job_title="Owner", email="bob@x.com", phone="222", status="lead")
    make_contact(name="Cy", status="qualified")  # no org, title, email or phone
    asc = names(client.get("/api/contacts", params={"sort": sort}))
    desc = names(client.get("/api/contacts", params={"sort": sort, "dir": "desc"}))
    if sort == "name":
        assert asc == ["Ann", "Bob", "Cy"] and desc == ["Cy", "Bob", "Ann"]
    elif sort == "status":
        assert asc == ["Ann", "Bob", "Cy"] and desc == ["Cy", "Bob", "Ann"]
    else:
        assert asc == ["Ann", "Bob", "Cy"] and desc == ["Bob", "Ann", "Cy"]


DEAL_SORTS = ["name", "organization_name", "main_contact_name", "stage", "value", "probability", "close_date"]


@pytest.mark.parametrize("sort", DEAL_SORTS)
def test_every_deal_sort_works_both_ways_with_nulls_last__T2(client, make_org, make_contact, make_deal, sort):
    from datetime import date

    org_a = make_org(name="Aardvark")
    org_b = make_org(name="Zebra")
    ann = make_contact(name="Ann")
    bob = make_contact(name="Bob")
    make_deal(name="A deal", organization_id=org_a, main_contact_id=ann, stage="new",
              value=100, probability=5, close_date=date(2027, 1, 1))
    make_deal(name="B deal", organization_id=org_b, main_contact_id=bob, stage="qualified",
              value=200, probability=20, close_date=date(2027, 2, 1))
    make_deal(name="C deal", organization_id=org_b, stage="won", value=300)  # no contact
    asc = names(client.get("/api/deals", params={"sort": sort}))
    desc = names(client.get("/api/deals", params={"sort": sort, "dir": "desc"}))
    if sort in ("main_contact_name",):
        assert asc == ["A deal", "B deal", "C deal"] and desc == ["B deal", "A deal", "C deal"]
    elif sort == "organization_name":
        # B and C share Zebra; id breaks the tie.
        assert asc == ["A deal", "B deal", "C deal"] and desc == ["B deal", "C deal", "A deal"]
    elif sort == "close_date":
        # C is Won, so its close date is today (2026-11-26), the earliest.
        assert asc == ["C deal", "A deal", "B deal"] and desc == ["B deal", "A deal", "C deal"]
    else:
        assert asc == ["A deal", "B deal", "C deal"] and desc == ["C deal", "B deal", "A deal"]


def test_stage_sorts_in_stage_order_not_alphabetically__T2(client, make_deal):
    for stage in ["lost", "won", "negotiation", "proposal", "qualified", "new"]:
        make_deal(name=stage, stage=stage)
    assert names(client.get("/api/deals", params={"sort": "stage"})) == [
        "new", "qualified", "proposal", "negotiation", "won", "lost"
    ]


def test_unknown_sort_column_is_422__T2(client):
    for path in ("/api/organizations", "/api/contacts", "/api/deals"):
        assert client.get(path, params={"sort": "password"}).status_code == 422
    assert client.get("/api/deals", params={"dir": "sideways"}).status_code == 422


def test_paging_returns_slice_and_total__T3(client, make_org):
    for i in range(60):
        make_org(name=f"Org {i:02d}")
    body = client.get("/api/organizations", params={"page": 2}).json()
    assert body["total"] == 60
    assert body["page"] == 2 and body["page_size"] == 25
    assert [i["name"] for i in body["items"]] == [f"Org {i:02d}" for i in range(25, 50)]
    last = client.get("/api/organizations", params={"page": 3}).json()
    assert len(last["items"]) == 10


def test_page_size_over_100_is_422__T3(client):
    assert client.get("/api/organizations", params={"page_size": 101}).status_code == 422
    assert client.get("/api/organizations", params={"page": 0}).status_code == 422
