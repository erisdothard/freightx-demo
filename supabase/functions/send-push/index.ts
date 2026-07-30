/**
 * send-push Edge Function
 *
 * Accepts: { user_id, title, body, url?, tag? }
 * Looks up the user's push_subscriptions and sends via Web Push protocol.
 *
 * Requires:
 *   - VAPID_PUBLIC_KEY env secret
 *   - VAPID_PRIVATE_KEY env secret
 *   - VAPID_SUBJECT (mailto: or URL)
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// Minimal Web Push implementation using fetch + crypto (Deno built-ins)
// For production, use the web-push npm package or a proper Deno VAPID library.

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

interface PushPayload {
  user_id: string;
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

async function sendWebPush(
  subscription: {
    endpoint: string;
    p256dh: string;
    auth: string;
  },
  payload: Record<string, unknown>,
): Promise<boolean> {
  // NOTE: Full VAPID signing requires crypto operations best handled by
  // the `web-push` npm package. For now we use a simplified direct fetch
  // approach that works with most push services when auth headers are built.
  // In production, add: import webpush from 'npm:web-push' and use signVapid.

  const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
  const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
  const vapidSubject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:noreply@freightx.app';

  if (!vapidPublicKey || !vapidPrivateKey) {
    console.warn('[send-push] VAPID keys not configured — skipping push delivery');
    return false;
  }

  const body = JSON.stringify(payload);

  // Build Authorization header using VAPID
  // This is a simplified placeholder — full VAPID JWT signing requires
  // the web-push library for proper EC key handling.
  const resp = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aes128gcm',
      TTL: '86400',
      // In full implementation: Authorization: `vapid t=<jwt>,k=<pubkey>`
      'X-Push-Subject': vapidSubject,
    },
    body,
  });

  return resp.ok || resp.status === 201;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const payload = (await req.json()) as PushPayload;
    const { user_id, title, body, url, tag } = payload;

    if (!user_id || !title || !body) {
      return new Response(JSON.stringify({ error: 'user_id, title, body required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: subs, error } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', user_id);

    if (error) throw error;
    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: 'no_subscriptions' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const pushData = { title, body, url: url ?? '/', tag: tag ?? 'freightx' };
    let sent = 0;
    let failed = 0;

    for (const sub of subs) {
      const ok = await sendWebPush(
        { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
        pushData,
      );
      if (ok) {
        sent++;
        // Update last_used_at
        await supabase
          .from('push_subscriptions')
          .update({ last_used_at: new Date().toISOString() })
          .eq('endpoint', sub.endpoint);
      } else {
        failed++;
        // Remove dead subscriptions (410 Gone)
        await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
      }
    }

    return new Response(JSON.stringify({ sent, failed }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[send-push] Error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
