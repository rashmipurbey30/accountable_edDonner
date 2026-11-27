from fastapi import APIRouter, Response
from sqlalchemy import case, select

from .. import config
from ..db import Conn
from ..errors import NotFound
from ..listing import apply_listing
from ..models import DealCreate, DealMove, DealUpdate
from ..schema import activities, contacts, deals, organizations
from ..services import deals as service
from ..services.timeline import deal_timeline
from ..stages import STAGES
from .common import Listing, count, is_late, page_body
from .pipeline import board

router = APIRouter(prefix="/api/deals", tags=["deals"])

main_contact = contacts.alias("main_contact")
STAGE_ORDER = case({s: i for i, s in enumerate(STAGES)}, value=deals.c.stage)


def _base():
    return select(
        deals.c.id,
        deals.c.name,
        deals.c.organization_id,
        organizations.c.name.label("organization_name"),
        deals.c.main_contact_id,
        main_contact.c.name.label("main_contact_name"),
        deals.c.stage,
        deals.c.value,
        deals.c.probability,
        deals.c.close_date,
    ).select_from(
        deals.join(organizations, deals.c.organization_id == organizations.c.id).outerjoin(
            main_contact, deals.c.main_contact_id == main_contact.c.id
        )
    )


def _item(row, today) -> dict:
    item = dict(row)
    item["is_late"] = is_late(item["stage"], item["close_date"], today)
    return item


@router.get("")
def list_deals(conn: Conn, params: Listing):
    sort_cols = {
        "name": deals.c.name,
        "organization_name": organizations.c.name,
        "main_contact_name": main_contact.c.name,
        "stage": STAGE_ORDER,
        "value": deals.c.value,
        "probability": deals.c.probability,
        "close_date": deals.c.close_date,
    }
    rows, total = apply_listing(
        conn,
        _base(),
        q=params.q,
        search_cols=[deals.c.name, organizations.c.name, main_contact.c.name],
        sort=params.sort or "close_date",
        dir=params.dir,
        sort_cols=sort_cols,
        id_col=deals.c.id,
        page=params.page,
        page_size=params.page_size,
    )
    today = config.today()
    return page_body([_item(r, today) for r in rows], total, params)


def get_deal(conn, deal_id: int) -> dict:
    row = conn.execute(
        _base().add_columns(deals.c.lost_reason).where(deals.c.id == deal_id)
    ).mappings().first()
    if row is None:
        raise NotFound("Deal")
    return _item(row, config.today())


@router.post("", status_code=201)
def create_deal(conn: Conn, body: DealCreate):
    deal_id = service.create_deal(conn, body.model_dump())
    return get_deal(conn, deal_id)


@router.get("/{deal_id}")
def deal_detail(conn: Conn, deal_id: int):
    return get_deal(conn, deal_id)


@router.patch("/{deal_id}")
def update_deal(conn: Conn, deal_id: int, body: DealUpdate):
    service.update_deal(conn, deal_id, body.changes())
    return get_deal(conn, deal_id)


@router.get("/{deal_id}/delete-impact")
def deal_delete_impact(conn: Conn, deal_id: int):
    get_deal(conn, deal_id)
    return {"activities": count(conn, activities, activities.c.deal_id == deal_id)}


@router.delete("/{deal_id}", status_code=204)
def delete_deal(conn: Conn, deal_id: int):
    service.delete_deal(conn, deal_id)
    return Response(status_code=204)


@router.post("/{deal_id}/move")
def move_deal(conn: Conn, deal_id: int, body: DealMove):
    service.move_deal(conn, deal_id, body.stage, body.before_id, body.lost_reason)
    return board(conn)


@router.get("/{deal_id}/timeline")
def timeline(conn: Conn, deal_id: int):
    get_deal(conn, deal_id)
    return deal_timeline(conn, deal_id)
