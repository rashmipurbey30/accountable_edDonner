from fastapi import APIRouter, Response
from sqlalchemy import delete, insert, select, update

from .. import config
from ..db import Conn
from ..errors import NotFound
from ..models import ActivityCreate, ActivityUpdate
from ..schema import activities, contacts, deals
from .common import must_exist

router = APIRouter(prefix="/api/activities", tags=["activities"])


def get_activity(conn, activity_id: int) -> dict:
    row = conn.execute(select(activities).where(activities.c.id == activity_id)).mappings().first()
    if row is None:
        raise NotFound("Activity")
    return dict(row)


@router.post("", status_code=201)
def create_activity(conn: Conn, body: ActivityCreate):
    if body.contact_id is not None:
        must_exist(conn, contacts, body.contact_id, "Contact")
    if body.deal_id is not None:
        must_exist(conn, deals, body.deal_id, "Deal")
    at = config.now()
    activity_id = conn.execute(
        insert(activities).values(**body.model_dump(), done=False, created_at=at, updated_at=at)
    ).inserted_primary_key[0]
    return get_activity(conn, activity_id)


@router.patch("/{activity_id}")
def update_activity(conn: Conn, activity_id: int, body: ActivityUpdate):
    get_activity(conn, activity_id)
    changes = body.changes()
    if changes:
        conn.execute(
            update(activities)
            .where(activities.c.id == activity_id)
            .values(**changes, updated_at=config.now())
        )
    return get_activity(conn, activity_id)


@router.delete("/{activity_id}", status_code=204)
def delete_activity(conn: Conn, activity_id: int):
    get_activity(conn, activity_id)
    conn.execute(delete(activities).where(activities.c.id == activity_id))
    return Response(status_code=204)
