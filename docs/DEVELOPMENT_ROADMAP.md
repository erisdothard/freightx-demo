# FreightX — Development Roadmap

> **IMPORTANT:** Items listed here are NOT yet implemented. Everything built is in [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md).

**Last Updated:** 2026-04-12
**Original Version:** 1.0 (February 17, 2026)

---

## Build Phase History

Phases 0 through 20 are complete. Historical step-by-step guides are archived in `docs/phases/`. This document now tracks only what remains to be built.

---

## Post-Launch Roadmap — Items Not Yet Built

The following items have no corresponding source code as of the last audit (2026-03-30). They are grouped by strategic priority.

### High-Priority Gaps (Confirmed Missing)

| Item                                  | Description                                                                                                                                                                    |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ACH carrier payout via Stripe Connect | Stripe Checkout exists for subscription billing; direct ACH payout to carrier bank accounts is not implemented. Carriers currently cannot receive payment inside the platform. |
| Auto-alerts for insurance expiry      | The verification service records expiry dates. Alerts at 60/30/7 days before expiry are not confirmed. A dedicated edge function is needed.                                    |
| File sharing in messages              | The messaging UI has no attachment support. Supabase Storage buckets exist but are not wired into message threads.                                                             |
| Sentry DSN configuration              | `@sentry/react` is installed but active error reporting is unconfirmed. Requires a live DSN.                                                                                   |
| Live FMCSA API key                    | The verification panel has a placeholder guard. FMCSA lookups will silently fail without a real API key in env.                                                                |
| Live Stripe price IDs                 | `stripe.service.ts` uses placeholder price IDs. Subscriptions cannot be purchased without real Stripe price IDs in env.                                                        |

### Strategic Product Features (Not Started)

| Item                                             | Notes                                                                                                                                  |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| Native mobile app (iOS / Android)                | No React Native / Expo project in monorepo. Requires separate app. Driver workflow (status, POD, GPS) is highest value starting point. |
| ACH factoring partner integration                | OTR Solutions, Apex Capital, RTS Financial — same-day pay on POD. High carrier retention value.                                        |
| Payment escrow / Guaranteed Pay                  | Surety or fintech partner to hold funds until delivery confirmation. Biggest carrier trust differentiator.                             |
| ELD / telematics integration                     | Samsara, Motive (KeepTruckin), Omnitracs — automated position tracking replacing manual GPS pings.                                     |
| DAT / Truckstop cross-posting                    | Cross-post loads to external load boards to increase carrier reach.                                                                    |
| QuickBooks / accounting software sync            | Invoice and payment sync for broker and carrier back-office.                                                                           |
| Open REST API for enterprise shippers            | RESTful API for custom TMS integrations.                                                                                               |
| Multi-language support                           | Spanish at minimum (estimated 40% of owner-operators).                                                                                 |
| IFTA mileage auto-logging + quarterly tax export | Currently logs GPS breadcrumbs; no IFTA calculation or export.                                                                         |
| HOS (Hours of Service) awareness                 | Show only loads a driver can legally complete on current hours.                                                                        |
| HAZMAT certification tracking                    | Verify HAZMAT endorsement before showing HAZMAT loads to driver.                                                                       |
| Market heatmap / capacity forecasting            | Supply/demand visualization by region.                                                                                                 |
| Custom report builder                            | User-configurable metrics and filters with export to CSV/PDF.                                                                          |
| Referral program                                 | Invite-based growth for carriers and brokers.                                                                                          |
| Featured / promoted load listings                | Paid visibility boost in search results.                                                                                               |

### Infrastructure Improvements (Unconfirmed or Partial)

| Item                                    | Notes                                                                                                                                |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Test coverage (Vitest + Playwright)     | Both are devDependencies. Extent of written tests is unconfirmed. A coverage report has not been audited.                            |
| Accessorial-to-invoice total UI linkage | Service logic exists (`accessorials.service.ts`). End-to-end UI update of invoice total when accessorial is approved is unconfirmed. |
| Background queue dead-letter handling   | `notification-worker` edge function exists. Whether failed notifications surface to an admin UI or alert is unconfirmed.             |

---

## Decision Log

| Date       | Decision                                      | Rationale                                                |
| ---------- | --------------------------------------------- | -------------------------------------------------------- |
| 2026-02-17 | pnpm + Turborepo monorepo                     | Future mobile app, shared types                          |
| 2026-02-17 | React 19 + Vite 6 (not Next.js)               | SPA is fine for load board, faster DX                    |
| 2026-02-17 | Supabase for backend                          | Built-in auth, realtime, storage, RLS                    |
| 2026-02-17 | Vercel for deploy                             | Excellent Vite support, preview deploys on PRs           |
| 2026-02-17 | Stripe for payments                           | PCI compliant, industry standard                         |
| 2026-02-17 | Tailwind CSS v3 with custom fx-\* tokens      | Full control over design system; no dependency on shadcn |
| 2026-02-17 | Orange (#E86030) + near-black (#0D0D0D) theme | Brand direction from UI mockups                          |
| 2026-03-30 | Phase guides archived to docs/phases/         | Guides are historical; active roadmap is this file       |

---

## Competitive Context

FreightX's strategic advantage over DAT / Truckstop / Convoy is owning the full transaction: instant book → digital rate con → GPS tracking → POD → payment. The unbuilt items above (ACH payout, escrow, factoring) are the critical missing pieces that would complete that loop.

See archived PHASE guides in `docs/phases/` for the full historical build record.
