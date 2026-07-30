/**
 * stripe.service — integration tests with mocked Supabase
 *
 * Verifies that the real service functions:
 *  - getSubscription() returns the subscription row or null
 *  - getInvoice() returns the invoice row or null
 *  - approveInvoice() writes status='approved' + approved_at timestamp
 *  - selectPaymentMethod('quick_pay') sets a 2% fee and a 2-day due date
 *  - selectPaymentMethod('standard_net30') sets null fee and a 30-day due date
 *  - All functions throw on Supabase errors
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';
import {
  getSubscription,
  getInvoice,
  approveInvoice,
  selectPaymentMethod,
} from '@/services/stripe.service';
import { supabase } from '@/lib/supabase';

vi.mock('@/lib/supabase', () => ({
  supabase: { from: vi.fn() },
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

const RAW_SUBSCRIPTION = {
  id: 'sub-1',
  company_id: 'co-1',
  stripe_customer_id: 'cus_test',
  stripe_subscription_id: 'sub_test',
  tier: 'carrier_pro',
  status: 'active',
  current_period_start: '2026-03-01T00:00:00Z',
  current_period_end: '2026-04-01T00:00:00Z',
  trial_ends_at: null,
  created_at: '2026-03-01T00:00:00Z',
  updated_at: '2026-03-01T00:00:00Z',
};

const RAW_INVOICE = {
  id: 'inv-1',
  load_id: 'load-1',
  broker_id: 'broker-1',
  carrier_id: 'carrier-1',
  amount_usd: 5000,
  quick_pay_fee_usd: null,
  payment_method: null,
  stripe_payment_intent_id: null,
  stripe_transfer_id: null,
  status: 'invoiced',
  approved_at: null,
  paid_at: null,
  due_date: null,
  created_at: '2026-03-01T00:00:00Z',
  updated_at: '2026-03-01T00:00:00Z',
};

const mockFrom = vi.mocked(supabase.from);

beforeEach(() => {
  // resetAllMocks clears queued mockReturnValueOnce values between tests
  vi.resetAllMocks();
});

// ---------------------------------------------------------------------------
// getSubscription
// ---------------------------------------------------------------------------

describe('getSubscription', () => {
  it('returns the subscription row', async () => {
    mockFrom.mockReturnValue(makeBuilder({ data: RAW_SUBSCRIPTION, error: null }) as never);
    const sub = await getSubscription('co-1');
    expect(sub).not.toBeNull();
    expect(sub!.tier).toBe('carrier_pro');
    expect(sub!.status).toBe('active');
  });

  it('returns null when no subscription exists', async () => {
    mockFrom.mockReturnValue(makeBuilder({ data: null, error: null }) as never);
    expect(await getSubscription('co-1')).toBeNull();
  });

  it('throws when Supabase returns an error', async () => {
    mockFrom.mockReturnValue(makeBuilder({ data: null, error: { message: 'db error' } }) as never);
    await expect(getSubscription('co-1')).rejects.toThrow('db error');
  });
});

// ---------------------------------------------------------------------------
// getInvoice
// ---------------------------------------------------------------------------

describe('getInvoice', () => {
  it('returns the invoice row', async () => {
    mockFrom.mockReturnValue(makeBuilder({ data: RAW_INVOICE, error: null }) as never);
    const inv = await getInvoice('load-1');
    expect(inv).not.toBeNull();
    expect(inv!.amount_usd).toBe(5000);
    expect(inv!.status).toBe('invoiced');
  });

  it('returns null when no invoice exists for the load', async () => {
    mockFrom.mockReturnValue(makeBuilder({ data: null, error: null }) as never);
    expect(await getInvoice('load-missing')).toBeNull();
  });

  it('throws when Supabase returns an error', async () => {
    mockFrom.mockReturnValue(
      makeBuilder({ data: null, error: { message: 'query failed' } }) as never,
    );
    await expect(getInvoice('load-1')).rejects.toThrow('query failed');
  });
});

// ---------------------------------------------------------------------------
// approveInvoice
// ---------------------------------------------------------------------------

describe('approveInvoice', () => {
  it('updates the invoice with status="approved" and an approved_at timestamp', async () => {
    const builder = makeBuilder({ error: null });
    mockFrom.mockReturnValue(builder as never);
    await approveInvoice('inv-1');
    expect(builder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'approved',
        approved_at: expect.any(String),
      }),
    );
    expect(builder.eq).toHaveBeenCalledWith('id', 'inv-1');
  });

  it('throws when the update fails', async () => {
    mockFrom.mockReturnValue(makeBuilder({ error: { message: 'invoice locked' } }) as never);
    await expect(approveInvoice('inv-1')).rejects.toThrow('invoice locked');
  });
});

// ---------------------------------------------------------------------------
// selectPaymentMethod
// ---------------------------------------------------------------------------

describe('selectPaymentMethod', () => {
  it('quick_pay: sets a 2% fee and a due date 2 days from now', async () => {
    const before = Date.now();
    const updateBuilder = makeBuilder({ error: null });

    // First call: fetch invoice amount; second call: update
    mockFrom
      .mockReturnValueOnce(makeBuilder({ data: { amount_usd: 5000 }, error: null }) as never)
      .mockReturnValueOnce(updateBuilder as never);

    await selectPaymentMethod('inv-1', 'quick_pay');

    const expectedFee = Math.round(5000 * 0.02); // 100
    expect(updateBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        payment_method: 'quick_pay',
        quick_pay_fee_usd: expectedFee,
        status: 'processing',
      }),
    );

    // Service truncates to YYYY-MM-DD (midnight UTC), so compare date strings
    const updateCall = (updateBuilder.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const expectedDue = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    expect(updateCall.due_date).toBe(expectedDue);
  });

  it('standard_net30: sets null fee and a due date 30 days from now', async () => {
    const updateBuilder = makeBuilder({ error: null });
    mockFrom
      .mockReturnValueOnce(makeBuilder({ data: { amount_usd: 5000 }, error: null }) as never)
      .mockReturnValueOnce(updateBuilder as never);

    await selectPaymentMethod('inv-1', 'standard_net30');

    expect(updateBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        payment_method: 'standard_net30',
        quick_pay_fee_usd: null,
        status: 'processing',
      }),
    );

    const updateCall = (updateBuilder.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const expectedDue = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    expect(updateCall.due_date).toBe(expectedDue);
  });

  it('quick_pay fee is exactly 2% rounded to nearest integer', async () => {
    const updateBuilder = makeBuilder({ error: null });
    mockFrom
      .mockReturnValueOnce(makeBuilder({ data: { amount_usd: 3750 }, error: null }) as never)
      .mockReturnValueOnce(updateBuilder as never);

    await selectPaymentMethod('inv-1', 'quick_pay');

    const updateCall = (updateBuilder.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(updateCall.quick_pay_fee_usd).toBe(Math.round(3750 * 0.02)); // 75
  });

  it('throws when the invoice fetch fails', async () => {
    mockFrom.mockReturnValueOnce(
      makeBuilder({ data: null, error: { message: 'invoice not found' } }) as never,
    );
    await expect(selectPaymentMethod('inv-missing', 'quick_pay')).rejects.toThrow(
      'invoice not found',
    );
  });

  it('throws when the update fails', async () => {
    mockFrom
      .mockReturnValueOnce(makeBuilder({ data: { amount_usd: 5000 }, error: null }) as never)
      .mockReturnValueOnce(makeBuilder({ error: { message: 'update failed' } }) as never);
    await expect(selectPaymentMethod('inv-1', 'standard_net30')).rejects.toThrow('update failed');
  });
});
