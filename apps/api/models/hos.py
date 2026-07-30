"""
FreightX API — HOS (Hours of Service) Compliance Models

INTERVIEW NOTE: HOS is regulated by 49 CFR Part 395 (FMCSA).
These aren't just data models — they represent legal compliance requirements.
This is the kind of domain knowledge that impresses in freight-tech interviews.
"""

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class DutyStatus(str, Enum):
    """
    FMCSA-defined duty statuses per 49 CFR § 395.2.
    Every commercial driver must be in exactly ONE of these states.
    """
    off_duty = "off_duty"
    sleeper_berth = "sleeper_berth"
    driving = "driving"
    on_duty_not_driving = "on_duty_not_driving"


class HosViolation(BaseModel):
    """An HOS violation detected for a driver."""
    violation_type: str = Field(
        ...,
        description="11h_driving, 14h_window, 30min_break, 60h_weekly, 70h_weekly",
    )
    severity: str  # warning, violation, critical
    detected_at: datetime
    acknowledged: bool = False


class HosDailySummary(BaseModel):
    """Pre-aggregated daily HOS hours."""
    log_date: str
    drive_minutes: int
    on_duty_minutes: int
    off_duty_minutes: int
    sleeper_minutes: int
    violations_count: int


class HosStatusResponse(BaseModel):
    """
    Complete HOS compliance snapshot for a driver.

    INTERVIEW NOTE: This is a good example of a "composite" response —
    it combines current state, historical data, and computed fields.
    The RPC (get_driver_hos_status) does all the heavy lifting in SQL.
    """
    driver_id: str
    current_status: DutyStatus
    hours_driven_today: float = Field(..., description="Hours driven in current 24h period")
    hours_on_duty_today: float = Field(..., description="Total on-duty hours today")
    hours_remaining_drive: float = Field(..., description="Driving hours left before 11h limit")
    hours_remaining_window: float = Field(..., description="Hours left in 14h on-duty window")
    minutes_since_last_break: Optional[int] = Field(None, description="Minutes since last 30min+ break")
    weekly_hours: float = Field(..., description="Total on-duty hours this week")
    weekly_limit: int = Field(70, description="60h/7day or 70h/8day limit")
    violations: list[HosViolation] = []
    daily_summary: list[HosDailySummary] = []
    last_updated: datetime
