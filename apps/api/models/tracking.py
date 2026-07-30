"""
FreightX API — Tracking Models
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class LocationPing(BaseModel):
    """A single GPS location ping from a driver."""
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    timestamp: datetime
    speed_mph: Optional[float] = None
    heading: Optional[float] = None


class TrackingResponse(BaseModel):
    """
    Real-time tracking data for a load.

    INTERVIEW NOTE: Field() with `description` generates documentation
    in Swagger UI automatically. Always add descriptions to non-obvious fields.
    """
    load_id: str
    status: str
    driver_name: Optional[str] = None
    current_location: Optional[LocationPing] = None
    eta_minutes: Optional[int] = Field(None, description="Estimated minutes to next stop")
    breadcrumbs: list[LocationPing] = Field(
        default=[],
        description="Recent location history (last 50 pings)",
    )
    geofence_status: Optional[str] = Field(
        None,
        description="at_pickup, en_route, at_delivery, departed",
    )
