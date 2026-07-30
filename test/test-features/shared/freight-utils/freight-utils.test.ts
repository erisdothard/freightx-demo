/**
 * freight-utils — analyzeRate, getLoadAge, getBrokerCreditLabel, calcGrossProfit
 *
 * Production failure scenarios:
 *  - Unknown equipment type → should not crash, fall back to default market rate
 *  - Zero rate or miles → should handle gracefully
 *  - Missing postedAt → getLoadAge returns empty string (no crash)
 *  - Score of 0 → getBrokerCreditLabel returns null (not a label)
 */

import { describe, it, expect } from 'vitest';
import {
  analyzeRate,
  getLoadAge,
  getBrokerCreditLabel,
  calcGrossProfit,
} from '../../apps/web/src/shared/lib/freight';
import type { Load } from '../../packages/shared/src/index';

const baseLoad: Load = {
  id: 'test-1',
  loadNumber: 'FX-0001',
  originCity: 'Chicago',
  originState: 'IL',
  destCity: 'Dallas',
  destState: 'TX',
  pickupDate: new Date().toISOString(),
  equipment: 'van',
  weightLbs: 42000,
  rateUsd: 2800,
  ratePerMile: 2.8,
  totalMiles: 1000,
  status: 'posted',
  companyName: 'Test Broker',
  postedAt: new Date().toISOString(),
  commodity: 'General Freight',
  brokerCreditScore: 90,
  hazmat: false,
  tempControlled: false,
  bidCount: 0,
};

// ─── analyzeRate ──────────────────────────────────────────────────────────────

describe('analyzeRate', () => {
  it('returns hot for rate 15%+ above market', () => {
    const load = { ...baseLoad, ratePerMile: 3.3 }; // 2.82 market → +17%
    expect(analyzeRate(load).health).toBe('hot');
  });

  it('returns good for rate 3–14% above market', () => {
    const load = { ...baseLoad, ratePerMile: 2.95 }; // +4.6%
    expect(analyzeRate(load).health).toBe('good');
  });

  it('returns fair for rate within -8% of market', () => {
    const load = { ...baseLoad, ratePerMile: 2.7 }; // -4.3%
    expect(analyzeRate(load).health).toBe('fair');
  });

  it('returns low for rate more than 8% below market', () => {
    const load = { ...baseLoad, ratePerMile: 2.4 }; // -14.9%
    expect(analyzeRate(load).health).toBe('low');
  });

  it('does not crash on unknown equipment type', () => {
    const load = { ...baseLoad, equipment: 'unknown_type' as never };
    expect(() => analyzeRate(load)).not.toThrow();
  });

  it('includes delta string in result', () => {
    const result = analyzeRate(baseLoad);
    expect(result.delta).toMatch(/mkt/);
  });
});

// ─── getLoadAge ───────────────────────────────────────────────────────────────

describe('getLoadAge', () => {
  it('returns empty string when postedAt is undefined', () => {
    expect(getLoadAge(undefined)).toBe('');
  });

  it('returns minutes ago for recent posts', () => {
    const recent = new Date(Date.now() - 20 * 60 * 1000).toISOString();
    expect(getLoadAge(recent)).toBe('20m ago');
  });

  it('returns hours ago for posts within 24h', () => {
    const hoursAgo = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString();
    expect(getLoadAge(hoursAgo)).toBe('5h ago');
  });

  it('returns days ago for older posts', () => {
    const twoDays = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    expect(getLoadAge(twoDays)).toBe('2d ago');
  });
});

// ─── getBrokerCreditLabel ─────────────────────────────────────────────────────

describe('getBrokerCreditLabel', () => {
  it('returns null when score is undefined', () => {
    expect(getBrokerCreditLabel(undefined)).toBeNull();
  });

  it('returns null when score is 0', () => {
    expect(getBrokerCreditLabel(0)).toBeNull();
  });

  it('returns A+ for score >= 85', () => {
    expect(getBrokerCreditLabel(90)?.label).toBe('Credit A+');
  });

  it('returns B for score 70–84', () => {
    expect(getBrokerCreditLabel(75)?.label).toBe('Credit B');
  });

  it('returns C for score 55–69', () => {
    expect(getBrokerCreditLabel(60)?.label).toBe('Credit C');
  });

  it('returns D for score below 55', () => {
    expect(getBrokerCreditLabel(40)?.label).toBe('Credit D');
  });
});

// ─── calcGrossProfit ──────────────────────────────────────────────────────────

describe('calcGrossProfit', () => {
  it('returns null when totalMiles is missing', () => {
    const load = { ...baseLoad, totalMiles: undefined };
    expect(calcGrossProfit(load)).toBeNull();
  });

  it('returns a margin string when miles are present', () => {
    const result = calcGrossProfit(baseLoad);
    expect(result).toMatch(/\d+% margin/);
  });

  it('handles high-cost loads that may show negative margin', () => {
    const load = { ...baseLoad, rateUsd: 100, totalMiles: 1000 };
    // cost = 1000 * 1.45 = 1450 > 100 → negative margin
    const result = calcGrossProfit(load);
    expect(result).toBeTruthy(); // should still return a string, not crash
  });
});
