import { supabase } from '@/lib/supabase';

export type DutyStatus = 'off_duty' | 'sleeper_berth' | 'driving' | 'on_duty_not_driving';

export interface HosStatus {
  driver_id: string;
  current_status: DutyStatus;
  status_since: string;
  drive_hours_today: number;
  on_duty_hours_today: number;
  hours_until_break: number;
  weekly_hours: number;
  weekly_limit: number;
  cycle_type: string;
}

export interface DutyLogEntry {
  id: string;
  driver_id: string;
  status: DutyStatus;
  started_at: string;
  ended_at: string | null;
  duration_minutes: number | null;
  location_lat: number | null;
  location_lng: number | null;
  location_description: string | null;
  notes: string | null;
  created_at: string;
}

export interface HosViolation {
  id: string;
  driver_id: string;
  violation_type: string;
  violation_date: string;
  description: string | null;
  duty_log_id: string | null;
  severity: string;
  resolved: boolean;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
}

export interface HosDailySummary {
  id: string;
  driver_id: string;
  log_date: string;
  drive_hours: number;
  on_duty_hours: number;
  off_duty_hours: number;
  sleeper_hours: number;
}

export async function getDriverHosStatus(driverId: string): Promise<HosStatus | null> {
  const { data, error } = await supabase.rpc('get_driver_hos_status', {
    p_driver_id: driverId,
  });
  if (error) throw new Error(error.message);
  return (data as unknown as HosStatus) ?? null;
}

export async function logDutyTransition(params: {
  driverId: string;
  newStatus: DutyStatus;
  locationLat?: number;
  locationLng?: number;
  locationDescription?: string;
  odometer?: number;
  notes?: string;
}): Promise<void> {
  const { error } = await supabase.rpc('log_duty_transition', {
    p_driver_id: params.driverId,
    p_new_status: params.newStatus,
    p_location_lat: params.locationLat ?? null,
    p_location_lng: params.locationLng ?? null,
    p_location_description: params.locationDescription ?? null,
    p_odometer: params.odometer ?? null,
    p_notes: params.notes ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function getDutyLog(driverId: string, date?: string): Promise<DutyLogEntry[]> {
  let query = supabase
    .from('hos_duty_log')
    .select('*')
    .eq('driver_id', driverId)
    .order('started_at', { ascending: false })
    .limit(50);

  if (date) {
    query = query.gte('started_at', `${date}T00:00:00Z`).lt('started_at', `${date}T23:59:59Z`);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as DutyLogEntry[];
}

export async function getViolations(driverId: string): Promise<HosViolation[]> {
  const { data, error } = await supabase
    .from('hos_violations')
    .select('*')
    .eq('driver_id', driverId)
    .order('violation_date', { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data ?? []) as HosViolation[];
}

export async function acknowledgeViolation(violationId: string): Promise<void> {
  const { error } = await supabase
    .from('hos_violations')
    .update({ resolved: true, resolved_at: new Date().toISOString() })
    .eq('id', violationId);
  if (error) throw new Error(error.message);
}

export async function getDailySummaries(
  driverId: string,
  logDate?: string,
): Promise<HosDailySummary[]> {
  const { data, error } = await supabase.rpc('aggregate_hos_daily', {
    p_driver_id: driverId,
    p_log_date: logDate ?? new Date().toISOString().split('T')[0],
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as HosDailySummary[];
}
