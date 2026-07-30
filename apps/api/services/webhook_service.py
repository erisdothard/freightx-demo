"""
FreightX API — Outbound Webhook Delivery Service

INTERVIEW NOTE: This is business logic in the SERVICE layer, not in routes.
The separation matters:
- Routes: HTTP concerns (parsing requests, returning responses)
- Services: Business logic (webhook delivery, retry, signing)
- Models: Data shapes (validation, serialization)

This 3-layer architecture is an interview staple:
"How do you structure business logic in FastAPI?"
Answer: Routes handle HTTP, services handle logic, models handle data.
Routes call services. Services call the database. Never skip a layer.
"""

import hashlib
import hmac
import time
from datetime import datetime, timezone

import httpx

from services.supabase_client import get_supabase_client, query_table


async def deliver_webhook(
    webhook_id: str,
    event_type: str,
    payload: dict,
) -> bool:
    """
    Deliver an event to a registered webhook endpoint.

    INTERVIEW NOTE: Webhook delivery has three critical requirements:
    1. Signing — HMAC-SHA256 so the receiver can verify authenticity
    2. Timeout — don't wait forever for slow endpoints
    3. Retry — if delivery fails, try again with exponential backoff

    This function handles #1 and #2. For #3, we create a webhook_deliveries
    record and let the webhook-delivery edge function handle retries.
    """
    # Fetch webhook config
    webhooks = await query_table("webhooks", filters={"id": webhook_id, "active": True})
    if not webhooks:
        return False

    webhook = webhooks[0]
    url = webhook["url"]
    secret_hash = webhook.get("secret", "")

    # Build the signed payload
    import json
    body = json.dumps(payload, default=str)
    timestamp = str(int(time.time()))

    # INTERVIEW NOTE: HMAC signing
    # We sign: timestamp + "." + body
    # The receiver computes the same HMAC with their stored secret.
    # If the hashes match, the payload is authentic AND unmodified.
    # The timestamp prevents replay attacks (reject if too old).
    signature_payload = f"{timestamp}.{body}"
    signature = hmac.new(
        secret_hash.encode(),
        signature_payload.encode(),
        hashlib.sha256,
    ).hexdigest()

    headers = {
        "Content-Type": "application/json",
        "X-FreightX-Signature": f"t={timestamp},v1={signature}",
        "X-FreightX-Event": event_type,
        "User-Agent": "FreightX-Webhook/1.0",
    }

    # Record the delivery attempt
    client = get_supabase_client()
    delivery = client.table("webhook_deliveries").insert({
        "webhook_id": webhook_id,
        "event_type": event_type,
        "payload": payload,
        "attempts": 1,
    }).execute()

    delivery_id = delivery.data[0]["id"] if delivery.data else None

    # INTERVIEW NOTE: httpx is the async HTTP client for Python.
    # `requests` library is synchronous — using it in async FastAPI blocks
    # the event loop. Always use httpx for async HTTP calls.
    try:
        async with httpx.AsyncClient() as http:
            response = await http.post(
                url,
                content=body,
                headers=headers,
                timeout=10.0,  # 10 second timeout — don't wait forever
            )

        if delivery_id:
            client.table("webhook_deliveries").update({
                "response_status": response.status_code,
                "delivered_at": datetime.now(timezone.utc).isoformat()
                    if response.status_code < 400 else None,
            }).eq("id", delivery_id).execute()

        return response.status_code < 400

    except httpx.TimeoutException:
        if delivery_id:
            client.table("webhook_deliveries").update({
                "response_status": 408,  # Timeout
            }).eq("id", delivery_id).execute()
        return False

    except Exception as e:
        if delivery_id:
            client.table("webhook_deliveries").update({
                "response_status": 0,  # Connection error
            }).eq("id", delivery_id).execute()
        return False
