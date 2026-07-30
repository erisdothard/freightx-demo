import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const MAX_BATCH = 50;

/**
 * notification-worker: pg_cron polls this every 30s.
 * Drains the notification_queue table — sends email via Resend, SMS via Twilio.
 * Implements exponential backoff retry (max 3 attempts, dead-letter after that).
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Claim a batch of pending/retryable items
  const { data: items, error: fetchErr } = await supabase
    .from('notification_queue')
    .select('*')
    .in('status', ['pending', 'failed'])
    .lte('next_retry_at', new Date().toISOString())
    .order('created_at', { ascending: true })
    .limit(MAX_BATCH);

  if (fetchErr || !items || items.length === 0) {
    return new Response(JSON.stringify({ processed: 0 }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let sent = 0;
  let failed = 0;

  for (const item of items) {
    const attempts = item.attempts + 1;
    try {
      if (item.type === 'email') {
        await sendEmail(item);
      } else if (item.type === 'sms') {
        await sendSms(item);
      }

      await supabase
        .from('notification_queue')
        .update({ status: 'sent', sent_at: new Date().toISOString(), attempts })
        .eq('id', item.id);

      sent++;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      const isDead = attempts >= item.max_attempts;
      const backoffMs = Math.min(1000 * 2 ** attempts, 30 * 60 * 1000); // max 30 min
      const nextRetry = new Date(Date.now() + backoffMs).toISOString();

      await supabase
        .from('notification_queue')
        .update({
          status: isDead ? 'dead' : 'failed',
          attempts,
          error_message: errMsg,
          next_retry_at: isDead ? null : nextRetry,
        })
        .eq('id', item.id);

      failed++;
    }
  }

  return new Response(JSON.stringify({ processed: items.length, sent, failed }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});

async function sendEmail(item: Record<string, unknown>) {
  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  if (!resendApiKey) throw new Error('RESEND_API_KEY not configured');

  const payload = item.payload as { template: string; data: Record<string, unknown> };
  const edgeFnUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-notification-email`;

  const resp = await fetch(edgeFnUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to: item.recipient,
      subject: item.subject,
      template: payload.template,
      data: payload.data,
    }),
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Email failed: ${body}`);
  }
}

async function sendSms(item: Record<string, unknown>) {
  const payload = item.payload as { message: string };
  const edgeFnUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-sms`;

  const resp = await fetch(edgeFnUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to: item.recipient,
      message: payload.message,
    }),
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`SMS failed: ${body}`);
  }
}
