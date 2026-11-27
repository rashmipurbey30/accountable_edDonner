from fastapi import APIRouter, Request

from .. import config
from ..seed import reset

router = APIRouter(prefix="/api")


@router.get("/health")
def health():
    return {"ok": True}


@router.get("/meta")
def meta():
    return {"today": config.today().isoformat(), "now": config.now().isoformat()}


# Included by create_app only when ACCOUNTABLE_TEST_MODE=1.
test_router = APIRouter(prefix="/api")


@test_router.post("/test/reset")
def test_reset(request: Request):
    reset(request.app.state.engine, config.today())
    return {"ok": True}
