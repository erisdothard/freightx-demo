import { supabase } from '@/lib/supabase';

export interface FuelCard {
  id: string;
  company_id: string;
  card_number_masked: string;
  provider: string;
  assigned_driver: string | null;
  assigned_truck: string | null;
  spending_limit_usd: number | null;
  daily_limit_usd: number | null;
  status: string;
  created_at: string;
}

export interface FuelTransaction {
  id: string;
  fuel_card_id: string;
  company_id: string;
  driver_id: string | null;
  load_id: string | null;
  truck_id: string | null;
  transaction_date: string;
  gallons: number;
  price_per_gallon: number;
  total_amount_usd: number;
  created_at: string;
}

export interface FuelSummary {
  total_spent: number;
  total_gallons: number;
  avg_price_per_gallon: number;
  transaction_count: number;
  savings_estimate: number;
}

export async function getFuelCards(companyId: string): Promise<FuelCard[]> {
  const { data, error } = await supabase
    .from('fuel_cards')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as FuelCard[];
}

export async function getFuelTransactions(cardId: string, limit = 50): Promise<FuelTransaction[]> {
  const { data, error } = await supabase
    .from('fuel_transactions')
    .select('*')
    .eq('fuel_card_id', cardId)
    .order('transaction_date', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as FuelTransaction[];
}

export async function getFuelSummary(companyId: string): Promise<FuelSummary | null> {
  const { data, error } = await supabase.rpc('get_fuel_summary' as any, {
    p_company_id: companyId,
  });
  if (error) throw new Error(error.message);
  return (data as unknown as FuelSummary) ?? null;
}

export async function issueFuelCard(params: {
  companyId: string;
  driverId?: string;
  dailyLimit?: number;
}): Promise<FuelCard> {
  const { data, error } = await supabase
    .from('fuel_cards')
    .insert({
      company_id: params.companyId,
      card_number_masked: `****-****-****-${Math.floor(1000 + Math.random() * 9000)}`,
      provider: 'freightx',
      assigned_driver: params.driverId ?? null,
      daily_limit_usd: params.dailyLimit ?? 500,
      status: 'active',
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as FuelCard;
}

export async function updateFuelCardStatus(cardId: string, status: string): Promise<void> {
  const { error } = await supabase.from('fuel_cards').update({ status }).eq('id', cardId);
  if (error) throw new Error(error.message);
}
