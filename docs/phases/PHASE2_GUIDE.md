# Phase 2 — Core Data Layer & CRUD

**Status:** Complete

**Migrations:**

- Loads table (in `001-initial-schema.sql`) — load_number sequence, equipment enum, load_status enum, RLS policies
- Trucks table (in `001-initial-schema.sql`) — truck_status enum, origin/dest/availability fields, RLS
- Bookings stub (in `001-initial-schema.sql`) — placeholder for Phase 4 booking workflow

**Key files added:**

- `services/loads.service.ts` — getLoads, createLoad, updateLoad, deleteLoad with filter support
- `services/trucks.service.ts` — getTrucks, createTruck, updateTruck, deleteTruck
- `features/loads/components/post-load-sheet.tsx` — load posting form connected to Supabase
- `features/trucks/components/post-truck-sheet.tsx` — truck posting form connected to Supabase
- `features/loads/components/load-detail-sheet.tsx` — tappable load detail drawer with rate analysis
- `features/loads/components/load-card.tsx` — load list card with broker credit and bid CTA
- `pages/carrier/loads.tsx`, `pages/broker/loads.tsx`, `pages/shipper/loads.tsx` — role dashboards with live Supabase data
- `features/loads/hooks/use-loads.ts`, `features/trucks/hooks/use-trucks.ts` — custom data hooks

**Features delivered:**

- Load CRUD fully connected to Supabase (zero mock data)
- Truck CRUD fully connected to Supabase
- Server-side filtering by equipment type, origin state, dest state, and pickup date
- Carrier, broker, and shipper dashboards displaying live query results
- Tappable load cards with full detail drawer
- Loading skeletons, empty states, and error states on all list views
- `mockData.ts` deleted entirely
