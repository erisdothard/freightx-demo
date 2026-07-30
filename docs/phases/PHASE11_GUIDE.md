# Phase 11 — AI Assisted Load Seeking

**Status:** Complete

**Migrations:**

- `011-carrier-preferences.sql` — carrier_preferences table (preferred equipment, origin/dest states, min rate/mile); updated_at auto-trigger

**Key files added:**

- `apps/web/src/features/loads/components/ai-search-bar.tsx` — natural language input with example prompt chips; invokes ai-load-search edge function
- `supabase/functions/ai-load-search/index.ts` — Claude Haiku (claude-haiku-4-5-20251001) query parser with keyword fallback
- `apps/web/src/features/loads/lib/match-score.ts` — scoreLoad(), rankLoads(), getTopMatches() with 5-category scoring engine
- `apps/web/src/features/loads/components/match-badge.tsx` — color-coded match percentage pill (green/orange/gray)
- `apps/web/src/features/loads/hooks/use-match-scores.ts` — re-ranks load list on updates against carrier preferences
- `apps/web/src/features/loads/components/carrier-preferences-sheet.tsx` — home states, equipment types, and preferred lanes settings

**Features delivered:**

- AI natural language load search bar with example prompt chips on carrier load board
- Claude Haiku edge function parses queries into structured filters (equipment, state, pickup window, min rate/mile)
- Keyword-based fallback parser when ANTHROPIC_API_KEY is absent
- 40+ US state name recognition and equipment type detection in fallback parser
- Match score engine: 0–100 across equipment match (40pts), rate health (25pts), lane preference (20pts), pickup urgency (10pts), broker credit (5pts)
- Color-coded match badge on every load card: green ≥80, orange 60–79, gray <60
- Carrier preferences sheet for home state, equipment types, and preferred lanes
- useMatchScores hook re-ranks load list client-side in real time
