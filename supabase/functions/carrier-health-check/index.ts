/**
 * carrier-health-check Edge Function
 *
 * Scheduled daily (via pg_cron or Supabase cron jobs):
 * 1. Flags carriers with insurance expiring within 30 days → 'insurance_warning'
 * 2. Re-runs FMCSA lookup for carriers not verified in 90+ days
 * 3. Computes a risk score (0–100) for each carrier
 * 4. Enqueues notifications for warnings
 *
 * Can also be triggered manually with: POST /functions/v1/carrier-health-check
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

interface CarrierVerificationRow {
  id: string;
  company_id: string;
  carrier_id: string;
  status: string;
  insurance_expiry_date: string | null;
  last_verified_at: string | null;
  safety_rating: string | null;
  csa_score: number | null;
  risk_score: number | null;
}

/** Compute 0–100 risk score from carrier verification data. Lower = safer. */
function computeRiskScore(cv: CarrierVerificationRow): number {
  let score = 0;

  // Days since last verification (up to 40 points)
  if (cv.last_verified_at) {
    const daysSince =
      (Date.now() - new Date(cv.last_verified_at).getTime()) / (1000 * 60 * 60 * 24);
    score += Math.min(40, Math.floor(daysSince / 90) * 20);
  } else {
    score += 40; // never verified
  }

  // Insurance status (up to 30 points)
  if (cv.insurance_expiry_date) {
    const daysUntilExpiry =
      (new Date(cv.insurance_expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    if (daysUntilExpiry < 0) score += 30;
    else if (daysUntilExpiry < 30) score += 20;
    else if (daysUntilExpiry < 60) score += 10;
  } else {
    score += 15; // unknown
  }

  // Safety rating (up to 20 points)
  if (cv.safety_rating === 'Unsatisfactory') score += 20;
  else if (cv.safety_rating === 'Conditional') score += 10;

  // CSA score (up to 10 points)
  if (cv.csa_score != null) {
    if (cv.csa_score > 80) score += 10;
    else if (cv.csa_score > 60) score += 5;
  }

  return Math.min(100, score);
}

async function enqueueNotification(params: {
  userId: string;
  type: string;
  title: string;
  message: string;
  data?: Record<string, unknown>;
}) {
  await supabase.from('notifications').insert({
    user_id: params.userId,
    type: params.type,
    title: params.title,
    message: params.message,
    data: params.data ?? {},
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    // Fetch all active carrier verifications
    const { data: verifications, error: fetchError } = await supabase
      .from('carrier_verifications')
      .select(
        'id, company_id, carrier_id, status, insurance_expiry_date, last_verified_at, safety_rating, csa_score, risk_score',
      )
      .not('carrier_id', 'is', null);

    if (fetchError) throw fetchError;
    if (!verifications || verifications.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const results = {
      insurance_warnings: 0,
      fmcsa_reverified: 0,
      risk_scores_updated: 0,
      notifications_sent: 0,
    };

    for (const cv of verifications as CarrierVerificationRow[]) {
      const updates: Record<string, unknown> = {};
      const riskScore = computeRiskScore(cv);

      // Always update risk score if changed
      if (cv.risk_score !== riskScore) {
        updates.risk_score = riskScore;
        results.risk_scores_updated++;
      }

      // Check insurance expiry
      if (cv.insurance_expiry_date) {
        const expiry = new Date(cv.insurance_expiry_date);
        if (expiry <= thirtyDaysFromNow && cv.status !== 'insurance_warning') {
          updates.status = 'insurance_warning';
          results.insurance_warnings++;

          // Notify carrier owner
          await enqueueNotification({
            userId: cv.carrier_id,
            type: 'insurance_expiry_warning',
            title: 'Insurance Expiring Soon',
            message: `Your insurance expires on ${expiry.toLocaleDateString()}. Upload a renewed certificate to avoid load posting restrictions.`,
            data: { company_id: cv.company_id, expiry_date: cv.insurance_expiry_date },
          });
          results.notifications_sent++;
        }
      }

      // FMCSA re-verification (carriers not checked in 90+ days)
      if (!cv.last_verified_at || new Date(cv.last_verified_at) < ninetyDaysAgo) {
        // Schedule re-verification (insert into verification_schedule)
        const { error: scheduleError } = await supabase.from('verification_schedule').upsert(
          {
            company_id: cv.company_id,
            carrier_id: cv.carrier_id,
            scheduled_at: now.toISOString(),
            trigger_reason: 'periodic',
          },
          { onConflict: 'company_id,scheduled_at', ignoreDuplicates: true },
        );

        if (!scheduleError) {
          updates.next_verify_at = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString();
          results.fmcsa_reverified++;
        }
      }

      // Flush updates
      if (Object.keys(updates).length > 0) {
        await supabase.from('carrier_verifications').update(updates).eq('id', cv.id);
      }
    }

    return new Response(JSON.stringify({ processed: verifications.length, ...results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[carrier-health-check] Error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
