import { describe, it, expect } from 'vitest';

// ─── Book-It-Now eligibility ──────────────────────────────────────────────────

interface Load {
  status: string;
  book_now_rate: number | null;
  posted_by: string;
}

function canBookNow(load: Load, carrierId: string): { allowed: boolean; reason?: string } {
  if (load.status !== 'posted')
    return { allowed: false, reason: 'Load is not available for booking' };
  if (!load.book_now_rate) return { allowed: false, reason: 'No Book-It-Now rate set' };
  if (load.posted_by === carrierId) return { allowed: false, reason: 'Cannot book your own load' };
  return { allowed: true };
}

describe('Book-It-Now eligibility', () => {
  const load: Load = { status: 'posted', book_now_rate: 2500, posted_by: 'broker-1' };

  it('allows booking when all conditions met', () => {
    expect(canBookNow(load, 'carrier-1').allowed).toBe(true);
  });

  it('blocks booking on non-posted load', () => {
    expect(canBookNow({ ...load, status: 'awarded' }, 'carrier-1').allowed).toBe(false);
  });

  it('blocks when no book-now rate', () => {
    expect(canBookNow({ ...load, book_now_rate: null }, 'carrier-1').allowed).toBe(false);
  });

  it('blocks carrier from booking their own load', () => {
    expect(canBookNow(load, 'broker-1').allowed).toBe(false);
  });
});

// ─── Rate confirmation PDF data validation ────────────────────────────────────

interface RateConData {
  load_number: string;
  origin: string;
  destination: string;
  pickup_date: string;
  rate_usd: number;
  carrier_name: string;
  broker_name: string;
}

function validateRateCon(data: Partial<RateConData>): string[] {
  const errors: string[] = [];
  if (!data.load_number) errors.push('Load number required');
  if (!data.origin) errors.push('Origin required');
  if (!data.destination) errors.push('Destination required');
  if (!data.pickup_date) errors.push('Pickup date required');
  if (!data.rate_usd || data.rate_usd <= 0) errors.push('Rate required');
  if (!data.carrier_name) errors.push('Carrier name required');
  if (!data.broker_name) errors.push('Broker name required');
  return errors;
}

describe('Rate confirmation data validation', () => {
  const valid: RateConData = {
    load_number: 'FX-20260219-0001',
    origin: 'Dallas, TX',
    destination: 'Chicago, IL',
    pickup_date: '2026-03-01',
    rate_usd: 2500,
    carrier_name: 'Speedy Freight LLC',
    broker_name: 'BrokerCo',
  };

  it('passes with complete data', () => expect(validateRateCon(valid)).toHaveLength(0));

  it('catches missing load number', () => {
    expect(validateRateCon({ ...valid, load_number: '' })).toContain('Load number required');
  });

  it('catches zero rate', () => {
    expect(validateRateCon({ ...valid, rate_usd: 0 })).toContain('Rate required');
  });

  it('returns multiple errors at once', () => {
    expect(validateRateCon({})).toHaveLength(7);
  });
});

// ─── Cancellation eligibility ─────────────────────────────────────────────────

type LoadStatus =
  | 'draft'
  | 'posted'
  | 'bid_received'
  | 'awarded'
  | 'dispatched'
  | 'in_transit'
  | 'delivered'
  | 'completed'
  | 'cancelled'
  | 'expired';

const CANCELLABLE_STATUSES: LoadStatus[] = ['draft', 'posted', 'bid_received', 'awarded'];

function canCancelLoad(status: LoadStatus, role: string): boolean {
  if (role !== 'broker' && role !== 'admin') return false;
  return CANCELLABLE_STATUSES.includes(status);
}

describe('Load cancellation eligibility', () => {
  it('broker can cancel a posted load', () => expect(canCancelLoad('posted', 'broker')).toBe(true));
  it('broker can cancel an awarded load', () =>
    expect(canCancelLoad('awarded', 'broker')).toBe(true));
  it('broker cannot cancel in-transit load', () =>
    expect(canCancelLoad('in_transit', 'broker')).toBe(false));
  it('broker cannot cancel completed load', () =>
    expect(canCancelLoad('completed', 'broker')).toBe(false));
  it('carrier cannot cancel at all', () => expect(canCancelLoad('posted', 'carrier')).toBe(false));
  it('admin can cancel posted load', () => expect(canCancelLoad('posted', 'admin')).toBe(true));
});
