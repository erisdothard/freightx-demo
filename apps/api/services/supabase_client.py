"""
FreightX API — Supabase Client Service

INTERVIEW NOTE: This is the data access layer. In FastAPI, you typically
create a database connection at startup and inject it into routes via Depends().

Key concepts demonstrated:
- Singleton pattern for the client (one connection, reused everywhere)
- Service layer separation (routes don't know about Supabase directly)
- RPC calls (Supabase's way of calling PostgreSQL functions)

Interview question: "How do you connect to a database in FastAPI?"
Answer: Create a connection pool/client at startup (in lifespan), store it on
app.state, and inject it via dependency injection. For Supabase specifically,
we use the official Python SDK which handles connection pooling internally.
"""

from supabase import create_client, Client

from config import settings


# ---------------------------------------------------------------------------
# INTERVIEW NOTE: Singleton Pattern
# ---------------------------------------------------------------------------
# We create ONE Supabase client and reuse it. The SDK handles connection
# pooling internally. Creating a new client per request would be wasteful.
#
# With a traditional database (SQLAlchemy), you'd use:
#   engine = create_async_engine(DATABASE_URL)
#   async_session = sessionmaker(engine, class_=AsyncSession)
#
# And inject sessions per-request. Supabase abstracts this away.
# ---------------------------------------------------------------------------
_client: Client | None = None


def get_supabase_client() -> Client:
    """
    Get or create the Supabase client singleton.

    INTERVIEW NOTE: This uses the service role key, which bypasses RLS.
    The API layer handles its own auth (API keys), so we need full DB access.
    In a user-facing app, you'd use the anon key + user JWT instead.
    """
    global _client
    if _client is None:
        _client = create_client(
            settings.supabase_url,
            settings.supabase_service_role_key,
        )
    return _client


async def call_rpc(function_name: str, params: dict | None = None) -> dict:
    """
    Call a Supabase RPC (PostgreSQL function).

    INTERVIEW NOTE: RPCs are Supabase's way of calling stored procedures.
    Our SQL migrations define functions like `forecast_lane_rate()` and
    `rank_carriers_for_load()`. This method calls them from Python.

    Example:
        result = await call_rpc("forecast_lane_rate", {
            "p_origin_state": "TN",
            "p_dest_state": "GA",
            "p_equipment": "dry_van",
        })
    """
    client = get_supabase_client()
    response = client.rpc(function_name, params or {}).execute()
    return response.data


async def query_table(
    table: str,
    select: str = "*",
    filters: dict | None = None,
    order_by: str | None = None,
    limit: int | None = None,
    offset: int | None = None,
) -> list[dict]:
    """
    Query a Supabase table with optional filters, ordering, and pagination.

    INTERVIEW NOTE: This is a lightweight query builder. In a larger app,
    you'd use SQLAlchemy ORM for complex queries. But since our heavy logic
    lives in RPCs, simple table queries are fine with the Supabase SDK.
    """
    client = get_supabase_client()
    query = client.table(table).select(select)

    if filters:
        for key, value in filters.items():
            query = query.eq(key, value)

    if order_by:
        desc = order_by.startswith("-")
        column = order_by.lstrip("-")
        query = query.order(column, desc=desc)

    if limit:
        query = query.limit(limit)

    if offset:
        query = query.offset(offset)

    response = query.execute()
    return response.data
