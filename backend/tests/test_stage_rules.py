from datetime import date, datetime

import pytest
from sqlalchemy import select

from backend.app.schema import deals, stage_changes
from backend.app.services.deals import update_deal
from backend.app.stages import STAGES, USUAL_PROBABILITY


@pytest.fixture
def deal(engine):
    def read(deal_id):
        with engine.connect() as conn:
            return conn.execute(select(deals).where(deals.c.id == deal_id)).mappings().one()

    return read


@pytest.fixture
def update(engine):
    def run(deal_id, **changes):
        with engine.begin() as conn:
            update_deal(conn, deal_id, changes)

    return run


@pytest.fixture
def history(engine):
    def read(deal_id):
        with engine.connect() as conn:
            rows = conn.execute(
                select(stage_changes.c.from_stage, stage_changes.c.to_stage, stage_changes.c.lost_reason)
                .where(stage_changes.c.deal_id == deal_id)
                .order_by(stage_changes.c.id)
            ).all()
        return [tuple(r) for r in rows]

    return read


@pytest.mark.parametrize("stage", STAGES)
def test_new_deal_gets_its_stages_usual_probability__D3(make_deal, deal, stage):
    deal_id = make_deal(stage=stage)
    assert deal(deal_id)["probability"] == USUAL_PROBABILITY[stage]


def test_changing_only_probability_keeps_it__D3(make_deal, deal, update):
    deal_id = make_deal(stage="proposal")
    update(deal_id, probability=63)
    assert deal(deal_id)["probability"] == 63
    assert deal(deal_id)["stage"] == "proposal"


def test_stage_change_resets_probability_unless_one_is_sent__D3(make_deal, deal, update):
    deal_id = make_deal(stage="proposal", probability=40)
    update(deal_id, stage="negotiation")
    assert deal(deal_id)["probability"] == 75
    update(deal_id, stage="qualified", probability=33)
    assert deal(deal_id)["probability"] == 33


@pytest.mark.parametrize("stage", ["won", "lost"])
def test_moving_to_won_or_lost_sets_close_date_to_today__D4(make_deal, deal, update, today, stage):
    deal_id = make_deal(stage="negotiation", close_date=date(2027, 3, 1))
    update(deal_id, stage=stage, close_date=date(2027, 5, 5))
    assert deal(deal_id)["close_date"] == today


def test_saving_won_again_keeps_close_date__D4(make_deal, deal, update):
    deal_id = make_deal(stage="won")
    update(deal_id, close_date=date(2026, 10, 1))
    update(deal_id, stage="won", name="Renamed")
    assert deal(deal_id)["close_date"] == date(2026, 10, 1)


def test_reopening_lost_clears_reason_keeps_close_date__D4a(make_deal, deal, update, today):
    deal_id = make_deal(stage="negotiation")
    update(deal_id, stage="lost", lost_reason="Price too high")
    assert deal(deal_id)["lost_reason"] == "Price too high"
    update(deal_id, stage="qualified")
    row = deal(deal_id)
    assert row["lost_reason"] is None
    assert row["close_date"] == today
    assert row["probability"] == 25


def test_lost_reason_only_kept_while_lost(make_deal, deal, update):
    deal_id = make_deal(stage="new", lost_reason="ignored")
    assert deal(deal_id)["lost_reason"] is None
    update(deal_id, lost_reason="still ignored")
    assert deal(deal_id)["lost_reason"] is None


def test_stage_changes_are_recorded__D7(make_deal, update, history):
    deal_id = make_deal(stage="new")
    update(deal_id, stage="proposal")
    update(deal_id, stage="lost", lost_reason="Budget cut")
    assert history(deal_id) == [
        (None, "new", None),
        ("new", "proposal", None),
        ("proposal", "lost", "Budget cut"),
    ]


def test_created_as_lost_records_reason__D7(make_deal, history):
    deal_id = make_deal(stage="lost", lost_reason="Budget cut")
    assert history(deal_id) == [(None, "lost", "Budget cut")]


def test_edit_without_stage_change_records_nothing__D7(make_deal, update, history):
    deal_id = make_deal(stage="new")
    update(deal_id, name="Other", value=5, stage="new")
    assert history(deal_id) == [(None, "new", None)]


def test_history_uses_the_given_time(make_deal, engine, history):
    at = datetime(2026, 1, 5, 9, 30)
    deal_id = make_deal(stage="new", at=at)
    with engine.connect() as conn:
        changed = conn.execute(
            select(stage_changes.c.changed_at).where(stage_changes.c.deal_id == deal_id)
        ).scalar_one()
    assert changed == at
