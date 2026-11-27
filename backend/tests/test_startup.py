from sqlalchemy import func, select, update

from backend.app.db import make_engine
from backend.app.main import create_app
from backend.app.schema import organizations


def count_orgs(path):
    eng = make_engine(path)
    with eng.connect() as conn:
        n = conn.execute(select(func.count()).select_from(organizations)).scalar_one()
    eng.dispose()
    return n


def test_missing_file_is_created_and_seeded__G2(tmp_path):
    path = tmp_path / "sub" / "fresh.db"
    app = create_app(path)
    app.state.engine.dispose()
    assert path.exists()
    assert count_orgs(path) == 20


def test_existing_file_is_not_reseeded__G2(tmp_path):
    path = tmp_path / "kept.db"
    app = create_app(path)
    with app.state.engine.begin() as conn:
        conn.execute(organizations.delete().where(organizations.c.id == 1))
    app.state.engine.dispose()

    app = create_app(path)
    app.state.engine.dispose()
    assert count_orgs(path) == 19


def test_change_survives_closing_and_reopening__G4(tmp_path):
    path = tmp_path / "persist.db"
    app = create_app(path)
    with app.state.engine.begin() as conn:
        conn.execute(update(organizations).where(organizations.c.id == 1).values(name="Kept"))
    app.state.engine.dispose()

    app = create_app(path)
    with app.state.engine.connect() as conn:
        name = conn.execute(
            select(organizations.c.name).where(organizations.c.id == 1)
        ).scalar_one()
    app.state.engine.dispose()
    assert name == "Kept"
