/**
 * load-expiry — Scheduled Edge Function
 *
 * Runs every hour via cron. Auto-expires loads that have:
 *   - status = 'posted' AND pickup_date < now (pickup date has passed)
 *   - OR status = 'posted' AND posted_at < now - 7 days (stale listing)
 *
 * Deploy: supabase functions deploy load-expiry --no-verify-jwt
 * Schedule:
 *   SELECT cron.schedule('load-expiry', '0 * * * *',
 *     $$SELECT net.http_post(url:='https://<project>.supabase.co/functions/v1/load-expiry',
 *       headers:='{"Authorization": "Bearer <service-role-key>"}')$$);
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno';

Deno.serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  const now = new Date().toISOString();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Expire loads where pickup date has passed
  const { data: expiredByDate, error: err1 } = await supabase
    .from('loads')
    .update({ status: 'expired' })
    .eq('status', 'posted')
    .lt('pickup_date', now)
    .select('id');

  // Expire loads that have been posted for 7+ days without a bid
  const { data: expiredByAge, error: err2 } = await supabase
    .from('loads')
    .update({ status: 'expired' })
    .eq('status', 'posted')
    .lt('posted_at', sevenDaysAgo)
    .select('id');

  if (err1 || err2) {
    return new Response(JSON.stringify({ error: err1?.message ?? err2?.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const totalExpired = (expiredByDate?.length ?? 0) + (expiredByAge?.length ?? 0);

  return new Response(
    JSON.stringify({
      ok: true,
      expired_by_date: expiredByDate?.length ?? 0,
      expired_by_age: expiredByAge?.length ?? 0,
      total: totalExpired,
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );
});
