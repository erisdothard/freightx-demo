# Phase 1 — Database, Auth, Infra

**Status:** Complete

**Migrations:**

- `001-initial-schema.sql` — profiles, companies, loads, trucks, conversations, messages, tracking_milestones tables; handle_new_user() trigger auto-creates profile on signup

**Key files added:**

- `apps/web/src/contexts/AuthContext.tsx` — Supabase JWT session, role loading, sign-out
- `apps/web/src/pages/login.tsx` — email/password + Google OAuth sign-in
- `apps/web/src/pages/forgot-password.tsx`, `reset-password.tsx` — password reset flow
- `apps/web/src/pages/onboarding.tsx`, `features/onboarding/` — 3-step onboarding (email → role → company)
- `features/onboarding/components/OnboardingChecklist.tsx` — new-user onboarding checklist
- `features/profile/components/edit-profile-sheet.tsx`, `edit-company-sheet.tsx` — profile and company editing
- `lib/supabase.ts` — Supabase client with full TypeScript types
- `lib/mappers.ts` — camelCase mappers for shared type compatibility
- `vercel.json` — production (main) and preview (develop + PRs) deploy config

**Features delivered:**

- Email/password and Google OAuth sign-in and sign-up
- Password reset flow (forgot-password + reset-password pages)
- Multi-step onboarding: email → role selection → company info (MC/DOT for carriers, broker authority for brokers)
- Auto-created profile row on signup via DB trigger reading role from user metadata
- Role-based protected routes with ProtectedRoute component
- User profile and company creation and editing
- Vercel production and preview deployments
- All mock credentials and hardcoded demo data removed
