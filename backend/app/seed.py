"""Sample data for a small wholesale business (S1 to S5).

`seed(conn, today)` fills empty tables. Run `python -m backend.app.seed` (or `npm run seed`)
to back up the current database and reset it to the sample data.
"""

import random
import sqlite3
import unicodedata
from datetime import date, datetime, time, timedelta

from faker import Faker
from sqlalchemy import Connection, Engine, func, insert, select, update

from . import config
from .schema import activities, contacts, deals, metadata, organizations, stage_changes
from .services.deals import create_deal, update_deal
from .stages import OPEN_STAGES, STAGES

SEED = 20261126

ORGANIZATIONS = [
    ("Harbor Street Café", "Restaurants and cafés"),
    ("Maple & Rye Bakery", "Restaurants and cafés"),
    ("Copper Kettle Diner", "Restaurants and cafés"),
    ("Brightwell Hotels", "Hotels"),
    ("Crescent Spa", "Hotels"),
    ("Seaview Inn", "Hotels"),
    ("Riverside Grocers", "Retail"),
    ("Elm Row Boutique", "Retail"),
    ("Hollow Pine Hardware", "Retail"),
    ("Northwind Office Park", "Offices and co-working"),
    ("Greenleaf Co-working", "Offices and co-working"),
    ("Pinecrest Fitness", "Fitness"),
    ("Ironworks Gym", "Fitness"),
    ("Lakeside Primary School", "Schools"),
    ("Oakridge Academy", "Schools"),
    ("Willow Bank College", "Schools"),
    ("Summit Dental Group", "Healthcare"),
    ("Bayview Medical", "Healthcare"),
    ("Atlas Logistics", "Logistics"),
    ("Quayside Freight", "Logistics"),
]

NOTES = [
    "Orders monthly. Prefers delivery before 10am.",
    "Pays on 30-day terms. Ask for the purchasing manager.",
    "Opening a second site next spring.",
    "Price-sensitive; compares quotes every quarter.",
    "Long-standing customer. Likes a call before each delivery.",
    "Moved from a competitor last year.",
    "Budget is set each January.",
    "Needs invoices by email only.",
]

# What we sell to each industry: deal names, and phrases for activity descriptions.
CATALOGUE = {
    "Restaurants and cafés": {
        "deals": ["Coffee bean supply 2027", "Takeaway packaging", "Kitchen cleaning supplies",
                  "Tableware refresh", "Paper napkins and cups"],
        "items": ["takeaway cups", "coffee beans", "napkins", "cleaning supplies", "tableware"],
    },
    "Hotels": {
        "deals": ["Banquet linen contract", "Guest toiletries", "Housekeeping supplies",
                  "Room amenities 2027", "Breakfast buffet tableware"],
        "items": ["linen", "guest toiletries", "towels", "housekeeping supplies", "amenity kits"],
    },
    "Retail": {
        "deals": ["Shopping bags", "Till rolls and labels", "Shelf display units",
                  "Gift wrap for the holidays", "Store cleaning contract"],
        "items": ["shopping bags", "till rolls", "price labels", "gift wrap", "display units"],
    },
    "Offices and co-working": {
        "deals": ["Office stationery", "Kitchen and coffee supplies", "Printer paper contract",
                  "Washroom supplies", "Desk accessories"],
        "items": ["printer paper", "stationery", "coffee pods", "washroom supplies", "notebooks"],
    },
    "Fitness": {
        "deals": ["Gym towels", "Cleaning wipes and spray", "Locker room supplies",
                  "Branded water bottles", "Studio mats"],
        "items": ["towels", "cleaning wipes", "hand soap", "water bottles", "yoga mats"],
    },
    "Schools": {
        "deals": ["Classroom supplies 2027", "Exercise books", "Art supplies",
                  "Canteen tableware", "Cleaning contract"],
        "items": ["exercise books", "art supplies", "whiteboard pens", "canteen trays", "paper"],
    },
    "Healthcare": {
        "deals": ["Disposable gloves", "Waiting room supplies", "Clinical wipes",
                  "Patient gowns", "Hand sanitiser contract"],
        "items": ["gloves", "clinical wipes", "hand sanitiser", "paper towels", "gowns"],
    },
    "Logistics": {
        "deals": ["Packing tape and film", "Shipping boxes", "Pallet wrap contract",
                  "Warehouse safety gear", "Labels and printers"],
        "items": ["pallet wrap", "shipping boxes", "packing tape", "hi-vis vests", "labels"],
    },
}

