/**
 * location-cleanup — Scheduled Edge Function (Phase 12)
 *
 * Deletes location_pings older than 24 hours to keep the table lean.
 * Milestone records in `tracking_milestones` are the permanent history.
 *
 * Deploy:
 *   supabase functions deploy location-cleanup --no-verify-jwt
 *
 * Schedule via Supabase Dashboard → Database → Cron Jobs (pg_cron):
 *   SELECT cron.schedule(
 *     'location-cleanup',
 *     '0 * * * *',   -- every hour
 *     $$SELECT net.http_post(
 *       url:='https://<project>.supabase.co/functions/v1/location-cleanup',
 *       headers:='{"Authorization": "Bearer <service-role-key>"}'
 *     )$$
 *   );
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno';

Deno.serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { error, count } = await supabase
    .from('location_pings')
    .delete({ count: 'exact' })
    .lt('recorded_at', cutoff);

  if (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ ok: true, deleted: count ?? 0 }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
