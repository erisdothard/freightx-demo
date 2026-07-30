import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WebhookEvent {
  type: string;
  data: any;
  timestamp: string;
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Get pending webhook deliveries
    const { data: deliveries, error: fetchError } = await supabase
      .from('webhook_deliveries')
      .select(
        `
        *,
        webhook:webhooks(*)
      `,
      )
      .is('delivered_at', null)
      .is('failed_at', null)
      .lte('next_retry_at', new Date().toISOString())
      .limit(100);

    if (fetchError) throw fetchError;

    const results = [];

    for (const delivery of deliveries || []) {
      const webhook = delivery.webhook;

      if (!webhook || !webhook.active) {
        // Mark as failed if webhook is inactive
        await supabase
          .from('webhook_deliveries')
          .update({ failed_at: new Date().toISOString() })
          .eq('id', delivery.id);
        continue;
      }

      // Create HMAC signature
      const encoder = new TextEncoder();
      const data = encoder.encode(JSON.stringify(delivery.payload));
      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(webhook.secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign'],
      );
      const signature = await crypto.subtle.sign('HMAC', key, data);
      const signatureHex = Array.from(new Uint8Array(signature))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      // Attempt delivery
      try {
        const response = await fetch(webhook.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-FreightX-Signature': signatureHex,
            'X-FreightX-Event': delivery.event_type,
            'X-FreightX-Delivery-ID': delivery.id,
          },
          body: JSON.stringify(delivery.payload),
          signal: AbortSignal.timeout(30000), // 30 second timeout
        });

        const responseBody = await response.text();

        if (response.ok) {
          // Success - mark as delivered
          await supabase
            .from('webhook_deliveries')
            .update({
              response_status: response.status,
              response_body: responseBody.substring(0, 1000), // Limit size
              delivered_at: new Date().toISOString(),
              attempts: delivery.attempts + 1,
            })
            .eq('id', delivery.id);

          results.push({ id: delivery.id, status: 'delivered' });
        } else {
          // Failed - schedule retry with exponential backoff
          const nextRetry = calculateNextRetry(delivery.attempts + 1);

          if (delivery.attempts + 1 >= 5) {
            // Max retries reached - mark as failed
            await supabase
              .from('webhook_deliveries')
              .update({
                response_status: response.status,
                response_body: responseBody.substring(0, 1000),
                failed_at: new Date().toISOString(),
                attempts: delivery.attempts + 1,
              })
              .eq('id', delivery.id);

            results.push({ id: delivery.id, status: 'failed', reason: 'max_retries' });
          } else {
            // Schedule retry
            await supabase
              .from('webhook_deliveries')
              .update({
                response_status: response.status,
                response_body: responseBody.substring(0, 1000),
                attempts: delivery.attempts + 1,
                next_retry_at: nextRetry.toISOString(),
              })
              .eq('id', delivery.id);

            results.push({ id: delivery.id, status: 'retry_scheduled', next_retry: nextRetry });
          }
        }
      } catch (error) {
        // Network error or timeout
        const nextRetry = calculateNextRetry(delivery.attempts + 1);

        if (delivery.attempts + 1 >= 5) {
          await supabase
            .from('webhook_deliveries')
            .update({
              response_status: 0,
              response_body: error.message,
              failed_at: new Date().toISOString(),
              attempts: delivery.attempts + 1,
            })
            .eq('id', delivery.id);

          results.push({ id: delivery.id, status: 'failed', reason: error.message });
        } else {
          await supabase
            .from('webhook_deliveries')
            .update({
              response_status: 0,
              response_body: error.message,
              attempts: delivery.attempts + 1,
              next_retry_at: nextRetry.toISOString(),
            })
            .eq('id', delivery.id);

          results.push({ id: delivery.id, status: 'retry_scheduled', next_retry: nextRetry });
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: results.length,
        results,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});

// Calculate next retry time with exponential backoff
function calculateNextRetry(attempts: number): Date {
  // Exponential backoff: 1min, 5min, 15min, 1hr, 4hr
  const delays = [60, 300, 900, 3600, 14400]; // in seconds
  const delay = delays[Math.min(attempts - 1, delays.length - 1)];
  return new Date(Date.now() + delay * 1000);
}
