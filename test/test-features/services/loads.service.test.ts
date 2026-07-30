/**
 * loads.service — integration tests with mocked Supabase
 *
 * Verifies that the real service functions:
 *  - Return properly camelCase-mapped Load objects (via rowToLoad mapper)
 *  - Forward filters (equipment, status, search, postedBy) to the query builder
 *  - Throw (or return null) correctly on Supabase errors
 *  - createLoad() notifies carriers after a successful insert
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { getLoads, getLoadByNumber, createLoad, updateLoad } from '@/services/loads.service';
import { supabase } from '@/lib/supabase';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Creates a chainable Supabase query builder that resolves to `result`. */
function makeBuilder(result: unknown) {
  const self: Record<string, unknown> = {};
  for (const m of [
    'select',
    'insert',
    'update',
    'delete',
    'eq',
    'neq',
    'or',
    'order',
    'limit',
    'lt',
    'single',
    'maybeSingle',
    'range',
  ]) {
    self[m] = vi.fn().mockReturnValue(self);
  }
  // Make the builder itself awaitable (Supabase PostgREST pattern)
  self.then = (onfulfilled: (v: unknown) => unknown, onrejected: (v: unknown) => unknown) =>
    Promise.resolve(result).then(onfulfilled, onrejected);
  return self;
}

const RAW_LOAD = {
  id: 'load-1',
  load_number: 'FX-20260301-0001',
  posted_by: 'user-1',
  company_id: 'co-1',
  company_name: 'Acme Logistics',
  origin_city: 'Dallas',
  origin_state: 'TX',
  dest_city: 'Chicago',
  dest_state: 'IL',
  pickup_date: '2026-04-01',
  delivery_date: '2026-04-03',
  equipment: 'van',
  commodity: 'General Freight',
  weight_lbs: 42000,
  rate_usd: 2800,
  rate_per_mile: 2.1,
  total_miles: 1000,
  status: 'posted',
  bid_count: 0,
  hazmat: false,
  temp_controlled: false,
  posted_at: '2026-03-01T00:00:00Z',
  broker_credit_score: null,
  created_at: '2026-03-01T00:00:00Z',
};

/** Creates a thenable that resolves/rejects for supabase.rpc() */
function makeRpc(result: unknown) {
  return {
    then: (onfulfilled: (v: unknown) => unknown, onrejected: (v: unknown) => unknown) =>
      Promise.resolve(result).then(onfulfilled, onrejected),
  };
}

const mockFrom = vi.mocked(supabase.from);
const mockRpc = vi.mocked(supabase.rpc);

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// getLoads
// ---------------------------------------------------------------------------

describe('getLoads', () => {
  it('returns camelCase-mapped Load objects', async () => {
    mockFrom.mockReturnValue(makeBuilder({ data: [RAW_LOAD], error: null }) as never);
    const loads = await getLoads();
    expect(loads).toHaveLength(1);
    expect(loads[0].loadNumber).toBe('FX-20260301-0001');
    expect(loads[0].originCity).toBe('Dallas');
    expect(loads[0].destCity).toBe('Chicago');
    expect(loads[0].rateUsd).toBe(2800);
    expect(loads[0].weightLbs).toBe(42000);
  });

  it('returns an empty array when no loads exist', async () => {
    mockFrom.mockReturnValue(makeBuilder({ data: [], error: null }) as never);
    expect(await getLoads()).toEqual([]);
  });

  it('throws when Supabase returns an error', async () => {
    mockFrom.mockReturnValue(
      makeBuilder({ data: null, error: { message: 'connection refused' } }) as never,
    );
    await expect(getLoads()).rejects.toBeTruthy();
  });

  it('applies equipment filter via .eq()', async () => {
    const builder = makeBuilder({ data: [], error: null });
    mockFrom.mockReturnValue(builder as never);
    await getLoads({ equipment: 'reefer' });
    expect(builder.eq).toHaveBeenCalledWith('equipment', 'reefer');
  });

  it('applies status filter via .eq()', async () => {
    const builder = makeBuilder({ data: [], error: null });
    mockFrom.mockReturnValue(builder as never);
    await getLoads({ status: 'in_transit' });
    expect(builder.eq).toHaveBeenCalledWith('status', 'in_transit');
  });

  it('skips equipment filter when value is "all"', async () => {
    const builder = makeBuilder({ data: [], error: null });
    mockFrom.mockReturnValue(builder as never);
    await getLoads({ equipment: 'all' });
    expect(builder.eq).not.toHaveBeenCalledWith('equipment', 'all');
  });

  it('skips status filter when value is "all"', async () => {
    const builder = makeBuilder({ data: [], error: null });
    mockFrom.mockReturnValue(builder as never);
    await getLoads({ status: 'all' });
    expect(builder.eq).not.toHaveBeenCalledWith('status', 'all');
  });

  it('applies search filter via .or() with ilike patterns', async () => {
    const builder = makeBuilder({ data: [], error: null });
    mockFrom.mockReturnValue(builder as never);
    await getLoads({ search: 'Chicago' });
    expect(builder.or).toHaveBeenCalledWith(expect.stringContaining('ilike'));
    expect(builder.or).toHaveBeenCalledWith(expect.stringContaining('%Chicago%'));
  });

  it('applies postedBy filter via .eq()', async () => {
    const builder = makeBuilder({ data: [], error: null });
    mockFrom.mockReturnValue(builder as never);
    await getLoads({ postedBy: 'user-1' });
    expect(builder.eq).toHaveBeenCalledWith('posted_by', 'user-1');
  });
});

