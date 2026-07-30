/**
 * bids.service — integration tests with mocked Supabase
 *
 * Verifies that the real service functions:
 *  - Return BidRow objects from the database
 *  - submitBid() inserts the correct fields and calls the bid-count RPC
 *  - submitBid() does NOT throw if the bid-count RPC fails (non-critical)
 *  - acceptBid() / bookNow() call the correct RPCs
 *  - declineBid() updates status to 'declined'
 *  - All functions throw on hard Supabase errors
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';
import {
  getBidsForLoad,
  getMyBids,
  submitBid,
  acceptBid,
  declineBid,
  bookNow,
} from '@/services/bids.service';
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
    'single',
    'maybeSingle',
  ]) {
    self[m] = vi.fn().mockReturnValue(self);
  }
  self.then = (onfulfilled: (v: unknown) => unknown, onrejected: (v: unknown) => unknown) =>
    Promise.resolve(result).then(onfulfilled, onrejected);
  return self;
}

/** Creates a thenable that resolves/rejects for supabase.rpc() */
function makeRpc(result: unknown) {
  return {
    then: (onfulfilled: (v: unknown) => unknown, onrejected: (v: unknown) => unknown) =>
      Promise.resolve(result).then(onfulfilled, onrejected),
  };
}

const RAW_BID = {
  id: 'bid-1',
  load_id: 'load-1',
  carrier_id: 'carrier-1',
  company_id: 'co-1',
  company_name: 'Fast Freight LLC',
  amount_usd: 2600,
  notes: 'Can pick up early',
  status: 'pending',
  parent_bid_id: null,
  round: 1,
  expires_at: '2026-04-02T00:00:00Z',
  created_at: '2026-03-01T00:00:00Z',
  updated_at: '2026-03-01T00:00:00Z',
};

const mockFrom = vi.mocked(supabase.from);
const mockRpc = vi.mocked(supabase.rpc);

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// getBidsForLoad
// ---------------------------------------------------------------------------

describe('getBidsForLoad', () => {
  it('returns an array of BidRow objects', async () => {
    mockFrom.mockReturnValue(makeBuilder({ data: [RAW_BID], error: null }) as never);
    const bids = await getBidsForLoad('load-1');
    expect(bids).toHaveLength(1);
    expect(bids[0].id).toBe('bid-1');
    expect(bids[0].amount_usd).toBe(2600);
  });

  it('returns an empty array when no bids exist', async () => {
    mockFrom.mockReturnValue(makeBuilder({ data: [], error: null }) as never);
    expect(await getBidsForLoad('load-1')).toEqual([]);
  });

  it('throws when Supabase returns an error', async () => {
    mockFrom.mockReturnValue(
      makeBuilder({ data: null, error: { message: 'permission denied' } }) as never,
    );
    await expect(getBidsForLoad('load-1')).rejects.toThrow('permission denied');
  });
});

// ---------------------------------------------------------------------------
// getMyBids
// ---------------------------------------------------------------------------

