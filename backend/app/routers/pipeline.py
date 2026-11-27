from datetime import timedelta

from fastapi import APIRouter
from sqlalchemy import Connection, select

from .. import config
from ..db import Conn
from ..schema import contacts, deals, organizations
from ..stages import CLOSED_STAGES, OPEN_STAGES, STAGES
from .common import is_late

router = APIRouter(prefix="/api", tags=["pipeline"])

# Won and Lost show deals closed in the last 30 days: today and the 29 before (P2).
CLOSED_WINDOW_DAYS = 30


def initials(name: str | None) -> str | None:
    if not name:
        return None
    words = name.split()
    if len(words) == 1:
        return words[0][0].upper()
    return (words[0][0] + words[-1][0]).upper()


def expected(rows) -> int:
    return round(sum(r["value"] * r["probability"] / 100 for r in rows))


def board(conn: Connection) -> dict:
    today = config.today()
    since = today - timedelta(days=CLOSED_WINDOW_DAYS - 1)
    query = (
        select(
            deals.c.id,
            deals.c.name,
            deals.c.stage,
            organizations.c.name.label("organization_name"),
            deals.c.value,
            deals.c.probability,
            deals.c.close_date,
            contacts.c.name.label("main_contact_name"),
            deals.c.lost_reason,
        )
        .select_from(
            deals.join(organizations, deals.c.organization_id == organizations.c.id).outerjoin(
                contacts, deals.c.main_contact_id == contacts.c.id
            )
        )
        .where(
            deals.c.stage.in_(OPEN_STAGES)
            | (
                deals.c.stage.in_(CLOSED_STAGES)
                & (deals.c.close_date >= since)
                & (deals.c.close_date <= today)
            )
        )
        .order_by(deals.c.position, deals.c.id)
    )
    by_stage: dict[str, list[dict]] = {s: [] for s in STAGES}
    for row in conn.execute(query).mappings():
        card = {
            "id": row["id"],
            "name": row["name"],
            "organization_name": row["organization_name"],
            "value": row["value"],
            "probability": row["probability"],
            "close_date": row["close_date"],
            "is_late": is_late(row["stage"], row["close_date"], today),
            "main_contact_initials": initials(row["main_contact_name"]),
            "lost_reason": row["lost_reason"],
        }
        by_stage[row["stage"]].append(card)

    columns = [
        {
            "stage": stage,
            "count": len(cards),
            "value": sum(c["value"] for c in cards),
            "expected": expected(cards),
            "deals": cards,
        }
        for stage, cards in by_stage.items()
    ]
    open_cards = [c for s in OPEN_STAGES for c in by_stage[s]]
    return {
        "totals": {
            "open_value": sum(c["value"] for c in open_cards),
            "open_expected": expected(open_cards),
            "open_count": len(open_cards),
        },
        "columns": columns,
    }


@router.get("/pipeline")
def pipeline(conn: Conn):
    return board(conn)
