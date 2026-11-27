import pytest
from sqlalchemy import insert
from sqlalchemy.exc import IntegrityError

from backend.app import config
from backend.app.db import foreign_keys_on
from backend.app.schema import activities, deals


def test_foreign_keys_are_on_for_every_connection(engine):
    with engine.connect() as conn:
        assert foreign_keys_on(conn) == 1


def _activity(**fields):
    at = config.now()
    return {"type": "note", "description": "x", "occurred_at": at, "done": False,
            "created_at": at, "updated_at": at, **fields}


def test_activity_needs_exactly_one_of_contact_or_deal__A2(engine, make_contact, make_deal):
    contact_id = make_contact()
    deal_id = make_deal()
    with pytest.raises(IntegrityError), engine.begin() as conn:
        conn.execute(insert(activities).values(**_activity(contact_id=contact_id, deal_id=deal_id)))
    with pytest.raises(IntegrityError), engine.begin() as conn:
        conn.execute(insert(activities).values(**_activity()))


def _deal(**fields):
    at = config.now()
    return {"name": "D", "stage": "new", "value": 1, "probability": 10, "position": 0,
            "created_at": at, "updated_at": at, **fields}


def test_deal_needs_an_organization(engine):
    with pytest.raises(IntegrityError), engine.begin() as conn:
        conn.execute(insert(deals).values(**_deal(organization_id=None)))
    with pytest.raises(IntegrityError), engine.begin() as conn:
        conn.execute(insert(deals).values(**_deal(organization_id=999)))


def test_database_refuses_negative_value_and_probability_over_100(engine, make_org):
    org = make_org()
    with pytest.raises(IntegrityError), engine.begin() as conn:
        conn.execute(insert(deals).values(**_deal(organization_id=org, value=-1)))
    with pytest.raises(IntegrityError), engine.begin() as conn:
        conn.execute(insert(deals).values(**_deal(organization_id=org, probability=101)))


def test_api_refuses_negative_value_and_probability_over_100(client, make_org):
    base = {"name": "D", "organization_id": make_org(), "stage": "new"}
    assert client.post("/api/deals", json={**base, "value": -1}).status_code == 422
    assert client.post("/api/deals", json={**base, "value": 1, "probability": 101}).status_code == 422
