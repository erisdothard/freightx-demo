# Supabase Skill

## Query patterns

- Always use the typed Supabase client
- Prefer .select() with explicit column names — never select(\*)
- Always handle { data, error } destructure — never assume success
- RLS is enabled — always test queries as the correct role

## Auth

- Use supabase.auth.getUser() server-side — never trust client-side session alone
- Service role key only in backend/edge functions — never in frontend

## Edge functions

- Located in supabase/functions/
- Deploy with: supabase functions deploy [name]
- Local test with: supabase functions serve
