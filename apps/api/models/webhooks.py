"""
FreightX API — Webhook Models

INTERVIEW NOTE: Webhooks are reverse APIs — instead of the client polling
your server, your server pushes events to the client's URL.

Key concepts:
- Webhook registration: client tells you their URL and which events they want
- Webhook delivery: you POST event data to their URL with HMAC signature
- Webhook retry: if delivery fails, retry with exponential backoff
- Webhook secret: shared secret used to sign payloads (so client can verify it's from you)
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, HttpUrl


class WebhookCreate(BaseModel):
    """Register a new webhook endpoint."""
    url: HttpUrl = Field(..., description="HTTPS URL to receive webhook events")
    events: list[str] = Field(
        ...,
        min_length=1,
        description="Events to subscribe to",
        examples=[["load.posted", "load.delivered", "bid.accepted"]],
    )
    description: Optional[str] = Field(None, max_length=500)


class WebhookResponse(BaseModel):
    """
    INTERVIEW NOTE: Notice `secret` is only returned on creation (via a separate
    model or field). Once created, the secret is never shown again — just like
    API keys. This is the "show once" pattern for sensitive data.
    """
    id: str
    url: str
    events: list[str]
    secret: Optional[str] = Field(None, description="Only returned on creation")
    active: bool = True
    created_at: datetime


class WebhookDelivery(BaseModel):
    """Record of a webhook delivery attempt."""
    id: str
    webhook_id: str
    event_type: str
    status_code: Optional[int] = None
    attempts: int
    delivered_at: Optional[datetime] = None
    next_retry_at: Optional[datetime] = None
