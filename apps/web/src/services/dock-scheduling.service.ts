import { supabase } from '@/lib/supabase';

export interface Facility {
  id: string;
  company_id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  operating_hours: Record<string, { open: string; close: string }> | null;
  timezone: string;
  created_at: string;
}

export interface DockSlot {
  id: string;
  facility_id: string;
  slot_name: string;
  slot_type: string;
  equipment_types: string[] | null;
  slot_duration_minutes: number;
  active: boolean;
  created_at: string;
}

export interface DockAppointment {
  id: string;
  facility_id: string;
  dock_slot_id: string;
  load_id: string | null;
  appointment_type: string;
  carrier_company_id: string | null;
  scheduled_start: string;
  scheduled_end: string;
  dwell_minutes: number | null;
  status: string;
  notes: string | null;
  created_at: string;
}

export interface AvailableSlot {
  dock_slot_id: string;
  dock_name: string;
  start_time: string;
  end_time: string;
  slot_type: string;
}

export async function getFacilities(companyId: string): Promise<Facility[]> {
  const { data, error } = await supabase
    .from('facilities')
    .select('*')
    .eq('company_id', companyId)
    .order('name');
  if (error) throw new Error(error.message);
  return (data ?? []) as Facility[];
}

export async function createFacility(params: {
  companyId: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  timezone?: string;
}): Promise<Facility> {
  const { data, error } = await supabase
    .from('facilities')
    .insert({
      company_id: params.companyId,
      name: params.name,
      address: params.address,
      city: params.city,
      state: params.state,
      zip: params.zip,
      timezone: params.timezone ?? 'America/Chicago',
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Facility;
}

export async function getDockSlots(facilityId: string): Promise<DockSlot[]> {
  const { data, error } = await supabase
    .from('dock_slots')
    .select('*')
    .eq('facility_id', facilityId)
    .order('slot_name');
  if (error) throw new Error(error.message);
  return (data ?? []) as DockSlot[];
}

export async function createDockSlot(params: {
  facilityId: string;
  name: string;
  slotType?: string;
  durationMinutes?: number;
  equipmentTypes?: string[];
}): Promise<DockSlot> {
  const { data, error } = await supabase
    .from('dock_slots')
    .insert({
      facility_id: params.facilityId,
      slot_name: params.name,
      slot_type: params.slotType ?? 'both',
      slot_duration_minutes: params.durationMinutes ?? 60,
      equipment_types: params.equipmentTypes ?? null,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as DockSlot;
}

export async function getAvailableDockSlots(
  facilityId: string,
  date: string,
): Promise<AvailableSlot[]> {
  const { data, error } = await supabase.rpc('get_available_dock_slots', {
    p_facility_id: facilityId,
    p_date: date,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as AvailableSlot[];
}

export async function bookDockAppointment(params: {
  dockSlotId: string;
  carrierCompanyId: string;
  scheduledStart: string;
  scheduledEnd: string;
  loadId?: string;
  notes?: string;
}): Promise<DockAppointment> {
  const { data, error } = await supabase.rpc('book_dock_appointment', {
    p_dock_slot_id: params.dockSlotId,
    p_load_id: params.loadId ?? '',
    p_scheduled_start: params.scheduledStart,
    p_scheduled_end: params.scheduledEnd,
    p_appointment_type: 'inbound',
    p_notes: params.notes ?? '',
  });
  if (error) throw new Error(error.message);
  return data as unknown as DockAppointment;
}

export async function dockCheckIn(appointmentId: string): Promise<void> {
  const { error } = await supabase.rpc('dock_check_in', {
    p_appointment_id: appointmentId,
  });
  if (error) throw new Error(error.message);
}

export async function dockCheckOut(appointmentId: string): Promise<void> {
  const { error } = await supabase.rpc('dock_check_out', {
    p_appointment_id: appointmentId,
  });
  if (error) throw new Error(error.message);
}

export async function getAppointments(
  facilityId: string,
  date?: string,
): Promise<DockAppointment[]> {
  let query = supabase
    .from('dock_appointments')
    .select('*')
    .order('scheduled_start', { ascending: true });

  if (facilityId) {
    const { data: slots } = await supabase
      .from('dock_slots')
      .select('id')
      .eq('facility_id', facilityId);
    const slotIds = (slots ?? []).map((s: { id: string }) => s.id);
    if (slotIds.length === 0) return [];
    query = query.in('dock_slot_id', slotIds);
  }

  if (date) {
    query = query
      .gte('scheduled_start', `${date}T00:00:00Z`)
      .lt('scheduled_start', `${date}T23:59:59Z`);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as DockAppointment[];
}
