"""The five tables, in SQLAlchemy Core."""

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    MetaData,
    String,
    Table,
    Text,
    false,
)

from .stages import ACTIVITY_TYPES, CONTACT_STATUSES, STAGES

metadata = MetaData()


def _in(column: str, values: list[str]) -> str:
    quoted = ", ".join(f"'{v}'" for v in values)
    return f"{column} IN ({quoted})"


def _stamps() -> list[Column]:
    return [
        Column("created_at", DateTime, nullable=False),
        Column("updated_at", DateTime, nullable=False),
    ]


organizations = Table(
    "organizations",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("name", String(200), nullable=False),
    Column("website", String(300)),
    Column("industry", String(100)),
    Column("notes", Text),
    *_stamps(),
    Index("ix_organizations_name", "name"),
)

contacts = Table(
    "contacts",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("name", String(200), nullable=False),
    Column("email", String(254)),
    Column("phone", String(50)),
    Column("job_title", String(100)),
    Column("organization_id", Integer, ForeignKey("organizations.id", ondelete="SET NULL")),
    Column("status", String(20), nullable=False),
    *_stamps(),
    CheckConstraint(_in("status", CONTACT_STATUSES), name="ck_contacts_status"),
    Index("ix_contacts_name", "name"),
    Index("ix_contacts_organization_id", "organization_id"),
)

deals = Table(
    "deals",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("name", String(200), nullable=False),
    Column(
        "organization_id",
        Integer,
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
    ),
    Column("main_contact_id", Integer, ForeignKey("contacts.id", ondelete="SET NULL")),
    Column("stage", String(20), nullable=False),
    Column("value", Integer, nullable=False),
    Column("probability", Integer, nullable=False),
    Column("close_date", Date),
    Column("lost_reason", String(200)),
    Column("position", Integer, nullable=False),
    *_stamps(),
    CheckConstraint(_in("stage", STAGES), name="ck_deals_stage"),
    CheckConstraint("value >= 0", name="ck_deals_value"),
    CheckConstraint("probability BETWEEN 0 AND 100", name="ck_deals_probability"),
    Index("ix_deals_name", "name"),
    Index("ix_deals_organization_id", "organization_id"),
    Index("ix_deals_main_contact_id", "main_contact_id"),
    Index("ix_deals_stage_position", "stage", "position"),
)

activities = Table(
    "activities",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("type", String(10), nullable=False),
    Column("description", Text, nullable=False),
    Column("occurred_at", DateTime, nullable=False),
    Column("follow_up_date", Date),
    Column("done", Boolean, nullable=False, default=False, server_default=false()),
    Column("contact_id", Integer, ForeignKey("contacts.id", ondelete="CASCADE")),
    Column("deal_id", Integer, ForeignKey("deals.id", ondelete="CASCADE")),
    *_stamps(),
    CheckConstraint(_in("type", ACTIVITY_TYPES), name="ck_activities_type"),
    CheckConstraint(
        "(contact_id IS NULL) != (deal_id IS NULL)", name="ck_activities_one_owner"
    ),
    Index("ix_activities_contact_id", "contact_id"),
    Index("ix_activities_deal_id", "deal_id"),
    Index("ix_activities_occurred_at", "occurred_at"),
    Index("ix_activities_follow_up", "follow_up_date", "done"),
)

stage_changes = Table(
    "stage_changes",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("deal_id", Integer, ForeignKey("deals.id", ondelete="CASCADE"), nullable=False),
    Column("from_stage", String(20)),
    Column("to_stage", String(20), nullable=False),
    Column("lost_reason", String(200)),
    Column("changed_at", DateTime, nullable=False),
    *_stamps(),
    Index("ix_stage_changes_deal_id", "deal_id"),
    Index("ix_stage_changes_changed_at", "changed_at"),
)