// ---------------------------------------------------------------------------
// getLoadByNumber
// ---------------------------------------------------------------------------

describe('getLoadByNumber', () => {
  it('returns a mapped Load when found', async () => {
    mockFrom.mockReturnValue(makeBuilder({ data: RAW_LOAD, error: null }) as never);
    const load = await getLoadByNumber('FX-20260301-0001');
    expect(load).not.toBeNull();
    expect(load!.loadNumber).toBe('FX-20260301-0001');
    expect(load!.companyName).toBe('Acme Logistics');
  });

  it('returns null when Supabase returns an error (not found)', async () => {
    mockFrom.mockReturnValue(makeBuilder({ data: null, error: { message: 'no rows' } }) as never);
    expect(await getLoadByNumber('FX-MISSING')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// updateLoad
// ---------------------------------------------------------------------------

describe('updateLoad', () => {
  it('returns a mapped Load after a successful update', async () => {
    const updated = { ...RAW_LOAD, status: 'in_transit' };
    mockFrom.mockReturnValue(makeBuilder({ data: updated, error: null }) as never);
    const load = await updateLoad('load-1', { status: 'in_transit' });
    expect(load.status).toBe('in_transit');
  });

  it('throws when the update fails', async () => {
    mockFrom.mockReturnValue(
      makeBuilder({ data: null, error: { message: 'update failed' } }) as never,
    );
    await expect(updateLoad('load-1', { status: 'cancelled' })).rejects.toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// createLoad
// ---------------------------------------------------------------------------

describe('createLoad', () => {
  it('returns a mapped Load after a successful insert', async () => {
    mockFrom.mockReturnValue(makeBuilder({ data: RAW_LOAD, error: null }) as never);
    mockRpc.mockReturnValue(makeRpc({ data: null, error: null }) as never);

    const { id: _, created_at: __, ...payload } = RAW_LOAD;
    const load = await createLoad(payload as never);
    expect(load.loadNumber).toBe('FX-20260301-0001');
    expect(load.companyName).toBe('Acme Logistics');
  });

  it('throws when the DB insert fails', async () => {
    mockFrom.mockReturnValue(
      makeBuilder({ data: null, error: { message: 'duplicate key' } }) as never,
    );
    const { id: _, created_at: __, ...payload } = RAW_LOAD;
    await expect(createLoad(payload as never)).rejects.toBeTruthy();
  });

  it('sends a notification for every carrier when load is created', async () => {
    mockFrom.mockReturnValue(makeBuilder({ data: RAW_LOAD, error: null }) as never);
    mockRpc.mockReturnValue(makeRpc({ data: null, error: null }) as never);

    const { id: _, created_at: __, ...payload } = RAW_LOAD;
    await createLoad(payload as never);

    expect(mockRpc).toHaveBeenCalledWith('notify_carriers_new_load', { p_load_id: 'load-1' });
  });

  it('delegates notification to notify_carriers_new_load RPC (server-side)', async () => {
    mockFrom.mockReturnValue(makeBuilder({ data: RAW_LOAD, error: null }) as never);
    mockRpc.mockReturnValue(makeRpc({ data: null, error: null }) as never);

    const { id: _, created_at: __, ...payload } = RAW_LOAD;
    await createLoad(payload as never);

    // Notification is handled server-side via RPC, not client-side insert
    expect(mockRpc).toHaveBeenCalledWith('notify_carriers_new_load', { p_load_id: 'load-1' });
  });
});
