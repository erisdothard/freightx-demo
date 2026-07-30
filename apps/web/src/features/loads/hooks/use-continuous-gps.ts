/**
 * Continuous GPS tracking hook for drivers
 *
 * Unlike useDriverLocation (which only tracks during in_transit),
 * this hook tracks GPS whenever driver is on-duty or driving,
 * enabling between-load tracking and deadhead optimization.
 *
 * Usage:
 *   const { dutyStatus, setDutyStatus, isTracking } = useContinuousGps();
 *
 *   // Driver goes on-duty → GPS starts automatically
 *   setDutyStatus('on_duty');
 *
 *   // Driver goes off-duty → GPS stops
 *   setDutyStatus('off_duty');
 */

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useDriverLocation } from './use-driver-location';
import { supabase } from '@/lib/supabase';

export type DutyStatus = 'on_duty' | 'off_duty' | 'sleeper' | 'driving';

interface UseContinuousGpsReturn {
  dutyStatus: DutyStatus;
  setDutyStatus: (status: DutyStatus) => Promise<void>;
  isTracking: boolean;
  lastLocationUpdate: Date | null;
}

/**
 * Continuous GPS tracking based on duty status
 */
export function useContinuousGps(): UseContinuousGpsReturn {
  const { user, profile } = useAuth();
  const [dutyStatus, setDutyStatusState] = useState<DutyStatus>('off_duty');
  const [lastLocationUpdate, setLastLocationUpdate] = useState<Date | null>(null);

  // GPS is active when on_duty or driving
  const shouldTrack = dutyStatus === 'on_duty' || dutyStatus === 'driving';

  // Activate GPS pinging
  // Note: loadNumber is null because we're tracking between loads
  // TODO: Add updateInterval option to useDriverLocation hook to support different
  // ping frequencies for driving vs on-duty (30s vs 60s)
  useDriverLocation({
    loadNumber: null as any, // Between-load tracking (no specific load)
    active: shouldTrack,
  });

  // Load current duty status from database on mount
  useEffect(() => {
    if (!user?.id) return;

    (async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('current_duty_status, last_location_update')
          .eq('id', user.id)
          .single();

        if (data) {
          setDutyStatusState((data.current_duty_status as DutyStatus) ?? 'off_duty');
          if (data.last_location_update) {
            setLastLocationUpdate(new Date(data.last_location_update));
          }
        }
      } catch (error) {
        console.error('[useContinuousGps] Failed to load duty status:', error);
      }
    })();
  }, [user?.id]);

  // Subscribe to duty status changes (in case driver changes status on another device)
  useEffect(() => {
    if (!user?.id) return;

    const subscription = supabase
      .channel(`duty-status:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.new.current_duty_status) {
            setDutyStatusState(payload.new.current_duty_status as DutyStatus);
          }
          if (payload.new.last_location_update) {
            setLastLocationUpdate(new Date(payload.new.last_location_update));
          }
        },
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user?.id]);

  /**
   * Set driver duty status (updates database and triggers GPS on/off)
   */
  async function setDutyStatus(status: DutyStatus): Promise<void> {
    if (!user?.id) {
      throw new Error('User not authenticated');
    }

    try {
      // Call RPC function to update duty status
      const { error } = await supabase.rpc('set_driver_duty_status', {
        p_driver_id: user.id,
        p_duty_status: status,
      });

      if (error) throw error;

      // Update local state
      setDutyStatusState(status);

      // If going on-duty or driving, update location immediately
      if (status === 'on_duty' || status === 'driving') {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            await supabase.rpc('update_driver_location', {
              p_driver_id: user.id,
              p_latitude: position.coords.latitude,
              p_longitude: position.coords.longitude,
            });
            setLastLocationUpdate(new Date());
          },
          (error) => console.error('[GPS] Failed to get current position:', error),
          { enableHighAccuracy: true },
        );
      }
    } catch (error) {
      console.error('[useContinuousGps] Failed to set duty status:', error);
      throw error;
    }
  }

  return {
    dutyStatus,
    setDutyStatus,
    isTracking: shouldTrack,
    lastLocationUpdate,
  };
}

/**
 * Hook for carriers to monitor their fleet's duty status
 */
export function useFleetDutyStatus(companyId?: string) {
  const [summary, setSummary] = useState<{
    on_duty: number;
    off_duty: number;
    sleeper: number;
    driving: number;
  }>({
    on_duty: 0,
    off_duty: 0,
    sleeper: 0,
    driving: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) return;

    async function fetchSummary() {
      try {
        const { data, error } = await supabase.rpc('get_fleet_availability_summary', {
          p_company_id: companyId!,
        });

        if (error) throw error;

        if (data) {
          const newSummary = {
            on_duty: 0,
            off_duty: 0,
            sleeper: 0,
            driving: 0,
          };

          for (const row of data as any) {
            newSummary[row.duty_status as DutyStatus] = Number(row.driver_count);
          }

          setSummary(newSummary);
        }
      } catch (error) {
        console.error('[useFleetDutyStatus] Failed to fetch summary:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchSummary();

    // Refresh every 60 seconds
    const interval = setInterval(fetchSummary, 60000);
    return () => clearInterval(interval);
  }, [companyId]);

  return { summary, loading };
}
