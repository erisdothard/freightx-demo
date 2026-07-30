import { supabase } from '@/lib/supabase';
import type { RatingRow } from '@/lib/database.types';

export type { RatingRow };

export async function getRatingsForCompany(companyId: string): Promise<RatingRow[]> {
  const { data, error } = await supabase
    .from('ratings')
    .select('*')
    .eq('rated_company_id', companyId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as RatingRow[];
}

export async function hasRatedLoad(loadId: string, raterId: string): Promise<boolean> {
  const { data } = await supabase
    .from('ratings')
    .select('id')
    .eq('load_id', loadId)
    .eq('rater_id', raterId)
    .maybeSingle();
  return !!data;
}

export async function submitRating(params: {
  loadId: string;
  raterId: string;
  ratedCompanyId: string;
  overall: number;
  communication?: number;
  reliability?: number;
  professionalism?: number;
  comment?: string;
}): Promise<RatingRow> {
  const { data, error } = await supabase
    .from('ratings')
    .insert({
      load_id: params.loadId,
      rater_id: params.raterId,
      rated_company_id: params.ratedCompanyId,
      overall: params.overall,
      communication: params.communication ?? null,
      reliability: params.reliability ?? null,
      professionalism: params.professionalism ?? null,
      comment: params.comment ?? null,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as RatingRow;
}

export function calcAverageRating(ratings: RatingRow[]): number | null {
  if (!ratings.length) return null;
  const sum = ratings.reduce((acc, r) => acc + r.overall, 0);
  return Math.round((sum / ratings.length) * 10) / 10;
}
