"""Pieces the routers share."""

from dataclasses import dataclass
from datetime import date
from typing import Annotated

from fastapi import Depends, Query
from sqlalchemy import Connection, func, select

from .. import config
from ..errors import NotFound
from ..listing import Direction
from ..stages import OPEN_STAGES


@dataclass
class ListParams:
    q: str | None
    sort: str | None
    dir: Direction
    page: int
    page_size: int


def list_params(
    q: Annotated[str | None, Query(max_length=200)] = None,
    sort: str | None = None,
    dir: Direction = "asc",
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 25,
) -> ListParams:
    return ListParams(q=q, sort=sort, dir=dir, page=page, page_size=page_size)


Listing = Annotated[ListParams, Depends(list_params)]


def is_late(stage: str, close_date: date | None, today: date | None = None) -> bool:
    """D6: open, with a close date, and that date before today."""
    today = today or config.today()
    return stage in OPEN_STAGES and close_date is not None and close_date < today


def must_exist(conn: Connection, table, record_id: int, record: str) -> None:
    found = conn.execute(select(table.c.id).where(table.c.id == record_id)).first()
    if found is None:
        raise NotFound(record)


def count(conn: Connection, table, *where) -> int:
    return conn.execute(select(func.count()).select_from(table).where(*where)).scalar_one()


def page_body(items: list, total: int, params: ListParams, **extra) -> dict:
    return {"items": items, "total": total, "page": params.page, "page_size": params.page_size, **extra}


def stamp(values: dict) -> dict:
    at = config.now()
    return {**values, "created_at": at, "updated_at": at}
