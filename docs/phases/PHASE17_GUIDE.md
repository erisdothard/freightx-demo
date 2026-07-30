# Phase 17 — Carrier Financial Services & Compliance

**Status:** ✅ Complete
**Date:** 2026-03-30

## Goals

Carrier stickiness via QuickPay/factoring + legal protection via FMCSA re-vetting and insurance expiry monitoring.

## What Was Built

### Migrations

- **`database/migrations/047-factoring.sql`** — `factoring_requests` table
  - Columns: carrier_id, company_id, load_id, invoice_amount, fee_percent, net_payout (computed), status, factor_partner, requested_at, approved_at, funded_at
  - Status flow: `requested → approved → funded` (also `denied`, `cancelled`)
  - RLS: carriers see own requests; admins see all

- **`database/migrations/048-insurance-monitoring.sql`**
  - Adds `insurance_expiry_date`, `last_verified_at`, `next_verify_at`, `risk_score`, `risk_factors` columns to `carrier_verifications`
  - New `verification_schedule` table for periodic FMCSA re-check scheduling

### Edge Function

- **`supabase/functions/carrier-health-check/index.ts`** — Scheduled daily
  - Flags carriers with insurance expiring <30 days → sets `status = 'insurance_warning'`
  - Schedules FMCSA re-verification for carriers not checked in 90+ days
  - Computes risk score (0–100) factoring: days since verification, insurance status, safety rating, CSA score
  - Enqueues `insurance_expiry_warning` notifications to carrier owners

### Factoring Service & UI

- **`services/factoring.service.ts`** — CRUD for `factoring_requests`:
  - `getMyFactoringRequests()`, `requestFactoring()`, `cancelFactoringRequest()`
  - Admin: `approveFactoringRequest()`, `fundFactoringRequest()`, `denyFactoringRequest()`

- **`features/payments/components/factoring-sheet.tsx`** — Bottom sheet UI
  - Shows invoice amount, fee selection (3%/4%/5% with funding speed), net payout calculation
  - Submits `factoring_requests` record

- **`pages/carrier-payments.tsx`** — Route `/carrier/payments`
  - Summary cards: total funded, pending count
  - List of all factoring requests with status
  - CTA to open factoring sheet

### Verification Panel Enhancement

- **`features/verification/components/VerificationPanel.tsx`** — Risk score badge added
  - Green (≤30), amber (31–60), red (>60) color coding

## Files Changed

- `database/migrations/047-factoring.sql` — new
- `database/migrations/048-insurance-monitoring.sql` — new
- `supabase/functions/carrier-health-check/index.ts` — new
- `apps/web/src/services/factoring.service.ts` — new
- `apps/web/src/features/payments/components/factoring-sheet.tsx` — new
- `apps/web/src/pages/carrier-payments.tsx` — new
- `apps/web/src/features/verification/components/VerificationPanel.tsx` — risk badge added
