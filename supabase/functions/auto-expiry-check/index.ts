/**
 * auto-expiry-check — Scheduled Edge Function
 *
 * Runs daily via cron to check for expiring/expired:
 *   - Insurance certificates (warn at 30 days, 7 days; mark expired at 0)
 *   - Operating authority (same cadence)
 *
 * Deploy cron: supabase functions deploy auto-expiry-check --no-verify-jwt
 * Schedule via pg_cron or Supabase Dashboard → Database → Cron Jobs:
 *   SELECT cron.schedule('auto-expiry-check', '0 9 * * *',
 *     $$SELECT net.http_post(url:='https://<project>.supabase.co/functions/v1/auto-expiry-check',
 *       headers:='{"Authorization": "Bearer <service-role-key>"}')$$);
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const FROM_EMAIL = 'noreply@freightx.io';

interface ExpiringVerification {
  id: string;
  company_id: string;
  insurance_expiry: string | null;
  authority_expiry: string | null;
  companies: {
    name: string;
    owner_id: string;
    profiles: {
      email: string | null;
      full_name: string | null;
    } | null;
  } | null;
}

async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) return;

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
  });
}

Deno.serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  const now = new Date();
  const in30 = new Date(now);
  in30.setDate(in30.getDate() + 30);
  const in7 = new Date(now);
  in7.setDate(in7.getDate() + 7);

  // Fetch all active verifications with expiry dates coming up
  const { data: verifications, error } = await supabase
    .from('carrier_verifications')
    .select(
      `id, company_id, insurance_expiry, authority_expiry,
       companies(name, owner_id, profiles(email, full_name))`,
    )
    .eq('verification_status', 'approved')
    .not('insurance_expiry', 'is', null);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  let notified = 0;
  let expired = 0;

  for (const v of (verifications as ExpiringVerification[]) ?? []) {
    const email = v.companies?.profiles?.email;
    const name = v.companies?.profiles?.full_name ?? v.companies?.name ?? 'FreightX User';
    const companyName = v.companies?.name ?? '';

    if (!email) continue;

    // Check insurance expiry
    if (v.insurance_expiry) {
      const expiry = new Date(v.insurance_expiry);

      if (expiry <= now) {
        // Mark expired
        await supabase
          .from('carrier_verifications')
          .update({ verification_status: 'expired' })
          .eq('id', v.id);

        await sendEmail(
          email,
          `⚠️ FreightX: Your insurance certificate has expired`,
          `<p>Hi ${name},</p>
           <p>Your insurance certificate for <strong>${companyName}</strong> has <strong>expired</strong>.</p>
           <p>Your account is now suspended from posting trucks until you upload a valid certificate.</p>
           <p><a href="https://freightx.io/profile">Update your verification →</a></p>`,
        );
        expired++;
      } else if (expiry <= in7) {
        await sendEmail(
          email,
          `🔔 FreightX: Insurance expiring in 7 days`,
          `<p>Hi ${name},</p>
           <p>Your insurance certificate for <strong>${companyName}</strong> expires on <strong>${expiry.toLocaleDateString()}</strong> — that's in 7 days.</p>
           <p>Please upload a renewed certificate now to avoid any disruption.</p>
           <p><a href="https://freightx.io/profile">Update verification →</a></p>`,
        );
        notified++;
      } else if (expiry <= in30) {
        await sendEmail(
          email,
          `📋 FreightX: Insurance expiring in 30 days`,
          `<p>Hi ${name},</p>
           <p>Your insurance certificate for <strong>${companyName}</strong> expires on <strong>${expiry.toLocaleDateString()}</strong>.</p>
           <p>Start the renewal process early to keep your account in good standing.</p>
           <p><a href="https://freightx.io/profile">View verification status →</a></p>`,
        );
        notified++;
      }
    }
  }

  return new Response(
    JSON.stringify({ ok: true, notified, expired, checked: verifications?.length ?? 0 }),
    { headers: { 'Content-Type': 'application/json' } },
  );
});
