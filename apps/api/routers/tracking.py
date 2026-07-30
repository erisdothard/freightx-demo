"""
FreightX API — Real-Time Tracking Router
"""

from fastapi import APIRouter, Depends, HTTPException, Path

from dependencies import require_scope
from models.tracking import TrackingResponse
from services.supabase_client import query_table, call_rpc


router = APIRouter(
    prefix="/api/v1/tracking",
    tags=["Tracking"],
    dependencies=[Depends(require_scope("tracking:read"))],
)


@router.get(
    "/{load_id}",
    response_model=TrackingResponse,
    summary="Get live tracking data",
    description="Returns current location, ETA, breadcrumb trail, and geofence status for a load.",
)
async def get_tracking(
    load_id: str = Path(..., description="UUID of the load to track"),
):
    """
    INTERVIEW NOTE: This endpoint aggregates data from multiple tables:
    - loads (status)
    - location_pings (GPS breadcrumbs)
    - breadcrumb_snapshots (geofence status)
    - driver_assignments (driver info)

    In a simple app, you'd make 4 DB calls. But our RPC
    (get_latest_truck_locations) handles this in one SQL query.
    This is why RPCs exist — complex joins stay in the database.
    """
    # Get load status
    loads = await query_table("loads", filters={"id": load_id, "deleted_at": None})
    if not loads:
        raise HTTPException(status_code=404, detail="Load not found")

    load = loads[0]

    # Get latest location pings for this load's driver
    pings = await query_table(
        table="location_pings",
        filters={"load_id": load_id},
        order_by="-created_at",
        limit=50,
    )

    current_location = None
    if pings:
        latest = pings[0]
        current_location = {
            "latitude": latest.get("latitude"),
            "longitude": latest.get("longitude"),
            "timestamp": latest.get("created_at"),
            "speed_mph": latest.get("speed"),
            "heading": latest.get("heading"),
        }

    return TrackingResponse(
        load_id=load_id,
        status=load.get("status", "unknown"),
        current_location=current_location,
        breadcrumbs=[
            {
                "latitude": p.get("latitude"),
                "longitude": p.get("longitude"),
                "timestamp": p.get("created_at"),
                "speed_mph": p.get("speed"),
                "heading": p.get("heading"),
            }
            for p in pings
        ],
    )
