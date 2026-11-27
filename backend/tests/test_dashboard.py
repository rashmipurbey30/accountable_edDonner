"""Dashboard figures on a hand-built dataset. Today is 2026-11-26, so the window starts 2025-12-01."""

from datetime import date, datetime

import pytest

from backend.app.services.dashboard import window_start
from backend.app.services.deals import create_deal, update_deal


def at(text: str) -> datetime:
    return datetime.fromisoformat(text)


@pytest.fixture
def history(engine, make_org):
    """Make a deal that walks through `steps`: [(stage, time), ...]. The first is its creation."""
    org = make_org(name="Acme")

    def make(name, value, steps, reason=None, close_date=None):
        (first_stage, first_at), *rest = steps
        with engine.begin() as conn:
            deal_id = create_deal(
                conn,
                {"name": name, "organization_id": org, "stage": first_stage, "value": value,
                 "close_date": close_date},
                at=at(first_at),
            )
            for stage, when in rest:
                changes = {"stage": stage}
                if stage == "lost":
                    changes["lost_reason"] = reason
                update_deal(conn, deal_id, changes, at=at(when))
        return deal_id

    return make


@pytest.fixture
def dataset(history):
    # Won
    history("W1", 10000, [("new", "2026-01-05 09:00"), ("qualified", "2026-02-01 09:00"), ("won", "2026-04-10 10:00")])
    history("W2", 5000, [("new", "2026-03-01 09:00"), ("won", "2026-04-20 10:00")])
    history("W3", 15000, [("new", "2026-08-01 09:00"), ("proposal", "2026-08-10 09:00"), ("won", "2026-09-15 10:00")])
    history("W4", 7000, [("new", "2025-10-01 09:00"), ("won", "2025-12-15 10:00")])  # created before the window
    history("W-old", 99000, [("new", "2024-01-01 09:00"), ("won", "2025-11-30 10:00")])  # closed before the window
    # Lost
    history("L1", 4000, [("new", "2026-05-01 09:00"), ("qualified", "2026-05-10 09:00"), ("lost", "2026-06-01 10:00")], reason="Budget cut")
    history("L2", 2000, [("new", "2026-10-01 09:00"), ("lost", "2026-11-05 10:00")])
    # Open
    history("O1", 1000, [("new", "2026-11-01 09:00")], close_date=date(2026, 12, 31))
    history("O2", 8000, [("new", "2026-06-01 09:00"), ("qualified", "2026-06-05 09:00"), ("proposal", "2026-07-01 09:00")],
            close_date=date(2026, 11, 20))  # late
    history("O3", 3000, [("new", "2025-06-01 09:00"), ("qualified", "2025-07-01 09:00"),
                         ("proposal", "2025-08-01 09:00"), ("negotiation", "2025-09-01 09:00")])


@pytest.fixture
def dash(client, dataset):
    return client.get("/api/dashboard").json()


def test_window_runs_dec_2025_to_nov_2026__H1(client, today):
    assert window_start(today) == date(2025, 12, 1)
    assert window_start(date(2026, 1, 15)) == date(2025, 2, 1)
    labels = [m["label"] for m in client.get("/api/dashboard").json()["months"]]
    assert labels == ["Dec 2025", "Jan 2026", "Feb 2026", "Mar 2026", "Apr 2026", "May 2026",
                      "Jun 2026", "Jul 2026", "Aug 2026", "Sep 2026", "Oct 2026", "Nov 2026"]


def test_revenue_by_month_and_running_total__H3(dash):
    # Dec: W4 7,000. Apr: W1 10,000 + W2 5,000. Sep: W3 15,000. W-old closed 30 Nov 2025: outside.
    revenue = [m["revenue"] for m in dash["months"]]
    assert revenue == [7000, 0, 0, 0, 15000, 0, 0, 0, 0, 15000, 0, 0]
    # Running: 7,000 until April, 22,000 until September, then 37,000.
    running = [m["running_total"] for m in dash["months"]]
    assert running == [7000, 7000, 7000, 7000, 22000, 22000, 22000, 22000, 22000, 37000, 37000, 37000]
    assert dash["revenue_won"] == 37000


