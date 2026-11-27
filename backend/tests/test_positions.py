import pytest
from sqlalchemy import select

from backend.app.errors import Invalid
from backend.app.schema import deals
from backend.app.services.deals import delete_deal, move_deal, update_deal
from backend.app.stages import STAGES


@pytest.fixture
def column(engine):
    """A stage's ids, top to bottom, read fresh from the database."""

    def read(stage):
        with engine.connect() as conn:
            return list(
                conn.execute(
                    select(deals.c.id).where(deals.c.stage == stage).order_by(deals.c.position)
                ).scalars()
            )

    return read


@pytest.fixture
def positions(engine):
    def read(stage):
        with engine.connect() as conn:
            return list(
                conn.execute(
                    select(deals.c.position).where(deals.c.stage == stage).order_by(deals.c.position)
                ).scalars()
            )

    return read


@pytest.fixture
def move(engine):
    def run(deal_id, stage, before_id, lost_reason=None):
        with engine.begin() as conn:
            move_deal(conn, deal_id, stage, before_id, lost_reason)

    return run


def test_new_deal_goes_to_the_top__P7(make_deal, column):
    a = make_deal(stage="qualified")
    b = make_deal(stage="qualified")
    c = make_deal(stage="qualified")
    assert column("qualified") == [c, b, a]


def test_move_puts_deal_above_before_id_or_at_bottom__P5(make_deal, column, move):
    a = make_deal(stage="new")
    b = make_deal(stage="new")
    c = make_deal(stage="new")  # column: c, b, a
    x = make_deal(stage="proposal")
    move(x, "new", b)
    assert column("new") == [c, x, b, a]
    move(c, "new", None)
    assert column("new") == [x, b, a, c]
    move(a, "new", x)
    assert column("new") == [a, x, b, c]
    assert column("proposal") == []


def test_both_stages_numbered_without_gaps_after_move(make_deal, positions, move):
    ids = [make_deal(stage="new") for _ in range(4)]
    others = [make_deal(stage="won") for _ in range(3)]
    move(ids[1], "won", others[1])
    move(others[0], "new", None)
    for stage in STAGES:
        assert positions(stage) == list(range(len(positions(stage))))


def test_stage_change_from_form_goes_to_top(make_deal, column, engine):
    a = make_deal(stage="proposal")
    b = make_deal(stage="proposal")
    x = make_deal(stage="new")
    with engine.begin() as conn:
        update_deal(conn, x, {"stage": "proposal"})
    assert column("proposal") == [x, b, a]
    assert column("new") == []


def test_before_id_in_another_stage_is_refused(make_deal, move):
    a = make_deal(stage="new")
    b = make_deal(stage="proposal")
    with pytest.raises(Invalid):
        move(a, "negotiation", b)


def test_move_order_survives_a_reload__P5(make_deal, engine, db_file, move):
    a = make_deal(stage="new")
    b = make_deal(stage="new")
    move(a, "new", b)
    engine.dispose()
    from backend.app.db import make_engine

    fresh = make_engine(db_file)
    with fresh.connect() as conn:
        order = list(
            conn.execute(
                select(deals.c.id).where(deals.c.stage == "new").order_by(deals.c.position)
            ).scalars()
        )
    fresh.dispose()
    assert order == [a, b]


def test_move_to_another_stage_applies_stage_rules__D3_D4(make_deal, move, engine, today):
    a = make_deal(stage="proposal", probability=40)
    move(a, "won", None)
    with engine.connect() as conn:
        row = conn.execute(select(deals).where(deals.c.id == a)).mappings().one()
    assert row["probability"] == 100
    assert row["close_date"] == today


def test_delete_renumbers_its_stage(make_deal, engine, positions):
    ids = [make_deal(stage="new") for _ in range(3)]
    with engine.begin() as conn:
        delete_deal(conn, ids[1])
    assert positions("new") == [0, 1]
