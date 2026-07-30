import { supabase } from '@/lib/supabase';

export type RelationshipStatus = 'preferred' | 'blocked';

export interface CarrierRelationship {
  id: string;
  company_id: string;
  carrier_id: string;
  carrier_name: string | null;
  status: RelationshipStatus;
  notes: string | null;
  created_at: string;
}

interface RelRow {
  id: string;
  company_id: string;
  carrier_id: string;
  status: RelationshipStatus;
  notes: string | null;
  created_at: string;
}

export async function getRelationships(): Promise<CarrierRelationship[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('carrier_relationships')
    .select('id, company_id, carrier_id, status, notes, created_at')
    .order('created_at', { ascending: false });

  if (error) throw new Error((error as { message: string }).message);

  const rows = (data as RelRow[]) ?? [];

  // Batch-fetch carrier names from profiles
  const carrierIds = [...new Set(rows.map((r) => r.carrier_id).filter(Boolean))];
  const nameMap = new Map<string, string>();

  if (carrierIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', carrierIds);

    for (const p of profiles ?? []) {
      if (p.full_name) nameMap.set(p.id, p.full_name);
    }
  }

  return rows.map((row) => ({
    id: row.id,
    company_id: row.company_id,
    carrier_id: row.carrier_id,
    carrier_name: nameMap.get(row.carrier_id) ?? null,
    status: row.status,
    notes: row.notes,
    created_at: row.created_at,
  }));
}

export async function upsertRelationship(
  carrierId: string,
  status: RelationshipStatus,
  notes?: string,
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error('Not authenticated');

  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id')
    .eq('id', user.id)
    .single();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const companyId = (profile as any)?.company_id as string | undefined;
  if (!companyId) throw new Error('No company found');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from('carrier_relationships').upsert(
    {
      company_id: companyId,
      carrier_id: carrierId,
      status,
      notes: notes ?? null,
      created_by: user.id,
    },
    { onConflict: 'company_id,carrier_id' },
  );

  if (error) throw new Error((error as { message: string }).message);
}

export async function removeRelationship(id: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from('carrier_relationships').delete().eq('id', id);
  if (error) throw new Error((error as { message: string }).message);
}
