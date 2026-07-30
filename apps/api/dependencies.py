"""
FreightX API — Dependency Injection

INTERVIEW NOTE: This is THE most important FastAPI concept. If you understand
Depends(), you understand FastAPI. Period.

"What is dependency injection in FastAPI?"
Answer: Depends() lets you declare that a route handler NEEDS something
(a DB session, an authenticated user, validated settings) and FastAPI
automatically provides it. It's like React's useContext() but for backends.

How it works:
1. You write a function that returns something (e.g., get_db() returns a DB session)
2. You declare it as a parameter: def my_route(db = Depends(get_db))
3. FastAPI calls get_db() before your route, passes the result as `db`
4. If get_db() is a generator (yield), FastAPI handles cleanup after the response

Why it matters:
- Testability: swap real DB for mock DB in tests by overriding the dependency
- Reusability: auth logic written once, used on every protected route
- Composability: dependencies can depend on other dependencies (dependency trees)

Example dependency chain:
  get_api_key() → validate_scopes() → get_company() → your route handler
  Each step depends on the previous one. FastAPI resolves the whole chain.
"""

from fastapi import Depends, HTTPException, Security, Header
from fastapi.security import APIKeyHeader

from services.supabase_client import get_supabase_client, call_rpc
from config import settings


# ---------------------------------------------------------------------------
# INTERVIEW NOTE: Security Schemes
# ---------------------------------------------------------------------------
# APIKeyHeader tells FastAPI (and Swagger UI) that this API uses API keys
# passed in the X-API-Key header. Swagger will show a lock icon and let you
# enter your key to test endpoints.
#
# Other options: APIKeyQuery (key in URL), OAuth2PasswordBearer (JWT in header)
# ---------------------------------------------------------------------------
api_key_header = APIKeyHeader(
    name="X-API-Key",
    auto_error=False,  # Don't auto-raise 403 — we want custom error messages
)


async def get_api_key_data(
    api_key: str | None = Security(api_key_header),
) -> dict:
    """
    Validate API key and return the associated company data.

    INTERVIEW NOTE: This is a dependency that other dependencies build on.
    It's the first link in the auth chain:
        get_api_key_data() → require_scope() → route handler

    Security() is like Depends() but also registers the auth scheme in OpenAPI.
    This means Swagger UI will show the "Authorize" button.
    """
    if not api_key:
        raise HTTPException(
            status_code=401,
            detail={
                "error": "missing_api_key",
                "message": "X-API-Key header is required",
            },
        )

    # Call the validate_api_key RPC we built in migration 084
    result = await call_rpc("validate_api_key", {
        "p_key_raw": api_key,
        "p_scope": None,      # Scope checked separately per-route
        "p_ip_address": None,  # Could pass request.client.host
    })

    if not result or not result.get("valid"):
        raise HTTPException(
            status_code=403,
            detail={
                "error": "invalid_api_key",
                "message": result.get("reason", "Invalid or expired API key"),
            },
        )

    return result


def require_scope(scope: str):
    """
    Factory function that creates a dependency requiring a specific API scope.

    INTERVIEW NOTE: This is a DEPENDENCY FACTORY — a function that RETURNS
    a dependency. This pattern lets you parameterize dependencies.

    Usage:
        @router.get("/loads", dependencies=[Depends(require_scope("loads:read"))])
        async def list_loads(): ...

    Why a factory? Because each route needs a DIFFERENT scope. You can't
    hardcode "loads:read" into a single dependency function. The factory
    creates a new dependency for each scope.

    This is equivalent to Express.js middleware:
        app.get("/loads", requireScope("loads:read"), handler)
    """
    async def _check_scope(
        api_key_data: dict = Depends(get_api_key_data),
    ) -> dict:
        scopes = api_key_data.get("scopes", [])
        if scope not in scopes:
            raise HTTPException(
                status_code=403,
                detail={
                    "error": "insufficient_scope",
                    "message": f"This endpoint requires the '{scope}' scope",
                    "required_scope": scope,
                    "your_scopes": scopes,
                },
            )
        return api_key_data

    return _check_scope
