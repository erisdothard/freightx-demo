# Phase 5 — Verification, Payments & Ratings

**Status:** Complete

**Migrations:**

- `011-carrier-verifications.sql` — carrier_verifications table; sync_company_verified() trigger updates companies.verified on status change
- `012-ratings.sql` — ratings table with sub-ratings and unique(load_id, rater_id) constraint
- `008-subscriptions.sql` — subscriptions table with Stripe customer/subscription IDs and tier enum

**Key files added:**

- `features/verification/lib/fmcsa.ts` — FMCSA SAFER API MC/DOT lookup
- `services/verification.service.ts` — uploadInsuranceCert, uploadW9, CSA score display
- `features/verification/components/VerificationPanel.tsx` — stepped UI: FMCSA → insurance → W-9
- `features/verification/components/VerifiedBadge.tsx` — verified badge for carrier/broker cards
- `services/stripe.service.ts` — Stripe Checkout, subscription management, invoice generation
- `features/payments/components/SubscriptionPlans.tsx`, `SubscriptionGate.tsx` — tier enforcement UI
- `features/payments/components/InvoiceCard.tsx` — invoice approval workflow and quick pay selection
- `features/ratings/components/RatingModal.tsx`, `RatingPromptBanner.tsx` — post-load rating flow
- `services/ratings.service.ts` — rating submission and aggregate display
- `supabase/functions/create-checkout-session/` — Stripe Checkout redirect
- `supabase/functions/stripe-webhook/` — subscription lifecycle event handler

**Features delivered:**

- FMCSA SAFER API MC/DOT verification on carrier/broker company creation
- Insurance certificate upload with expiry date tracking
- W-9 upload
- CSA safety score display on carrier profiles
- Verified badge on carrier and broker cards
- Stripe subscription billing (monthly/annual, tier enforcement via SubscriptionGate)
- Invoice auto-generation on load completion
- Invoice approval workflow: invoiced → approved → processing → paid
- Quick Pay option (2% fee for expedited payment)
- Post-load rating prompt for both parties after load completion
- 5-star rating modal with sub-ratings (communication, reliability, professionalism)
- Average rating displayed on profiles and cards
