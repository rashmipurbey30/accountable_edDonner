import random
from collections import Counter
from datetime import timedelta

import pytest
from sqlalchemy import func, select, update

from backend.app.schema import activities, contacts, deals, metadata, organizations, stage_changes
from backend.app.seed import SEED, reset, seed
from backend.app.stages import OPEN_STAGES


@pytest.fixture(scope="module")
def seeded(tmp_path_factory):
    """Seeded once for the read-only tests in this file."""
    from backend.app.db import make_engine
    from backend.tests.conftest import TODAY

    eng = make_engine(tmp_path_factory.mktemp("seed") / "seeded.db")
    with eng.begin() as conn:
        metadata.create_all(conn)
        seed(conn, TODAY, random.Random(SEED))
    yield eng
    eng.dispose()


def rows(engine, table):
    with engine.connect() as conn:
        return [dict(r) for r in conn.execute(select(table).order_by(table.c.id)).mappings()]


def test_counts__S1(seeded):
    assert len(rows(seeded, organizations)) == 20
    assert len(rows(seeded, contacts)) == 60
    assert len(rows(seeded, deals)) == 40
    assert len(rows(seeded, activities)) == 150


def test_at_least_six_industries__S1(seeded):
    industries = Counter(o["industry"] for o in rows(seeded, organizations))
    assert len(industries) >= 6
    assert min(industries.values()) >= 2


def test_contact_statuses_and_unattached__S2(seeded):
    people = rows(seeded, contacts)
    assert Counter(c["status"] for c in people) == {"lead": 24, "qualified": 14, "customer": 22}
    loners = [c for c in people if c["organization_id"] is None]
    assert len(loners) == 8
    assert all(c["status"] == "lead" for c in loners)
    per_org = Counter(c["organization_id"] for c in people if c["organization_id"])
    assert all(2 <= n <= 4 for n in per_org.values())


def test_deal_stages_values_and_late__S3(seeded, today):
    all_deals = rows(seeded, deals)
    assert Counter(d["stage"] for d in all_deals) == {
        "won": 12, "lost": 6, "new": 6, "qualified": 6, "proposal": 5, "negotiation": 5,
    }
    assert all(1000 <= d["value"] <= 40000 and d["value"] % 100 == 0 for d in all_deals)
    late = [d for d in all_deals if d["stage"] in OPEN_STAGES and d["close_date"] < today]
    assert sorted(d["stage"] for d in late) == ["negotiation", "proposal", "qualified"]
    lost = [d for d in all_deals if d["stage"] == "lost"]
    assert sum(1 for d in lost if d["lost_reason"]) == 4


def test_won_and_lost_spread_over_months__S3(seeded, today):
    closed = [d for d in rows(seeded, deals) if d["stage"] in ("won", "lost")]
    months = {(d["close_date"].year, d["close_date"].month) for d in closed}
    assert len(months) >= 8
    recent = today - timedelta(days=29)
    assert sum(1 for d in closed if d["stage"] == "won" and d["close_date"] >= recent) >= 2
    assert sum(1 for d in closed if d["stage"] == "lost" and d["close_date"] >= recent) >= 1


def test_follow_ups__S4(seeded, today):
    acts = rows(seeded, activities)
    with_fu = [a for a in acts if a["follow_up_date"]]
    overdue = [a for a in with_fu if not a["done"] and a["follow_up_date"] < today]
    upcoming = [a for a in with_fu if not a["done"]
                and today <= a["follow_up_date"] <= today + timedelta(days=14)]
    done = [a for a in with_fu if a["done"]]
    assert len(overdue) >= 3
    assert len(upcoming) >= 3
    assert len(done) >= 5
    assert sum(1 for a in acts if a["contact_id"]) == 60
    assert sum(1 for a in acts if a["deal_id"]) == 90
    assert all(a["occurred_at"].date() < today for a in acts)


def test_each_deals_history_ends_at_its_stage__S3(seeded):
    with seeded.connect() as conn:
        for d in conn.execute(select(deals.c.id, deals.c.stage, deals.c.created_at)).all():
            history = conn.execute(
                select(stage_changes).where(stage_changes.c.deal_id == d.id)
                .order_by(stage_changes.c.changed_at, stage_changes.c.id)
            ).mappings().all()
            assert history[0]["from_stage"] is None
            assert history[0]["to_stage"] == "new"
            assert history[0]["changed_at"] == d.created_at
            assert history[-1]["to_stage"] == d.stage
            for prev, nxt in zip(history, history[1:]):
                assert nxt["from_stage"] == prev["to_stage"]
                assert nxt["changed_at"] > prev["changed_at"]


def test_closed_deals_changed_on_their_close_date(seeded):
    with seeded.connect() as conn:
        for d in conn.execute(select(deals).where(deals.c.stage.in_(["won", "lost"]))).mappings():
            last = conn.execute(
                select(func.max(stage_changes.c.changed_at)).where(stage_changes.c.deal_id == d["id"])
            ).scalar_one()
            assert last.date() == d["close_date"]


def test_same_today_gives_identical_rows__S5(tmp_path, today):
    from backend.app.db import make_engine

    snapshots = []
    for name in ("a.db", "b.db"):
        eng = make_engine(tmp_path / name)
        reset(eng, today)
        snapshots.append({t.name: rows(eng, t) for t in metadata.sorted_tables})
        eng.dispose()
    assert snapshots[0] == snapshots[1]


def test_seeding_over_changes_restores_sample_data__G3(engine, today):
    reset(engine, today)
    before = {t.name: rows(engine, t) for t in metadata.sorted_tables}
    with engine.begin() as conn:
        conn.execute(update(organizations).values(name="Changed"))
        conn.execute(deals.delete().where(deals.c.id == 1))
    reset(engine, today)
    after = {t.name: rows(engine, t) for t in metadata.sorted_tables}
    assert after == before
