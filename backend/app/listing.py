"""Search, sort and paging for the three lists, done in the database (T1 to T3)."""

from typing import Literal

from sqlalchemy import Connection, ColumnElement, Select, func, or_, select

from .errors import Invalid

Direction = Literal["asc", "desc"]


def escape_like(q: str) -> str:
    return q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def search_clause(q: str | None, search_cols: list[ColumnElement]):
    q = (q or "").strip()
    if not q:
        return None
    pattern = f"%{escape_like(q.lower())}%"
    return or_(*(func.lower(col).like(pattern, escape="\\") for col in search_cols))


def apply_listing(
    conn: Connection,
    query: Select,
    *,
    q: str | None,
    search_cols: list[ColumnElement],
    sort: str,
    dir: Direction,
    sort_cols: dict[str, ColumnElement],
    id_col: ColumnElement,
    page: int,
    page_size: int,
) -> tuple[list[dict], int]:
    """Returns the page's rows and the total number of matching rows."""
    if sort not in sort_cols:
        raise Invalid("sort", f"Can't sort by {sort}", location="query")
    clause = search_clause(q, search_cols)
    if clause is not None:
        query = query.where(clause)

    total = conn.execute(select(func.count()).select_from(query.order_by(None).subquery())).scalar_one()

    key = sort_cols[sort]
    ordered = key.desc() if dir == "desc" else key.asc()
    query = query.order_by(key.is_(None), ordered, id_col.asc())
    query = query.limit(page_size).offset((page - 1) * page_size)
    rows = [dict(r) for r in conn.execute(query).mappings()]
    return rows, total
