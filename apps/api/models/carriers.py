"""
FreightX API — Carrier Ranking Models

INTERVIEW NOTE: This demonstrates a POST request body for a "query" operation.
"Isn't POST only for creating resources?" No. POST is appropriate when:
1. The query has a complex body (can't fit in URL params)
2. The query is not idempotent (changes state, like logging the search)
3. The query parameters are sensitive (shouldn't appear in server logs)

Here, rank_carriers_for_load has a load_id and returns scored results.
A POST is appropriate because it may log the query for analytics.
"""

from typing import Optional

from pydantic import BaseModel, Field


class CarrierRankRequest(BaseModel):
    """Request body to rank carriers for a specific load."""
    load_id: str = Field(..., description="UUID of the load to rank carriers for")
    limit: int = Field(20, ge=1, le=100, description="Max carriers to return")


class ScoringFactor(BaseModel):
    """One factor in the carrier scoring breakdown."""
    factor: str
    score: float
    max_score: float
    detail: Optional[str] = None


class RankedCarrier(BaseModel):
    """A carrier with their match score for a specific load."""
    company_id: str
    company_name: str
    mc_number: Optional[str] = None
    dot_number: Optional[str] = None
    total_score: float
    max_score: float
    percentage: float
    grade: str  # A+, A, B+, B, C+, C, D
    factors: list[ScoringFactor] = []


class CarrierRankResponse(BaseModel):
    """
    INTERVIEW NOTE: response_model=CarrierRankResponse on the route
    ensures FastAPI only returns these fields. If the RPC returns extra
    data (internal scores, debug info), it gets filtered out automatically.
    This is the "response model" pattern — one of FastAPI's best features.
    """
    load_id: str
    carriers: list[RankedCarrier]
    total_scored: int
