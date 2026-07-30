import { supabase } from '@/lib/supabase';
import { rowToLoad, rowToMilestone } from '@/lib/mappers';
import type { LoadRow, EquipmentType, LoadStatus } from '@/lib/database.types';
import type { Load, TrackingMilestone } from '@freightx/shared';
import { recordLaneRate } from './rate-intelligence.service';
import { notifyLoadStatusChange, notifyDriverAssigned } from './email-notifications.service';
import { LoadFiltersSchema, CreateLoadInputSchema } from '@/lib/schemas/loads.schema';
import {
  getAllLoads,
  getCarrierLoads,
  getDriverLoadsDemo,
  getBrokerLoads,
  getShipperLoads,
  DEMO_LOADS,
} from '@/lib/demo-data';

/** Returns true when the app is running in demo mode (no real Supabase calls). */
function isDemoUser(userId?: string): boolean {
  return !!userId?.startsWith('demo-');
}

export const PAGE_SIZE = 25;

export interface LoadFilters {
  equipment?: EquipmentType | 'all';
  status?: LoadStatus | 'all';
  search?: string;
  postedBy?: string;
  originState?: string;
  destState?: string;
  minRatePerMile?: number;
  postedAfter?: string; // ISO date string
  page?: number; // 0-indexed
}

export interface LoadsPage {
  loads: Load[];
  hasMore: boolean;
  total: number | null;
}

