/**
 * Singleton realtime channel manager.
 * Prevents duplicate WebSocket subscriptions when multiple components
 * subscribe to the same logical channel.
 */
import { supabase } from '@/lib/supabase';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

type PostgresEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

interface ChannelConfig {
  table: string;
  event?: PostgresEvent;
  schema?: string;
  filter?: string;
}

interface ActiveChannel {
  channel: RealtimeChannel;
  refCount: number;
  callbacks: Set<(payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void>;
}

const activeChannels = new Map<string, ActiveChannel>();

function channelKey(config: ChannelConfig): string {
  return `${config.schema ?? 'public'}:${config.table}:${config.event ?? '*'}:${config.filter ?? ''}`;
}

/**
 * Subscribe to a Supabase Realtime channel.
 * Returns an unsubscribe function — call it in useEffect cleanup.
 */
export function realtimeSubscribe(
  config: ChannelConfig,
  callback: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void,
): () => void {
  const key = channelKey(config);
  const existing = activeChannels.get(key);

  if (existing) {
    existing.refCount++;
    existing.callbacks.add(callback);
    return () => realtimeUnsubscribe(key, callback);
  }

  const callbacks = new Set([callback]);
  const channel = supabase
    .channel(key)
    .on(
      'postgres_changes',
      {
        event: (config.event ?? '*') as PostgresEvent,
        schema: config.schema ?? 'public',
        table: config.table,
        ...(config.filter ? { filter: config.filter } : {}),
      },
      (payload) => {
        callbacks.forEach((cb) =>
          cb(payload as RealtimePostgresChangesPayload<Record<string, unknown>>),
        );
      },
    )
    .subscribe();

  activeChannels.set(key, { channel, refCount: 1, callbacks });
  return () => realtimeUnsubscribe(key, callback);
}

function realtimeUnsubscribe(
  key: string,
  callback: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void,
): void {
  const entry = activeChannels.get(key);
  if (!entry) return;

  entry.callbacks.delete(callback);
  entry.refCount--;

  if (entry.refCount <= 0) {
    supabase.removeChannel(entry.channel);
    activeChannels.delete(key);
  }
}
