"""
FreightX API — Rate Intelligence Models

INTERVIEW NOTE: These models show how to structure complex response data
with nested objects. Interviewers ask "how do you handle nested data?"
Answer: Compose Pydantic models — one model can reference another.
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class RateForecastRequest(BaseModel):
    """Query parameters for rate forecasting (used as query params, not body)."""
    origin_state: str = Field(..., min_length=2, max_length=2, examples=["TN"])
    destination_state: str = Field(..., min_length=2, max_length=2, examples=["GA"])
    equipment_type: str = Field("dry_van", examples=["dry_van"])
    lookback_days: int = Field(90, ge=7, le=365, description="Historical window in days")


class WeeklyBreakdown(BaseModel):
    """One week's rate data within a forecast."""
    week_start: str
    avg_rate: float
    sample_count: int


class RateForecastResponse(BaseModel):
    """
    Rate forecast for a specific lane.

    INTERVIEW NOTE: Notice the nested model (WeeklyBreakdown).
    Pydantic handles serialization of nested models automatically.
    In Swagger UI, you'll see the full nested schema with examples.
    """
    origin_state: str
    destination_state: str
    equipment_type: str
    current_avg_rate: Optional[float] = None
    moving_avg_7d: Optional[float] = None
    moving_avg_14d: Optional[float] = None
    moving_avg_30d: Optional[float] = None
    moving_avg_90d: Optional[float] = None
    trend_slope: Optional[float] = None
    forecast_next_week: Optional[float] = None
    confidence: str = Field(..., description="high, medium, low, or very_low")
    sample_count: int
    weekly_breakdown: list[WeeklyBreakdown] = []


class HeatmapLane(BaseModel):
    """One lane in a rate heatmap."""
    origin_state: str
    destination_state: str
    avg_rate_per_mile: float
    sample_count: int
    trend_direction: str  # rising, falling, stable


class RateHeatmapResponse(BaseModel):
    """Multi-lane rate comparison."""
    equipment_type: str
    days: int
    lanes: list[HeatmapLane]
