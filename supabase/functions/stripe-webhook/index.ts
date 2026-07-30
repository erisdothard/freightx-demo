import Stripe from 'https://esm.sh/stripe@14?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno';
import { corsHeaders } from '../_shared/cors.ts';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2024-04-10',
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const signature = req.headers.get('stripe-signature');
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '';

  if (!signature) {
    return new Response('Missing stripe-signature', { status: 400 });
  }

  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Webhook signature verification failed';
    return new Response(msg, { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const companyId = session.metadata?.company_id;
      const tier = session.metadata?.tier;
      const subscriptionId = session.subscription as string;

      if (!companyId || !tier || !subscriptionId) break;

      const sub = await stripe.subscriptions.retrieve(subscriptionId);
      const periodEnd = new Date((sub as any).current_period_end * 1000).toISOString();
      const periodStart = new Date((sub as any).current_period_start * 1000).toISOString();

      await supabase.from('subscriptions').upsert(
        {
          company_id: companyId,
          stripe_subscription_id: subscriptionId,
          stripe_customer_id: session.customer as string,
          tier,
          status: 'active',
          current_period_start: periodStart,
          current_period_end: periodEnd,
        },
        { onConflict: 'company_id' },
      );

      break;
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription;
      const companyId = sub.metadata?.company_id;
      if (!companyId) break;

      const periodEnd = new Date((sub as any).current_period_end * 1000).toISOString();
      const periodStart = new Date((sub as any).current_period_start * 1000).toISOString();

      await supabase
        .from('subscriptions')
        .update({
          status: sub.status,
          tier: sub.metadata?.tier ?? undefined,
          current_period_start: periodStart,
          current_period_end: periodEnd,
        })
        .eq('company_id', companyId);

      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      const companyId = sub.metadata?.company_id;
      if (!companyId) break;

      await supabase
        .from('subscriptions')
        .update({ status: 'cancelled' })
        .eq('company_id', companyId);

      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = invoice.customer as string;

      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('company_id')
        .eq('stripe_customer_id', customerId)
        .maybeSingle();

      if (subscription?.company_id) {
        await supabase
          .from('subscriptions')
          .update({ status: 'past_due' })
          .eq('company_id', subscription.company_id);
      }
      break;
    }

    default:
      break;
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
