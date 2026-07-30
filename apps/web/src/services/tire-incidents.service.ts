import { supabase } from '@/lib/supabase';
import type { TireIncident, TirePosition, TireSeverity, TireResolution } from '@freightx/shared';

// tire_incidents table not yet in generated DB types — use untyped client
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

function mapRow(row: Record<string, unknown>): TireIncident {
  return {
    id: row.id as string,
    driverId: row.driver_id as string,
    loadNumber: (row.load_number as string) ?? undefined,
    incidentDate: row.incident_date as string,
    locationText: row.location_text as string,
    lat: row.lat as number | undefined,
    lng: row.lng as number | undefined,
    tirePosition: row.tire_position as TirePosition,
    severity: row.severity as TireSeverity,
    description: (row.description as string) ?? undefined,
    resolution: (row.resolution as TireResolution) ?? undefined,
    resolvedAt: (row.resolved_at as string) ?? undefined,
    photos: (row.photos as string[]) ?? [],
    createdAt: row.created_at as string,
  };
}

export async function getTireIncidents(driverId: string): Promise<TireIncident[]> {
  const { data, error } = await db
    .from('tire_incidents')
    .select('*')
    .eq('driver_id', driverId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapRow);
}

export async function createTireIncident(params: {
  driverId: string;
  loadNumber?: string;
  incidentDate: string;
  locationText: string;
  lat?: number;
  lng?: number;
  tirePosition: TirePosition;
  severity: TireSeverity;
  description?: string;
  resolution?: TireResolution;
  photos?: string[];
}): Promise<TireIncident> {
  const { data, error } = await db
    .from('tire_incidents')
    .insert({
      driver_id: params.driverId,
      load_number: params.loadNumber ?? null,
      incident_date: params.incidentDate,
      location_text: params.locationText,
      lat: params.lat ?? null,
      lng: params.lng ?? null,
      tire_position: params.tirePosition,
      severity: params.severity,
      description: params.description ?? null,
      resolution: params.resolution ?? null,
      photos: params.photos ?? [],
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return mapRow(data);
}

export async function updateTireIncident(
  id: string,
  updates: Partial<{
    resolution: TireResolution;
    resolvedAt: string;
    photos: string[];
    description: string;
  }>,
): Promise<void> {
  const row: Record<string, unknown> = {};
  if (updates.resolution !== undefined) row.resolution = updates.resolution;
  if (updates.resolvedAt !== undefined) row.resolved_at = updates.resolvedAt;
  if (updates.photos !== undefined) row.photos = updates.photos;
  if (updates.description !== undefined) row.description = updates.description;

  const { error } = await db.from('tire_incidents').update(row).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function uploadTirePhoto(file: File, driverId: string): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'jpg';
  const path = `${driverId}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from('tire-photos')
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from('tire-photos').getPublicUrl(path);
  return data.publicUrl;
}
