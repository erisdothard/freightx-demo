"""
FreightX API — Loads Router

INTERVIEW NOTE: This is the most complete router — it demonstrates:
1. GET list with pagination + filtering (Query params)
2. GET single by ID (Path params)
3. POST create (Request body + response_model)
4. Dependency injection for auth (Depends + require_scope)
5. BackgroundTasks for post-response work
6. Error handling with HTTPException

This is the router interviewers would drill into. Know every line.
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Path, BackgroundTasks

from dependencies import get_api_key_data, require_scope
from models.loads import (
    LoadCreate,
    LoadResponse,
    LoadListResponse,
    EquipmentType,
    LoadStatus,
)
from services.supabase_client import call_rpc, query_table


router = APIRouter(
    prefix="/api/v1/loads",
    tags=["Loads"],
    # INTERVIEW NOTE: `dependencies` at the router level means EVERY route
    # in this file requires API key auth. You don't have to add Depends()
    # to each individual route. This is DRY auth.
    dependencies=[Depends(get_api_key_data)],
)


# ---------------------------------------------------------------------------
# INTERVIEW NOTE: GET with Query Parameters
# ---------------------------------------------------------------------------
# Query() params are type-validated automatically. If someone sends
# page=-1, they get a 422 error because we set ge=1 (greater than or equal to 1).
#
# Optional fields default to None — they're ignored in the query if not sent.
#
# Interview question: "What's the difference between Query, Path, Body, and Header?"
# Answer:
# - Path: part of the URL (/loads/{load_id})
# - Query: after the ? (/loads?page=1&status=posted)
# - Body: JSON in the request body (POST/PUT)
# - Header: HTTP headers (X-API-Key, Authorization)
# FastAPI infers the type from the parameter's position and type hint.
# ---------------------------------------------------------------------------
@router.get(
    "",
    response_model=LoadListResponse,
    summary="List available loads",
    description="Returns paginated list of loads with optional filtering by status, equipment, and origin/destination.",
)
async def list_loads(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    status: Optional[LoadStatus] = Query(None, description="Filter by load status"),
    equipment_type: Optional[EquipmentType] = Query(None, description="Filter by equipment"),
    origin_state: Optional[str] = Query(None, min_length=2, max_length=2),
    destination_state: Optional[str] = Query(None, min_length=2, max_length=2),
):
    """
    INTERVIEW NOTE: This is a read endpoint. Notice:
    - response_model=LoadListResponse → FastAPI serializes output through this model
    - Query() with validation → invalid params return 422 before your code runs
    - Pagination wrapper → never return raw arrays (can't add metadata later)
    """
    filters = {}
    if status:
        filters["status"] = status.value
    if equipment_type:
        filters["equipment_type"] = equipment_type.value
    if origin_state:
        filters["origin_state"] = origin_state.upper()
    if destination_state:
        filters["destination_state"] = destination_state.upper()

    # Add soft-delete filter (migration 066)
    filters["deleted_at"] = None

    offset = (page - 1) * page_size

    data = await query_table(
        table="loads",
        filters=filters,
        order_by="-created_at",
        limit=page_size,
        offset=offset,
    )

    return LoadListResponse(
        data=data,
        total=len(data),  # Simplified — production would use a COUNT query
        page=page,
        page_size=page_size,
        has_more=len(data) == page_size,
    )


# ---------------------------------------------------------------------------
# INTERVIEW NOTE: GET with Path Parameter
# ---------------------------------------------------------------------------
# Path() is like Query() but for URL segments. {load_id} in the URL
# becomes the `load_id` parameter in the function.
#
# Interview question: "How do you validate path parameters?"
# Answer: Use Path() with constraints, or Pydantic types. For UUIDs,
# you could use `load_id: UUID = Path(...)` for automatic UUID validation.
# ---------------------------------------------------------------------------
@router.get(
    "/{load_id}",
    response_model=LoadResponse,
    summary="Get load details",
)
async def get_load(
    load_id: str = Path(..., description="UUID of the load"),
):
    """Get a single load by ID."""
    data = await query_table(
        table="loads",
        filters={"id": load_id, "deleted_at": None},
    )

    if not data:
        # INTERVIEW NOTE: HTTPException is FastAPI's way of returning error responses.
        # status_code=404 → Not Found. The `detail` can be a string or dict.
        # FastAPI automatically converts this to a JSON response.
        raise HTTPException(
            status_code=404,
            detail={"error": "not_found", "message": f"Load {load_id} not found"},
        )

    return data[0]


# ---------------------------------------------------------------------------
# INTERVIEW NOTE: POST with Request Body + BackgroundTasks
# ---------------------------------------------------------------------------
# - LoadCreate is the Pydantic model for the request body
# - response_model=LoadResponse controls the output shape
# - status_code=201 overrides the default 200 (201 = Created)
# - BackgroundTasks runs code AFTER the response is sent
#
# Interview question: "What are BackgroundTasks in FastAPI?"
# Answer: Lightweight post-response tasks (email, logging, webhooks).
# NOT for heavy computation — use Celery/RQ for that. BackgroundTasks
# run in the same process, so if the server crashes, the task is lost.
# ---------------------------------------------------------------------------
@router.post(
    "",
    response_model=LoadResponse,
    status_code=201,
    summary="Create a new load",
    dependencies=[Depends(require_scope("loads:write"))],
)
async def create_load(
    load: LoadCreate,
    background_tasks: BackgroundTasks,
    api_key_data: dict = Depends(get_api_key_data),
):
    """
    Create a new freight load.

    INTERVIEW NOTE: The `load: LoadCreate` parameter tells FastAPI:
    1. Read the JSON request body
    2. Validate it against the LoadCreate model
    3. If validation fails, return 422 with detailed error messages
    4. If validation passes, pass the validated object to this function

    You never write manual validation code. Pydantic does it all.
    """
    # Build the insert data
    load_data = load.model_dump()
    load_data["poster_company_id"] = api_key_data.get("company_id")
    load_data["status"] = "posted"

    # Convert enum values to strings for DB
    load_data["equipment_type"] = load_data["equipment_type"].value

    from services.supabase_client import get_supabase_client
    client = get_supabase_client()
    result = client.table("loads").insert(load_data).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create load")

    created_load = result.data[0]

    # INTERVIEW NOTE: BackgroundTasks example — notify carriers about new load
    # This runs AFTER the 201 response is sent to the client.
    # The client doesn't wait for notifications to be sent.
    background_tasks.add_task(
        _notify_new_load,
        load_id=created_load["id"],
    )

    return created_load


async def _notify_new_load(load_id: str):
    """
    Background task: notify carriers about a new load.

    INTERVIEW NOTE: This calls the existing notify_carriers_new_load() RPC
    from migration 065. We're not replacing Supabase — we're wrapping it.
    The FastAPI layer adds: auth, validation, rate limiting, logging.
    """
    try:
        await call_rpc("notify_carriers_new_load", {"p_load_id": load_id})
    except Exception as e:
        # Background tasks should never crash silently
        print(f"Failed to notify carriers for load {load_id}: {e}")
