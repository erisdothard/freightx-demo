import { supabase } from '@/lib/supabase';

export type AccessorialType =
  | 'detention'
  | 'lumper'
  | 'layover'
  | 'tonu'
  | 'fuel_surcharge'
  | 'other';
export type AccessorialStatus = 'pending' | 'approved' | 'denied';

export interface AccessorialCharge {
  id: string;
  load_id: string;
  booking_id: string | null;
  type: AccessorialType;
  amount_usd: number;
  notes: string | null;
  status: AccessorialStatus;
  created_by: string;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export const ACCESSORIAL_LABELS: Record<AccessorialType, string> = {
  detention: 'Detention',
  lumper: 'Lumper',
  layover: 'Layover',
  tonu: 'TONU',
  fuel_surcharge: 'Fuel Surcharge',
  other: 'Other',
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export async function getAccessorials(loadId: string): Promise<AccessorialCharge[]> {
  const { data, error } = await db
    .from('accessorial_charges')
    .select('*')
    .eq('load_id', loadId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as AccessorialCharge[];
}

export async function addAccessorial(params: {
  loadId: string;
  bookingId?: string | null;
  type: AccessorialType;
  amountUsd: number;
  notes?: string;
}): Promise<AccessorialCharge> {
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) throw new Error('Not authenticated');

  const { data, error } = await db
    .from('accessorial_charges')
    .insert({
      load_id: params.loadId,
      booking_id: params.bookingId ?? null,
      type: params.type,
      amount_usd: params.amountUsd,
      notes: params.notes ?? null,
      created_by: authData.user.id,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as AccessorialCharge;
}

export async function approveAccessorial(id: string): Promise<void> {
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) throw new Error('Not authenticated');

  const { error } = await db
    .from('accessorial_charges')
    .update({
      status: 'approved',
      approved_by: authData.user.id,
      approved_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) throw new Error(error.message);
}

export async function denyAccessorial(id: string): Promise<void> {
  const { error } = await db.from('accessorial_charges').update({ status: 'denied' }).eq('id', id);

  if (error) throw new Error(error.message);
}

export async function getApprovedAccessorialTotal(loadId: string): Promise<number> {
  const { data, error } = await db
    .from('accessorial_charges')
    .select('amount_usd')
    .eq('load_id', loadId)
    .eq('status', 'approved');

  if (error || !data) return 0;
  return (data as { amount_usd: number }[]).reduce((sum, row) => sum + Number(row.amount_usd), 0);
}
