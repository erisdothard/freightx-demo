import { supabase } from '@/lib/supabase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export type FactoringStatus = 'requested' | 'approved' | 'funded' | 'denied' | 'cancelled';

export interface FactoringRequest {
  id: string;
  carrierId: string;
  companyId: string | null;
  loadId: string | null;
  loadNumber: string | null;
  invoiceAmount: number;
  feePercent: number;
  netPayout: number | null;
  status: FactoringStatus;
  factorPartner: string | null;
  notes: string | null;
  requestedAt: string;
  approvedAt: string | null;
  fundedAt: string | null;
}

interface FactoringRow {
  id: string;
  carrier_id: string;
  company_id: string | null;
  load_id: string | null;
  load_number: string | null;
  invoice_amount: number;
  fee_percent: number;
  net_payout: number | null;
  status: string;
  factor_partner: string | null;
  notes: string | null;
  requested_at: string;
  approved_at: string | null;
  funded_at: string | null;
}

function rowToFactoring(row: FactoringRow): FactoringRequest {
  return {
    id: row.id,
    carrierId: row.carrier_id,
    companyId: row.company_id,
    loadId: row.load_id,
    loadNumber: row.load_number,
    invoiceAmount: Number(row.invoice_amount),
    feePercent: Number(row.fee_percent),
    netPayout: row.net_payout != null ? Number(row.net_payout) : null,
    status: row.status as FactoringStatus,
    factorPartner: row.factor_partner,
    notes: row.notes,
    requestedAt: row.requested_at,
    approvedAt: row.approved_at,
    fundedAt: row.funded_at,
  };
}

export async function getMyFactoringRequests(carrierId: string): Promise<FactoringRequest[]> {
  const { data, error } = await db
    .from('factoring_requests')
    .select('*')
    .eq('carrier_id', carrierId)
    .order('requested_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToFactoring);
}

export async function requestFactoring(params: {
  carrierId: string;
  companyId: string | null;
  loadId: string;
  loadNumber: string;
  invoiceAmount: number;
  feePercent?: number;
  notes?: string;
}): Promise<FactoringRequest> {
  const { data, error } = await db
    .from('factoring_requests')
    .insert({
      carrier_id: params.carrierId,
      company_id: params.companyId,
      load_id: params.loadId,
      load_number: params.loadNumber,
      invoice_amount: params.invoiceAmount,
      fee_percent: params.feePercent ?? 3.0,
      notes: params.notes ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return rowToFactoring(data as FactoringRow);
}

export async function cancelFactoringRequest(id: string): Promise<void> {
  const { error } = await db
    .from('factoring_requests')
    .update({ status: 'cancelled' })
    .eq('id', id);
  if (error) throw error;
}

/** Admin: approve a factoring request */
export async function approveFactoringRequest(id: string): Promise<void> {
  const { error } = await db
    .from('factoring_requests')
    .update({ status: 'approved', approved_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

/** Admin: mark as funded */
export async function fundFactoringRequest(id: string): Promise<void> {
  const { error } = await db
    .from('factoring_requests')
    .update({ status: 'funded', funded_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

/** Admin: deny */
export async function denyFactoringRequest(id: string, notes?: string): Promise<void> {
  const { error } = await db
    .from('factoring_requests')
    .update({ status: 'denied', notes: notes ?? null })
    .eq('id', id);
  if (error) throw error;
}
