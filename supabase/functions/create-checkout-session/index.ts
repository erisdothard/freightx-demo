import Stripe from 'https://esm.sh/stripe@14?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { priceId, companyId, tier } = (await req.json()) as {
      priceId: string;
      companyId: string;
      tier: string;
    };

    if (!priceId || !companyId) {
      return new Response(JSON.stringify({ error: 'priceId and companyId are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
      apiVersion: '2024-04-10',
    });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Fetch company to get existing Stripe customer ID
    const { data: company } = await supabase
      .from('companies')
      .select('id, name, stripe_customer_id')
      .eq('id', companyId)
      .single();

    let customerId: string | undefined = company?.stripe_customer_id;

    // Create Stripe customer if not exists
    if (!customerId) {
      const customer = await stripe.customers.create({
        metadata: { company_id: companyId, tier },
        name: company?.name ?? companyId,
      });
      customerId = customer.id;

      // Persist customer ID to avoid duplicates
      await supabase
        .from('companies')
        .update({ stripe_customer_id: customerId } as any)
        .eq('id', companyId);
    }

    const appUrl = Deno.env.get('APP_URL') ?? 'https://freightx.io';

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: `${appUrl}/profile?checkout=success`,
      cancel_url: `${appUrl}/profile?checkout=cancelled`,
      metadata: { company_id: companyId, tier },
      subscription_data: {
        metadata: { company_id: companyId, tier },
      },
      allow_promotion_codes: true,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
