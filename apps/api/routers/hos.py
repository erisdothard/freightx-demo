"""
FreightX API — HOS (Hours of Service) Compliance Router

INTERVIEW NOTE: This router wraps FMCSA-regulated compliance data.
In freight-tech, HOS compliance is table stakes. Carriers MUST track
driver hours, and ELD devices automatically report duty status.

This API exposes HOS data to external TMS systems that need to:
- Check if a driver is available for a load (hours remaining)
- Audit compliance history
- Integrate with their own dispatch software
"""

from fastapi import APIRouter, Depends, Path

from dependencies import get_api_key_data
from models.hos import HosStatusResponse
from services.supabase_client import call_rpc


router = APIRouter(
    prefix="/api/v1/drivers",
    tags=["HOS Compliance"],
    dependencies=[Depends(get_api_key_data)],
)


@router.get(
    "/{driver_id}/hos",
    response_model=HosStatusResponse,
    summary="Get driver HOS status",
    description=(
        "Returns real-time Hours of Service compliance data including "
        "current duty status, remaining drive time, violations, and daily summary. "
        "Compliant with 49 CFR Part 395."
    ),
)
async def get_driver_hos(
    driver_id: str = Path(..., description="UUID of the driver"),
):
    """
    INTERVIEW NOTE: This is a thin wrapper around the get_driver_hos_status RPC.
    The SQL function does all the calculation (aggregating duty logs, checking
    violation thresholds, computing remaining hours).

    Why not do this in Python? Because the data already lives in PostgreSQL.
    Doing aggregations in SQL is 10-100x faster than fetching raw duty logs
    and computing in Python. Let the database do what databases are good at.

    When would you move this to Python? When you need:
    - ML-based predictions ("will this driver violate in the next 2 hours?")
    - External ELD device integration (Samsara, Geotab API polling)
    - Complex workflow (alert → notification → escalation)
    """
    result = await call_rpc("get_driver_hos_status", {
        "p_driver_id": driver_id,
    })

    return result
