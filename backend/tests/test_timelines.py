from datetime import date, datetime


def test_newest_first_then_newest_id__A3(client, make_contact, make_activity):
    pat = make_contact()
    old = make_activity(contact_id=pat, occurred_at=datetime(2026, 10, 1, 9, 0))
    same_a = make_activity(contact_id=pat, occurred_at=datetime(2026, 11, 1, 9, 0))
    same_b = make_activity(contact_id=pat, occurred_at=datetime(2026, 11, 1, 9, 0))
    newest = make_activity(contact_id=pat, occurred_at=datetime(2026, 11, 20, 9, 0))
    ids = [i["id"] for i in client.get(f"/api/contacts/{pat}/timeline").json()]
    assert ids == [newest, same_b, same_a, old]


def test_contact_timeline_includes_their_deals_activities__A4(client, make_contact, make_deal, make_activity):
    pat = make_contact()
    deal = make_deal(name="Linen", main_contact_id=pat)
    own = make_activity(contact_id=pat, occurred_at=datetime(2026, 11, 1, 9, 0))
    on_deal = make_activity(deal_id=deal, occurred_at=datetime(2026, 11, 2, 9, 0))
    items = client.get(f"/api/contacts/{pat}/timeline").json()
    assert [i["id"] for i in items] == [on_deal, own]
    assert items[0]["source"] == {"kind": "deal", "id": deal, "name": "Linen"}
    assert items[1]["source"] is None
    assert all(i["kind"] == "activity" for i in items)  # stage changes show only on the deal


def test_changing_main_contact_moves_deal_activities__A4(client, make_contact, make_deal, make_activity):
    pat = make_contact(name="Pat")
    sam = make_contact(name="Sam")
    deal = make_deal(main_contact_id=pat)
    act = make_activity(deal_id=deal)
    client.patch(f"/api/deals/{deal}", json={"main_contact_id": sam})
    assert client.get(f"/api/contacts/{pat}/timeline").json() == []
    assert [i["id"] for i in client.get(f"/api/contacts/{sam}/timeline").json()] == [act]


def test_deal_timeline_has_stage_change_text__D7(client, make_deal, make_activity):
    deal = make_deal(stage="new", at=datetime(2026, 11, 1, 9, 0))
    client.patch(f"/api/deals/{deal}", json={"stage": "proposal"})
    client.patch(f"/api/deals/{deal}", json={"stage": "negotiation"})
    client.patch(f"/api/deals/{deal}", json={"stage": "lost", "lost_reason": "Price too high"})
    make_activity(deal_id=deal, occurred_at=datetime(2026, 11, 2, 9, 0), description="Called")
    items = client.get(f"/api/deals/{deal}/timeline").json()
    texts = [i["text"] for i in items]
    assert texts == [
        "Moved from Negotiation to Lost: Price too high",
        "Moved from Proposal to Negotiation",
        "Moved from New to Proposal",
        "Called",
        "Created in New",
    ]
    change = items[0]
    assert change["kind"] == "stage_change" and change["type"] == "stage"


def test_reopened_deal_keeps_reason_in_timeline__D4a(client, make_deal):
    deal = make_deal(stage="negotiation")
    client.patch(f"/api/deals/{deal}", json={"stage": "lost", "lost_reason": "Price too high"})
    body = client.patch(f"/api/deals/{deal}", json={"stage": "qualified"}).json()
    assert body["lost_reason"] is None
    texts = [i["text"] for i in client.get(f"/api/deals/{deal}/timeline").json()]
    assert "Moved from Negotiation to Lost: Price too high" in texts
    assert texts[0] == "Moved from Lost to Qualified"


def test_overdue_flag_on_open_follow_ups(client, make_contact, make_activity):
    pat = make_contact()
    make_activity(contact_id=pat, follow_up_date=date(2026, 11, 25), occurred_at=datetime(2026, 11, 3, 9, 0))
    make_activity(contact_id=pat, follow_up_date=date(2026, 11, 25), done=True, occurred_at=datetime(2026, 11, 2, 9, 0))
    make_activity(contact_id=pat, follow_up_date=date(2026, 11, 26), occurred_at=datetime(2026, 11, 1, 9, 0))
    assert [i["overdue"] for i in client.get(f"/api/contacts/{pat}/timeline").json()] == [True, False, False]


def test_unknown_record_timeline_is_404(client):
    assert client.get("/api/contacts/999/timeline").status_code == 404
    assert client.get("/api/deals/999/timeline").status_code == 404
