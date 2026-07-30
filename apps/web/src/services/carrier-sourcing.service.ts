import { supabase } from '@/lib/supabase';

export interface CarrierScore {
  company_id: string;
  company_name: string;
  mc_number: string | null;
  total_score: number;
  equipment_score: number;
  availability_score: number;
  lane_preference_score: number;
  history_score: number;
  saved_search_score: number;
  rating_score: number;
  preferred_score: number;
  is_eligible: boolean;
  is_blocked: boolean;
}

export async function rankCarriersForLoad(loadId: string): Promise<CarrierScore[]> {
  const { data, error } = await supabase.rpc('rank_carriers_for_load', {
    p_load_id: loadId,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as CarrierScore[];
}

export async function scoreCarrierForLoad(
  loadId: string,
  companyId: string,
): Promise<CarrierScore | null> {
  const { data, error } = await supabase.rpc('score_carrier_for_load', {
    p_load_id: loadId,
    p_carrier_company_id: companyId,
  });
  if (error) throw new Error(error.message);
  return (data as unknown as CarrierScore) ?? null;
}
