# Phase 3 — Real-Time & Messaging

**Status:** Complete

**Migrations:**

- `002-notifications.sql` — notifications table with notification_type enum and RLS

**Key files added:**

- `pages/messages.tsx` — per-load and direct conversation threads with real-time delivery
- `features/notifications/hooks/use-notifications.ts` — Supabase Realtime subscription and unread count
- `features/notifications/components/notification-sheet.tsx` — notification bell drawer with mark-all-read
- `services/messages.service.ts` — conversations, message CRUD, searchUsers, getOrCreateConversation
- `supabase/functions/send-notification-email/` — Resend email dispatch triggered on bid events

**Features delivered:**

- Supabase Realtime on loads and trucks — new posts appear within 2 seconds for all users
- Status changes propagate in real time without page refresh
- Per-load conversation threads with real-time message delivery
- Conversation list with unread count badges
- In-app notification bell with real-time unread count on all role dashboards
- Notification sheet with mark-all-read action
- New Message modal: "message about a load" or "message a user" with search UI
- Direct messaging between any two users (not only load parties)
- Email notification edge function for bid events via Resend
