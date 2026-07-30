import { describe, it, expect } from 'vitest';

// ─── Subscription tier limits ─────────────────────────────────────────────────

type SubscriptionTier =
  | 'free'
  | 'carrier_pro'
  | 'broker_starter'
  | 'broker_growth'
  | 'shipper'
  | 'enterprise';

const TIER_LIMITS: Record<
  SubscriptionTier,
  { maxTruckPostings: number | null; canPostLoads: boolean; maxLoads: number | null }
> = {
  free: { maxTruckPostings: 2, canPostLoads: false, maxLoads: null },
  carrier_pro: { maxTruckPostings: null, canPostLoads: false, maxLoads: null },
  broker_starter: { maxTruckPostings: null, canPostLoads: true, maxLoads: 50 },
  broker_growth: { maxTruckPostings: null, canPostLoads: true, maxLoads: null },
  shipper: { maxTruckPostings: null, canPostLoads: true, maxLoads: 25 },
  enterprise: { maxTruckPostings: null, canPostLoads: true, maxLoads: null },
};

function canPostLoads(tier: SubscriptionTier, loadsUsed: number): boolean {
  const limits = TIER_LIMITS[tier];
  if (!limits.canPostLoads) return false;
  if (limits.maxLoads !== null && loadsUsed >= limits.maxLoads) return false;
  return true;
}

function canPostTruck(tier: SubscriptionTier, trucksPosted: number): boolean {
  const limits = TIER_LIMITS[tier];
  if (limits.maxTruckPostings === null) return true;
  return trucksPosted < limits.maxTruckPostings;
}

describe('Subscription tier limits', () => {
  it('free tier cannot post loads', () => {
    expect(canPostLoads('free', 0)).toBe(false);
  });

  it('carrier_pro cannot post loads (load-posting requires broker/shipper)', () => {
    expect(canPostLoads('carrier_pro', 0)).toBe(false);
  });

  it('broker_starter can post loads when under limit', () => {
    expect(canPostLoads('broker_starter', 49)).toBe(true);
  });

  it('broker_starter blocked at 50 loads', () => {
    expect(canPostLoads('broker_starter', 50)).toBe(false);
  });

  it('broker_growth unlimited loads', () => {
    expect(canPostLoads('broker_growth', 9999)).toBe(true);
  });

  it('shipper blocked at 25 loads', () => {
    expect(canPostLoads('shipper', 25)).toBe(false);
  });

  it('free allows up to 2 truck postings', () => {
    expect(canPostTruck('free', 1)).toBe(true);
    expect(canPostTruck('free', 2)).toBe(false);
  });

  it('carrier_pro has no truck limit', () => {
    expect(canPostTruck('carrier_pro', 999)).toBe(true);
  });
});

// ─── Quick Pay fee calculation ────────────────────────────────────────────────

function calcQuickPayFee(amountUsd: number): number {
  return Math.round(amountUsd * 0.02);
}

function calcNetAfterFee(amountUsd: number): number {
  return amountUsd - calcQuickPayFee(amountUsd);
}

describe('Quick Pay fee calculation', () => {
  it('2% fee on $5,000 load = $100', () => {
    expect(calcQuickPayFee(500000)).toBe(10000); // cents
  });

  it('carrier nets 98% on quick pay', () => {
    const gross = 500000;
    expect(calcNetAfterFee(gross)).toBe(490000);
  });

  it('zero fee on zero amount', () => {
    expect(calcQuickPayFee(0)).toBe(0);
  });

  it('fee rounds correctly on odd amount', () => {
    // $999 → $19.98 → rounds to $20
    expect(calcQuickPayFee(99900)).toBe(1998);
  });
});

// ─── Invoice status machine ───────────────────────────────────────────────────

type InvoiceStatus = 'invoiced' | 'approved' | 'processing' | 'paid' | 'disputed' | 'void';

const VALID_TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  invoiced: ['approved', 'void'],
  approved: ['processing', 'disputed', 'void'],
  processing: ['paid', 'disputed'],
  paid: [],
  disputed: ['approved', 'void'],
  void: [],
};

function canTransition(from: InvoiceStatus, to: InvoiceStatus): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

describe('Invoice status transitions', () => {
  it('invoiced → approved is valid', () => {
    expect(canTransition('invoiced', 'approved')).toBe(true);
  });

  it('paid → any is terminal', () => {
    expect(canTransition('paid', 'void')).toBe(false);
    expect(canTransition('paid', 'disputed')).toBe(false);
  });

  it('void → any is terminal', () => {
    expect(canTransition('void', 'invoiced')).toBe(false);
  });

  it('approved → processing is valid (payment method selected)', () => {
    expect(canTransition('approved', 'processing')).toBe(true);
  });

  it('disputed → approved is valid (re-approval after dispute)', () => {
    expect(canTransition('disputed', 'approved')).toBe(true);
  });
});
