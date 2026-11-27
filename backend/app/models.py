"""Request models and their checks. Responses are plain dicts built by the routers."""

from datetime import date, datetime
from typing import Annotated, ClassVar, Literal

from pydantic import (
    BaseModel,
    BeforeValidator,
    ConfigDict,
    EmailStr,
    Field,
    StringConstraints,
    model_validator,
)

Stage = Literal["new", "qualified", "proposal", "negotiation", "won", "lost"]
Status = Literal["lead", "qualified", "customer"]
ActivityType = Literal["note", "call", "email"]


def _blank_to_none(value):
    if isinstance(value, str):
        value = value.strip()
        return value or None
    return value


def _strip(value):
    return value.strip() if isinstance(value, str) else value


# A required name: trimmed, not empty.
Name = Annotated[str, BeforeValidator(_strip), StringConstraints(min_length=1, max_length=200)]


def OptText(max_length: int | None = None):
    """Optional text. An empty string is stored as null."""
    if max_length is None:
        return Annotated[str | None, BeforeValidator(_blank_to_none)]
    return Annotated[
        Annotated[str, StringConstraints(max_length=max_length)] | None,
        BeforeValidator(_blank_to_none),
    ]


OptEmail = Annotated[
    Annotated[EmailStr, StringConstraints(max_length=254)] | None, BeforeValidator(_blank_to_none)
]


class _Patch(BaseModel):
    """A partial update. Fields left out are unchanged; required fields can't be cleared."""

    model_config = ConfigDict(extra="forbid")
    required_fields: ClassVar[tuple[str, ...]] = ()

    @model_validator(mode="after")
    def _no_clearing_required(self):
        for name in self.required_fields:
            if name in self.model_fields_set and getattr(self, name) is None:
                raise ValueError(f"{name} can't be empty")
        return self

    def changes(self) -> dict:
        return {name: getattr(self, name) for name in self.model_fields_set}


class OrganizationCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: Name
    website: OptText(300) = None
    industry: OptText(100) = None
    notes: OptText() = None


class OrganizationUpdate(_Patch):
    required_fields = ("name",)
    name: Name | None = None
    website: OptText(300) = None
    industry: OptText(100) = None
    notes: OptText() = None


class ContactCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: Name
    email: OptEmail = None
    phone: OptText(50) = None
    job_title: OptText(100) = None
    organization_id: int | None = None
    status: Status = "lead"


class ContactUpdate(_Patch):
    required_fields = ("name", "status")
    name: Name | None = None
    email: OptEmail = None
    phone: OptText(50) = None
    job_title: OptText(100) = None
    organization_id: int | None = None
    status: Status | None = None


class DealCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: Name
    organization_id: int
    main_contact_id: int | None = None
    stage: Stage
    value: Annotated[int, Field(ge=0)]
    probability: Annotated[int, Field(ge=0, le=100)] | None = None
    close_date: date | None = None
    lost_reason: OptText(200) = None


class DealUpdate(_Patch):
    required_fields = ("name", "organization_id", "stage", "value", "probability")
    name: Name | None = None
    organization_id: int | None = None
    main_contact_id: int | None = None
    stage: Stage | None = None
    value: Annotated[int, Field(ge=0)] | None = None
    probability: Annotated[int, Field(ge=0, le=100)] | None = None
    close_date: date | None = None
    lost_reason: OptText(200) = None


class DealMove(BaseModel):
    model_config = ConfigDict(extra="forbid")
    stage: Stage
    before_id: int | None
    lost_reason: OptText(200) = None


Description = Annotated[str, BeforeValidator(_strip), StringConstraints(min_length=1, max_length=2000)]


class ActivityCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    type: ActivityType
    description: Description
    occurred_at: datetime
    follow_up_date: date | None = None
    contact_id: int | None = None
    deal_id: int | None = None

    @model_validator(mode="after")
    def _one_owner(self):
        if (self.contact_id is None) == (self.deal_id is None):
            raise ValueError("An activity belongs to one contact or one deal")
        return self


class ActivityUpdate(_Patch):
    required_fields = ("type", "description", "occurred_at", "done")
    type: ActivityType | None = None
    description: Description | None = None
    occurred_at: datetime | None = None
    follow_up_date: date | None = None
    done: bool | None = None
