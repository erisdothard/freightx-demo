# Phase 22 — DAT-Standard Load Detail

**Status:** 🔧 In Progress
**Branch:** `feat/dat-parity-load-detail` (pushed, not merged to main)
**Goal:** Carrier load detail must match what carriers see on DAT side-by-side. FreightX loses credibility if carriers compare the two. The reference is 4 DAT screenshots saved at `Screenshots/IMG_2954.png` through `IMG_2957.png`. READ THOSE SCREENSHOTS FIRST.

---

## Reference Screenshots (source of truth)

| File                       | Shows                                                                                                                                                               |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Screenshots/IMG_2954.png` | Route hero with distance inline, TRIP/RATE/MARKET/AGE stat bar, CALL + EMAIL buttons, Route map section, Profit Estimator collapsed                                 |
| `Screenshots/IMG_2955.png` | Profit Estimator expanded (line-item rows), Equipment Details section (Full/Partial, Truck Type, Length, Weight, Commodity), Shipment Details section               |
| `Screenshots/IMG_2956.png` | Rate Details section (Total, Trip, Rate/mile), Company Details section (Company, Phone, Email, Docket/MC#, Location, Credit score, Days to pay, Factoring, Reviews) |
| `Screenshots/IMG_2957.png` | Load Resources section — 4 full-width stacked cards with CTA buttons                                                                                                |

---

## What Was Built (already on branch)

### DB Migration — `database/migrations/052-dat-parity-fields.sql` ✅

- `full_partial TEXT CHECK (IN ('full','partial'))` added to `loads`
- `accepts_factoring BOOLEAN DEFAULT false` added to `companies`
- **Already applied to production DB**

### Type / Mapper Layer ✅

- `fullPartial?: 'full' | 'partial'` added to `Load` type (`packages/shared/src/types/index.ts`)
- `full_partial` added to `LoadRow` Row/Insert/Update in `apps/web/src/lib/database.types.ts`
- Mapped in `apps/web/src/lib/mappers.ts`

### Post-Load Form — Full/Partial Toggle ✅

- `fullPartial: 'full'` added to `EMPTY_FORM`
- Two-button toggle (Full Truckload / Partial) rendered after equipment selector
- `full_partial: form.fullPartial` passed in `createLoad()` payload

### Haversine Distance Util ✅

- `haversineDistance(lat1, lon1, lat2, lon2): number` added to `apps/web/src/shared/lib/utils.ts`

### Load Detail Sheet — Partial ⚠️

File: `apps/web/src/features/loads/components/load-detail-sheet.tsx`

**Built:**

- Distance to pickup state + geolocation effect (uses `load.originLat`/`load.originLng` — see note below)
- `distanceMi` shown below origin city (NOT inline — needs fixing)
- Full/Partial badge next to equipment in detail rows
- Profit estimator upgraded to 4-input grid (op cost, MPG, fuel price, factoring %) with breakdown table
- Factoring acceptance row in broker payment section
- Load Resources section — 2-column grid cards with "Learn More →" links
- `acceptsFactoring` state fetched from `companies` table

**NOT built / wrong vs screenshots:**

---

## What Still Needs To Be Built

### 1. Route Hero — Distance inline (IMG_2954)

**Current:** Distance shows as a separate `<p>` below the city name
**Required:** Inline with city: `Cincinnati, OH (105 mi)` on same line
**Fix:** Change the origin city display from:

```tsx
<p>{load.originCity}, {load.originState}</p>
<p>{distanceMi} mi away</p>  {/* separate line — WRONG */}
```

To:

```tsx
<p>
  {load.originCity}, {load.originState}
  {distanceMi ? ` (${distanceMi} mi)` : ''}
