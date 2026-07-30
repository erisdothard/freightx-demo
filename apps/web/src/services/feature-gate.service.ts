import { supabase } from '@/lib/supabase';

export type FeatureName =
  | 'rate_analytics'
  | 'lane_alerts'
  | 'api_access'
  | 'advanced_tracking'
  | 'dock_scheduling'
  | 'factoring'
  | 'predictive_sourcing'
  | 'csv_import';

export interface TierInfo {
  tier: string;
  display_name: string;
  monthly_price: number;
  features: Record<string, number | boolean>;
}

export async function checkFeatureAccess(
  companyId: string,
  feature: FeatureName,
): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc('check_feature_access', {
    p_company_id: companyId,
    p_feature: feature,
  });

  if (error) {
    console.warn('[feature-gate] check_feature_access error:', error.message);
    return false;
  }

  return data === true;
}

export async function getCompanyTier(companyId: string): Promise<TierInfo | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc('get_company_tier', {
    p_company_id: companyId,
  });

  if (error || !data) return null;

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;

  return {
    tier: row.tier as string,
    display_name: row.display_name as string,
    monthly_price: Number(row.monthly_price ?? 0),
    features: (row.features ?? {}) as Record<string, number | boolean>,
  };
}
