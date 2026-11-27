"""The engine, table creation, and a per-request connection."""

from collections.abc import Iterator
from pathlib import Path
from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy import Connection, Engine, create_engine, event, func, select, text

from . import config
from .schema import metadata, organizations


def make_engine(path: Path | str) -> Engine:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    # autocommit=False (Python 3.12+) makes sqlite3 put every statement, DDL included,
    # inside the transaction SQLAlchemy commits or rolls back.
    engine = create_engine(f"sqlite:///{path.as_posix()}", connect_args={"autocommit": False})

    @event.listens_for(engine, "connect")
    def _on_connect(dbapi_conn, _record):
        # PRAGMA foreign_keys has no effect inside a transaction, so set it outside one.
        dbapi_conn.autocommit = True
        dbapi_conn.execute("PRAGMA foreign_keys=ON")
        dbapi_conn.autocommit = False

    return engine


def foreign_keys_on(conn: Connection) -> int:
    return conn.execute(text("PRAGMA foreign_keys")).scalar_one()


def init_db(engine: Engine, path: Path | None = None) -> bool:
    """Create missing tables. Seed only when the file was just created and is empty.

    Returns True if it seeded.
    """
    db_file = Path(path) if path else Path(engine.url.database or "")
    is_new = not db_file.exists() or db_file.stat().st_size == 0
    with engine.begin() as conn:
        metadata.create_all(conn)
    if not is_new:
        return False
    with engine.begin() as conn:
        count = conn.execute(select(func.count()).select_from(organizations)).scalar_one()
        if count:
            return False
        from .seed import seed  # imported here to avoid a cycle

        seed(conn, config.today())
    return True


def get_conn(request: Request) -> Iterator[Connection]:
    """A FastAPI dependency: one transaction per request, committed before the response."""
    engine: Engine = request.app.state.engine
    with engine.begin() as conn:
        yield conn


# scope="function" ends the transaction (commit) before the response is sent (G4).
Conn = Annotated[Connection, Depends(get_conn, scope="function")]
