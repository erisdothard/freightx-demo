"""
FreightX API — Rate Intelligence Router

INTERVIEW NOTE: This router demonstrates:
1. Multiple GET endpoints on one router
2. Complex query parameters (state codes, equipment types)
3. Calling SQL RPCs that do heavy computation
4. response_model for clean output
"""

from typing import Optional

from fastapi import APIRouter, Depends, Query

from dependencies import require_scope
from models.rates import RateForecastResponse, RateHeatmapResponse
from services.supabase_client import call_rpc


router = APIRouter(
    prefix="/api/v1/rates",
    tags=["Rate Intelligence"],
    dependencies=[Depends(require_scope("rates:read"))],
)


@router.get(
    "/forecast",
    response_model=RateForecastResponse,
    summary="Get lane rate forecast",
    description="Returns historical moving averages, trend analysis, and naive forecast for a specific lane.",
)
async def get_rate_forecast(
    origin_state: str = Query(..., min_length=2, max_length=2, examples=["TN"]),
    destination_state: str = Query(..., min_length=2, max_length=2, examples=["GA"]),
    equipment_type: str = Query("dry_van", examples=["dry_van", "reefer", "flatbed"]),
    lookback_days: int = Query(90, ge=7, le=365),
):
    """
    INTERVIEW NOTE: The ... (Ellipsis) in Query(...) means REQUIRED.
    No default value → FastAPI returns 422 if not provided.
    This is different from Query("default") which makes it optional with a default.

    The RPC does all the heavy lifting — 7/14/30/90-day moving averages,
    linear regression (regr_slope), confidence bands. We just pass through.
    """
    result = await call_rpc("forecast_lane_rate", {
        "p_origin_state": origin_state.upper(),
        "p_dest_state": destination_state.upper(),
        "p_equipment": equipment_type,
        "p_lookback_days": lookback_days,
    })

    return result


@router.get(
    "/heatmap",
    response_model=RateHeatmapResponse,
    summary="Get rate heatmap",
    description="Multi-lane rate comparison with trend direction indicators.",
)
async def get_rate_heatmap(
    equipment_type: str = Query("dry_van"),
    origin_state: Optional[str] = Query(None, min_length=2, max_length=2),
    days: int = Query(30, ge=7, le=365),
    limit: int = Query(20, ge=1, le=100),
):
    """
    INTERVIEW NOTE: Optional query params with defaults.
    If origin_state is None, the RPC returns top lanes across all origins.
    This is how you make flexible APIs — optional filters with sensible defaults.
    """
    result = await call_rpc("get_rate_heatmap", {
        "p_equipment": equipment_type,
        "p_origin_state": origin_state.upper() if origin_state else None,
        "p_days": days,
        "p_limit": limit,
    })

    return result
