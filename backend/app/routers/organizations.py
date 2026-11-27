from fastapi import APIRouter, Response
from sqlalchemy import case, delete, func, insert, select, update

from .. import config
from ..db import Conn
from ..errors import NotFound
from ..listing import apply_listing, search_clause
from ..models import OrganizationCreate, OrganizationUpdate
from ..schema import activities, contacts, deals, organizations
from ..services.deals import renumber
from ..stages import OPEN_STAGES
from .common import Listing, count, is_late, page_body, stamp

router = APIRouter(prefix="/api/organizations", tags=["organizations"])

ORG_FIELDS = ("id", "name", "website", "industry", "notes")


def _counts():
    contacts_count = (
        select(func.count())
        .where(contacts.c.organization_id == organizations.c.id)
        .scalar_subquery()
        .label("contacts_count")
    )
    deals_count = (
        select(func.count())
        .where(deals.c.organization_id == organizations.c.id)
        .scalar_subquery()
        .label("deals_count")
    )
    open_value = (
        select(func.coalesce(func.sum(deals.c.value), 0))
        .where(deals.c.organization_id == organizations.c.id, deals.c.stage.in_(OPEN_STAGES))
        .scalar_subquery()
        .label("open_value")
    )
    return contacts_count, deals_count, open_value


@router.get("")
def list_organizations(conn: Conn, params: Listing):
    contacts_count, deals_count, open_value = _counts()
    query = select(
        organizations.c.id,
        organizations.c.name,
        organizations.c.industry,
        organizations.c.website,
        contacts_count,
        deals_count,
        open_value,
    )
    sort_cols = {
        "name": organizations.c.name,
        "industry": organizations.c.industry,
        "website": organizations.c.website,
        "contacts_count": contacts_count,
        "deals_count": deals_count,
        "open_value": open_value,
    }
    rows, total = apply_listing(
        conn,
        query,
        q=params.q,
        search_cols=[organizations.c.name, organizations.c.industry, organizations.c.website],
        sort=params.sort or "name",
        dir=params.dir,
        sort_cols=sort_cols,
        id_col=organizations.c.id,
        page=params.page,
        page_size=params.page_size,
    )
    return page_body(rows, total, params)


@router.get("/options")
def organization_options(conn: Conn, q: str | None = None):
    query = select(organizations.c.id, organizations.c.name)
    clause = search_clause(q, [organizations.c.name])
    if clause is not None:
        query = query.where(clause)
    query = query.order_by(organizations.c.name, organizations.c.id).limit(20)
    return [dict(r) for r in conn.execute(query).mappings()]


def get_organization(conn, org_id: int) -> dict:
    row = conn.execute(
        select(*(organizations.c[f] for f in ORG_FIELDS)).where(organizations.c.id == org_id)
    ).mappings().first()
    if row is None:
        raise NotFound("Organization")
    return dict(row)


@router.post("", status_code=201)
def create_organization(conn: Conn, body: OrganizationCreate):
    org_id = conn.execute(
        insert(organizations).values(**stamp(body.model_dump()))
    ).inserted_primary_key[0]
    return get_organization(conn, org_id)


@router.get("/{org_id}")
def organization_detail(conn: Conn, org_id: int):
    org = get_organization(conn, org_id)
    org["contacts"] = [
        dict(r)
        for r in conn.execute(
            select(contacts.c.id, contacts.c.name, contacts.c.job_title, contacts.c.status)
            .where(contacts.c.organization_id == org_id)
            .order_by(contacts.c.name, contacts.c.id)
        ).mappings()
    ]
    stage_order = case({s: i for i, s in enumerate(OPEN_STAGES + ["won", "lost"])}, value=deals.c.stage)
    today = config.today()
    org["deals"] = [
        {**dict(r), "is_late": is_late(r["stage"], r["close_date"], today)}
        for r in conn.execute(
            select(deals.c.id, deals.c.name, deals.c.stage, deals.c.value, deals.c.close_date)
            .where(deals.c.organization_id == org_id)
            .order_by(stage_order, deals.c.position)
        ).mappings()
    ]
    return org


@router.patch("/{org_id}")
def update_organization(conn: Conn, org_id: int, body: OrganizationUpdate):
    get_organization(conn, org_id)
    changes = body.changes()
    if changes:
        conn.execute(
            update(organizations)
            .where(organizations.c.id == org_id)
            .values(**changes, updated_at=config.now())
        )
    return get_organization(conn, org_id)


@router.get("/{org_id}/delete-impact")
def organization_delete_impact(conn: Conn, org_id: int):
    get_organization(conn, org_id)
    deal_ids = select(deals.c.id).where(deals.c.organization_id == org_id)
    return {
        "contacts": count(conn, contacts, contacts.c.organization_id == org_id),
        "deals": count(conn, deals, deals.c.organization_id == org_id),
        "activities": count(conn, activities, activities.c.deal_id.in_(deal_ids)),
    }


@router.delete("/{org_id}", status_code=204)
def delete_organization(conn: Conn, org_id: int):
    get_organization(conn, org_id)
    stages = set(
        conn.execute(select(deals.c.stage).where(deals.c.organization_id == org_id)).scalars()
    )
    # The database cascades to deals, their activities and stage changes,
    # and clears the organization on its contacts (O4).
    conn.execute(delete(organizations).where(organizations.c.id == org_id))
    for stage in stages:
        renumber(conn, stage)
    return Response(status_code=204)
