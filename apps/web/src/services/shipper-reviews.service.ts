import { supabase } from '@/lib/supabase';

export interface ShipperReview {
  id: string;
  load_id: string;
  reviewer_company_id: string;
  reviewed_company_id: string;
  overall_rating: number;
  loading_efficiency: number | null;
  dock_wait_time: number | null;
  communication: number | null;
  facility_quality: number | null;
  accuracy: number | null;
  detention_minutes: number | null;
  comment: string | null;
  created_at: string;
}

export interface TrustProfile {
  company_id: string;
  company_name: string;
  avg_overall: number;
  avg_loading_efficiency: number | null;
  avg_dock_wait_time: number | null;
  avg_communication: number | null;
  avg_facility_quality: number | null;
  avg_accuracy: number | null;
  review_count: number;
  trust_grade: string;
  avg_detention_minutes: number | null;
}

export interface MarketplaceTrustSummary {
  total_companies: number;
  avg_trust_score: number;
  companies_with_a_plus: number;
}

export async function submitShipperReview(params: {
  loadId: string;
  reviewerCompanyId: string;
  reviewedCompanyId: string;
  overallRating: number;
  loadingEfficiency?: number;
  dockWaitTime?: number;
  communication?: number;
  facilityQuality?: number;
  accuracy?: number;
  detentionMinutes?: number;
  comment?: string;
}): Promise<ShipperReview> {
  const { data, error } = await supabase.rpc('submit_shipper_review', {
    p_load_id: params.loadId,
    p_overall: params.overallRating,
    p_loading_efficiency: params.loadingEfficiency ?? null,
    p_dock_wait_time: params.dockWaitTime ?? null,
    p_communication: params.communication ?? null,
    p_facility_quality: params.facilityQuality ?? null,
    p_accuracy: params.accuracy ?? null,
    p_detention_minutes: params.detentionMinutes ?? null,
    p_comment: params.comment ?? null,
  });
  if (error) throw new Error(error.message);
  return data as unknown as ShipperReview;
}

export async function getShipperTrustProfile(companyId: string): Promise<TrustProfile | null> {
  const { data, error } = await supabase.rpc('get_shipper_trust_profile', {
    p_shipper_company_id: companyId,
  });
  if (error) throw new Error(error.message);
  return (data as unknown as TrustProfile) ?? null;
}

export async function getMarketplaceTrustSummary(): Promise<MarketplaceTrustSummary | null> {
  const { data, error } = await supabase.rpc('get_marketplace_trust_summary');
  if (error) throw new Error(error.message);
  return (data as unknown as MarketplaceTrustSummary) ?? null;
}

export async function getBrokerTrustProfile(companyId: string): Promise<TrustProfile | null> {
  const { data, error } = await supabase.rpc('get_broker_trust_profile', {
    p_broker_company_id: companyId,
  });
  if (error) throw new Error(error.message);
  return (data as unknown as TrustProfile) ?? null;
}
