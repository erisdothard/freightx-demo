import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { insertLocationPing } from '../lib/location';
import { checkGeofences } from '../lib/geofence';
import { detectAnomalies } from '../lib/anomaly-detection';
import { getGeofencesForLoad, recordGeofenceEvent } from '@/services/geofence.service';
import { startDwell, endDwell, findOpenDwell } from '@/services/dwell-time.service';
import { supabase } from '@/lib/supabase';
import type { Geofence } from '@freightx/shared';

const PING_INTERVAL_MS = 30_000; // 30 seconds
const MOVEMENT_THRESHOLD_M = 50; // 50 metres
const HEARTBEAT_MS = 30_000; // backup heartbeat interval
const AUTO_STATUS_DWELL_MS = 180_000; // 3 minutes dwell before auto-status
const AUTO_ACCEPT_TIMEOUT_MS = 60_000; // 60s auto-accept for dispatcher confirmation

/** Haversine distance in metres between two lat/lng pairs. */
function distanceM(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6_371_000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface UseDriverLocationOptions {
  loadNumber: string;
  /** Hook only activates when this is true (i.e. load status === 'in_transit'). */
  active: boolean;
}

/**
 * Watches the driver's position using the Web Geolocation API.
 * Writes a ping to Supabase whenever:
 *   - 30 seconds have elapsed, OR
 *   - the driver has moved >=50 m since the last ping
 *
 * Resilience features:
 *   - Re-initialises watchPosition when the tab returns to the foreground
 *   - Backup heartbeat interval forces a getCurrentPosition every 30 s
 *     in case the browser throttled watchPosition while backgrounded
 *   - Failed pings are queued and retried automatically (see location.ts)
 *
 * Post-ping checks:
 *   - Geofence enter/exit -> alert dispatcher
 *   - Auto-status: after 3 min dwell in geofence, auto-update load status
 *     with dispatcher confirmation (60s auto-accept)
 *   - Anomaly detection -> alert dispatcher on suspicious movement
 *   - Dwell time -> start/end tracking at geofence boundaries
 */
export function useDriverLocation({ loadNumber, active }: UseDriverLocationOptions) {
  const { profile } = useAuth();
  const watchIdRef = useRef<number | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPingTimeRef = useRef<number>(0);
  const lastPingPosRef = useRef<{ lat: number; lng: number } | null>(null);
  const geofencesRef = useRef<Geofence[]>([]);
  const insideGeofencesRef = useRef<Set<string>>(new Set());
  const previousPingRef = useRef<{
    latitude: number;
    longitude: number;
    speed_ms?: number | null;
    recorded_at: string;
  } | null>(null);

  // Track dwell timers for auto-status per geofence
  const dwellTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  // Track which geofences have already had auto-status applied (prevent re-firing)
  const autoStatusAppliedRef = useRef<Set<string>>(new Set());
  // Notification debounce: prevents duplicate alerts when flushing queued pings
  const notificationDebounceRef = useRef<Map<string, number>>(new Map());

  // Load geofences when the hook activates
  useEffect(() => {
    if (active && loadNumber) {
      getGeofencesForLoad(loadNumber)
        .then((fences) => {
          geofencesRef.current = fences;
        })
        .catch(() => undefined);
    }
  }, [active, loadNumber]);

  // Cleanup dwell timers on unmount
  useEffect(() => {
    return () => {
      dwellTimersRef.current.forEach((timer) => clearTimeout(timer));
      dwellTimersRef.current.clear();
    };
  }, []);

  /**
   * Notify dispatcher via in-app notification (non-blocking).
   * Debounced: same notification type won't fire more than once per 60s
   * to prevent alert storms when flushing queued pings after a dead zone.
   */
  const notifyDispatcher = useCallback(
    async (type: string, title: string, body: string) => {
      if (!loadNumber) return;

      // Debounce: skip if same type fired within 60s
      const debounceKey = `${loadNumber}:${type}`;
      const lastFired = notificationDebounceRef.current.get(debounceKey) ?? 0;
      if (Date.now() - lastFired < 60_000) return;
      notificationDebounceRef.current.set(debounceKey, Date.now());

      // Find load poster to notify
      const { data: load } = await supabase
        .from('loads')
        .select('posted_by, id')
        .eq('load_number', loadNumber)
        .single();
      if (!load?.posted_by) return;
      await supabase
        .from('notifications')
        .insert({
          user_id: load.posted_by,
          type,
          title,
          body,
          load_id: load.id,
        })
        .then(undefined, () => undefined);
    },
    [loadNumber],
  );

  /** Apply auto-status update after dwell threshold. Sends dispatcher confirmation with auto-accept. */
  const applyAutoStatus = useCallback(
    async (fence: Geofence) => {
      if (autoStatusAppliedRef.current.has(fence.id)) return;
      autoStatusAppliedRef.current.add(fence.id);

      const targetStatus = fence.stopType === 'pickup' ? 'at_pickup' : 'at_delivery';
      const confirmationType = fence.stopType === 'pickup' ? 'arrival_pickup' : 'arrival_delivery';

      // Send dispatcher confirmation notification
      const { data: load } = await supabase
        .from('loads')
        .select('posted_by, id')
        .eq('load_number', loadNumber)
        .single();

      if (!load?.posted_by) return;

      // Notify dispatcher: "Confirm arrival?" — auto-accept in 60s
      await supabase
        .from('notifications')
        .insert({
          user_id: load.posted_by,
          type: confirmationType,
          title: `Confirm ${fence.stopType === 'pickup' ? 'Pickup' : 'Delivery'} Arrival?`,
          body: `Driver has been at ${fence.label} for 3+ minutes. Status will auto-update to "${targetStatus}" in 60 seconds. (Load ${loadNumber})`,
          load_id: load.id,
        })
        .then(undefined, () => undefined);

      // Auto-accept after 60s — update load status
      setTimeout(async () => {
        try {
          await supabase
            .from('loads')
            .update({ status: targetStatus })
            .eq('load_number', loadNumber);

          // Record auto-status on the geofence event
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any)
            .from('geofence_events')
            .update({
              dwell_seconds: Math.round(AUTO_STATUS_DWELL_MS / 1000),
              auto_status_applied: targetStatus,
            })
            .eq('geofence_id', fence.id)
            .eq('load_number', loadNumber)
            .eq('event_type', 'enter')
            .order('recorded_at', { ascending: false })
            .limit(1);

          notifyDispatcher(
            'load_status_change',
            'Auto-Status Applied',
            `Load ${loadNumber} status updated to "${targetStatus}" after 3-min dwell at ${fence.label}.`,
          ).catch(() => undefined);
        } catch {
          // Non-fatal
        }
      }, AUTO_ACCEPT_TIMEOUT_MS);
    },
    [loadNumber, notifyDispatcher],
  );

  /** Send a ping if the time/distance threshold is met. Pass `force` to skip threshold checks. */
  const sendPing = useCallback(
    async (pos: GeolocationPosition, force = false) => {
      if (!profile?.id) return;

      const { latitude, longitude, accuracy, heading, speed } = pos.coords;
      const now = Date.now();
      const last = lastPingPosRef.current;

      if (!force) {
        const movedEnough =
          !last || distanceM(last.lat, last.lng, latitude, longitude) >= MOVEMENT_THRESHOLD_M;
        const timeElapsed = now - lastPingTimeRef.current >= PING_INTERVAL_MS;
        if (!movedEnough && !timeElapsed) return;
      }

      lastPingTimeRef.current = now;
      lastPingPosRef.current = { lat: latitude, lng: longitude };

      await insertLocationPing({
        load_number: loadNumber,
        driver_id: profile.id,
        latitude,
        longitude,
        accuracy_m: accuracy != null ? Math.round(accuracy) : undefined,
        heading_deg: heading != null ? heading : undefined,
        speed_ms: speed != null ? speed : undefined,
      });

      const currentPing = {
        latitude,
        longitude,
        speed_ms: speed,
        recorded_at: new Date().toISOString(),
      };

      // ── Anomaly detection ──
      const anomalies = detectAnomalies(currentPing, previousPingRef.current);
      for (const anomaly of anomalies) {
        notifyDispatcher(
          'gps_anomaly',
          'GPS Anomaly Detected',
          `${anomaly.message} (Load ${loadNumber})`,
        ).catch(() => undefined);
      }
      previousPingRef.current = currentPing;

      // ── Geofence checks ──
      if (geofencesRef.current.length > 0) {
        const { entered, exited } = checkGeofences(
          latitude,
          longitude,
          geofencesRef.current,
          insideGeofencesRef.current,
        );

        for (const fence of entered) {
          insideGeofencesRef.current.add(fence.id);
          recordGeofenceEvent({
            geofenceId: fence.id,
            loadNumber,
            driverId: profile.id,
            eventType: 'enter',
            lat: latitude,
            lng: longitude,
          }).catch(() => undefined);

          // Notify dispatcher
          notifyDispatcher(
            'geofence_enter',
            'Driver Entered Zone',
            `Driver entered ${fence.stopType} zone "${fence.label}" (Load ${loadNumber})`,
          ).catch(() => undefined);

          // Start dwell tracking
          startDwell({
            loadNumber,
            geofenceId: fence.id,
            stopType: fence.stopType as 'pickup' | 'delivery',
            label: fence.label,
          }).catch(() => undefined);

          // Start auto-status dwell timer (3 min)
          if (!autoStatusAppliedRef.current.has(fence.id)) {
            const timer = setTimeout(() => {
              applyAutoStatus(fence).catch(() => undefined);
              dwellTimersRef.current.delete(fence.id);
            }, AUTO_STATUS_DWELL_MS);
            dwellTimersRef.current.set(fence.id, timer);
          }
        }

        for (const fence of exited) {
          insideGeofencesRef.current.delete(fence.id);
          recordGeofenceEvent({
            geofenceId: fence.id,
            loadNumber,
            driverId: profile.id,
            eventType: 'exit',
            lat: latitude,
            lng: longitude,
          }).catch(() => undefined);

          notifyDispatcher(
            'geofence_exit',
            'Driver Left Zone',
            `Driver left ${fence.stopType} zone "${fence.label}" (Load ${loadNumber})`,
          ).catch(() => undefined);

          // Cancel auto-status timer if driver leaves before dwell threshold
          const timer = dwellTimersRef.current.get(fence.id);
          if (timer) {
            clearTimeout(timer);
            dwellTimersRef.current.delete(fence.id);
          }

          // End dwell tracking — may auto-flag detention
          findOpenDwell(fence.id)
            .then(async (dwell) => {
              if (dwell) {
                const ended = await endDwell(dwell.id);
                if (ended.detentionFlagged) {
                  notifyDispatcher(
                    'detention_flagged',
                    'Detention Flagged',
                    `Driver spent ${ended.dwellMinutes}+ min at ${fence.label} — detention flagged (Load ${loadNumber})`,
                  ).catch(() => undefined);
                }
              }
            })
            .catch(() => undefined);
        }
      }
    },
    [loadNumber, profile?.id, notifyDispatcher, applyAutoStatus],
  );

  const handlePosition = useCallback((pos: GeolocationPosition) => void sendPing(pos), [sendPing]);

  /** Start (or restart) the geolocation watch + heartbeat. */
  const startWatch = useCallback(() => {
    if (!('geolocation' in navigator)) return;

    // Clear any existing watch
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }
    if (heartbeatRef.current != null) {
      clearInterval(heartbeatRef.current);
    }

    watchIdRef.current = navigator.geolocation.watchPosition(handlePosition, () => undefined, {
      enableHighAccuracy: true,
      maximumAge: 10_000,
    });

    // Backup heartbeat: force a one-shot position every 30 s.
    // Covers the case where the browser suspended watchPosition callbacks.
    heartbeatRef.current = setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        (pos) => void sendPing(pos),
        () => undefined,
        { enableHighAccuracy: true, maximumAge: 5_000 },
      );
    }, HEARTBEAT_MS);
  }, [handlePosition, sendPing]);

  const stopWatch = useCallback(() => {
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (heartbeatRef.current != null) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!active) return;

    startWatch();

    // When the tab comes back to the foreground, restart the watch and fire
    // an immediate ping so the tracker never looks stale for more than ~30 s.
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        startWatch();
        // Force an immediate ping so the viewer sees fresh data right away
        navigator.geolocation.getCurrentPosition(
          (pos) => void sendPing(pos, true),
          () => undefined,
          { enableHighAccuracy: true, maximumAge: 0 },
        );
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      stopWatch();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [active, startWatch, stopWatch, sendPing]);
}
