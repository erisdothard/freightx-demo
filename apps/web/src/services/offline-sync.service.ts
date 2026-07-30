import { supabase } from '@/lib/supabase';

export interface SyncQueueItem {
  id: string;
  table_name: string;
  operation: 'insert' | 'update' | 'delete';
  payload: Record<string, unknown>;
  status: 'pending' | 'syncing' | 'synced' | 'failed';
  error_message: string | null;
  created_at: string;
  synced_at: string | null;
}

const QUEUE_KEY = 'fx-offline-queue';

function getQueue(): SyncQueueItem[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]') as SyncQueueItem[];
  } catch {
    return [];
  }
}

function saveQueue(queue: SyncQueueItem[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function queueOfflineAction(
  tableName: string,
  operation: 'insert' | 'update' | 'delete',
  payload: Record<string, unknown>,
): SyncQueueItem {
  const item: SyncQueueItem = {
    id: crypto.randomUUID(),
    table_name: tableName,
    operation,
    payload,
    status: 'pending',
    error_message: null,
    created_at: new Date().toISOString(),
    synced_at: null,
  };
  const queue = getQueue();
  queue.push(item);
  saveQueue(queue);
  return item;
}

export async function processQueue(): Promise<{ synced: number; failed: number }> {
  const queue = getQueue();
  let synced = 0;
  let failed = 0;

  for (const item of queue) {
    if (item.status !== 'pending') continue;

    item.status = 'syncing';
    saveQueue(queue);

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const table = supabase.from(item.table_name as any);
      if (item.operation === 'insert') {
        const { error } = await table.insert(item.payload as any);
        if (error) throw error;
      } else if (item.operation === 'update') {
        const { id, ...rest } = item.payload;
        const { error } = await table.update(rest as any).eq('id', id as string);
        if (error) throw error;
      } else if (item.operation === 'delete') {
        const { error } = await table.delete().eq('id', item.payload.id as string);
        if (error) throw error;
      }
      item.status = 'synced';
      item.synced_at = new Date().toISOString();
      synced++;
    } catch (e) {
      item.status = 'failed';
      item.error_message = e instanceof Error ? e.message : 'Sync failed';
      failed++;
    }
  }

  // Remove synced items, keep failed for retry
  saveQueue(queue.filter((q) => q.status !== 'synced'));

  return { synced, failed };
}

export function getPendingCount(): number {
  return getQueue().filter((q) => q.status === 'pending').length;
}

export function getSyncStatus(): { pending: number; failed: number; total: number } {
  const queue = getQueue();
  return {
    pending: queue.filter((q) => q.status === 'pending').length,
    failed: queue.filter((q) => q.status === 'failed').length,
    total: queue.length,
  };
}

export function clearFailedItems(): void {
  saveQueue(getQueue().filter((q) => q.status !== 'failed'));
}
