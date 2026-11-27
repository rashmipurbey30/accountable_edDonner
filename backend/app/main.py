from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from . import config
from .db import init_db, make_engine
from .errors import Invalid, NotFound


def create_app(db_path: Path | str | None = None) -> FastAPI:
    path = Path(db_path) if db_path else config.db_path()
    engine = make_engine(path)
    init_db(engine, path)

    app = FastAPI(title="Accountable")
    app.state.engine = engine

    @app.exception_handler(NotFound)
    async def _not_found(_request: Request, exc: NotFound):
        return JSONResponse({"detail": exc.detail}, status_code=404)

    @app.exception_handler(Invalid)
    async def _invalid(_request: Request, exc: Invalid):
        return JSONResponse({"detail": exc.detail}, status_code=422)

    from .routers import activities, contacts, dashboard, deals, meta, organizations, pipeline

    for module in (meta, organizations, contacts, deals, activities, pipeline, dashboard):
        app.include_router(module.router)
    if config.test_mode():
        app.include_router(meta.test_router)
    return app


def __getattr__(name: str):
    # `app` is built on first use (uvicorn asks for it), so importing this module
    # never opens or creates a database by itself.
    if name == "app":
        globals()["app"] = create_app()
        return globals()["app"]
    raise AttributeError(name)
