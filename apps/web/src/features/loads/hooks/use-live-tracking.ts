import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export interface LivePing {
  latitude: number;
  longitude: number;
  heading_deg: number | null;
  speed_ms: number | null;
  accuracy_m: number | null;
  recorded_at: string;
}

/**
 * Subscribes to real-time location pings for the given load number.
 * Returns the most recent ping, or null if none have arrived yet.
 * Falls back gracefully if Realtime is unavailable.
 */
export function useLiveTracking(loadNumber: string | null | undefined) {
  const [latestPing, setLatestPing] = useState<LivePing | null>(null);

  useEffect(() => {
    if (!loadNumber) return;

    // Fetch the most recent existing ping first
    void supabase
      .from('location_pings')
      .select('latitude,longitude,heading_deg,speed_ms,accuracy_m,recorded_at')
      .eq('load_number', loadNumber)
      .order('recorded_at', { ascending: false })
      .limit(1)
      .single()
      .then(({ data }) => {
        if (data) setLatestPing(data as LivePing);
      });

    // Subscribe to new inserts
    const channel = supabase
      .channel(`location_pings:${loadNumber}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'location_pings',
          filter: `load_number=eq.${loadNumber}`,
        },
        (payload) => {
          const row = payload.new as LivePing;
          setLatestPing(row);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadNumber]);

  return latestPing;
}