JOB_TITLES = [
    "Owner", "Office Manager", "Purchasing Manager", "Head Chef", "Facilities Manager",
    "General Manager", "Operations Manager", "Bursar", "Practice Manager", "Store Manager",
    "Warehouse Manager", "Buyer",
]

LOST_REASONS = [
    "Went with a cheaper supplier",
    "Budget cut",
    "Chose to wait until next year",
    "Went with their usual supplier",
]

TEMPLATES = {
    "note": [
        "Interested in a volume discount on {item}",
        "Wants samples of our {item} before ordering",
        "Current supplier of {item} is letting them down",
        "Asked about delivery times for {item}",
        "Reorders {item} every few weeks",
    ],
    "call": [
        "Talked through a volume discount on {item}",
        "Called about the {item} order",
        "Went over prices for {item}",
        "Checked how the last delivery of {item} went",
        "Discussed next year's {item} budget",
    ],
    "email": [
        "Sent the 2027 catalogue",
        "Sent a quote for {item}",
        "Emailed the price list for {item}",
        "Followed up on the {item} quote",
        "Sent delivery dates for {item}",
    ],
}


_FAKER: Faker | None = None


def _faker() -> Faker:
    """Faker is slow to start, so make it once. seed_instance() makes each use repeatable."""
    global _FAKER
    if _FAKER is None:
        _FAKER = Faker("en_US")
    return _FAKER


def _domain(name: str) -> str:
    plain = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    return "".join(ch for ch in plain.lower() if ch.isalnum()) + ".example.com"