def test_best_month_tie_goes_to_later_month__H3(dash):
    # April and September both made 15,000; September is later. It had one deal (W3).
    assert dash["best_month"] == {"label": "Sep 2026", "revenue": 15000, "deals": 1}


def test_headline_figures__H2(dash):
    # Won in the window: W1, W2, W3, W4. Lost: L1, L2.
    assert dash["deals_won"] == 4
    assert dash["deals_lost"] == 2
    # 100 × 4 / 6 = 66.7, rounded to 67.
    assert dash["win_rate"] == 67
    # 37,000 / 4 = 9,250.
    assert dash["average_won"] == 9250


def test_won_and_lost_by_month__H4(dash):
    assert [m["won"] for m in dash["months"]] == [1, 0, 0, 0, 2, 0, 0, 0, 0, 1, 0, 0]
    assert [m["lost"] for m in dash["months"]] == [0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]


def test_funnel__H5(dash):
    # Created in the window: W1, W2, W3 (furthest Won), L1 (Qualified), L2 (New), O1 (New), O2 (Proposal).
    # W4, W-old and O3 were created before 1 Dec 2025, so they're left out.
    # New:         all 7: 10,000 + 5,000 + 15,000 + 4,000 + 2,000 + 1,000 + 8,000 = 45,000
    # Qualified:   W1, W2, W3, L1, O2: 10,000 + 5,000 + 15,000 + 4,000 + 8,000 = 42,000
    # Proposal:    W1, W2, W3, O2 = 38,000
    # Negotiation: W1, W2, W3 = 30,000 (Won deals count in every stage, even ones they skipped)
    # Won:         W1, W2, W3 = 30,000
    assert dash["funnel"] == [
        {"stage": "new", "deals": 7, "value": 45000},
        {"stage": "qualified", "deals": 5, "value": 42000},
        {"stage": "proposal", "deals": 4, "value": 38000},
        {"stage": "negotiation", "deals": 3, "value": 30000},
        {"stage": "won", "deals": 3, "value": 30000},
    ]


def test_open_pipeline_by_stage__H6(dash):
    # O1 new 1,000 at 10% = 100. O2 proposal 8,000 at 50% = 4,000. O3 negotiation 3,000 at 75% = 2,250.
    assert dash["open"] == {
        "value": 12000,
        "expected": 6350,
        "count": 3,
        "late": 1,  # O2 closes 20 Nov
        "by_stage": [
            {"stage": "new", "count": 1, "value": 1000, "expected": 100},
            {"stage": "qualified", "count": 0, "value": 0, "expected": 0},
            {"stage": "proposal", "count": 1, "value": 8000, "expected": 4000},
            {"stage": "negotiation", "count": 1, "value": 3000, "expected": 2250},
        ],
    }


def test_nothing_won_or_lost__H2_H3(client):
    dash = client.get("/api/dashboard").json()
    assert dash["revenue_won"] == 0
    assert dash["best_month"] is None
    assert dash["win_rate"] is None
    assert dash["average_won"] is None


def test_only_lost_gives_zero_win_rate__H2(client, history):
    history("L", 1000, [("new", "2026-05-01 09:00"), ("lost", "2026-06-01 10:00")])
    dash = client.get("/api/dashboard").json()
    assert dash["win_rate"] == 0
    assert dash["best_month"] is None


