# FreightX Testing Structure

## How to run

```bash
# From repo root — runs all test files
npx turbo test

# From apps/web — runs only web tests (faster)
cd apps/web && npx vitest run
```

---

## Folder Layout

```
test/
├── test-features/
│   ├── phase-1/          # Auth, onboarding, profile logic tests
│   ├── phase-2/          # Loads, trucks logic tests
│   ├── phase-3/          # Messaging, notifications, realtime logic tests
│   ├── phase-4/          # Bids, bookings, documents, load-status logic tests
│   ├── phase-5/          # Payments, ratings, verification logic tests
│   ├── phase-6/          # Admin dashboard, onboarding checklist, performance tests
│   ├── services/         # Service integration tests — mock Supabase, test real functions
│   └── shared/           # Shared utilities (freight math, etc.)
└── audits/               # Codebase audits — phase reviews, snapshots
```

---

## test-features/phase-\*/

Pure logic unit tests. Each file tests inline business logic (validation,
filtering, status transitions, calculations) without importing app code or
hitting Supabase. Fast — all 252 tests run in ~60ms.

Examples:

- `phase-2/loads/loads.test.ts` — load number formatting, form validation, filtering
- `phase-4/bids/bids.test.ts` — bid delta math, amount validation, status rules
- `phase-5/payments/payments.test.ts` — invoice fee calculation, payment method logic

---

## test-features/services/ ← service integration tests

Tests the **real service functions** from `apps/web/src/services/` and
`apps/web/src/features/*/lib/` by mocking `@/lib/supabase`. These verify
that functions call the correct Supabase tables, forward the right arguments,
run rows through the camelCase mapper, and throw/return correctly on errors.

| File                        | Service tested                   | Key coverage                                                                                 |
| --------------------------- | -------------------------------- | -------------------------------------------------------------------------------------------- |
| `loads.service.test.ts`     | `loads.service.ts`               | `getLoads` filter forwarding, mapper output, `createLoad` carrier notifications              |
| `bids.service.test.ts`      | `bids.service.ts`                | `submitBid` RPC call, non-critical RPC failure tolerance, `acceptBid`/`declineBid`/`bookNow` |
| `stripe.service.test.ts`    | `stripe.service.ts`              | `selectPaymentMethod` fee (2% quick-pay vs null net-30), due date strings                    |
| `documents.service.test.ts` | `documents.service.ts`           | Storage upload → DB insert chain, error propagation order                                    |
| `location.service.test.ts`  | `features/loads/lib/location.ts` | `insertLocationPing` field mapping, heading rounding, silent null on error                   |

Mock pattern used:

```ts
vi.mock('@/lib/supabase', () => ({ supabase: { from: vi.fn(), rpc: vi.fn() } }));

function makeBuilder(result) {
  // Chainable thenable — all Supabase builder methods return self,
  // and the builder itself is awaitable (resolves to result).
}
```

---

## audits/

Point-in-time audits of phases or areas. Naming convention: `[phase]-audit.md`.

---

## Rules

- Every new feature that ships gets a corresponding entry in `test-features/`
- Service functions should have a corresponding test in `test-features/services/`
- Every phase completion triggers an audit file in `audits/`
- Audits note what passed, what was deferred, and any open issues
