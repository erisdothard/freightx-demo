import { supabase } from '@/lib/supabase';
import type { SubscriptionTier, SubscriptionRow, InvoiceRow } from '@/lib/database.types';

// Price IDs — set these in Stripe dashboard and add to env
const PRICE_IDS: Record<string, string> = {
  carrier_pro: import.meta.env.VITE_STRIPE_PRICE_CARRIER_PRO ?? 'price_PLACEHOLDER_carrier_pro',
  broker_starter:
    import.meta.env.VITE_STRIPE_PRICE_BROKER_STARTER ?? 'price_PLACEHOLDER_broker_starter',
  broker_growth:
    import.meta.env.VITE_STRIPE_PRICE_BROKER_GROWTH ?? 'price_PLACEHOLDER_broker_growth',
  shipper: import.meta.env.VITE_STRIPE_PRICE_SHIPPER ?? 'price_PLACEHOLDER_shipper',
};

export async function redirectToCheckout(tier: SubscriptionTier, companyId: string): Promise<void> {
  const priceId = PRICE_IDS[tier];
  if (!priceId) throw new Error(`No price configured for tier: ${tier}`);

  // Edge Function creates a Stripe Checkout session and returns the hosted URL
  const { data, error } = await supabase.functions.invoke<{ url: string }>(
    'create-checkout-session',
    {
      body: { priceId, companyId, tier },
    },
  );

  if (error) throw new Error(error.message);
  if (!data?.url) throw new Error('No checkout URL returned');

  // Redirect to Stripe-hosted checkout page
  window.location.href = data.url;
}

export async function getSubscription(companyId: string): Promise<SubscriptionRow | null> {
  const { data, error } = await (supabase as any)
    .from('subscriptions')
    .select('*')
    .eq('company_id', companyId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function getInvoice(loadId: string): Promise<InvoiceRow | null> {
  const { data, error } = await (supabase as any)
    .from('invoices')
    .select('*')
    .eq('load_id', loadId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function approveInvoice(invoiceId: string): Promise<void> {
  const { error } = await (supabase as any)
    .from('invoices')
    .update({ status: 'approved', approved_at: new Date().toISOString() })
    .eq('id', invoiceId);
  if (error) throw new Error(error.message);
}

export async function selectPaymentMethod(
  invoiceId: string,
  method: 'standard_net30' | 'quick_pay',
): Promise<void> {
  // Fetch invoice to compute quick pay fee
  const { data: invoice, error: fetchError } = await (supabase as any)
    .from('invoices')
    .select('amount_usd')
    .eq('id', invoiceId)
    .single();
  if (fetchError) throw new Error(fetchError.message);

  const fee = method === 'quick_pay' ? Math.round((invoice.amount_usd as number) * 0.02) : null;
  const due =
    method === 'quick_pay'
      ? new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const { error } = await (supabase as any)
    .from('invoices')
    .update({
      payment_method: method,
      quick_pay_fee_usd: fee,
      due_date: due,
      status: 'processing',
      updated_at: new Date().toISOString(),
    })
    .eq('id', invoiceId);
  if (error) throw new Error(error.message);
}