export async function getLoads(filters: LoadFilters = {}): Promise<Load[]> {
  if (isDemoUser(filters.postedBy)) {
    let loads = filters.postedBy?.includes('broker')
      ? getBrokerLoads()
      : filters.postedBy?.includes('shipper')
        ? getShipperLoads()
        : getAllLoads();
    if (filters.equipment && filters.equipment !== 'all')
      loads = loads.filter((l) => l.equipment === filters.equipment);
    if (filters.status && filters.status !== 'all')
      loads = loads.filter((l) => l.status === filters.status);
    if (filters.search) {
      const q = filters.search.toLowerCase();
      loads = loads.filter(
        (l) =>
          l.loadNumber.toLowerCase().includes(q) ||
          l.originCity.toLowerCase().includes(q) ||
          l.destCity.toLowerCase().includes(q) ||
          l.commodity.toLowerCase().includes(q),
      );
    }
    return loads;
  }
  LoadFiltersSchema.parse(filters);
  const page = filters.page ?? 0;
  const from = page * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from('loads')
    .select(
      '*, assignee_profile:assignee_id(full_name), company_logo_url:companies!loads_company_id_fkey(logo_url)',
      { count: 'estimated' },
    )
    .order('posted_at', { ascending: false })
    .range(from, to);

  if (filters.equipment && filters.equipment !== 'all') {
    query = query.eq('equipment', filters.equipment);
  }
  if (filters.status && filters.status !== 'all') {
    query = query.eq('status', filters.status);
  } else if (!filters.status || filters.status === 'all') {
    // By default, exclude canceled loads from load board
    query = query.neq('status', 'cancelled');
  }
  if (filters.postedBy) {
    query = query.eq('posted_by', filters.postedBy);
  }
  if (filters.originState) {
    query = query.eq('origin_state', filters.originState.toUpperCase());
  }
  if (filters.destState) {
    query = query.eq('dest_state', filters.destState.toUpperCase());
  }
  if (filters.minRatePerMile && filters.minRatePerMile > 0) {
    query = query.gte('rate_per_mile', filters.minRatePerMile);
  }
  if (filters.postedAfter) {
    query = query.gte('posted_at', filters.postedAfter);
  }
  if (filters.search) {
    // Use full-text search if search_vector column exists, otherwise fall back to ilike
    const s = `%${filters.search}%`;
    query = query.or(
      `load_number.ilike.${s},origin_city.ilike.${s},dest_city.ilike.${s},company_name.ilike.${s},commodity.ilike.${s}`,
    );
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(rowToLoad);
}

export async function getLoadsPage(filters: LoadFilters = {}): Promise<LoadsPage> {
  if (isDemoUser(filters.postedBy)) {
    const loads = await getLoads(filters);
    return { loads, hasMore: false, total: loads.length };
  }
  const page = filters.page ?? 0;
  const from = page * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from('loads')
    .select(
      '*, assignee_profile:assignee_id(full_name), company_logo_url:companies!loads_company_id_fkey(logo_url)',
      { count: 'exact' },
    )
    .order('posted_at', { ascending: false })
    .range(from, to);

  if (filters.equipment && filters.equipment !== 'all') {
    query = query.eq('equipment', filters.equipment);
  }
  if (filters.status && filters.status !== 'all') {
    query = query.eq('status', filters.status);
  } else if (!filters.status || filters.status === 'all') {
    // By default, exclude canceled loads from public load board
    query = query.neq('status', 'cancelled');
  }
  if (filters.postedBy) {
    query = query.eq('posted_by', filters.postedBy);
  }
  if (filters.originState) {
    query = query.eq('origin_state', filters.originState.toUpperCase());
  }
  if (filters.destState) {
    query = query.eq('dest_state', filters.destState.toUpperCase());
  }
  if (filters.minRatePerMile && filters.minRatePerMile > 0) {
    query = query.gte('rate_per_mile', filters.minRatePerMile);
  }
  if (filters.postedAfter) {
    query = query.gte('posted_at', filters.postedAfter);
  }
  if (filters.search) {
    const s = `%${filters.search}%`;
    query = query.or(
      `load_number.ilike.${s},origin_city.ilike.${s},dest_city.ilike.${s},company_name.ilike.${s},commodity.ilike.${s}`,
    );
  }

  const { data, error, count } = await query;
  if (error) throw error;

  const loads = (data ?? []).map(rowToLoad);
  return {
    loads,
    hasMore: count != null ? from + loads.length < count : loads.length === PAGE_SIZE,
    total: count,
  };
}

export async function getLoadByNumber(loadNumber: string): Promise<Load | null> {
  const { data, error } = await supabase
    .from('loads')
    .select('*, driver_profile:assigned_driver_id(full_name)')
    .eq('load_number', loadNumber)
    .single();
  if (error) return null;
  return rowToLoad(data);
}

export async function getLoadById(id: string): Promise<Load | null> {
  if (id.startsWith('load-')) return DEMO_LOADS.find((l) => l.id === id) ?? null;
  const { data, error } = await supabase.from('loads').select('*').eq('id', id).single();
  if (error) return null;
  return rowToLoad(data);
}

export async function createLoad(
  load: Omit<
    LoadRow,
    | 'id'
    | 'created_at'
    | 'search_vector'
    | 'deleted_at'
    | 'visibility'
    | 'hazmat_proper_shipping_name'
    | 'hazmat_class'
    | 'hazmat_un_number'
    | 'hazmat_packing_group'
    | 'hazmat_quantity'
    | 'hazmat_emergency_phone'
    | 'hazmat_placard_required'
    | 'hazmat_reportable_quantity'
  >,
): Promise<Load> {
  CreateLoadInputSchema.parse(load);
  const { data, error } = await supabase.from('loads').insert(load).select().single();
  if (error) throw error;

  // Notify carriers of new load
  await notifyCarriersOfNewLoad(data);

  return rowToLoad(data);
}

/**
 * Notify all carriers when a new load is posted
 */
async function notifyCarriersOfNewLoad(load: LoadRow) {
  await supabase.rpc('notify_carriers_new_load', { p_load_id: load.id });
}

export async function updateLoad(id: string, updates: Partial<LoadRow>): Promise<Load> {
  // Snapshot before for audit diff
  const { data: before } = await supabase.from('loads').select('*').eq('id', id).single();

  const { data, error } = await supabase
    .from('loads')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;

  // Email on status change — get poster email
  if (updates.status && before?.status !== updates.status && data.posted_by) {
    const { data: poster } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', data.posted_by)
      .single();

    if (poster?.email) {
      notifyLoadStatusChange({
        email: poster.email,
        loadNumber: data.load_number,
        origin: `${data.origin_city}, ${data.origin_state}`,
        dest: `${data.dest_city}, ${data.dest_state}`,
        status: updates.status,
      }).then(
        () => undefined,
        () => undefined,
      );
    }

    supabase
      .from('notifications')
      .insert({
        user_id: data.posted_by,
        type: 'load_status_change',
        title: `Load ${data.load_number} — ${updates.status.replace(/_/g, ' ')}`,
        body: `Load ${data.load_number} (${data.origin_city} → ${data.dest_city}) is now ${updates.status.replace(/_/g, ' ')}.`,
        load_id: data.id,
      })
      .then(
        () => undefined,
        () => undefined,
      );
  }

  return rowToLoad(data);
}

/**
 * Record rate history snapshot when a load is booked/awarded.
 * Call this after acceptBid or bookNow succeeds.
 */
export async function recordBookingRateHistory(loadId: string): Promise<void> {
  const { data: load } = await supabase.from('loads').select('*').eq('id', loadId).single();
  if (!load?.rate_usd || !load?.origin_state || !load?.dest_state) return;

  await recordLaneRate({
    originState: load.origin_state,
    destState: load.dest_state,
    equipment: load.equipment,
    rateUsd: load.rate_usd,
    totalMiles: load.total_miles,
    loadId: load.id,
  });
}

/**
 * Get loads where this carrier has an accepted bid OR where carrier's company owns the load.
 */
export async function getMyActiveLoads(carrierId: string): Promise<Load[]> {
  if (isDemoUser(carrierId)) return getCarrierLoads();
  // 1. Get carrier's company via company_members join
  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', carrierId)
    .single();

  // 2. Find all accepted bids for this carrier
  const { data: bids, error: bidErr } = await supabase
    .from('bids')
    .select('load_id')
    .eq('carrier_id', carrierId)
    .eq('status', 'accepted');
  if (bidErr) throw bidErr;

  const bidLoadIds = (bids ?? []).map((b) => b.load_id);

  // 3. Build query for loads from two sources:
  //    - Loads where carrier has accepted bid
  //    - Loads where carrier's company owns the load and status is active
  let query = supabase
    .from('loads')
    .select(
      '*, driver_profile:assigned_driver_id(full_name), company_logo_url:companies!loads_company_id_fkey(logo_url)',
    );

  if (bidLoadIds.length > 0 && membership?.company_id) {
    query = query.or(
      `id.in.(${bidLoadIds.join(',')}),and(company_id.eq.${membership.company_id},status.in.(awarded,dispatched,in_transit,delivered,completed,cancelled,expired))`,
    );
  } else if (bidLoadIds.length > 0) {
    query = query.in('id', bidLoadIds);
  } else if (membership?.company_id) {
    query = query
      .eq('company_id', membership.company_id)
      .in('status', [
        'awarded',
        'dispatched',
        'in_transit',
        'delivered',
        'completed',
        'cancelled',
        'expired',
      ]);
  } else {
    return [];
  }

  // Exclude pre-award and terminal statuses — carrier only sees loads they're working
  query = query.not(
    'status',
    'in',
    '("posted","bid_received","cancelled","tonu","rejected","draft")',
  );

  const { data, error } = await query.order('pickup_date', { ascending: true });
  if (error) throw error;

  // 4. Deduplicate by load ID (in case a load appears in both queries)
  const uniqueLoads = new Map<string, LoadRow>();
  (data ?? []).forEach((load) => {
    if (!uniqueLoads.has(load.id)) {
      uniqueLoads.set(load.id, load);
    }
  });

  return Array.from(uniqueLoads.values()).map(rowToLoad);
}

/**
 * Assign a driver to a load.
 */
export async function assignDriver(loadId: string, driverId: string): Promise<Load> {
  const { data, error } = await supabase
    .from('loads')
    .update({ assigned_driver_id: driverId })
    .eq('id', loadId)
    .select()
    .single();
  if (error) {
    if (error.code === 'PGRST116') {
      throw new Error(
        'Unable to assign driver — you may not have permission to update this load. Ensure you have an accepted bid on this load.',
      );
    }
    throw error;
  }

  // In-app notification to driver
  await supabase.rpc('send_notification', {
    p_user_id: driverId,
    p_type: 'load_assigned',
    p_title: 'New Load Assigned',
    p_body: `You have been assigned load ${data.load_number}: ${data.origin_city}, ${data.origin_state} → ${data.dest_city}, ${data.dest_state}`,
    p_load_id: data.id,
  });

  // Email driver (non-fatal)
  const { data: driverProfile } = await supabase
    .from('profiles')
    .select('email')
    .eq('id', driverId)
    .single();
  if (driverProfile?.email) {
    notifyDriverAssigned({
      driverEmail: driverProfile.email,
      loadNumber: data.load_number,
      origin: `${data.origin_city}, ${data.origin_state}`,
      dest: `${data.dest_city}, ${data.dest_state}`,
      pickupDate: data.pickup_date ?? '',
    }).then(
      () => undefined,
      () => undefined,
    );
  }

  return rowToLoad(data);
}

/**
 * Assign a co-driver (second driver) to a load.
 */
export async function assignCoDriver(loadId: string, driverId: string | null): Promise<Load> {
  const { data, error } = await supabase
    .from('loads')
    .update({ second_driver_id: driverId })
    .eq('id', loadId)
    .select()
    .single();
  if (error) throw error;

  if (driverId) {
    await supabase.rpc('send_notification', {
      p_user_id: driverId,
      p_type: 'load_assigned',
      p_title: 'Co-Driver Assignment',
      p_body: `You have been assigned as co-driver on load ${data.load_number}: ${data.origin_city}, ${data.origin_state} → ${data.dest_city}, ${data.dest_state}`,
      p_load_id: data.id,
    });
  }

  return rowToLoad(data);
}

/**
 * Get loads assigned to a specific driver (primary or co-driver).
 */
export async function getDriverLoads(driverId: string, status?: string): Promise<Load[]> {
  if (isDemoUser(driverId)) {
    let loads = getDriverLoadsDemo();
    if (status) loads = loads.filter((l) => l.status === status);
    return loads;
  }
  let query = supabase
    .from('loads')
    .select('*, company_logo_url:companies!loads_company_id_fkey(logo_url)')
    .or(`assigned_driver_id.eq.${driverId},second_driver_id.eq.${driverId}`)
    .order('pickup_date', { ascending: true });

  // Drivers never have a view of pre-dispatch statuses — always exclude them
  query = query.not('status', 'in', '("posted","bid_received","awarded","draft")');

  if (status && status !== 'all') {
    query = query.eq('status', status as LoadStatus);
  } else if (!status) {
    // Hide cancelled/rejected but keep completed so drivers see their delivery history
    query = query.not('status', 'in', '("cancelled","tonu","rejected")');
  }
  // status === 'all' → no additional filter beyond the pre-dispatch exclusion above

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(rowToLoad);
}

/**
 * Get company drivers (profiles that are company_members with role 'driver' or profiles with role 'driver' in the same company).
 */
export async function getCompanyDrivers(
  companyId: string,
): Promise<Array<{ id: string; fullName: string; email: string }>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('company_members')
    .select('user_id, profiles!company_members_user_id_fkey(id, full_name, email, role)')
    .eq('company_id', companyId);

  if (error) throw error;

  interface MemberRow {
    profiles?: { id: string; full_name?: string; email: string; role: string };
  }

  return ((data ?? []) as MemberRow[])
    .filter(
      (m): m is MemberRow & { profiles: NonNullable<MemberRow['profiles']> } =>
        m.profiles?.role === 'driver',
    )
    .map((m) => ({
      id: m.profiles.id,
      fullName: m.profiles.full_name ?? m.profiles.email,
      email: m.profiles.email,
    }));
}

export async function nudgeCarrier(
  loadId: string,
  carrierId: string,
  loadNumber: string,
): Promise<void> {
  const { error } = await supabase.rpc('send_notification', {
    p_user_id: carrierId,
    p_type: 'load_reminder',
    p_title: 'Load Awaiting Dispatch',
    p_body: `Load ${loadNumber} has been awarded and is waiting for you to sign the rate confirmation and dispatch.`,
    p_load_id: loadId,
  });
  if (error) throw error;
}

export async function confirmReceipt(
  loadId: string,
  brokerId: string,
  loadNumber: string,
): Promise<void> {
  const { error } = await supabase.rpc('send_notification', {
    p_user_id: brokerId,
    p_type: 'receipt_confirmed',
    p_title: 'Delivery Confirmed by Shipper',
    p_body: `Shipper has confirmed receipt of Load ${loadNumber}. Ready to close out.`,
    p_load_id: loadId,
  });
  if (error) throw error;
}

export async function getTrackingMilestones(loadNumber: string): Promise<TrackingMilestone[]> {
  const { data, error } = await supabase
    .from('tracking_milestones')
    .select('*')
    .eq('load_number', loadNumber)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(rowToMilestone);
}
