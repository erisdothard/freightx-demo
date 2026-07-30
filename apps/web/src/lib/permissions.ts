/**
 * Role-based permissions for FreightX
 *
 * Enforces enterprise-grade access control across GPS tracking,
 * fleet management, and load operations.
 */

import { supabase } from './supabase';

export type Role = 'driver' | 'carrier' | 'broker' | 'shipper' | 'admin';

export interface GpsPermissions {
  canSend: boolean;
  canView: boolean;
  scope: 'self' | 'company' | 'load' | 'all';
}

/**
 * GPS permissions by role
 *
 * - **driver**: Can send GPS, can't view others
 * - **carrier**: Can't send GPS, views all company drivers
 * - **broker**: Can't send GPS, views loads they booked
 * - **shipper**: Can't send GPS, views their loads only
 * - **owner-operator**: Can send + view (detected at runtime)
 */
export const GPS_PERMISSIONS: Record<Role, GpsPermissions> = {
  driver: {
    canSend: true,
    canView: false,
    scope: 'self',
  },
  carrier: {
    canSend: false,
    canView: true,
    scope: 'company',
  },
  broker: {
    canSend: false,
    canView: true,
    scope: 'load',
  },
  shipper: {
    canSend: false,
    canView: true,
    scope: 'load',
  },
  admin: {
    canSend: false,
    canView: true,
    scope: 'all',
  },
};

/**
 * Check if user is an owner-operator (carrier who also drives their own truck)
 *
 * Owner-operators get both send + view permissions.
 */
export async function isOwnerOperator(userId: string): Promise<boolean> {
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, company_id')
      .eq('id', userId)
      .single();

    if (!profile || (profile as any).role !== 'carrier' || !(profile as any).company_id) {
      return false;
    }

    // Check if this carrier also has loads where they're the assigned driver
    const { data: driverLoads } = await supabase
      .from('loads')
      .select('id')
      .eq('assigned_driver_id', userId)
      .limit(1);

    return (driverLoads?.length ?? 0) > 0;
  } catch {
    return false;
  }
}

/**
 * Check if user can send GPS pings
 *
 * @param role - User's role
 * @param userId - User's ID (to check owner-operator status)
 * @returns true if user can send GPS
 */
export async function canSendGps(role: Role, userId: string): Promise<boolean> {
  // Drivers can always send GPS
  if (role === 'driver') return true;

  // Check if carrier is also owner-operator
  if (role === 'carrier') {
    return await isOwnerOperator(userId);
  }

  // All other roles cannot send GPS
  return false;
}

/**
 * Check if user can view GPS data
 *
 * @param role - User's role
 * @returns true if user can view GPS
 */
export function canViewGps(role: Role): boolean {
  return GPS_PERMISSIONS[role]?.canView ?? false;
}

/**
 * Get GPS permission scope for a role
 *
 * @param role - User's role
 * @returns scope level (self, company, load, all)
 */
export function getGpsScope(role: Role): GpsPermissions['scope'] {
  return GPS_PERMISSIONS[role]?.scope ?? 'self';
}

/**
 * Check if user can access a specific load's GPS data
 *
 * @param userId - User's ID
 * @param loadNumber - Load number to check access for
 * @returns true if user has access to this load's GPS data
 */
export async function canAccessLoadGps(userId: string, loadNumber: string): Promise<boolean> {
  try {
    const { data: load } = await supabase
      .from('loads')
      .select('posted_by, accepted_by, assigned_driver_id')
      .eq('load_number', loadNumber)
      .single();

    if (!load) return false;

    const loadData = load as any;

    // User is poster, carrier, or driver
    if (
      loadData.posted_by === userId ||
      loadData.accepted_by === userId ||
      loadData.assigned_driver_id === userId
    ) {
      return true;
    }

    // Check if user is a bidder on this load
    const { data: bids } = await supabase
      .from('bids')
      .select('id')
      .eq('load_id', loadData.posted_by) // Need to join through loads table
      .eq('bidder_id', userId)
      .limit(1);

    return (bids?.length ?? 0) > 0;
  } catch {
    return false;
  }
}
