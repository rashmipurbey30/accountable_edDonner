"""Every dashboard figure, over the rolling 12 months (H1 to H8)."""

from datetime import date, datetime, timedelta

from sqlalchemy import Connection, select

from .. import config
from ..schema import activities, contacts, deals, stage_changes
from ..stages import OPEN_STAGES
from .timeline import stage_change_text

FUNNEL_STEPS = ["new", "qualified", "proposal", "negotiation", "won"]
MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
               "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
UPCOMING_DAYS = 14
DASHBOARD_FOLLOW_UPS = 10
RECENT = 10


def window_start(today: date) -> date:
    """The first day of the month 11 months before today's month."""
    year, month = today.year, today.month - 11
    if month <= 0:
        month += 12
        year -= 1
    return date(year, month, 1)


def month_keys(today: date) -> list[tuple[int, int]]:
    start = window_start(today)
    keys = []
    year, month = start.year, start.month
    for _ in range(12):
        keys.append((year, month))
        month += 1
        if month > 12:
            month, year = 1, year + 1
    return keys


def label(key: tuple[int, int]) -> str:
    return f"{MONTH_NAMES[key[1] - 1]} {key[0]}"


def _expected(rows) -> int:
    return round(sum(r["value"] * r["probability"] / 100 for r in rows))


def _closed(conn, today):
    start = window_start(today)
    return conn.execute(
        select(deals.c.stage, deals.c.value, deals.c.close_date).where(
            deals.c.stage.in_(["won", "lost"]),
            deals.c.close_date >= start,
            deals.c.close_date <= today,
        )
    ).mappings().all()


def months(conn: Connection, today: date) -> list[dict]:
    keys = month_keys(today)
    buckets = {k: {"label": label(k), "revenue": 0, "won": 0, "lost": 0} for k in keys}
    for row in _closed(conn, today):
        bucket = buckets[(row["close_date"].year, row["close_date"].month)]
        if row["stage"] == "won":
            bucket["revenue"] += row["value"]
            bucket["won"] += 1
        else:
            bucket["lost"] += 1
    running = 0
    result = []
    for k in keys:
        running += buckets[k]["revenue"]
        result.append({**buckets[k], "running_total": running})
    return result


def best_month(month_rows: list[dict]) -> dict | None:
    """The month with the most revenue. A tie goes to the later month. None if nothing won."""
    best = None
    for m in month_rows:
        if m["revenue"] > 0 and (best is None or m["revenue"] >= best["revenue"]):
            best = m
    if best is None:
        return None
    return {"label": best["label"], "revenue": best["revenue"], "deals": best["won"]}


def open_pipeline(conn: Connection, today: date) -> dict:
    rows = conn.execute(
        select(deals.c.stage, deals.c.value, deals.c.probability, deals.c.close_date).where(
            deals.c.stage.in_(OPEN_STAGES)
        )
    ).mappings().all()
    by_stage = []
    for stage in OPEN_STAGES:
        mine = [r for r in rows if r["stage"] == stage]
        by_stage.append({
            "stage": stage,
            "count": len(mine),
            "value": sum(r["value"] for r in mine),
            "expected": _expected(mine),
        })
    return {
        "value": sum(r["value"] for r in rows),
        "expected": _expected(rows),
        "count": len(rows),
        "late": sum(1 for r in rows if r["close_date"] is not None and r["close_date"] < today),
        "by_stage": by_stage,
    }


def funnel(conn: Connection, today: date) -> list[dict]:
    """Deals created in the window count towards every step up to the furthest reached."""
    start = datetime.combine(window_start(today), datetime.min.time())
    created = conn.execute(
        select(deals.c.id, deals.c.stage, deals.c.value).where(deals.c.created_at >= start)
    ).mappings().all()
    reached: dict[int, set[str]] = {d["id"]: {d["stage"]} for d in created}
    if reached:
        for deal_id, to_stage in conn.execute(
            select(stage_changes.c.deal_id, stage_changes.c.to_stage).where(
                stage_changes.c.deal_id.in_(list(reached))
            )
        ).all():
            reached[deal_id].add(to_stage)

    steps = [{"stage": s, "deals": 0, "value": 0} for s in FUNNEL_STEPS]
    for d in created:
        furthest = max(
            (FUNNEL_STEPS.index(s) for s in reached[d["id"]] if s in FUNNEL_STEPS), default=-1
        )
        for i in range(furthest + 1):
            steps[i]["deals"] += 1
            steps[i]["value"] += d["value"]
    return steps


