import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { realtimeSubscribe } from '@/lib/realtime-manager';
import { DEMO_LOADS, DEMO_BIDS } from '@/lib/demo-data';

/**
 * Returns the number of loads requiring action for the current user's role.
 * Used to drive the orange badge on the Loads nav icon.
 *
 * Broker  → bid_received loads they posted (bids awaiting review)
 * Carrier → awarded loads they have an accepted bid on (awaiting dispatch)
 * Driver  → dispatched loads assigned to them (upcoming pickup)
 * Others  → 0
 */
export function useLoadActionCounts(): number {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  const fetchCount = useCallback(async () => {
    if (!user?.id || !user?.role) return;

    if (user.id.startsWith('demo-')) {
      const role = user.id.split('-')[1];
      if (role === 'broker') setCount(DEMO_LOADS.filter((l) => l.status === 'bid_received').length);
      else if (role === 'carrier')
        setCount(DEMO_LOADS.filter((l) => l.status === 'awarded').length);
      else if (role === 'driver')
        setCount(
          DEMO_LOADS.filter(
            (l) => l.status === 'dispatched' && l.assignedDriverId?.startsWith('demo-driver'),
          ).length,
        );
      else setCount(0);
      void DEMO_BIDS; // suppress unused
      return;
    }

    try {
      if (user.role === 'broker') {
        const { count: c } = await supabase
          .from('loads')
          .select('*', { count: 'exact', head: true })
          .eq('posted_by', user.id)
          .eq('status', 'bid_received');
        setCount(c ?? 0);
      } else if (user.role === 'carrier') {
        // Find load IDs where this carrier has an accepted bid
        const { data: bids } = await supabase
          .from('bids')
          .select('load_id')
          .eq('carrier_id', user.id)
          .eq('status', 'accepted');
        const loadIds = (bids ?? []).map((b) => b.load_id);
        if (loadIds.length === 0) {
          setCount(0);
          return;
        }

        const { count: c } = await supabase
          .from('loads')
          .select('*', { count: 'exact', head: true })
          .in('id', loadIds)
          .eq('status', 'awarded');
        setCount(c ?? 0);
      } else if (user.role === 'driver') {
        const { count: c } = await supabase
          .from('loads')
          .select('*', { count: 'exact', head: true })
          .eq('assigned_driver_id', user.id)
          .eq('status', 'dispatched');
        setCount(c ?? 0);
      } else {
        setCount(0);
      }
    } catch {
      // non-fatal — badge just won't show
    }
  }, [user?.id, user?.role]);

  useEffect(() => {
    fetchCount();
  }, [fetchCount]);

  // Refresh on any load update (status changes)
  useEffect(() => {
    if (!user?.id) return;
    return realtimeSubscribe({ table: 'loads', event: 'UPDATE' }, fetchCount);
  }, [user?.id, fetchCount]);

  return count;
}
