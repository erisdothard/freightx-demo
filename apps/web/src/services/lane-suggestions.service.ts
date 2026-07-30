import { supabase } from '@/lib/supabase';

export interface LaneSuggestion {
  origin_state: string;
  destination_state: string;
  equipment_type: string;
  avg_rate: number;
  load_count: number;
  score: number;
  source: 'preference' | 'history' | 'popular';
}

export interface BackhaulOpportunity {
  load_id: string;
  load_number: string;
  origin_city: string;
  origin_state: string;
  destination_city: string;
  destination_state: string;
  rate_usd: number;
  total_miles: number;
  equipment_type: string;
  pickup_date: string;
  deadhead_miles: number;
}

export interface LanePreference {
  id: string;
  carrier_company_id: string;
  origin_state: string;
  dest_state: string;
  equipment: string | null;
  min_rate_per_mile: number | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export async function getLaneSuggestions(companyId: string): Promise<LaneSuggestion[]> {
  const { data, error } = await supabase.rpc('get_lane_suggestions', {
    p_carrier_company_id: companyId,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as LaneSuggestion[];
}

export async function getBackhaulOpportunities(
  companyId: string,
  currentState?: string,
): Promise<BackhaulOpportunity[]> {
  const { data, error } = await supabase.rpc('get_backhaul_opportunities', {
    p_current_state: currentState ?? '',
    p_equipment: '',
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as BackhaulOpportunity[];
}

export async function getLanePreferences(companyId: string): Promise<LanePreference[]> {
  const { data, error } = await supabase
    .from('carrier_lane_preferences')
    .select('*')
    .eq('carrier_company_id', companyId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as LanePreference[];
}

export async function addLanePreference(params: {
  companyId: string;
  originState: string;
  destinationState: string;
  equipmentType?: string;
  minRate?: number;
}): Promise<LanePreference> {
  const { data, error } = await supabase
    .from('carrier_lane_preferences')
    .insert({
      carrier_company_id: params.companyId,
      origin_state: params.originState,
      dest_state: params.destinationState,
      equipment: params.equipmentType ?? null,
      min_rate_per_mile: params.minRate ?? null,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as LanePreference;
}

export async function removeLanePreference(id: string): Promise<void> {
  const { error } = await supabase.from('carrier_lane_preferences').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
