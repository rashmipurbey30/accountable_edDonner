"""Every stage rule: creating, updating, moving and deleting deals, and their positions.

Every function takes an optional `at` timestamp (default config.now()), so the seed can
write history through the same rules as the API.
"""

from datetime import datetime

from sqlalchemy import Connection, delete, func, insert, select, update

from .. import config
from ..errors import Invalid, NotFound
from ..schema import contacts, deals, organizations, stage_changes
from ..stages import CLOSED_STAGES, STAGES, USUAL_PROBABILITY

# Fields a deal's create or update request may carry.
DEAL_FIELDS = (
    "name",
    "organization_id",
    "main_contact_id",
    "stage",
    "value",
    "probability",
    "close_date",
    "lost_reason",
)


def _at(at: datetime | None) -> datetime:
    return at if at is not None else config.now()


def get_deal_row(conn: Connection, deal_id: int):
    row = conn.execute(select(deals).where(deals.c.id == deal_id)).mappings().first()
    if row is None:
        raise NotFound("Deal")
    return row


def _check_links(conn: Connection, values: dict) -> None:
    if "organization_id" in values:
        org_id = values["organization_id"]
        found = conn.execute(
            select(organizations.c.id).where(organizations.c.id == org_id)
        ).first()
        if found is None:
            raise Invalid("organization_id", "Organization not found")
    if values.get("main_contact_id") is not None:
        found = conn.execute(
            select(contacts.c.id).where(contacts.c.id == values["main_contact_id"])
        ).first()
        if found is None:
            raise Invalid("main_contact_id", "Contact not found")


def stage_ids(conn: Connection, stage: str, exclude: int | None = None) -> list[int]:
    """The ids in a stage, top to bottom."""
    query = select(deals.c.id).where(deals.c.stage == stage)
    if exclude is not None:
        query = query.where(deals.c.id != exclude)
    query = query.order_by(deals.c.position, deals.c.id)
    return list(conn.execute(query).scalars())


def _write_positions(conn: Connection, ids: list[int]) -> None:
    current = dict(
        conn.execute(select(deals.c.id, deals.c.position).where(deals.c.id.in_(ids))).all()
    ) if ids else {}
    for position, deal_id in enumerate(ids):
        if current.get(deal_id) != position:
            conn.execute(update(deals).where(deals.c.id == deal_id).values(position=position))


def renumber(conn: Connection, stage: str, order: list[int] | None = None) -> None:
    """Number a stage 0 to n-1, top to bottom. `order` gives the ids in their new order."""
    _write_positions(conn, order if order is not None else stage_ids(conn, stage))


def record_stage_change(
    conn: Connection,
    deal_id: int,
    from_stage: str | None,
    to_stage: str,
    lost_reason: str | None,
    at: datetime | None = None,
) -> None:
    at = _at(at)
    conn.execute(
        insert(stage_changes).values(
            deal_id=deal_id,
            from_stage=from_stage,
            to_stage=to_stage,
            lost_reason=lost_reason if to_stage == "lost" else None,
            changed_at=at,
            created_at=at,
            updated_at=at,
        )
    )


def _clean_reason(reason: str | None) -> str | None:
    if reason is None:
        return None
    reason = reason.strip()
    return reason or None


def create_deal(conn: Connection, data: dict, at: datetime | None = None) -> int:
    """Create a deal at the top of its stage. Returns its id."""
    at = _at(at)
    stage = data["stage"]
    _check_links(conn, data)
    probability = data.get("probability")
    if probability is None:
        probability = USUAL_PROBABILITY[stage]
    close_date = data.get("close_date")
    if stage in CLOSED_STAGES:
        close_date = at.date()
    lost_reason = _clean_reason(data.get("lost_reason")) if stage == "lost" else None

    order = stage_ids(conn, stage)
    deal_id = conn.execute(
        insert(deals).values(
            name=data["name"],
            organization_id=data["organization_id"],
            main_contact_id=data.get("main_contact_id"),
            stage=stage,
            value=data["value"],
            probability=probability,
            close_date=close_date,
            lost_reason=lost_reason,
            position=-1,
            created_at=at,
            updated_at=at,
        )
    ).inserted_primary_key[0]
    renumber(conn, stage, [deal_id, *order])
    record_stage_change(conn, deal_id, None, stage, lost_reason, at)
    return deal_id


