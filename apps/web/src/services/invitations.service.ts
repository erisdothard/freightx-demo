import { supabase } from '@/lib/supabase';

export interface LoadInvitation {
  id: string;
  load_id: string;
  carrier_company_id: string;
  invited_by: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  expires_at: string | null;
  created_at: string;
  load?: {
    load_number: string;
    origin_city: string;
    origin_state: string;
    destination_city: string;
    destination_state: string;
    rate_usd: number;
    equipment_type: string;
    pickup_date: string;
  };
}

export async function inviteCarriersToLoad(
  loadId: string,
  carrierCompanyIds: string[],
  expiresInHours = 48,
): Promise<void> {
  const { error } = await supabase.rpc('invite_carriers_to_load', {
    p_load_id: loadId,
    p_carrier_company_ids: carrierCompanyIds,
    p_expires_in_hours: expiresInHours,
  });
  if (error) throw new Error(error.message);
}

export async function getMyInvitations(companyId: string): Promise<LoadInvitation[]> {
  const { data, error } = await supabase.rpc('get_my_load_invitations', {
    p_status: null,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as LoadInvitation[];
}

export async function updateInvitationStatus(
  invitationId: string,
  status: 'accepted' | 'declined',
): Promise<void> {
  const { error } = await supabase
    .from('load_invitations')
    .update({ status })
    .eq('id', invitationId);
  if (error) throw new Error(error.message);
}

export async function searchCarriersForInvite(query: string): Promise<
  Array<{
    id: string;
    name: string;
    mc_number: string | null;
    city: string | null;
    state: string | null;
  }>
> {
  const { data, error } = await supabase
    .from('companies')
    .select('id, name, mc_number, city, state')
    .or(`name.ilike.%${query}%,mc_number.ilike.%${query}%`)
    .eq('type', 'carrier')
    .limit(20);
  if (error) throw new Error(error.message);
  return (data ?? []) as Array<{
    id: string;
    name: string;
    mc_number: string | null;
    city: string | null;
    state: string | null;
  }>;
}