describe('getMyBids', () => {
  it('returns bids for the given carrier', async () => {
    mockFrom.mockReturnValue(makeBuilder({ data: [RAW_BID], error: null }) as never);
    const bids = await getMyBids('carrier-1');
    expect(bids).toHaveLength(1);
    expect(bids[0].carrier_id).toBe('carrier-1');
  });

  it('returns empty array when carrier has no bids', async () => {
    mockFrom.mockReturnValue(makeBuilder({ data: [], error: null }) as never);
    expect(await getMyBids('carrier-1')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// submitBid
// ---------------------------------------------------------------------------

describe('submitBid', () => {
  it('returns the inserted BidRow', async () => {
    mockFrom.mockReturnValue(makeBuilder({ data: RAW_BID, error: null }) as never);
    mockRpc.mockReturnValue(makeRpc({ data: true, error: null }) as never);

    const bid = await submitBid({
      loadId: 'load-1',
      carrierId: 'carrier-1',
      companyId: 'co-1',
      companyName: 'Fast Freight LLC',
      amountUsd: 2600,
      notes: 'Can pick up early',
    });

    expect(bid.id).toBe('bid-1');
    expect(bid.amount_usd).toBe(2600);
  });

  it('calls increment_bid_count RPC with the correct load_id', async () => {
    mockFrom.mockReturnValue(makeBuilder({ data: RAW_BID, error: null }) as never);
    mockRpc.mockReturnValue(makeRpc({ data: true, error: null }) as never);

    await submitBid({
      loadId: 'load-1',
      carrierId: 'carrier-1',
      companyId: 'co-1',
      companyName: 'Fast Freight LLC',
      amountUsd: 2600,
    });

    expect(mockRpc).toHaveBeenCalledWith('increment_bid_count', { load_id: 'load-1' });
  });

  it('throws when the insert fails', async () => {
    mockRpc.mockReturnValue(makeRpc({ data: true, error: null }) as never);
    mockFrom.mockReturnValue(
      makeBuilder({ data: null, error: { message: 'load already booked' } }) as never,
    );

    await expect(
      submitBid({
        loadId: 'load-1',
        carrierId: 'carrier-1',
        companyId: 'co-1',
        companyName: 'Fast Freight LLC',
        amountUsd: 2600,
      }),
    ).rejects.toThrow('load already booked');
  });

  it('does NOT throw when increment_bid_count RPC fails (non-critical)', async () => {
    mockFrom.mockReturnValue(makeBuilder({ data: RAW_BID, error: null }) as never);
    // First RPC call is check_carrier_eligible (returns true), subsequent ones fail
    mockRpc
      .mockReturnValueOnce(makeRpc({ data: true, error: null }) as never)
      .mockReturnValue(makeRpc({ data: null, error: { message: 'rpc not found' } }) as never);

    await expect(
      submitBid({
        loadId: 'load-1',
        carrierId: 'carrier-1',
        companyId: 'co-1',
        companyName: 'Fast Freight LLC',
        amountUsd: 2600,
      }),
    ).resolves.not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// acceptBid
// ---------------------------------------------------------------------------

describe('acceptBid', () => {
  it('calls accept_bid RPC with the correct bid_id', async () => {
    mockRpc.mockReturnValue(makeRpc({ error: null }) as never);
    await acceptBid('bid-1');
    expect(mockRpc).toHaveBeenCalledWith('accept_bid', { bid_id: 'bid-1' });
  });

  it('throws when the RPC returns an error', async () => {
    mockRpc.mockReturnValue(makeRpc({ error: { message: 'bid already accepted' } }) as never);
    await expect(acceptBid('bid-1')).rejects.toThrow('bid already accepted');
  });
});

// ---------------------------------------------------------------------------
// declineBid
// ---------------------------------------------------------------------------

describe('declineBid', () => {
  it('updates the bid status to "declined"', async () => {
    const builder = makeBuilder({ error: null });
    mockFrom.mockReturnValue(builder as never);
    await declineBid('bid-1');
    expect(builder.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'declined' }));
    expect(builder.eq).toHaveBeenCalledWith('id', 'bid-1');
  });

  it('throws when the update fails', async () => {
    mockFrom.mockReturnValue(makeBuilder({ error: { message: 'row not found' } }) as never);
    await expect(declineBid('bid-1')).rejects.toThrow('row not found');
  });
});

// ---------------------------------------------------------------------------
// bookNow
// ---------------------------------------------------------------------------

describe('bookNow', () => {
  it('calls book_now RPC with the correct load id', async () => {
    // from('company_members') returns a membership, from('loads') returns load info
    mockFrom.mockReturnValue(makeBuilder({ data: { company_id: 'co-1' }, error: null }) as never);
    // check_carrier_eligible returns true, then book_now succeeds
    mockRpc.mockReturnValue(makeRpc({ data: true, error: null }) as never);
    await bookNow('load-1');
    expect(mockRpc).toHaveBeenCalledWith('book_now', { p_load_id: 'load-1' });
  });

  it('throws when the RPC returns an error', async () => {
    mockFrom.mockReturnValue(makeBuilder({ data: { company_id: 'co-1' }, error: null }) as never);
    // check_carrier_eligible returns true, then book_now fails
    mockRpc
      .mockReturnValueOnce(makeRpc({ data: true, error: null }) as never)
      .mockReturnValue(makeRpc({ error: { message: 'load not available' } }) as never);
    await expect(bookNow('load-1')).rejects.toThrow('load not available');
  });
});
