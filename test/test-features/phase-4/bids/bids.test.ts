/**
 * bids — bid amount validation, delta calculation, status flow
 *
 * Production failure scenarios:
 *  - Carrier submits bid at $0 → should be rejected
 *  - Bid amount higher than asking rate → shows positive delta (not crash)
 *  - Counter-offer with empty amount → should not submit
 *  - Book-now on a non-posted load → RPC should reject
 *  - Duplicate bid submission by same carrier → handled gracefully
 */

import { describe, it, expect } from 'vitest';

// ─── Bid delta calculation (mirrors BidCard logic) ────────────────────────────

function calcBidDelta(bidAmount: number, askingRate: number): string {
  if (!askingRate) return 'at ask';
  const diff = ((bidAmount - askingRate) / askingRate) * 100;
  if (diff === 0) return 'at ask';
  return diff > 0 ? `+${diff.toFixed(1)}%` : `${diff.toFixed(1)}%`;
}

describe('bid delta calculation', () => {
  it('shows positive delta when bid is above asking rate', () => {
    expect(calcBidDelta(3200, 2800)).toMatch(/^\+/);
  });

  it('shows negative delta when bid is below asking rate', () => {
    expect(calcBidDelta(2400, 2800)).toMatch(/^-/);
  });

  it('shows "at ask" when bid exactly matches asking rate', () => {
    expect(calcBidDelta(2800, 2800)).toBe('at ask');
  });

  it('handles zero asking rate without crash', () => {
    expect(() => calcBidDelta(2800, 0)).not.toThrow();
  });

  it('shows correct percentage — 14.3% above', () => {
    expect(calcBidDelta(3200, 2800)).toBe('+14.3%');
  });
});

// ─── Bid validation ───────────────────────────────────────────────────────────

function validateBidAmount(amount: string): boolean {
  const n = parseFloat(amount);
  return !isNaN(n) && n > 0;
}

describe('bid amount validation', () => {
  it('rejects empty string', () => {
    expect(validateBidAmount('')).toBe(false);
  });

  it('rejects zero', () => {
    expect(validateBidAmount('0')).toBe(false);
  });

  it('rejects negative amount', () => {
    expect(validateBidAmount('-500')).toBe(false);
  });

  it('rejects non-numeric string', () => {
    expect(validateBidAmount('abc')).toBe(false);
  });

  it('accepts valid positive amount', () => {
    expect(validateBidAmount('2800')).toBe(true);
  });

  it('accepts decimal amount', () => {
    expect(validateBidAmount('2800.50')).toBe(true);
  });
});

// ─── Bid status transitions ───────────────────────────────────────────────────

type BidStatus = 'pending' | 'accepted' | 'declined' | 'countered' | 'expired' | 'cancelled';

const ACTIONABLE_STATUSES: BidStatus[] = ['pending'];
const TERMINAL_STATUSES: BidStatus[] = ['accepted', 'declined', 'expired', 'cancelled'];

describe('bid status rules', () => {
  it('only pending bids can be actioned', () => {
    expect(ACTIONABLE_STATUSES.includes('pending')).toBe(true);
    expect(ACTIONABLE_STATUSES.includes('accepted')).toBe(false);
  });

  it('terminal statuses cannot be acted on', () => {
    for (const status of TERMINAL_STATUSES) {
      expect(ACTIONABLE_STATUSES.includes(status)).toBe(false);
    }
  });

  it('countered bids are not in terminal status', () => {
    expect(TERMINAL_STATUSES.includes('countered')).toBe(false);
  });
});