</p>
```

**Note on geocoords:** `load.originLat` / `load.originLng` are cast from `(load as unknown as {originLat?: number})` — these columns may not be populated on test loads. Check `origin_lat`/`origin_lng` columns exist on loads table and are populated. If not, distance will silently not show (that's fine).

---

### 2. TRIP / RATE / MARKET / AGE Stat Bar (IMG_2954)

**Current:** Not present. Rate is shown in the rate card but trip miles, market rate, and age are not in a stat bar format.
**Required:** A 4-cell horizontal stat bar directly below the route hero:

```
| TRIP        | RATE     | MARKET | AGE    |
| 2,413 mi    | $1,050   | —      | 39 min |
```

- TRIP = `load.totalMiles`
- RATE = `load.rateUsd`
- MARKET = `rate.delta` from `analyzeRate()` (already computed)
- AGE = `age` from `getLoadAge()` (already computed)

Style: 4 equal dark boxes, label above value, no borders between cells, muted label text, bold value text.

---

### 3. CALL + EMAIL Buttons (IMG_2954)

**Current:** Only "Message Broker" button exists.
**Required:** Two prominent full-width buttons below the stat bar, carrier/driver only on posted loads:

- **CALL** — primary filled button → `tel:` link using `load.shipperContactPhone` (fall back to hide if null)
- **EMAIL** — secondary outline button → `mailto:` link using `load.shipperContactEmail` (fall back to hide if null)

These replace or sit alongside the existing "Message Broker" button. On posted loads these are the primary CTAs.

---

### 4. Profit Estimator — Line-item rows layout (IMG_2955)

**Current:** 4-input grid at top, then a bordered table with rows.
**Required:** DAT uses a flat line-item list (no input grid visible at top level — inputs are tappable rows with `>` chevrons). Each row is label left, value right, chevron right. "My Costs" is a tappable row at the top that expands the input fields.

Exact rows from screenshot:

```
My Costs (Add Costs to calculate)  >
All In Rate          $1,050         >
Factoring %          —              >
Operating Cost       —
Fuel Cost            $2,184.85
Miles Per Gallon     6.5            >
Approximate Profit   —
```

The `>` chevron means it's tappable/editable. Non-chevron rows are computed/read-only.

**Implementation:** Keep the current inputs but restructure the display into this flat list format. Tapping a row with `>` opens/focuses that input inline or in a mini modal.

---

### 5. Equipment Details — Collapsible Section (IMG_2955)

**Current:** Full/Partial badge is inline next to equipment type in the main detail rows. Other equipment fields (length, weight) are also in the flat list.
**Required:** A dedicated collapsible **"Equipment Details"** section containing:

- Full/Partial
- Truck Type (equipment label)
- Length (from `load.lengthIn` converted to ft, or `—`)
- Weight (`load.weightLbs`)
- Commodity (`load.commodity`)

This section should be collapsed by default, expandable with a chevron.

---

### 6. Shipment Details — Collapsible Section (IMG_2955)

**Current:** Pickup/delivery dates are in the flat InfoRow list. Appointment windows are in a separate accordion.
**Required:** A dedicated collapsible **"Shipment Details"** section:

- Pick Up Date
- Pick Up Hours (appointment window)
- Drop Off Hours (appointment window)

Collapsed by default.

---

### 7. Rate Details — Collapsible Section (IMG_2956)

**Current:** Rate is in the rate card at the top. Miles shown in the route hero.
**Required:** A collapsible **"Rate Details"** section:

- Total: `$X,XXX`
- Trip: `X,XXX mi`
- Rate / mile (est): `$X.XX/mi`

---

### 8. Company Details — Collapsible Section (IMG_2956)

**Current:** BrokerCreditBadge shows avg days to pay, on-time %, payment count. Factoring acceptance added as a separate row.
**Required:** Replace/expand into a collapsible **"Company Details"** section with ALL of:

- Company: `{load.companyName}`
- Phone: `{shipperContactPhone}` (clickable `tel:` link, blue)
- Email: `{shipperContactEmail}` (clickable `mailto:` link, blue)
- Docket: `MC# {company.mcNumber}` (if available)
- Location: `{company.city, state}` (if available)
- Credit score: `{load.brokerCreditScore}` (from existing data)
- Days to pay: from `broker_payment_metrics`
- Factoring: `$` icon if accepts_factoring (from `companies.accepts_factoring`)
- Reviews: not built yet — omit or show placeholder

The existing `BrokerCreditBadge` component can remain but this section replaces the current "Broker Payment History" section in the carrier view.

**Data needed:** `company.mcNumber`, `company.city`, `company.state` — check if these exist on the `companies` table. If not, omit those rows silently.

---

### 9. Load Resources — Full-width stacked cards (IMG_2957)

**Current:** 2-column grid, small cards, "Learn More →" text links.
**Required:** Full-width stacked cards, each with:

- Title (bold, white)
- Description (muted, 2 lines)
- Full-width CTA button with icon and label text in all-caps

Exact cards from screenshot:

1. "Get faster pay with DAT Outgo" → button: `$ FACTOR THIS LOAD`
2. "STREAMLINE YOUR TRACKING" (accent colored card) → button: `⚬ CONNECT NOW`
3. "Simplified Cross Border eManifest Services" → button: `→ CROSS BORDER SERVICES`
4. "Per Load Insurance" → button: `shield GET PER LOAD INSURANCE`

Cards are full-width, stacked vertically, not a grid. The ELD card (#2) has a distinct accent background (dark red in DAT — use fx-orange or a dark variant).

---

## Implementation Order

1. Distance inline (quick, 1 line change)
2. Stat bar (new component, ~30 lines)
3. CALL + EMAIL buttons
4. Equipment Details collapsible section
5. Shipment Details collapsible section
6. Rate Details collapsible section
7. Company Details collapsible section (replaces BrokerCreditBadge section)
8. Profit Estimator line-item layout
9. Load Resources full-width cards

---

## Key Files

| File                                                             | Change                                     |
| ---------------------------------------------------------------- | ------------------------------------------ |
| `apps/web/src/features/loads/components/load-detail-sheet.tsx`   | All UI changes                             |
| `apps/web/src/features/loads/components/broker-credit-badge.tsx` | May be replaced by Company Details section |

---

## Branch Instructions

- Branch: `feat/dat-parity-load-detail`
- All DB migrations already applied to production
- Run `pnpm typecheck` before pushing — was clean as of last commit
- Push triggers pre-push hook: format + typecheck + 365 tests

---

## Test Accounts

- Carrier: `carrier@freightx.com` — use this to view load detail as carrier
- All 5 test loads reset to `posted` status with signed BOL + rate con seeded
- App: https://freightx-nine.vercel.app
