import { supabase } from '@/lib/supabase';
import type { DwellRecord } from '@freightx/shared';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

function mapRow(row: Record<string, unknown>): DwellRecord {
  return {
    id: row.id as string,
    loadNumber: row.load_number as string,
    geofenceId: row.geofence_id as string,
    stopType: row.stop_type as 'pickup' | 'delivery',
    label: row.label as string,
    enteredAt: row.entered_at as string,
    exitedAt: (row.exited_at as string) ?? undefined,
    dwellMinutes: (row.dwell_minutes as number) ?? undefined,
    detentionFlagged: row.detention_flagged as boolean,
  };
}

export async function startDwell(params: {
  loadNumber: string;
  geofenceId: string;
  stopType: 'pickup' | 'delivery';
  label: string;
}): Promise<DwellRecord> {
  const { data, error } = await db
    .from('dwell_records')
    .insert({
      load_number: params.loadNumber,
      geofence_id: params.geofenceId,
      stop_type: params.stopType,
      label: params.label,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return mapRow(data);
}

export async function endDwell(dwellId: string): Promise<DwellRecord> {
  const { data, error } = await db
    .from('dwell_records')
    .update({ exited_at: new Date().toISOString() })
    .eq('id', dwellId)
    .select()
    .single();
  if (error) throw new Error(error.message);

  const record = mapRow(data);

  // Auto-flag detention if dwell > 120 minutes
  if (record.dwellMinutes && record.dwellMinutes > 120) {
    await flagDetention(dwellId);
    record.detentionFlagged = true;
  }

  return record;
}

export async function flagDetention(dwellId: string): Promise<void> {
  await db.from('dwell_records').update({ detention_flagged: true }).eq('id', dwellId);
}

export async function getDwellRecords(loadNumber: string): Promise<DwellRecord[]> {
  const { data, error } = await db
    .from('dwell_records')
    .select('*')
    .eq('load_number', loadNumber)
    .order('entered_at', { ascending: true });
  if (error) return [];
  return (data ?? []).map(mapRow);
}

/**
 * Find an open (non-exited) dwell record for a geofence.
 */
export async function findOpenDwell(geofenceId: string): Promise<DwellRecord | null> {
  const { data } = await db
    .from('dwell_records')
    .select('*')
    .eq('geofence_id', geofenceId)
    .is('exited_at', null)
    .limit(1)
    .single();
  return data ? mapRow(data) : null;
}
