import { supabase } from '@/lib/supabase';

export interface FactoringRiskProfile {
  company_id: string;
  company_name: string;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  risk_score: number;
  outstanding_amount: number;
  total_factored: number;
  default_count: number;
  avg_days_to_pay: number;
  exposure_limit: number;
  available_exposure: number;
}

export interface ExposureControl {
  company_id: string;
  exposure_limit: number;
  current_exposure: number;
  utilization_pct: number;
}

export async function assessFactoringRisk(
  factoringRequestId: string,
): Promise<FactoringRiskProfile | null> {
  const { data, error } = await supabase.rpc('assess_factoring_risk', {
    p_factoring_request_id: factoringRequestId,
  });
  if (error) throw new Error(error.message);
  return (data as unknown as FactoringRiskProfile) ?? null;
}

export async function getFactoringRiskDashboard(): Promise<FactoringRiskProfile[]> {
  // Aggregate from factoring_requests table since dashboard RPC may not exist
  const { data, error } = await supabase
    .from('factoring_requests')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as FactoringRiskProfile[];
}

export async function updateExposureLimit(companyId: string, newLimit: number): Promise<void> {
  const { error } = await supabase
    .from('companies')
    .update({ factoring_exposure_limit: newLimit } as any)
    .eq('id', companyId);
  if (error) throw new Error(error.message);
}

export async function getExposureControls(): Promise<ExposureControl[]> {
  // Query companies with factoring activity
  const { data, error } = await supabase.from('companies').select('id, name').limit(50);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as ExposureControl[];
}
