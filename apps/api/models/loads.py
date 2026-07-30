"""
FreightX API — Load Models

INTERVIEW NOTE: These models demonstrate the most important Pydantic patterns:
- Request vs Response models (never use the same model for both)
- Field validation with constraints
- Optional fields with defaults
- Enum types for restricted values
- model_config for JSON schema examples (powers Swagger UI)
"""

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field, model_validator


# ---------------------------------------------------------------------------
# INTERVIEW NOTE: Enums for Controlled Values
# ---------------------------------------------------------------------------
# Use Python enums for fields with a fixed set of valid values.
# FastAPI auto-validates: if someone sends equipment_type="spaceship",
# they get a 422 Unprocessable Entity with a clear error message.
# Enums also auto-populate the dropdown in Swagger UI.
# ---------------------------------------------------------------------------
class EquipmentType(str, Enum):
    """Valid equipment types for freight loads."""
    dry_van = "dry_van"
    reefer = "reefer"
    flatbed = "flatbed"
    step_deck = "step_deck"
    box_truck = "box_truck"
    power_only = "power_only"
    hotshot = "hotshot"


class LoadStatus(str, Enum):
    """Load lifecycle states."""
    posted = "posted"
    pending = "pending"
    awarded = "awarded"
    in_transit = "in_transit"
    delivered = "delivered"
    cancelled = "cancelled"


# ---------------------------------------------------------------------------
# INTERVIEW NOTE: Request Model vs Response Model
# ---------------------------------------------------------------------------
# NEVER use the same model for input and output. Why?
# - Input: user sends what THEY control (no id, no created_at, no status)
# - Output: you send what THEY need (id, status, computed fields)
#
# This is the "Command Query Responsibility Segregation" (CQRS) principle
# applied to API models. Interviewers ask about this pattern.
# ---------------------------------------------------------------------------

class LoadCreate(BaseModel):
    """
    Request body for creating a new load.

    INTERVIEW NOTE: Notice no `id`, `status`, or `created_at` here.
    Those are server-generated. The client only sends what they control.
    """
    origin_city: str = Field(..., min_length=1, max_length=100, examples=["Nashville"])
    origin_state: str = Field(..., min_length=2, max_length=2, examples=["TN"])
    destination_city: str = Field(..., min_length=1, max_length=100, examples=["Atlanta"])
    destination_state: str = Field(..., min_length=2, max_length=2, examples=["GA"])
    equipment_type: EquipmentType = Field(..., examples=["dry_van"])
    weight: int = Field(..., gt=0, le=80000, description="Weight in pounds")
    rate: float = Field(..., gt=0, description="Rate in USD")
    pickup_date: datetime
    delivery_date: datetime
    description: Optional[str] = Field(None, max_length=1000)
    is_hazmat: bool = Field(False)
    book_now_enabled: bool = Field(False)
    book_now_rate: Optional[float] = Field(None, gt=0)

    # INTERVIEW NOTE: model_validator runs AFTER individual field validation.
    # Use it for cross-field validation (field A depends on field B).
    @model_validator(mode="after")
    def validate_dates(self):
        if self.delivery_date <= self.pickup_date:
            raise ValueError("delivery_date must be after pickup_date")
        if self.book_now_enabled and not self.book_now_rate:
            raise ValueError("book_now_rate is required when book_now_enabled is True")
        return self


class LoadResponse(BaseModel):
    """
    Response model for a load.

    INTERVIEW NOTE: This includes server-generated fields (id, status, created_at)
    that aren't in LoadCreate. The `response_model` parameter on the route
    handler ensures ONLY these fields are sent back — even if the DB returns more.
    This prevents accidental data leaks (e.g., internal_notes, deleted_at).
    """
    id: str
    origin_city: str
    origin_state: str
    destination_city: str
    destination_state: str
    equipment_type: EquipmentType
    weight: int
    rate: float
    pickup_date: datetime
    delivery_date: datetime
    description: Optional[str] = None
    status: LoadStatus
    is_hazmat: bool
    book_now_enabled: bool
    book_now_rate: Optional[float] = None
    poster_company_id: str
    created_at: datetime
    updated_at: Optional[datetime] = None
    miles: Optional[float] = None
    rate_per_mile: Optional[float] = None


class LoadListResponse(BaseModel):
    """
    INTERVIEW NOTE: Pagination wrapper. Always wrap list responses in an object
    with metadata (total count, page info). Never return a raw array — you can't
    add pagination metadata to an array without a breaking API change.
    """
    data: list[LoadResponse]
    total: int
    page: int
    page_size: int
    has_more: bool
