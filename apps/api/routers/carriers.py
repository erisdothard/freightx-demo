"""
FreightX API — Carrier Ranking Router

INTERVIEW NOTE: This demonstrates POST for a "query" operation.
The request body contains a load_id, and the response is a ranked
list of carriers. This is a read-heavy operation disguised as a POST
because the body is complex and the query may be logged.
"""

from fastapi import APIRouter, Depends

from dependencies import get_api_key_data
from models.carriers import CarrierRankRequest, CarrierRankResponse
from services.supabase_client import call_rpc


router = APIRouter(
    prefix="/api/v1/carriers",
    tags=["Carriers"],
    dependencies=[Depends(get_api_key_data)],
)


@router.post(
    "/rank",
    response_model=CarrierRankResponse,
    summary="Rank carriers for a load",
    description="Scores and ranks all eligible carriers for a specific load using 7-factor weighted scoring.",
)
async def rank_carriers(request: CarrierRankRequest):
    """
    INTERVIEW NOTE: The request body (CarrierRankRequest) is automatically
    parsed from JSON, validated, and passed as a Python object.

    If the JSON is invalid or missing required fields, FastAPI returns:
    {
        "detail": [
            {
                "loc": ["body", "load_id"],
                "msg": "field required",
                "type": "value_error.missing"
            }
        ]
    }

    You don't write ANY of this validation code. Pydantic does it.
    """
    result = await call_rpc("rank_carriers_for_load", {
        "p_load_id": request.load_id,
        "p_limit": request.limit,
    })

    return result
