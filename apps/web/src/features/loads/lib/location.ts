import { supabase } from '@/lib/supabase';

export interface LocationPing {
  load_number: string;
  driver_id: string;
  latitude: number;
  longitude: number;
  accuracy_m?: number;
  heading_deg?: number;
  speed_ms?: number;
}

/* ── Offline ping queue ─────────────────────────────────── */
const pendingQueue: LocationPing[] = [];
let flushing = false;

function pingToRow(ping: LocationPing) {
  return {
    load_number: ping.load_number,
    driver_id: ping.driver_id,
    latitude: ping.latitude,
    longitude: ping.longitude,
    accuracy_m: ping.accuracy_m ?? null,
    heading_deg: ping.heading_deg != null ? Math.round(ping.heading_deg) : null,
    speed_ms: ping.speed_ms ?? null,
  };
}

/**
 * Flush queued pings in batches of up to 50.
 * Uses Supabase bulk insert (single round-trip) to avoid
 * hammering the DB with 50 individual INSERTs after a dead zone.
 */
async function flushQueue() {
  if (flushing || pendingQueue.length === 0) return;
  flushing = true;

  while (pendingQueue.length > 0) {
    // Take up to 50 pings per batch
    const batchSize = Math.min(pendingQueue.length, 50);
    const batch = pendingQueue.slice(0, batchSize).map(pingToRow);

    const { error } = await supabase.from('location_pings').insert(batch);

    if (error) break; // still offline — stop retrying

    // Remove successfully inserted pings
    pendingQueue.splice(0, batchSize);
  }

  flushing = false;
}

// Flush queued pings whenever connectivity returns
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => void flushQueue());
}

/* ── Client-side rate limiting ──────────────────────────── */
const MIN_PING_INTERVAL_MS = 5_000; // 5 seconds minimum between pings per driver
const lastPingByDriver = new Map<string, number>();

/**
 * Write a single GPS ping to the location_pings table.
 * Rate-limited to 1 ping per 5 seconds per driver.
 * If the insert fails (e.g. offline), the ping is queued and retried
 * automatically when the browser fires the 'online' event.
 */
export async function insertLocationPing(ping: LocationPing) {
  // Enforce minimum interval per driver
  const lastTime = lastPingByDriver.get(ping.driver_id) ?? 0;
  const now = Date.now();
  if (now - lastTime < MIN_PING_INTERVAL_MS) {
    return null; // Rate limited — skip this ping
  }
  lastPingByDriver.set(ping.driver_id, now);

  const { data, error } = await supabase.from('location_pings').insert(pingToRow(ping));

  if (error) {
    console.warn('[location-ping] Insert failed, queuing for retry:', error.message);
    pendingQueue.push(ping);
    return null;
  }

  // Successful — also flush any older queued pings
  if (pendingQueue.length > 0) void flushQueue();

  return data;
}
