"""
FreightX API — Health Check Router

INTERVIEW NOTE: Every production API needs a health check endpoint.
Load balancers (ALB, nginx), container orchestrators (K8s, ECS), and
monitoring tools (Datadog, UptimeRobot) poll this endpoint to know if
your service is alive.

A good health check:
- Returns quickly (< 500ms)
- Checks real dependencies (database, cache, external services)
- Returns structured data (not just "ok")
- Does NOT require authentication
"""

from datetime import datetime, timezone

from fastapi import APIRouter
from services.supabase_client import get_supabase_client


# ---------------------------------------------------------------------------
# INTERVIEW NOTE: APIRouter
# ---------------------------------------------------------------------------
# APIRouter is FastAPI's grouping mechanism. It's like Express's Router().
# Each router gets a prefix, tags (for Swagger grouping), and its own routes.
#
# prefix="/health" means all routes in this file start with /health
# tags=["Health"] groups them under "Health" in Swagger UI
# ---------------------------------------------------------------------------
router = APIRouter(tags=["Health"])


@router.get("/health")
async def health_check():
    """
    System health check — verifies API and database connectivity.

    INTERVIEW NOTE: This endpoint returns a dict, and FastAPI automatically
    converts it to JSON. You don't need jsonify() like in Flask.
    FastAPI uses Pydantic under the hood to serialize the response.

    The status field uses a standard convention:
    - "healthy": all systems operational
    - "degraded": some systems down but core functionality works
    - "unhealthy": critical systems down

    No auth required — load balancers need to hit this without credentials.
    """
    db_healthy = False
    db_latency_ms = None

    try:
        import time
        start = time.perf_counter()
        client = get_supabase_client()
        # Simple query to verify DB connectivity
        client.table("profiles").select("id").limit(1).execute()
        db_latency_ms = round((time.perf_counter() - start) * 1000, 1)
        db_healthy = True
    except Exception:
        db_healthy = False

    status = "healthy" if db_healthy else "unhealthy"

    return {
        "status": status,
        "version": "1.0.0",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "checks": {
            "database": {
                "status": "up" if db_healthy else "down",
                "latency_ms": db_latency_ms,
            },
        },
    }
