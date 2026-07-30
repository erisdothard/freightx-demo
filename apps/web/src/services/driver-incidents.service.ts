import { supabase } from '@/lib/supabase';

// driver_incidents table not yet in generated DB types — use untyped client
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export type IncidentType =
  | 'tire'
  | 'engine'
  | 'brake'
  | 'lights'
  | 'body_damage'
  | 'accident'
  | 'driver_illness'
  | 'cargo'
  | 'fuel'
  | 'other';

export type IncidentSeverity = 'minor' | 'moderate' | 'severe' | 'critical';

export interface DriverIncident {
  id: string;
  driverId: string;
  loadNumber?: string;
  incidentType: IncidentType;
  severity: IncidentSeverity;
  description?: string;
  locationText?: string;
  lat?: number;
  lng?: number;
  incidentDate: string;
  resolutionNotes?: string;
  resolvedAt?: string;
  photos: string[];
  createdAt: string;
}

function mapRow(row: Record<string, unknown>): DriverIncident {
  return {
    id: row.id as string,
    driverId: row.driver_id as string,
    loadNumber: (row.load_number as string) ?? undefined,
    incidentType: row.incident_type as IncidentType,
    severity: row.severity as IncidentSeverity,
    description: (row.description as string) ?? undefined,
    locationText: (row.location_text as string) ?? undefined,
    lat: (row.lat as number) ?? undefined,
    lng: (row.lng as number) ?? undefined,
    incidentDate: row.incident_date as string,
    resolutionNotes: (row.resolution_notes as string) ?? undefined,
    resolvedAt: (row.resolved_at as string) ?? undefined,
    photos: (row.photos as string[]) ?? [],
    createdAt: row.created_at as string,
  };
}

export async function getDriverIncidents(driverId: string): Promise<DriverIncident[]> {
  const { data, error } = await db
    .from('driver_incidents')
    .select('*')
    .eq('driver_id', driverId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapRow);
}

export async function createDriverIncident(params: {
  driverId: string;
  loadNumber?: string;
  incidentType: IncidentType;
  severity: IncidentSeverity;
  description?: string;
  locationText?: string;
  lat?: number;
  lng?: number;
  incidentDate: string;
  photos?: string[];
}): Promise<DriverIncident> {
  const { data, error } = await db
    .from('driver_incidents')
    .insert({
      driver_id: params.driverId,
      load_number: params.loadNumber ?? null,
      incident_type: params.incidentType,
      severity: params.severity,
      description: params.description ?? null,
      location_text: params.locationText ?? null,
      lat: params.lat ?? null,
      lng: params.lng ?? null,
      incident_date: params.incidentDate,
      photos: params.photos ?? [],
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return mapRow(data);
}

export async function uploadIncidentPhoto(file: File, driverId: string): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'jpg';
  const path = `${driverId}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from('incident-photos')
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) {
    // Fallback: try tire-photos bucket (already exists)
    const { error: fallbackErr } = await supabase.storage
      .from('tire-photos')
      .upload(`incidents/${path}`, file, { contentType: file.type, upsert: false });
    if (fallbackErr) throw new Error(fallbackErr.message);
    const { data } = supabase.storage.from('tire-photos').getPublicUrl(`incidents/${path}`);
    return data.publicUrl;
  }

  const { data } = supabase.storage.from('incident-photos').getPublicUrl(path);
  return data.publicUrl;
}
