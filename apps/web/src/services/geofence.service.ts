import { supabase } from '@/lib/supabase';
import type { Geofence } from '@freightx/shared';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export async function createGeofenceForLoad(params: {
  loadNumber: string;
  stopType: 'pickup' | 'delivery';
  label: string;
  lat: number;
  lng: number;
  radiusM?: number;
}): Promise<Geofence> {
  const { data, error } = await db
    .from('geofences')
    .insert({
      load_number: params.loadNumber,
      stop_type: params.stopType,
      label: params.label,
      lat: params.lat,
      lng: params.lng,
      radius_m: params.radiusM ?? 500,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return {
    id: data.id,
    loadNumber: data.load_number,
    stopType: data.stop_type,
    label: data.label,
    lat: data.lat,
    lng: data.lng,
    radiusM: data.radius_m,
  } as Geofence;
}

export async function getGeofencesForLoad(loadNumber: string): Promise<Geofence[]> {
  const { data, error } = await db.from('geofences').select('*').eq('load_number', loadNumber);
  if (error) return [];
  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: row.id,
    loadNumber: row.load_number,
    stopType: row.stop_type,
    label: row.label,
    lat: row.lat,
    lng: row.lng,
    radiusM: row.radius_m,
  })) as Geofence[];
}

export async function recordGeofenceEvent(params: {
  geofenceId: string;
  loadNumber: string;
  driverId: string;
  eventType: 'enter' | 'exit';
  lat: number;
  lng: number;
}): Promise<void> {
  await db.from('geofence_events').insert({
    geofence_id: params.geofenceId,
    load_number: params.loadNumber,
    driver_id: params.driverId,
    event_type: params.eventType,
    lat: params.lat,
    lng: params.lng,
  });
}
