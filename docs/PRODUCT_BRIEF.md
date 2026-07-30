# FreightX — Product Brief

**Version:** 1.0
**Date:** February 17, 2026
**Status:** Pre-Development

---

## Vision

FreightX is a **unified freight marketplace** that replaces the fragmented ecosystem of load boards, TMS tools, and carrier portals with a single platform where Carriers, Brokers, and Shippers operate together in real time.

---

## The Problem

Freight operations today are broken across tools:

- **Brokers** post loads on DAT or Truckstop, manually call carriers, fax rate confirmations, and chase down PODs via email
- **Carriers** check multiple load boards, manually bid on loads, get paid 30–90 days later
- **Shippers** have zero visibility once freight leaves the dock — they call brokers who call carriers who don't pick up

No single platform serves all three. Users pay for three products, switch between apps constantly, and manually re-enter the same data everywhere.

---

## The Solution

FreightX unifies all three roles in one SaaS platform:

| Role        | What They Do on FreightX                                                                      |
| ----------- | --------------------------------------------------------------------------------------------- |
| **Carrier** | Post available trucks, search loads, bid, book, update status, upload POD, get paid           |
| **Broker**  | Post loads, search trucks, accept bids, generate rate confirmations, track shipments, invoice |
| **Shipper** | Post freight, book direct or via broker, track shipment live, receive POD                     |

All three see the same data in real time. One login. One platform.

---

## Key Differentiators

### 1. Multi-Role Unified Platform

The only load board where Carriers, Brokers, and Shippers all operate in the same system. No switching between apps. No duplicated data entry.

### 2. Real-Time Everything

New load postings appear instantly. Status updates push to all parties. Chat is live. The board is a living, breathing marketplace — not a static list refreshed by F5.

### 3. Booking-to-Payment Workflow

From posting to payment, every step is in FreightX. Rate confirmation auto-generated on booking. Invoice auto-generated on delivery. Payment processed in-platform. No more chasing paper.

### 4. Carrier Verification Built-In

MC/DOT numbers verified against FMCSA SAFER on signup. Insurance certificates tracked with auto-expiry alerts. Verified badge shown on every carrier profile. Trust is built into the system.

---

## Target Users

### Primary: Small-to-Mid Freight Brokerages (5–50 employees)

- Currently using DAT or Truckstop for the load board
- Using email, phone, and fax for carrier communication
- Paying per-seat for tools that don't talk to each other
- Pain: manual everything, no visibility, slow payments

### Secondary: Independent Owner-Operators and Small Fleets (1–10 trucks)

- Checking 2–3 load boards daily for freight
- Losing margin to brokers because they lack negotiating leverage
- Getting paid 30–60 days out, cash-flow constrained
- Pain: too many tools, no transparency, slow pay

### Tertiary: Regional Shippers (50–500 shipments/month)

- Booking freight via broker relationships or directly via phone
- No visibility on where their freight is between pickup and delivery
- Reconciling invoices manually
- Pain: zero visibility, invoice surprises, no data

---

## Business Model

### SaaS Subscriptions (Primary Revenue)

| Tier           | Price   | Target                      |
| -------------- | ------- | --------------------------- |
| Carrier Free   | $0      | Independent owner-operators |
| Carrier Pro    | $49/mo  | Small fleets (2–10 trucks)  |
| Broker Starter | $149/mo | Boutique brokerages         |
| Broker Growth  | $349/mo | Mid-size brokerages         |
| Shipper        | $199/mo | Regional shippers           |
| Enterprise     | Custom  | Large fleets and brokerages |

### Transaction Fees (Secondary Revenue)

- 0.5–1% on in-platform payments processed through FreightX
- Quick Pay fee: 2% for 2-day payment vs net-30

---

## Competitive Landscape

| Feature              | DAT     | Truckstop | Convoy     | **FreightX** |
| -------------------- | ------- | --------- | ---------- | ------------ |
| Multi-role (C+B+S)   | No      | No        | No         | **Yes**      |
| Real-time messaging  | Basic   | Basic     | Yes        | Yes          |
| In-platform payments | No      | Yes       | Yes        | Yes          |
| Carrier verification | Yes     | Yes       | Yes        | Yes          |
| Live GPS tracking    | Yes     | Yes       | Yes        | Planned      |
| AI matching          | No      | Limited   | Yes        | Planned      |
| Open API             | Limited | Yes       | No         | Planned      |
| Price                | $50+/mo | $50+/mo   | Commission | $49–$349/mo  |

---

## MVP Scope (Phase 1–4)

The minimum viable product for a **closed beta launch**:

1. Real database with user accounts (Carrier, Broker, Shipper)
2. Supabase Auth — email/password registration and login
3. Load posting (Broker/Shipper) with full details
4. Truck posting (Carrier) with availability windows
5. Advanced search — filter by equipment, location, date, rate
6. Real-time load board — new posts appear instantly
7. Rate bidding — carriers bid, brokers accept/counter/decline
8. Booking workflow — bid accepted → rate confirmation generated
9. Load status lifecycle — Posted → Awarded → Dispatched → Delivered
10. Per-load messaging — real-time chat between parties
11. In-app notifications — bids, bookings, status changes
12. Document management — BOL, POD, rate confirmation upload
13. Basic carrier verification — MC/DOT FMCSA lookup on signup
14. Admin dashboard — user management, system health

**Not in MVP:** GPS tracking, in-platform payments, ratings, TMS integrations, mobile app

---

## Success Metrics (Beta)

| Metric                | Target at 90 days post-launch |
| --------------------- | ----------------------------- |
| Registered companies  | 50+                           |
| Active users (weekly) | 100+                          |
| Loads posted          | 500+                          |
| Bookings completed    | 100+                          |
| NPS score             | > 40                          |
| Uptime                | > 99.5%                       |

---

## Technical Constraints

- **No custom auth** — use Supabase Auth exclusively
- **No raw card data** — all payments through Stripe Elements (PCI compliant)
- **RLS enforced at DB level** — every table has Row-Level Security policies
- **Vercel deployment** — static frontend + Vercel edge for API routes
- **GDPR/CCPA** — data residency and deletion must be supported from day one

---

_This brief is a living document. Update it as product decisions are made._
