# Phase 20 — Enterprise Polish & Hybrid Roles

**Status:** ✅ Complete
**Focus:** Load editing, BOL signature workflow, hybrid roles, company branding, GPS hardening, UX refinements

---

## Overview

Phase 20 delivered enterprise-grade polish across the platform: full load editing, BOL electronic signatures embedded into PDFs, broker+carrier hybrid role support with view switcher, company logo branding, and dozens of UX fixes for load lifecycle permissions and canceled load handling.

---

## Changes Implemented

### Load Editing & Lifecycle

- **Load editing** — brokers/shippers can update posted loads via the post-load sheet
- **Broker edit window** — brokers can edit loads until a bid is accepted
- **Canceled loads excluded** from `getLoads()` query results
- **Canceled load UX** — consistent styling and messaging across all role views
- **Date-based filtering** for recent loads
- **Quick load preview** cards on all role dashboards
- **"All Loads" as default tab** on carrier load board
- **Assign driver from load detail sheet** (carrier view)
- **Allow dispatch before driver assignment**
- **Drivers can mark loads as in transit**
- **Dispatch permissions removed from broker role**
- **Load cancellation restricted** to broker/shipper only
- **Enterprise load detail enhancement** — richer load detail sheet

### BOL & Document Workflow

- **BOL electronic signature** triggered automatically on delivered status
- **"View Signed BOL" button** shown only when BOL exists and is signed
- **Signature embedded into BOL PDF** for portable proof (no separate image needed)
- **Document uploads locked** after BOL is signed
- **BOL signature bug fix** — correct signature flow and restrict cancellation after signing

### Hybrid Roles & Company Branding

- **Broker+carrier hybrid capabilities** — users with both roles can access both dashboards
- **View switcher** — toggle between broker and carrier views on dashboards
- **Company logo upload** — owner-only, auto-saves to Supabase Storage
- **Redundant "My Fleet" card removed** from broker dashboard

### GPS & Infrastructure

- **Enterprise GPS architecture** — security hardening, geocoding improvements, fleet tracking
- **Type fixes** for new database columns and RPCs
- **Payment type mismatches** corrected (InvoiceStatus/SubscriptionTier)
- **Schema validation tests** for optional load fields

---

## Key Commits

| Commit    | Description                                               |
| --------- | --------------------------------------------------------- |
| `506192b` | Restrict company logo upload to owners only and auto-save |
| `0345a02` | Fix BOL signature bug and restrict load cancellation      |
| `323d7df` | Embed signature into BOL PDF for portable proof           |
| `4443c32` | Lock document uploads after BOL is signed                 |
| `d2999c5` | Integrate BOL electronic signature on delivered status    |
| `f94a7fc` | Add company logo upload and display                       |
| `a026945` | Add enterprise load detail enhancement                    |
| `a3bdb26` | Enterprise GPS architecture — security, geocoding, fleet  |
| `6a4d657` | Add date-based filtering for recent loads                 |
| `5181c97` | Add assign driver to load detail sheet                    |
| `74bb1ac` | Add load editing functionality                            |
| `c785d6c` | Add quick load preview to recent loads on dashboards      |
| `86d81db` | Add view switcher for broker+carrier hybrid users         |
| `7cb5558` | Enable broker+carrier hybrid capabilities                 |
| `99cceaa` | Phase 20 — BOL enhancements + broker credit UI            |

---

## Files Modified

- `apps/web/src/services/loads.service.ts`
- `apps/web/src/features/loads/components/post-load-sheet.tsx`
- `apps/web/src/features/loads/components/load-detail-sheet.tsx`
- `apps/web/src/features/loads/components/load-status-stepper.tsx`
- `apps/web/src/features/bookings/components/bol-signature-sheet.tsx`
- `apps/web/src/features/documents/components/document-upload.tsx`
- `apps/web/src/features/profile/components/edit-company-sheet.tsx`
- `apps/web/src/pages/broker/dashboard.tsx`
- `apps/web/src/pages/carrier/dashboard.tsx`
- `apps/web/src/pages/carrier/loads.tsx`
- `apps/web/src/pages/shipper/dashboard.tsx`
- `apps/web/src/pages/driver/dashboard.tsx`
- Database migrations and type definitions
