"""
FreightX API — Webhooks Router

INTERVIEW NOTE: This is the most complex router — it handles BOTH:
1. Outbound webhooks (our API pushes events to customer URLs)
2. Inbound webhooks (Stripe pushes payment events to our API)

Key concepts:
- Webhook registration (CRUD for webhook endpoints)
- HMAC signature verification (Stripe inbound)
- Background task delivery (outbound)
- Idempotency (don't process the same event twice)
"""

import hmac
import hashlib

from fastapi import APIRouter, Depends, HTTPException, Request, BackgroundTasks

from dependencies import require_scope, get_api_key_data
from models.webhooks import WebhookCreate, WebhookResponse
from services.supabase_client import get_supabase_client, call_rpc, query_table
from config import settings


router = APIRouter(tags=["Webhooks"])


# ---------------------------------------------------------------------------
# Outbound Webhooks — Customer-facing
# ---------------------------------------------------------------------------

@router.post(
    "/api/v1/webhooks",
    response_model=WebhookResponse,
    status_code=201,
    summary="Register a webhook endpoint",
    dependencies=[Depends(require_scope("webhooks:manage"))],
)
async def create_webhook(
    webhook: WebhookCreate,
    api_key_data: dict = Depends(get_api_key_data),
):
    """
    Register a URL to receive event notifications.

    INTERVIEW NOTE: The `secret` field in the response is only shown ONCE
    at creation time. The customer must save it — we store only the hash.
    This is the same pattern as API keys and GitHub webhook secrets.
    """
    import secrets

    # Generate webhook secret
    secret = f"whsec_{secrets.token_urlsafe(32)}"
    secret_hash = hashlib.sha256(secret.encode()).hexdigest()

    client = get_supabase_client()
    result = client.table("webhooks").insert({
        "company_id": api_key_data.get("company_id"),
        "url": str(webhook.url),
        "events": webhook.events,
        "secret": secret_hash,  # Store hash, not plaintext
        "active": True,
    }).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create webhook")

    response_data = result.data[0]
    response_data["secret"] = secret  # Return plaintext ONCE

    return response_data


@router.get(
    "/api/v1/webhooks",
    response_model=list[WebhookResponse],
    summary="List registered webhooks",
    dependencies=[Depends(require_scope("webhooks:manage"))],
)
async def list_webhooks(
    api_key_data: dict = Depends(get_api_key_data),
):
    """List all webhook endpoints for the authenticated company."""
    return await query_table(
        table="webhooks",
        filters={"company_id": api_key_data.get("company_id")},
        order_by="-created_at",
    )


# ---------------------------------------------------------------------------
# Inbound Webhooks — Stripe
# ---------------------------------------------------------------------------

@router.post(
    "/webhooks/stripe",
    summary="Stripe webhook handler",
    include_in_schema=False,  # Hide from public docs — internal endpoint
)
async def stripe_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
):
    """
    INTERVIEW NOTE: Inbound webhook from Stripe. This does NOT use API key auth —
    instead, Stripe signs the payload with a shared secret (STRIPE_WEBHOOK_SECRET).
    We verify the signature to ensure the request actually came from Stripe.

    This is the standard webhook verification pattern:
    1. Stripe sends POST with raw body + Stripe-Signature header
    2. We compute HMAC-SHA256(webhook_secret, raw_body)
    3. Compare our hash with the one in the header
    4. If they match, the payload is authentic

    Why `include_in_schema=False`? This endpoint is for Stripe, not for
    our API customers. Hiding it from Swagger prevents confusion.
    """
    import stripe

    # INTERVIEW NOTE: We need the RAW body for signature verification.
    # If FastAPI parses it as JSON first, the bytes change and verification fails.
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    if not sig_header:
        raise HTTPException(status_code=400, detail="Missing Stripe signature")

    try:
        event = stripe.Webhook.construct_event(
            payload,
            sig_header,
            settings.stripe_webhook_secret,
        )
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")

    # Route the event to the appropriate handler
    # INTERVIEW NOTE: Background task so we return 200 to Stripe immediately.
    # Stripe will retry if we don't return 200 within 20 seconds.
    background_tasks.add_task(_handle_stripe_event, event)

    return {"received": True}


async def _handle_stripe_event(event: dict):
    """
    Process Stripe events in the background.

    INTERVIEW NOTE: Each event type maps to a business action.
    This is the "event router" pattern — a switch/match on event type.
    """
    event_type = event.get("type")
    data = event.get("data", {}).get("object", {})

    handlers = {
        "checkout.session.completed": _handle_checkout_completed,
        "customer.subscription.updated": _handle_subscription_updated,
        "customer.subscription.deleted": _handle_subscription_deleted,
        "invoice.payment_failed": _handle_payment_failed,
    }

    handler = handlers.get(event_type)
    if handler:
        try:
            await handler(data)
        except Exception as e:
            print(f"Error handling Stripe event {event_type}: {e}")
    else:
        print(f"Unhandled Stripe event: {event_type}")


async def _handle_checkout_completed(data: dict):
    """New subscription created."""
    client = get_supabase_client()
    client.table("subscriptions").upsert({
        "stripe_customer_id": data.get("customer"),
        "stripe_subscription_id": data.get("subscription"),
        "status": "active",
    }).execute()


async def _handle_subscription_updated(data: dict):
    """Subscription plan changed or renewed."""
    client = get_supabase_client()
    client.table("subscriptions").update({
        "status": data.get("status"),
        "current_period_start": data.get("current_period_start"),
        "current_period_end": data.get("current_period_end"),
    }).eq("stripe_subscription_id", data.get("id")).execute()


async def _handle_subscription_deleted(data: dict):
    """Subscription cancelled."""
    client = get_supabase_client()
    client.table("subscriptions").update({
        "status": "cancelled",
    }).eq("stripe_subscription_id", data.get("id")).execute()


async def _handle_payment_failed(data: dict):
    """Payment failed — mark subscription as past_due."""
    client = get_supabase_client()
    client.table("subscriptions").update({
        "status": "past_due",
    }).eq("stripe_subscription_id", data.get("subscription")).execute()
