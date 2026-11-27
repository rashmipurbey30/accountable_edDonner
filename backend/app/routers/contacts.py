from typing import Annotated

from fastapi import APIRouter, Query, Response
from sqlalchemy import delete, func, insert, select, update

from .. import config
from ..db import Conn
from ..errors import Invalid, NotFound
from ..listing import apply_listing, search_clause
from ..models import ContactCreate, ContactUpdate, Status
from ..schema import activities, contacts, deals, organizations
from ..services.timeline import contact_timeline
from ..stages import CONTACT_STATUSES
from .common import Listing, count, is_late, page_body, stamp

router = APIRouter(prefix="/api/contacts", tags=["contacts"])

SEARCH_COLS = [
    contacts.c.name,
    contacts.c.email,
    contacts.c.phone,
    contacts.c.job_title,
    organizations.c.name,
]


def _base():
    return select(
        contacts.c.id,
        contacts.c.name,
        contacts.c.organization_id,
        organizations.c.name.label("organization_name"),
        contacts.c.job_title,
        contacts.c.email,
        contacts.c.phone,
        contacts.c.status,
    ).select_from(contacts.outerjoin(organizations, contacts.c.organization_id == organizations.c.id))


@router.get("")
def list_contacts(conn: Conn, params: Listing, status: Status | None = None):
    query = _base()
    if status:
        query = query.where(contacts.c.status == status)
    sort_cols = {
        "name": contacts.c.name,
        "organization_name": organizations.c.name,
        "job_title": contacts.c.job_title,
        "email": contacts.c.email,
        "phone": contacts.c.phone,
        "status": contacts.c.status,
    }
    rows, total = apply_listing(
        conn,
        query,
        q=params.q,
        search_cols=SEARCH_COLS,
        sort=params.sort or "name",
        dir=params.dir,
        sort_cols=sort_cols,
        id_col=contacts.c.id,
        page=params.page,
        page_size=params.page_size,
    )

    # Counts per status follow the search but not the status filter (C2).
    counts_query = (
        select(contacts.c.status, func.count())
        .select_from(contacts.outerjoin(organizations, contacts.c.organization_id == organizations.c.id))
        .group_by(contacts.c.status)
    )
    clause = search_clause(params.q, SEARCH_COLS)
    if clause is not None:
        counts_query = counts_query.where(clause)
    by_status = dict(conn.execute(counts_query).all())
    status_counts = {s: by_status.get(s, 0) for s in CONTACT_STATUSES}
    status_counts["all"] = sum(status_counts.values())
    return page_body(rows, total, params, status_counts=status_counts)


@router.get("/options")
def contact_options(
    conn: Conn,
    q: str | None = None,
    organization_id: Annotated[int | None, Query()] = None,
):
    query = _base().with_only_columns(
        contacts.c.id, contacts.c.name, organizations.c.name.label("organization_name")
    )
    clause = search_clause(q, [contacts.c.name, organizations.c.name])
    if clause is not None:
        query = query.where(clause)
    order = [contacts.c.name, contacts.c.id]
    if organization_id is not None:
        order.insert(0, (contacts.c.organization_id == organization_id).desc())
    query = query.order_by(*order).limit(20)
    return [dict(r) for r in conn.execute(query).mappings()]


def get_contact(conn, contact_id: int) -> dict:
    row = conn.execute(_base().where(contacts.c.id == contact_id)).mappings().first()
    if row is None:
        raise NotFound("Contact")
    return dict(row)


def _check_org(conn, organization_id):
    if organization_id is None:
        return
    found = conn.execute(
        select(organizations.c.id).where(organizations.c.id == organization_id)
    ).first()
    if found is None:
        raise Invalid("organization_id", "Organization not found")


@router.post("", status_code=201)
def create_contact(conn: Conn, body: ContactCreate):
    _check_org(conn, body.organization_id)
    contact_id = conn.execute(
        insert(contacts).values(**stamp(body.model_dump()))
    ).inserted_primary_key[0]
    return get_contact(conn, contact_id)


@router.get("/{contact_id}")
def contact_detail(conn: Conn, contact_id: int):
    contact = get_contact(conn, contact_id)
    today = config.today()
    contact["deals"] = [
        {**dict(r), "is_late": is_late(r["stage"], r["close_date"], today)}
        for r in conn.execute(
            select(deals.c.id, deals.c.name, deals.c.stage, deals.c.value, deals.c.close_date)
            .where(deals.c.main_contact_id == contact_id)
            .order_by(deals.c.close_date.is_(None), deals.c.close_date, deals.c.id)
        ).mappings()
    ]
    return contact


@router.patch("/{contact_id}")
def update_contact(conn: Conn, contact_id: int, body: ContactUpdate):
    get_contact(conn, contact_id)
    changes = body.changes()
    if "organization_id" in changes:
        _check_org(conn, changes["organization_id"])
    if changes:
        conn.execute(
            update(contacts).where(contacts.c.id == contact_id).values(**changes, updated_at=config.now())
        )
    return get_contact(conn, contact_id)


@router.get("/{contact_id}/delete-impact")
def contact_delete_impact(conn: Conn, contact_id: int):
    get_contact(conn, contact_id)
    return {
        "deals": count(conn, deals, deals.c.main_contact_id == contact_id),
        "activities": count(conn, activities, activities.c.contact_id == contact_id),
    }


@router.delete("/{contact_id}", status_code=204)
def delete_contact(conn: Conn, contact_id: int):
    get_contact(conn, contact_id)
    # Cascades to the contact's activities; deals keep going with no main contact (C5).
    conn.execute(delete(contacts).where(contacts.c.id == contact_id))
    return Response(status_code=204)


@router.get("/{contact_id}/timeline")
def timeline(conn: Conn, contact_id: int):
    get_contact(conn, contact_id)
    return contact_timeline(conn, contact_id)