def _owner_names(conn: Connection, rows) -> tuple[dict, dict]:
    contact_ids = {r["contact_id"] for r in rows if r["contact_id"] is not None}
    deal_ids = {r["deal_id"] for r in rows if r["deal_id"] is not None}
    contact_names = dict(
        conn.execute(select(contacts.c.id, contacts.c.name).where(contacts.c.id.in_(contact_ids))).all()
    ) if contact_ids else {}
    deal_names = dict(
        conn.execute(select(deals.c.id, deals.c.name).where(deals.c.id.in_(deal_ids))).all()
    ) if deal_ids else {}
    return contact_names, deal_names


def _on(row, contact_names, deal_names) -> dict:
    if row["contact_id"] is not None:
        return {"kind": "contact", "id": row["contact_id"], "name": contact_names[row["contact_id"]]}
    return {"kind": "deal", "id": row["deal_id"], "name": deal_names[row["deal_id"]]}


def all_follow_ups(conn: Connection, today: date) -> list[dict]:
    """Every open follow-up: overdue first (oldest first), then by date."""
    rows = conn.execute(
        select(
            activities.c.id,
            activities.c.description,
            activities.c.follow_up_date,
            activities.c.contact_id,
            activities.c.deal_id,
        )
        .where(activities.c.follow_up_date.is_not(None), activities.c.done.is_(False))
        .order_by(activities.c.follow_up_date, activities.c.id)
    ).mappings().all()
    contact_names, deal_names = _owner_names(conn, rows)
    return [
        {
            "id": r["id"],
            "description": r["description"],
            "follow_up_date": r["follow_up_date"],
            "overdue": r["follow_up_date"] < today,
            "on": _on(r, contact_names, deal_names),
        }
        for r in rows
    ]


def follow_ups_panel(conn: Connection, today: date) -> dict:
    everything = all_follow_ups(conn, today)
    horizon = today + timedelta(days=UPCOMING_DAYS)
    overdue = [f for f in everything if f["overdue"]]
    upcoming = [f for f in everything if today <= f["follow_up_date"] <= horizon]
    return {
        "items": (overdue + upcoming)[:DASHBOARD_FOLLOW_UPS],
        "overdue_count": len(overdue),
        "total_open": len(everything),
    }


def recent(conn: Connection) -> list[dict]:
    acts = conn.execute(
        select(
            activities.c.id,
            activities.c.type,
            activities.c.description,
            activities.c.occurred_at,
            activities.c.contact_id,
            activities.c.deal_id,
        )
        .order_by(activities.c.occurred_at.desc(), activities.c.id.desc())
        .limit(RECENT)
    ).mappings().all()
    changes = conn.execute(
        select(stage_changes, deals.c.name.label("deal_name"))
        .select_from(stage_changes.join(deals, stage_changes.c.deal_id == deals.c.id))
        .order_by(stage_changes.c.changed_at.desc(), stage_changes.c.id.desc())
        .limit(RECENT)
    ).mappings().all()
    contact_names, deal_names = _owner_names(conn, acts)
    entries = [
        {
            "kind": "activity",
            "id": a["id"],
            "type": a["type"],
            "text": a["description"],
            "at": a["occurred_at"],
            "on": _on(a, contact_names, deal_names),
        }
        for a in acts
    ] + [
        {
            "kind": "stage_change",
            "id": c["id"],
            "type": "stage",
            "text": stage_change_text(c["from_stage"], c["to_stage"], c["lost_reason"]),
            "at": c["changed_at"],
            "on": {"kind": "deal", "id": c["deal_id"], "name": c["deal_name"]},
        }
        for c in changes
    ]
    entries.sort(key=lambda e: (e["at"], e["kind"] == "activity", e["id"]), reverse=True)
    return entries[:RECENT]


def dashboard(conn: Connection, today: date | None = None) -> dict:
    today = today or config.today()
    month_rows = months(conn, today)
    revenue = sum(m["revenue"] for m in month_rows)
    won = sum(m["won"] for m in month_rows)
    lost = sum(m["lost"] for m in month_rows)
    return {
        "today": today,
        "months": month_rows,
        "revenue_won": revenue,
        "deals_won": won,
        "deals_lost": lost,
        "win_rate": round(100 * won / (won + lost)) if won + lost else None,
        "average_won": round(revenue / won) if won else None,
        "best_month": best_month(month_rows),
        "open": open_pipeline(conn, today),
        "funnel": funnel(conn, today),
        "follow_ups": follow_ups_panel(conn, today),
        "recent": recent(conn),
    }
