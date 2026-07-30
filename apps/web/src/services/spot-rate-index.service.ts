import { supabase } from '@/lib/supabase';

export interface SpotRateIndex {
  origin_state: string;
  destination_state: string;
  equipment_type: string;
  avg_rate: number;
  min_rate: number;
  max_rate: number;
  load_count: number;
  trend_direction: 'up' | 'down' | 'stable';
  trend_pct: number;
  period: string;
}

export interface ShipperRateRecommendation {
  origin_state: string;
  destination_state: string;
  equipment_type: string;
  recommended_rate: number;
  market_avg: number;
  confidence: 'high' | 'medium' | 'low';
  recommendation: string;
}

export async function getSpotRateIndex(params?: {
  originState?: string;
  destinationState?: string;
  equipmentType?: string;
}): Promise<SpotRateIndex[]> {
  const { data, error } = await supabase.rpc('get_spot_rate_index', {
    p_origin_state: params?.originState ?? '',
    p_dest_state: params?.destinationState ?? '',
    p_equipment: params?.equipmentType ?? '',
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as SpotRateIndex[];
}

export async function getShipperRateRecommendation(params: {
  originState: string;
  destinationState: string;
  equipmentType: string;
}): Promise<ShipperRateRecommendation | null> {
  const { data, error } = await supabase.rpc('get_shipper_rate_recommendation', {
    p_origin_state: params.originState,
    p_dest_state: params.destinationState,
    p_equipment: params.equipmentType,
  });
  if (error) throw new Error(error.message);
  return (data as unknown as ShipperRateRecommendation) ?? null;
}
