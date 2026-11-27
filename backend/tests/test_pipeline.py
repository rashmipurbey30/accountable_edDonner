from datetime import date

from sqlalchemy import select, update

from backend.app.schema import deals


def set_close_date(engine, deal_id, day):
    with engine.begin() as conn:
        conn.execute(update(deals).where(deals.c.id == deal_id).values(close_date=day))


def column(board, stage):
    return next(c for c in board["columns"] if c["stage"] == stage)


def test_columns_in_stage_order_with_totals__P1(client, make_deal):
    make_deal(stage="proposal", value=1000)
    make_deal(stage="proposal", value=3000, probability=20)
    make_deal(stage="new", value=500)
    board = client.get("/api/pipeline").json()
    assert [c["stage"] for c in board["columns"]] == ["new", "qualified", "proposal", "negotiation", "won", "lost"]
    proposal = column(board, "proposal")
    assert proposal["count"] == 2
    assert proposal["value"] == 4000
    assert proposal["expected"] == 1100  # 1000 × 50% + 3000 × 20%
    assert column(board, "qualified") == {"stage": "qualified", "count": 0, "value": 0, "expected": 0, "deals": []}


def test_won_and_lost_show_the_last_30_days__P2(client, engine, make_deal):
    inside = make_deal(stage="won", name="inside")
    edge = make_deal(stage="won", name="edge")
    outside = make_deal(stage="lost", name="outside")
    future = make_deal(stage="won", name="future")
    set_close_date(engine, edge, date(2026, 10, 28))
    set_close_date(engine, outside, date(2026, 10, 27))
    set_close_date(engine, future, date(2026, 11, 27))
    board = client.get("/api/pipeline").json()
    won = {c["name"] for c in column(board, "won")["deals"]}
    assert won == {"inside", "edge"}
    assert column(board, "lost")["deals"] == []
    assert column(board, "won")["count"] == 2
    # Still in the Deals table.
    assert client.get(f"/api/deals/{outside}").status_code == 200
    _ = inside


def test_board_totals_cover_open_deals_only__P3(client, make_deal):
    make_deal(stage="new", value=1000)
    make_deal(stage="negotiation", value=2000)
    make_deal(stage="won", value=50000)
    make_deal(stage="lost", value=70000)
    assert client.get("/api/pipeline").json()["totals"] == {
        "open_value": 3000, "open_expected": 1600, "open_count": 2,
    }


def test_cards_carry_late_flag_and_initials__P4(client, make_contact, make_deal):
    pat = make_contact(name="Patricia van der Berg")
    solo = make_contact(name="Cher")
    make_deal(stage="proposal", name="late", main_contact_id=pat, close_date=date(2026, 11, 20))
    make_deal(stage="proposal", name="solo", main_contact_id=solo, close_date=date(2026, 12, 20))
    make_deal(stage="proposal", name="nobody")
    cards = {c["name"]: c for c in column(client.get("/api/pipeline").json(), "proposal")["deals"]}
    assert cards["late"]["is_late"] is True
    assert cards["late"]["main_contact_initials"] == "PB"
    assert cards["solo"]["main_contact_initials"] == "C"
    assert cards["solo"]["is_late"] is False
    assert cards["nobody"]["main_contact_initials"] is None
    assert set(cards["late"]) == {
        "id", "name", "organization_name", "value", "probability", "close_date",
        "is_late", "main_contact_initials", "lost_reason",
    }


def test_cards_are_in_position_order__P5(client, make_deal):
    a = make_deal(stage="new")
    b = make_deal(stage="new")
    c = make_deal(stage="new")
    board = client.post(f"/api/deals/{a}/move", json={"stage": "new", "before_id": c}).json()
    assert [d["id"] for d in column(board, "new")["deals"]] == [a, c, b]
    again = client.get("/api/pipeline").json()
    assert [d["id"] for d in column(again, "new")["deals"]] == [a, c, b]


def test_move_to_lost_with_and_without_reason__D5(client, engine, make_deal):
    a = make_deal(stage="negotiation")
    b = make_deal(stage="negotiation")
    board = client.post(f"/api/deals/{a}/move", json={"stage": "lost", "before_id": None, "lost_reason": "Budget cut"}).json()
    lost = column(board, "lost")["deals"]
    assert [(d["id"], d["lost_reason"]) for d in lost] == [(a, "Budget cut")]
    client.post(f"/api/deals/{b}/move", json={"stage": "lost", "before_id": a})
    with engine.connect() as conn:
        reasons = dict(conn.execute(select(deals.c.id, deals.c.lost_reason)).all())
    assert reasons == {a: "Budget cut", b: None}


def test_move_with_before_id_in_another_stage_is_422(client, make_deal):
    a = make_deal(stage="new")
    b = make_deal(stage="proposal")
    r = client.post(f"/api/deals/{a}/move", json={"stage": "negotiation", "before_id": b})
    assert r.status_code == 422
    assert r.json()["detail"][0]["loc"] == ["body", "before_id"]


def test_move_requires_before_id_key_and_valid_stage(client, make_deal):
    a = make_deal(stage="new")
    assert client.post(f"/api/deals/{a}/move", json={"stage": "new"}).status_code == 422
    assert client.post(f"/api/deals/{a}/move", json={"stage": "done", "before_id": None}).status_code == 422
    assert client.post("/api/deals/999/move", json={"stage": "new", "before_id": None}).status_code == 404


def test_move_uses_usual_probability_and_sets_close_date__D3_D4(client, make_deal):
    a = make_deal(stage="proposal", probability=33)
    board = client.post(f"/api/deals/{a}/move", json={"stage": "won", "before_id": None}).json()
    card = column(board, "won")["deals"][0]
    assert card["probability"] == 100
    assert card["close_date"] == "2026-11-26"
