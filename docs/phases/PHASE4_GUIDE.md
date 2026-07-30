# Phase 4 — Booking Workflow & Documents

**Status:** Complete

**Migrations:**

- `005-book-now.sql` — book_now() RPC for instant carrier booking at posted rate
- `009-bids.sql` — bids table with bid_status enum, counter-offer chain (parent_bid_id, round), accept_bid() RPC
- `010-documents.sql` — documents table with document_type enum; Supabase Storage buckets (documents, profile-photos)

**Key files added:**

- `features/bids/components/bid-sheet.tsx` — carrier bid submission with delta indicator vs. posted rate
- `features/bids/components/bid-list-sheet.tsx` — broker bid management panel with real-time updates
- `services/bids.service.ts` — submitBid, acceptBid, declineBid, counterBid, bookNow
- `features/loads/components/load-status-stepper.tsx` — role-gated status stepper
- `features/documents/components/document-upload.tsx` — BOL, POD, rate con upload with progress
- `features/bookings/components/bol-signature-sheet.tsx` — BOL e-signature via HTML canvas with "already signed at dock" toggle
- `supabase/functions/auto-expiry-check/` — bid and load auto-expiration cron
- `services/email-notifications.service.ts` — notifyBookingConfirmed, notifyLoadStatusChange

**Features delivered:**

- Carrier bid submission with counter-offer multi-round negotiation
- Broker accepts bid → load status flips to awarded, all other pending bids auto-declined
- Book-It-Now instant booking at posted rate
- Load status lifecycle: posted → awarded → dispatched → in_transit → delivered → completed
- Role-based advancement rules: carrier advances in_transit/delivered; broker advances dispatched/completed; driver advances delivered only
- notifyLoadStatusChange() — email broker on every status update
- Document upload: BOL, POD, rate confirmation (drag-and-drop + file picker)
- BOL e-signature via canvas pad; "already signed at dock" toggle
- getBolStatusForLoads() — bulk BOL status check across multiple loads
- Rate confirmation PDF generated client-side via jsPDF
- Load cancellation with two-tap confirmation
- Booking confirmation email to both parties
- Bid and load auto-expiration via edge function cron
