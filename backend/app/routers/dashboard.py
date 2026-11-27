from fastapi import APIRouter

from .. import config
from ..db import Conn
from ..services.dashboard import all_follow_ups, dashboard

router = APIRouter(prefix="/api", tags=["dashboard"])


@router.get("/dashboard")
def get_dashboard(conn: Conn):
    return dashboard(conn)


@router.get("/follow-ups")
def follow_ups(conn: Conn):
    return all_follow_ups(conn, config.today())
