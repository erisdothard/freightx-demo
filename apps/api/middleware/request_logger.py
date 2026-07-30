"""
FreightX API — Request/Response Logger Middleware

INTERVIEW NOTE: Observability is a production requirement. Every API request
should be logged with: method, path, status code, duration, and client identifier.

This middleware captures timing data and logs it. In production, you'd send
these logs to a service (Datadog, CloudWatch, Grafana) for dashboards and alerts.

Interview question: "How do you monitor a FastAPI application in production?"
Answer: Three pillars of observability:
1. Logging — structured logs (JSON) with request context (this middleware)
2. Metrics — request count, latency percentiles, error rates (Prometheus)
3. Tracing — distributed trace IDs across services (OpenTelemetry)

This middleware handles pillar 1. For a sell-ready product, you'd add all three.
"""

import time
import logging

from starlette.middleware.base import BaseHTTPMiddleware
from fastapi import Request


# INTERVIEW NOTE: Structured logging vs print().
# print() is fine for dev. In production, use the logging module with JSON output.
# This lets log aggregators (Datadog, ELK) parse and query your logs.
logger = logging.getLogger("freightx.api")


class RequestLoggerMiddleware(BaseHTTPMiddleware):
    """
    Logs every request with method, path, status code, and duration.

    INTERVIEW NOTE: Notice we measure time AROUND the call_next().
    call_next() is where the actual route handler runs. So:
        start → call_next() → end
    gives us the total request processing time.
    """

    async def dispatch(self, request: Request, call_next):
        start_time = time.perf_counter()

        # Process the request through the rest of the middleware stack + route
        response = await call_next(request)

        # Calculate duration
        duration_ms = (time.perf_counter() - start_time) * 1000

        # Extract client identifier
        api_key = request.headers.get("X-API-Key", "")
        client_id = f"key:...{api_key[-4:]}" if api_key else f"ip:{request.client.host}"

        # Log the request
        # INTERVIEW NOTE: This log format includes everything you need for debugging:
        # - HTTP method and path (what was requested)
        # - Status code (did it succeed?)
        # - Duration (was it fast?)
        # - Client (who made the request?)
        logger.info(
            "%s %s → %d (%.1fms) [%s]",
            request.method,
            request.url.path,
            response.status_code,
            duration_ms,
            client_id,
        )

        # Add timing header to response (useful for client-side monitoring)
        response.headers["X-Response-Time"] = f"{duration_ms:.1f}ms"

        return response