def _stage_change_values(
    old: dict, new_stage: str, changes: dict, probability_from_request: bool, at: datetime
) -> dict:
    """The fields a change from old["stage"] to new_stage sets."""
    values: dict = {"stage": new_stage}
    if probability_from_request and changes.get("probability") is not None:
        values["probability"] = changes["probability"]
    else:
        values["probability"] = USUAL_PROBABILITY[new_stage]
    if new_stage in CLOSED_STAGES:
        values["close_date"] = at.date()
    if new_stage == "lost":
        values["lost_reason"] = _clean_reason(changes.get("lost_reason"))
    else:
        values["lost_reason"] = None
    return values


def update_deal(
    conn: Connection, deal_id: int, changes: dict, at: datetime | None = None
) -> None:
    """Apply a partial update. `changes` holds only the fields the request sent."""
    at = _at(at)
    old = dict(get_deal_row(conn, deal_id))
    changes = {k: v for k, v in changes.items() if k in DEAL_FIELDS}
    for required in ("name", "organization_id", "stage", "value"):
        if required in changes and changes[required] is None:
            raise Invalid(required, "Field required")
    _check_links(conn, changes)

    new_stage = changes.get("stage", old["stage"])
    values = {k: v for k, v in changes.items() if k not in ("stage", "probability", "lost_reason")}
    if "probability" in changes:
        if changes["probability"] is None:
            raise Invalid("probability", "Field required")
        values["probability"] = changes["probability"]

    if new_stage != old["stage"]:
        values.update(
            _stage_change_values(old, new_stage, changes, "probability" in changes, at)
        )
        values["position"] = -1
    elif "lost_reason" in changes:
        values["lost_reason"] = (
            _clean_reason(changes["lost_reason"]) if old["stage"] == "lost" else None
        )

    values["updated_at"] = at
    conn.execute(update(deals).where(deals.c.id == deal_id).values(**values))

    if new_stage != old["stage"]:
        renumber(conn, new_stage, [deal_id, *stage_ids(conn, new_stage, exclude=deal_id)])
        renumber(conn, old["stage"])
        record_stage_change(
            conn, deal_id, old["stage"], new_stage, values.get("lost_reason"), at
        )


def move_deal(
    conn: Connection,
    deal_id: int,
    stage: str,
    before_id: int | None,
    lost_reason: str | None = None,
    at: datetime | None = None,
) -> None:
    """Put a deal directly above `before_id` in `stage`, or at the bottom if it's None."""
    at = _at(at)
    if stage not in STAGES:
        raise Invalid("stage", "Unknown stage")
    old = dict(get_deal_row(conn, deal_id))
    if before_id is not None:
        if before_id == deal_id:
            raise Invalid("before_id", "A deal can't be placed above itself")
        before = conn.execute(
            select(deals.c.stage).where(deals.c.id == before_id)
        ).scalar_one_or_none()
        if before is None or before != stage:
            raise Invalid("before_id", "before_id must be a deal in the chosen stage")

    order = stage_ids(conn, stage, exclude=deal_id)
    index = order.index(before_id) if before_id is not None else len(order)
    order.insert(index, deal_id)

    if stage != old["stage"]:
        values = _stage_change_values(old, stage, {"lost_reason": lost_reason}, False, at)
        values["updated_at"] = at
        conn.execute(update(deals).where(deals.c.id == deal_id).values(**values))
        renumber(conn, stage, order)
        renumber(conn, old["stage"])
        record_stage_change(conn, deal_id, old["stage"], stage, values["lost_reason"], at)
    else:
        renumber(conn, stage, order)


def delete_deal(conn: Connection, deal_id: int) -> None:
    old = get_deal_row(conn, deal_id)
    conn.execute(delete(deals).where(deals.c.id == deal_id))
    renumber(conn, old["stage"])


def renumber_all(conn: Connection) -> None:
    for stage in STAGES:
        renumber(conn, stage)


def count_deals(conn: Connection) -> int:
    return conn.execute(select(func.count()).select_from(deals)).scalar_one()
