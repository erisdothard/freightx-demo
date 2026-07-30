import { describe, it, expect } from 'vitest';

// ─── Realtime event deduplication ────────────────────────────────────────────

interface RealtimeEvent {
  id: string;
  table: string;
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: Record<string, unknown>;
}

function deduplicateEvents(events: RealtimeEvent[]): RealtimeEvent[] {
  const seen = new Set<string>();
  return events.filter((e) => {
    const key = `${e.table}-${e.id}-${e.eventType}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

describe('Realtime event deduplication', () => {
  it('removes duplicate events for same row', () => {
    const events: RealtimeEvent[] = [
      { id: '1', table: 'loads', eventType: 'UPDATE', new: { status: 'posted' } },
      { id: '1', table: 'loads', eventType: 'UPDATE', new: { status: 'posted' } },
    ];
    expect(deduplicateEvents(events)).toHaveLength(1);
  });

  it('keeps events for different rows', () => {
    const events: RealtimeEvent[] = [
      { id: '1', table: 'loads', eventType: 'UPDATE', new: {} },
      { id: '2', table: 'loads', eventType: 'UPDATE', new: {} },
    ];
    expect(deduplicateEvents(events)).toHaveLength(2);
  });

  it('keeps INSERT and UPDATE for same row as distinct', () => {
    const events: RealtimeEvent[] = [
      { id: '1', table: 'loads', eventType: 'INSERT', new: {} },
      { id: '1', table: 'loads', eventType: 'UPDATE', new: {} },
    ];
    expect(deduplicateEvents(events)).toHaveLength(2);
  });

  it('handles empty event list', () => {
    expect(deduplicateEvents([])).toHaveLength(0);
  });
});

// ─── Optimistic update merge ──────────────────────────────────────────────────

interface LoadRow {
  id: string;
  status: string;
  bid_count: number;
}

function mergeRealtimeUpdate(
  current: LoadRow[],
  update: Partial<LoadRow> & { id: string },
): LoadRow[] {
  return current.map((l) => (l.id === update.id ? { ...l, ...update } : l));
}

describe('Realtime optimistic update merge', () => {
  const loads: LoadRow[] = [
    { id: 'a', status: 'posted', bid_count: 0 },
    { id: 'b', status: 'posted', bid_count: 2 },
  ];

  it('updates the correct row', () => {
    const result = mergeRealtimeUpdate(loads, { id: 'a', status: 'bid_received', bid_count: 1 });
    expect(result.find((l) => l.id === 'a')?.status).toBe('bid_received');
  });

  it('leaves other rows unchanged', () => {
    const result = mergeRealtimeUpdate(loads, { id: 'a', status: 'bid_received', bid_count: 1 });
    expect(result.find((l) => l.id === 'b')?.bid_count).toBe(2);
  });

  it('no-ops when id not found', () => {
    const result = mergeRealtimeUpdate(loads, { id: 'z', status: 'cancelled', bid_count: 0 });
    expect(result).toEqual(loads);
  });
});