class _Clock:
    """Random working-hours times (08:00 to 18:00), relative to today."""

    def __init__(self, today: date, rng: random.Random):
        self.today = today
        self.rng = rng

    def at(self, day: date) -> datetime:
        minutes = self.rng.randint(8 * 60, 17 * 60 + 59)
        return datetime.combine(day, time(minutes // 60, minutes % 60))

    def days_ago(self, n: int) -> date:
        return self.today - timedelta(days=n)


def _month_offset(today: date, offset: int) -> tuple[date, date]:
    """First and last day of the month `offset` months before today's month (last capped at today)."""
    year, month = today.year, today.month - offset
    while month <= 0:
        month += 12
        year -= 1
    first = date(year, month, 1)
    nxt = date(year + (month == 12), month % 12 + 1, 1)
    return first, min(nxt - timedelta(days=1), today)


def seed(conn: Connection, today: date, rng: random.Random | None = None) -> None:
    rng = rng or random.Random(SEED)
    fake = _faker()
    fake.seed_instance(SEED)
    clock = _Clock(today, rng)

    # Organizations: created 400 to 700 days ago.
    org_rows = []
    for i, (name, industry) in enumerate(ORGANIZATIONS):
        created = clock.at(clock.days_ago(rng.randint(400, 700)))
        org_id = conn.execute(
            insert(organizations).values(
                name=name,
                website=_domain(name),
                industry=industry,
                notes=NOTES[i % len(NOTES)] if i % 2 == 0 else None,
                created_at=created,
                updated_at=created,
            )
        ).inserted_primary_key[0]
        org_rows.append({"id": org_id, "name": name, "industry": industry, "created": created})

    # Contacts: 52 at organizations (2 to 4 each), 8 on their own.
    per_org = [2] * len(org_rows)
    extra = 52 - sum(per_org)
    while extra:
        i = rng.randrange(len(per_org))
        if per_org[i] < 4:
            per_org[i] += 1
            extra -= 1
    attached_statuses = ["lead"] * 16 + ["qualified"] * 14 + ["customer"] * 22
    rng.shuffle(attached_statuses)

    contact_rows = []
    org_contacts: dict[int, list[int]] = {}
    slots = [org for org, n in zip(org_rows, per_org) for _ in range(n)] + [None] * 8
    for k, org in enumerate(slots):
        first, last = fake.first_name(), fake.last_name()
        if org:
            email = f"{first}.{last}@{_domain(org['name'])}".lower()
            status = attached_statuses[k]
            created = clock.at(clock.days_ago(rng.randint(200, 390)))
        else:
            email = fake.free_email()
            status = "lead"
            created = clock.at(clock.days_ago(rng.randint(20, 300)))
        contact_id = conn.execute(
            insert(contacts).values(
                name=f"{first} {last}",
                email=email,
                phone=fake.phone_number(),
                job_title=rng.choice(JOB_TITLES),
                organization_id=org["id"] if org else None,
                status=status,
                created_at=created,
                updated_at=created,
            )
        ).inserted_primary_key[0]
        contact_rows.append({"id": contact_id, "org": org, "created": created})
        if org:
            org_contacts.setdefault(org["id"], []).append(contact_id)

    # Deals: plan each one's stage, creation day and close date, then write its history.
    plans = []
    won_offsets = rng.sample(range(1, 12), 10)
    for offset in won_offsets:
        first, last = _month_offset(today, offset)
        close = first + timedelta(days=rng.randint(0, (last - first).days))
        plans.append(("won", close))
    for _ in range(2):
        plans.append(("won", clock.days_ago(rng.randint(2, 25))))
    lost_offsets = rng.sample(range(1, 12), 5)
    for offset in lost_offsets:
        first, last = _month_offset(today, offset)
        close = first + timedelta(days=rng.randint(0, (last - first).days))
        plans.append(("lost", close))
    plans.append(("lost", clock.days_ago(rng.randint(3, 20))))

    open_ranges = {
        "new": ((0, 60), (30, 110), 6),
        "qualified": ((15, 90), (10, 90), 6),
        "proposal": ((20, 100), (5, 60), 5),
        "negotiation": ((30, 120), (3, 40), 5),
    }
    open_plans = []
    for stage, (_created, (lo, hi), count) in open_ranges.items():
        for n in range(count):
            late = stage != "new" and n == 0
            close = clock.days_ago(rng.randint(2, 12)) if late else today + timedelta(
                days=rng.randint(lo, hi)
            )
            open_plans.append((stage, close))

    reasons = LOST_REASONS[:]
    rng.shuffle(reasons)
    lost_seen = 0
    deal_rows = []
    used_names: set[str] = set()
    for stage, close in plans + open_plans:
        org = rng.choice(org_rows)
        options = CATALOGUE[org["industry"]]["deals"]
        name = rng.choice(options)
        while f"{org['id']}:{name}" in used_names:
            name = rng.choice(options)
        used_names.add(f"{org['id']}:{name}")
        value = rng.randint(10, 400) * 100
        org_people = org_contacts.get(org["id"], [])
        main_contact = rng.choice(org_people) if org_people and rng.random() >= 0.1 else None

        if stage in ("won", "lost"):
            created_day = close - timedelta(days=rng.randint(30, 120))
            end_day = close
        else:
            lo, hi = open_ranges[stage][0]
            created_day = clock.days_ago(rng.randint(lo, hi))
            end_day = today
        created_at = clock.at(created_day)

        if stage == "won":
            path = ["qualified", "proposal", "negotiation", "won"]
        elif stage == "lost":
            reached = rng.choice(OPEN_STAGES)
            path = OPEN_STAGES[1 : OPEN_STAGES.index(reached) + 1] + ["lost"]
        else:
            path = OPEN_STAGES[1 : OPEN_STAGES.index(stage) + 1]

        deal_id = create_deal(
            conn,
            {
                "name": name,
                "organization_id": org["id"],
                "main_contact_id": main_contact,
                "stage": "new",
                "value": value,
                "close_date": close,
            },
            at=created_at,
        )

        # Evenly spread steps. Closed deals end on their close date; open ones before today.
        span = (end_day - created_day).days
        steps = len(path)
        previous = created_at
        for i, to_stage in enumerate(path, start=1):
            fraction = i / steps if stage in ("won", "lost") else i / (steps + 1)
            day = created_day + timedelta(days=round(span * fraction))
            if stage in ("won", "lost") and i == steps:
                day = close  # the close date is the day it was won or lost
            moment = max(clock.at(day), previous + timedelta(minutes=5))
            changes: dict = {"stage": to_stage}
            if to_stage == "lost":
                lost_seen += 1
                changes["lost_reason"] = reasons[lost_seen - 1] if lost_seen <= 4 else None
            update_deal(conn, deal_id, changes, at=moment)
            previous = moment

        deal_rows.append(
            {"id": deal_id, "created": created_at, "stage": stage, "close": close,
             "industry": org["industry"], "main_contact": main_contact}
        )

    # Positions: by close date within each stage, soonest first.
    for stage in STAGES:
        ordered = conn.execute(
            select(deals.c.id)
            .where(deals.c.stage == stage)
            .order_by(deals.c.close_date.is_(None), deals.c.close_date, deals.c.id)
        ).scalars().all()
        for position, deal_id in enumerate(ordered):
            conn.execute(update(deals).where(deals.c.id == deal_id).values(position=position))

    # Activities: 60 on contacts and 90 on deals.
    types = ["note"] * 60 + ["call"] * 52 + ["email"] * 38
    rng.shuffle(types)
    owners = [("contact", rng.choice(contact_rows)) for _ in range(60)]
    owners += [("deal", rng.choice(deal_rows)) for _ in range(90)]
    rng.shuffle(owners)

    org_industry = {o["id"]: o["industry"] for o in org_rows}
    yesterday = clock.days_ago(1)

    def industry_of(kind, row) -> str:
        if kind == "deal":
            return row["industry"]
        return org_industry[row["org"]["id"]] if row["org"] else rng.choice(list(CATALOGUE))

    # Follow-ups go on records created long enough ago for their dates to make sense.
    follow_ups = (
        [("overdue", rng.randint(1, 9)) for _ in range(4)]
        + [("upcoming", rng.randint(0, 14)) for _ in range(7)]
        + [("later", rng.randint(15, 40)) for _ in range(3)]
        + [("done", rng.randint(10, 200)) for _ in range(12)]
    )
    old_enough = [i for i, (_k, row) in enumerate(owners) if row["created"].date() < today - timedelta(days=230)]
    rng.shuffle(old_enough)
    follow_up_for = dict(zip(old_enough[: len(follow_ups)], follow_ups))
    if len(follow_up_for) < len(follow_ups):  # never with the fixed seed, but stay correct
        raise RuntimeError("Not enough old records for follow-ups")

    for i, ((kind, row), kind_type) in enumerate(zip(owners, types)):
        industry = industry_of(kind, row)
        item = rng.choice(CATALOGUE[industry]["items"])
        description = rng.choice(TEMPLATES[kind_type]).format(item=item)
        earliest = max(row["created"].date() + timedelta(days=1), today - timedelta(days=360))
        latest = yesterday
        if kind == "deal" and row["stage"] in ("won", "lost"):
            latest = min(latest, row["close"] + timedelta(days=20))
        follow_up_date = None
        done = False
        if i in follow_up_for:
            group, days = follow_up_for[i]
            if group in ("overdue", "done"):
                follow_up_date = today - timedelta(days=days)
                done = group == "done"
            else:
                follow_up_date = today + timedelta(days=days)
            latest = min(latest, follow_up_date - timedelta(days=1))
            earliest = max(earliest, follow_up_date - timedelta(days=30))
        if earliest > latest:
            earliest = latest
        day = earliest + timedelta(days=rng.randint(0, (latest - earliest).days))
        occurred = clock.at(day)
        conn.execute(
            insert(activities).values(
                type=kind_type,
                description=description,
                occurred_at=occurred,
                follow_up_date=follow_up_date,
                done=done,
                contact_id=row["id"] if kind == "contact" else None,
                deal_id=row["id"] if kind == "deal" else None,
                created_at=occurred,
                updated_at=occurred,
            )
        )


def reset(engine: Engine, today: date) -> None:
    """Drop every table, create them again and load the sample data, in one transaction."""
    with engine.begin() as conn:
        metadata.drop_all(conn)
        metadata.create_all(conn)
        seed(conn, today)


def counts(conn: Connection) -> dict[str, int]:
    return {
        t.name: conn.execute(select(func.count()).select_from(t)).scalar_one()
        for t in (organizations, contacts, deals, activities, stage_changes)
    }


def main() -> None:
    from .db import make_engine

    path = config.db_path()
    backup = path.with_name(path.stem + ".backup.db")
    had_data = path.exists() and path.stat().st_size > 0
    engine = make_engine(path)
    if had_data:
        # SQLite's backup API copies a consistent snapshot, even with the app running.
        source = sqlite3.connect(path)
        target = sqlite3.connect(backup)
        with target:
            source.backup(target)
        source.close()
        target.close()
    reset(engine, config.today())
    engine.dispose()

    message = "Sample data loaded: 20 organizations, 60 contacts, 40 deals, 150 activities."
    if had_data:
        rel = backup.relative_to(config.REPO_ROOT) if backup.is_relative_to(config.REPO_ROOT) else backup
        message += f" Your previous data was saved to {rel.as_posix()}."
    message += " Refresh the browser to see it."
    print(message)


if __name__ == "__main__":
    main()
