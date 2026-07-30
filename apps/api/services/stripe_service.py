"""
FreightX API — Stripe Service

INTERVIEW NOTE: Services encapsulate third-party API interactions.
If you ever swap Stripe for another payment provider, you only change
this file — the routes and models stay the same. This is the
"adapter pattern" (or "port and adapter" / "hexagonal architecture").

Interview question: "How do you handle third-party API changes?"
Answer: Wrap third-party APIs in a service layer. Routes depend on
the service interface, not the third-party SDK directly. When the
third-party changes, update one file instead of every route.
"""

import stripe

from config import settings


def init_stripe():
    """Initialize the Stripe SDK with our API key."""
    stripe.api_key = settings.stripe_secret_key


def verify_webhook_signature(payload: bytes, sig_header: str) -> dict:
    """
    Verify a Stripe webhook signature and return the parsed event.

    INTERVIEW NOTE: Stripe uses HMAC-SHA256 webhook signatures.
    The process:
    1. Stripe sends: raw body + Stripe-Signature header
    2. Header contains: t=timestamp,v1=signature
    3. We compute: HMAC-SHA256(webhook_secret, timestamp + "." + body)
    4. Compare our signature with v1 from the header
    5. Also check timestamp to prevent replay attacks (reject if > 5 min old)

    The stripe SDK handles all of this in construct_event().
    """
    init_stripe()
    return stripe.Webhook.construct_event(
        payload,
        sig_header,
        settings.stripe_webhook_secret,
    )


async def create_checkout_session(
    company_id: str,
    price_id: str,
    success_url: str,
    cancel_url: str,
) -> str:
    """
    Create a Stripe Checkout Session for subscription purchase.
    Returns the checkout URL.
    """
    init_stripe()
    session = stripe.checkout.Session.create(
        mode="subscription",
        line_items=[{"price": price_id, "quantity": 1}],
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={"company_id": company_id},
    )
    return session.url
