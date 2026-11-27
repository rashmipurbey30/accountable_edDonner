"""Errors the services raise, turned into 404 and 422 responses by main.py."""


class NotFound(Exception):
    """A record that doesn't exist. `record` is e.g. "Organization"."""

    def __init__(self, record: str):
        super().__init__(f"{record} not found")
        self.detail = f"{record} not found"


class Invalid(Exception):
    """A request that fails a rule. Shaped like FastAPI's own 422 detail."""

    def __init__(self, field: str, message: str, location: str = "body"):
        super().__init__(message)
        self.detail = [{"type": "value_error", "loc": [location, field], "msg": message}]
