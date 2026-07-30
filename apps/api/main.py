"""
FreightX API — Application Entry Point

INTERVIEW NOTE: This is the #1 file interviewers look at. It tells them:
1. Do you understand the app lifecycle? (lifespan context manager)
2. Do you know middleware ordering? (CORS must be last added = first executed)
3. Can you structure a real app? (routers, not everything in one file)
4. Do you handle errors properly? (custom exception handlers)

Run locally:
    uvicorn main:app --reload --port 8000

Run with Docker:
    docker compose up

Swagger docs:  http://localhost:8000/docs
ReDoc:         http://localhost:8000/redoc
Health check:  http://localhost:8000/health
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config import settings
from middleware.request_logger import RequestLoggerMiddleware
from routers import health, loads, rates, carriers, tracking, documents, hos, webhooks


# ---------------------------------------------------------------------------
# INTERVIEW NOTE: Lifespan Events
# ---------------------------------------------------------------------------
# FastAPI 0.100+ uses `lifespan` instead of `@app.on_event("startup")`.
# This is an async context manager — code before `yield` runs at startup,
# code after `yield` runs at shutdown. Think of it like setUp/tearDown.
#
# Why? The old @app.on_event decorator couldn't share state between startup
# and shutdown. The lifespan pattern lets you create a DB pool at startup
# and close it at shutdown using the same variable.
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown logic."""
    # --- STARTUP ---
    print(f"🚛 FreightX API starting in {settings.environment} mode")
    print(f"📖 Docs available at http://{settings.api_host}:{settings.api_port}/docs")

    yield  # App is running — requests are being served

    # --- SHUTDOWN ---
    print("🛑 FreightX API shutting down")


# ---------------------------------------------------------------------------
# INTERVIEW NOTE: App Factory
# ---------------------------------------------------------------------------
# The `app` object IS your application. Everything attaches to it:
# - Routers (groups of endpoints)
# - Middleware (request/response interceptors)
# - Exception handlers
# - OpenAPI metadata (title, version, description → auto-generates docs)
#
# Common interview question: "What's the difference between Flask and FastAPI?"
# Answer: FastAPI is async-first, uses Pydantic for validation, and auto-generates
# OpenAPI docs. Flask is synchronous by default, has no built-in validation,
# and requires extensions (flask-restx, marshmallow) for what FastAPI gives free.
# ---------------------------------------------------------------------------
app = FastAPI(
    title="FreightX API",
    version="1.0.0",
    description=(
        "External-facing REST API for the FreightX freight marketplace. "
        "Provides load management, rate intelligence, carrier ranking, "
        "real-time tracking, and webhook integrations for TMS systems."
    ),
    lifespan=lifespan,
    docs_url="/docs",       # Swagger UI
    redoc_url="/redoc",     # ReDoc (alternative docs viewer)
    openapi_url="/openapi.json",
)


# ---------------------------------------------------------------------------
# INTERVIEW NOTE: Middleware
# ---------------------------------------------------------------------------
# Middleware wraps EVERY request/response. Order matters:
# - Middleware added LAST executes FIRST (it's a stack/onion model)
# - CORS must execute first (before auth, before logging)
# - Think of it like layers of an onion: Request → CORS → Logger → Auth → Route
#
# Common interview question: "Explain the middleware execution order in FastAPI."
# Answer: It's LIFO (Last In, First Out). The last middleware you add is the
# outermost layer. Request flows inward, response flows outward.
# ---------------------------------------------------------------------------

# Custom middleware — request/response audit logging
app.add_middleware(RequestLoggerMiddleware)

# CORS — must be added AFTER custom middleware (so it executes FIRST)
# INTERVIEW NOTE: Without CORS middleware, browsers block cross-origin requests.
# Your React app at localhost:5173 can't call your API at localhost:8000 without this.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],     # GET, POST, PUT, DELETE, PATCH, OPTIONS
    allow_headers=["*"],     # Authorization, Content-Type, X-API-Key, etc.
)


# ---------------------------------------------------------------------------
# INTERVIEW NOTE: Exception Handlers
# ---------------------------------------------------------------------------
# Custom exception handlers let you control the error response format.
# Without these, FastAPI returns its default error JSON. With these, you
# can add request IDs, log errors, send alerts, etc.
#
# Interview question: "How do you handle errors globally in FastAPI?"
# Answer: Custom exception handlers + HTTPException for expected errors +
# try/except in routes for unexpected errors.
# ---------------------------------------------------------------------------
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Catch-all for unhandled exceptions. Prevents stack traces leaking to clients."""
    # In production, you'd log this to Sentry/Datadog/etc.
    print(f"❌ Unhandled error: {exc}")
    return JSONResponse(
        status_code=500,
        content={
            "error": "internal_server_error",
            "message": "An unexpected error occurred" if settings.is_production else str(exc),
        },
    )


# ---------------------------------------------------------------------------
# INTERVIEW NOTE: Routers
# ---------------------------------------------------------------------------
# Routers are FastAPI's way of organizing endpoints into modules.
# Think of them like Express.js routers or Django's urlpatterns.
#
# Each router file (e.g., routers/loads.py) defines a group of related
# endpoints with a shared prefix and tag. Tags group endpoints in Swagger UI.
#
# Interview question: "How do you organize a large FastAPI application?"
# Answer: Routers for endpoint grouping, models/ for Pydantic schemas,
# services/ for business logic, dependencies.py for shared DI, middleware/ for
# cross-cutting concerns. Never put business logic in route handlers.
# ---------------------------------------------------------------------------
app.include_router(health.router)
app.include_router(loads.router)
app.include_router(rates.router)
app.include_router(carriers.router)
app.include_router(tracking.router)
app.include_router(documents.router)
app.include_router(hos.router)
app.include_router(webhooks.router)


# ---------------------------------------------------------------------------
# Root redirect — convenience
# ---------------------------------------------------------------------------
@app.get("/", include_in_schema=False)
async def root():
    """Redirect root to API docs."""
    return {"message": "FreightX API", "docs": "/docs", "health": "/health"}


# ---------------------------------------------------------------------------
# INTERVIEW NOTE: Running the App
# ---------------------------------------------------------------------------
# `uvicorn main:app` means: "In main.py, find the variable called `app`
# and serve it as an ASGI application."
#
# --reload: auto-restart on file changes (dev only, never in production)
# --workers: spawn multiple processes (production, behind nginx/gunicorn)
# --host 0.0.0.0: listen on all interfaces (required for Docker)
#
# For production: use gunicorn with uvicorn workers:
#   gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=not settings.is_production,
    )
