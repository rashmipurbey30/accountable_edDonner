"""Contact and deal timelines (A3, A4, D7)."""

from datetime import date

from sqlalchemy import Connection, or_, select

from .. import config
from ..schema import activities, deals, stage_changes
from ..stages import STAGE_NAMES


def stage_change_text(from_stage: str | None, to_stage: str, lost_reason: str | None) -> str:
    to_name = STAGE_NAMES[to_stage]
    text = f"Created in {to_name}" if from_stage is None else (
        f"Moved from {STAGE_NAMES[from_stage]} to {to_name}"
    )
    if to_stage == "lost" and lost_reason:
        text += f": {lost_reason}"
    return text


def is_overdue(follow_up_date: date | None, done: bool, today: date) -> bool:
    return follow_up_date is not None and not done and follow_up_date < today


def activity_item(row, today: date, source=None) -> dict:
    return {
        "kind": "activity",
        "id": row["id"],
        "type": row["type"],
        "text": row["description"],
        "at": row["occurred_at"],
        "follow_up_date": row["follow_up_date"],
        "done": row["done"],
        "overdue": is_overdue(row["follow_up_date"], row["done"], today),
        "source": source,
    }


def _activity_columns():
    return (
        activities.c.id,
        activities.c.type,
        activities.c.description,
        activities.c.occurred_at,
        activities.c.follow_up_date,
        activities.c.done,
        activities.c.contact_id,
        activities.c.deal_id,
    )


def contact_timeline(conn: Connection, contact_id: int) -> list[dict]:
    """Activities on the contact, plus those on deals where they're the main contact now."""
    today = config.today()
    rows = conn.execute(
        select(*_activity_columns(), deals.c.name.label("deal_name"))
        .select_from(activities.outerjoin(deals, activities.c.deal_id == deals.c.id))
        .where(or_(activities.c.contact_id == contact_id, deals.c.main_contact_id == contact_id))
        .order_by(activities.c.occurred_at.desc(), activities.c.id.desc())
    ).mappings()
    items = []
    for row in rows:
        source = (
            {"kind": "deal", "id": row["deal_id"], "name": row["deal_name"]}
            if row["deal_id"] is not None
            else None
        )
        items.append(activity_item(row, today, source))
    return items


def deal_timeline(conn: Connection, deal_id: int) -> list[dict]:
    """The deal's activities and its stage changes, newest first."""
    today = config.today()
    items = [
        activity_item(row, today)
        for row in conn.execute(
            select(*_activity_columns()).where(activities.c.deal_id == deal_id)
        ).mappings()
    ]
    for row in conn.execute(
        select(stage_changes).where(stage_changes.c.deal_id == deal_id)
    ).mappings():
        items.append(
            {
                "kind": "stage_change",
                "id": row["id"],
                "type": "stage",
                "text": stage_change_text(row["from_stage"], row["to_stage"], row["lost_reason"]),
                "at": row["changed_at"],
                "follow_up_date": None,
                "done": False,
                "overdue": False,
                "source": None,
            }
        )
    # Newest first. At the same moment, an activity sits above a stage change.
    items.sort(key=lambda i: (i["at"], i["kind"] == "activity", i["id"]), reverse=True)
    return items
