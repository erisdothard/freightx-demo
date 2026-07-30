"""
FreightX API — API Key Authentication Middleware

INTERVIEW NOTE: There are TWO ways to do auth in FastAPI:
1. Middleware (runs on EVERY request, before routing)
2. Dependencies (runs on SPECIFIC routes, via Depends())

We use BOTH:
- This middleware does lightweight checks (is the key present? is the path exempt?)
- The dependency (dependencies.py) does the heavy validation (DB lookup, scope check)

Why both? Middleware catches obviously bad requests EARLY (before routing, before
Pydantic validation). The dependency handles fine-grained scope checks per-route.

Interview question: "When would you use middleware vs dependencies?"
Answer: Middleware for cross-cutting concerns that apply to ALL requests (logging,
CORS, rate limiting). Dependencies for per-route logic (auth scopes, DB injection).
"""

from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse


# Paths that don't require an API key
EXEMPT_PATHS = {
    "/",
    "/health",
    "/docs",
    "/redoc",
    "/openapi.json",
    "/webhooks/stripe",  # Stripe verifies via signature, not API key
}


class APIKeyAuthMiddleware(BaseHTTPMiddleware):
    """
    INTERVIEW NOTE: BaseHTTPMiddleware is Starlette's (FastAPI's foundation)
    way of writing middleware. The `dispatch` method intercepts every request.

    The flow:
    1. Request comes in
    2. dispatch() runs your pre-processing code
    3. `response = await call_next(request)` passes to the next middleware/route
    4. You can modify the response before returning it

    This is the "onion model" — each middleware wraps the next one.
    """

    async def dispatch(self, request: Request, call_next):
        # Skip auth for exempt paths (docs, health check, etc.)
        if request.url.path in EXEMPT_PATHS:
            return await call_next(request)

        # Skip auth for OPTIONS requests (CORS preflight)
        if request.method == "OPTIONS":
            return await call_next(request)

        # Check for API key presence (actual validation happens in dependencies)
        api_key = request.headers.get("X-API-Key")
        if not api_key and request.url.path.startswith("/api/"):
            return JSONResponse(
                status_code=401,
                content={
                    "error": "missing_api_key",
                    "message": "X-API-Key header is required for /api/ endpoints",
                },
            )

        # Pass through — detailed validation happens in route dependencies
        return await call_next(request)
