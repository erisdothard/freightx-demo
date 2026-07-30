"""
FreightX API — Rate Limiting Middleware

INTERVIEW NOTE: Rate limiting is a TOP interview topic for API design.
"How would you implement rate limiting?"

Common algorithms:
1. Fixed Window — count requests per time window (e.g., 100/minute). Simple but bursty.
2. Sliding Window — smoother but more memory. Combines fixed windows.
3. Token Bucket — tokens refill at a fixed rate. Allows bursts up to bucket size. ← WE USE THIS
4. Leaky Bucket — requests drain at a fixed rate. No bursts allowed.

We use slowapi (built on limits library) which implements token bucket.
It integrates with FastAPI as middleware and uses the API key as the identifier.

Interview question: "Where does rate limit state live?"
Answer: In-memory for single server. Redis for distributed systems.
We use in-memory here (fine for single instance). For production scale,
you'd swap to Redis: `storage_uri="redis://localhost:6379"`.
"""

from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from fastapi import Request


def get_api_key_or_ip(request: Request) -> str:
    """
    INTERVIEW NOTE: Rate limit identifier function.
    We rate limit by API key if present, otherwise by IP address.
    This prevents one API key from consuming all capacity, while
    still limiting unauthenticated requests (like /health spam).
    """
    api_key = request.headers.get("X-API-Key")
    if api_key:
        # Use first 8 chars of key as identifier (don't store full key in memory)
        return f"key:{api_key[:8]}"
    return f"ip:{get_remote_address(request)}"


# INTERVIEW NOTE: The Limiter instance is configured once and shared.
# "100/minute" means 100 requests per minute per identifier.
# You can override per-route: @limiter.limit("10/minute")
limiter = Limiter(
    key_func=get_api_key_or_ip,
    default_limits=["100/minute"],
    # For production with multiple servers:
    # storage_uri="redis://localhost:6379",
)
