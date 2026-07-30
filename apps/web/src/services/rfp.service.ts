import { supabase } from '@/lib/supabase';

export interface Rfp {
  id: string;
  company_id: string;
  created_by: string;
  title: string;
  description: string | null;
  status: 'draft' | 'open' | 'evaluating' | 'awarded' | 'closed';
  contract_start: string;
  contract_end: string;
  deadline: string | null;
  volume_estimate: string | null;
  equipment: string | null;
  created_at: string;
  updated_at: string;
}

export interface RfpLane {
  id: string;
  rfp_id: string;
  origin_city: string | null;
  origin_state: string;
  dest_city: string | null;
  dest_state: string;
  equipment: string | null;
  loads_per_week: number | null;
  target_rate_usd: number | null;
  created_at: string;
}

export interface RfpProposal {
  id: string;
  rfp_id: string;
  rfp_lane_id: string;
  carrier_company_id: string;
  submitted_by: string;
  carrier_name?: string;
  proposed_rate_usd: number;
  capacity_per_week: number | null;
  transit_days: number | null;
  notes: string | null;
  status: 'submitted' | 'shortlisted' | 'awarded' | 'rejected';
  created_at: string;
  updated_at: string;
}

export interface RfpSummary {
  rfp_id: string;
  total_lanes: number;
  total_proposals: number;
  lanes_awarded: number;
  avg_proposed_rate: number;
}

export async function getRfps(companyId: string): Promise<Rfp[]> {
  const { data, error } = await supabase
    .from('rfps')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as Rfp[];
}

export async function getOpenRfps(): Promise<Rfp[]> {
  const { data, error } = await supabase
    .from('rfps')
    .select('*')
    .eq('status', 'open')
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as Rfp[];
}

export async function createRfp(params: {
  companyId: string;
  createdBy: string;
  title: string;
  description?: string;
  contractStart: string;
  contractEnd: string;
  deadline?: string;
}): Promise<Rfp> {
  const { data, error } = await supabase
    .from('rfps')
    .insert({
      company_id: params.companyId,
      created_by: params.createdBy,
      title: params.title,
      description: params.description ?? null,
      contract_start: params.contractStart,
      contract_end: params.contractEnd,
      deadline: params.deadline ?? null,
      status: 'draft',
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as unknown as Rfp;
}

export async function addRfpLane(params: {
  rfpId: string;
  originCity?: string;
  originState: string;
  destCity?: string;
  destState: string;
  equipment?: string;
  loadsPerWeek?: number;
  targetRateUsd?: number;
}): Promise<RfpLane> {
  const { data, error } = await supabase
    .from('rfp_lanes')
    .insert({
      rfp_id: params.rfpId,
      origin_city: params.originCity ?? null,
      origin_state: params.originState,
      dest_city: params.destCity ?? null,
      dest_state: params.destState,
      equipment: params.equipment ?? null,
      loads_per_week: params.loadsPerWeek ?? null,
      target_rate_usd: params.targetRateUsd ?? null,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as RfpLane;
}

export async function getRfpLanes(rfpId: string): Promise<RfpLane[]> {
  const { data, error } = await supabase
    .from('rfp_lanes')
    .select('*')
    .eq('rfp_id', rfpId)
    .order('origin_state');
  if (error) throw new Error(error.message);
  return (data ?? []) as RfpLane[];
}

export async function submitRfpProposal(params: {
  rfpId: string;
  rfpLaneId: string;
  carrierCompanyId: string;
  submittedBy: string;
  proposedRateUsd: number;
  capacityPerWeek?: number;
  transitDays?: number;
  notes?: string;
}): Promise<RfpProposal> {
  const { data, error } = await supabase
    .from('rfp_proposals')
    .insert({
      rfp_id: params.rfpId,
      rfp_lane_id: params.rfpLaneId,
      carrier_company_id: params.carrierCompanyId,
      submitted_by: params.submittedBy,
      proposed_rate_usd: params.proposedRateUsd,
      capacity_per_week: params.capacityPerWeek ?? null,
      transit_days: params.transitDays ?? null,
      notes: params.notes ?? null,
      status: 'submitted',
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as RfpProposal;
}

export async function getRfpProposals(rfpId: string): Promise<RfpProposal[]> {
  const { data, error } = await supabase
    .from('rfp_proposals')
    .select('*')
    .eq('rfp_id', rfpId)
    .order('proposed_rate_usd', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as RfpProposal[];
}

export async function awardRfpLane(proposalId: string): Promise<void> {
  const { error } = await supabase
    .from('rfp_proposals')
    .update({ status: 'awarded' })
    .eq('id', proposalId);
  if (error) throw new Error(error.message);
}

export async function publishRfp(rfpId: string): Promise<void> {
  const { error } = await supabase.from('rfps').update({ status: 'open' }).eq('id', rfpId);
  if (error) throw new Error(error.message);
}

export async function getRfpSummary(rfpId: string): Promise<RfpSummary | null> {
  const { data, error } = await supabase.rpc('get_rfp_summary', {
    p_rfp_id: rfpId,
  });
  if (error) throw new Error(error.message);
  return (data as unknown as RfpSummary) ?? null;
}