@pytest.fixture
def follow_ups(make_contact, make_deal, make_activity):
    pat = make_contact(name="Pat Lee")
    deal = make_deal(name="Linen")
    made = {}
    for key, due, done, owner in [
        ("overdue_recent", date(2026, 11, 20), False, {"contact_id": pat}),
        ("overdue_old", date(2026, 11, 10), False, {"deal_id": deal}),
        ("today", date(2026, 11, 26), False, {"contact_id": pat}),
        ("day14", date(2026, 12, 10), False, {"contact_id": pat}),
        ("day15", date(2026, 12, 11), False, {"contact_id": pat}),
        ("done", date(2026, 11, 15), True, {"contact_id": pat}),
    ]:
        made[key] = make_activity(description=key, follow_up_date=due, done=done,
                                  occurred_at=datetime(2026, 11, 1, 9, 0), **owner)
    make_activity(contact_id=pat, description="no follow-up")
    return made, pat, deal


def test_follow_ups_panel__H7(client, follow_ups):
    made, pat, deal = follow_ups
    panel = client.get("/api/dashboard").json()["follow_ups"]
    assert [f["description"] for f in panel["items"]] == ["overdue_old", "overdue_recent", "today", "day14"]
    assert panel["overdue_count"] == 2
    assert panel["total_open"] == 5
    first = panel["items"][0]
    assert first == {"id": made["overdue_old"], "description": "overdue_old", "follow_up_date": "2026-11-10",
                     "overdue": True, "on": {"kind": "deal", "id": deal, "name": "Linen"}}
    assert panel["items"][1]["on"] == {"kind": "contact", "id": pat, "name": "Pat Lee"}


def test_all_follow_ups_include_day_15__H7(client, follow_ups):
    everything = client.get("/api/follow-ups").json()
    assert [f["description"] for f in everything] == ["overdue_old", "overdue_recent", "today", "day14", "day15"]


def test_marking_done_removes_from_panel__A6_H7(client, follow_ups):
    made, _pat, _deal = follow_ups
    client.patch(f"/api/activities/{made['today']}", json={"done": True})
    items = client.get("/api/dashboard").json()["follow_ups"]["items"]
    assert "today" not in [f["description"] for f in items]


def test_at_most_ten_follow_ups__H7(client, make_contact, make_activity):
    pat = make_contact()
    for day in range(1, 13):
        make_activity(contact_id=pat, follow_up_date=date(2026, 12, day))
    panel = client.get("/api/dashboard").json()["follow_ups"]
    assert len(panel["items"]) == 10
    assert panel["total_open"] == 12


def test_recent_activity_is_the_ten_newest__H8(client, make_contact, make_deal, make_activity):
    pat = make_contact(name="Pat")
    deal = make_deal(name="Linen", at=datetime(2026, 11, 10, 9, 0))  # "Created in New" at 10 Nov 09:00
    for day in range(1, 11):
        make_activity(contact_id=pat, description=f"day {day}", occurred_at=datetime(2026, 11, day, 12, 0))
    recent = client.get("/api/dashboard").json()["recent"]
    assert len(recent) == 10
    assert recent[0]["text"] == "day 10"
    assert recent[1] == {"kind": "stage_change", "id": recent[1]["id"], "type": "stage",
                         "text": "Created in New", "at": "2026-11-10T09:00:00",
                         "on": {"kind": "deal", "id": deal, "name": "Linen"}}
    assert recent[2]["text"] == "day 9"
    assert recent[-1]["text"] == "day 2"
    assert recent[2]["on"] == {"kind": "contact", "id": pat, "name": "Pat"}


def test_moving_a_deal_to_won_updates_the_figures__H9(client, dataset, history):
    before = client.get("/api/dashboard").json()
    deal = history("New win", 6000, [("new", "2026-11-02 09:00"), ("negotiation", "2026-11-10 09:00")])
    middle = client.get("/api/dashboard").json()
    assert middle["open"]["value"] == before["open"]["value"] + 6000
    client.post(f"/api/deals/{deal}/move", json={"stage": "won", "before_id": None})
    after = client.get("/api/dashboard").json()
    assert after["revenue_won"] == before["revenue_won"] + 6000
    assert after["deals_won"] == before["deals_won"] + 1
    assert after["open"]["value"] == before["open"]["value"]
    assert after["months"][-1]["revenue"] == 6000
