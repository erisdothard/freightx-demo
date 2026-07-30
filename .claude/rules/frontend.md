---
paths:
  - 'src/components/**/*.tsx'
  - 'src/pages/**/*.tsx'
  - 'src/hooks/**/*.ts'
---

# Frontend Rules

- TypeScript strict mode — no `any`, no `as unknown`
- One component per file
- Custom hooks in src/hooks/ — not inside components
- No direct fetch() to DB — always go through API layer or Supabase client
- Tailwind for all styling — no inline styles except dynamic values
- Loading + error states required on every async component
