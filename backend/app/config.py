"""Settings read from the environment, with defaults for running on one computer."""

import os
from datetime import date, datetime
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent


def db_path() -> Path:
    """The SQLite file. ACCOUNTABLE_DB may be relative to the repo root."""
    raw = os.environ.get("ACCOUNTABLE_DB")
    if not raw:
        return REPO_ROOT / "data" / "accountable.db"
    path = Path(raw)
    return path if path.is_absolute() else REPO_ROOT / path


def today() -> date:
    raw = os.environ.get("ACCOUNTABLE_TODAY")
    return date.fromisoformat(raw) if raw else date.today()


def now() -> datetime:
    """Today's date (which tests may fix) with the current local time, to the second."""
    current = datetime.now().time().replace(microsecond=0)
    return datetime.combine(today(), current)


def test_mode() -> bool:
    return os.environ.get("ACCOUNTABLE_TEST_MODE") == "1"
