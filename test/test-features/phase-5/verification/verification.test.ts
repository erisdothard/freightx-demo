import { describe, it, expect, vi } from 'vitest';

// ─── FMCSA helpers ───────────────────────────────────────────────────────────

function mockFmcsaResult(identifier: string) {
  return {
    status: 'AUTHORIZED' as const,
    legalName: 'PLACEHOLDER — FMCSA API key not configured',
    dotNumber: identifier,
    mcNumber: null,
    safetyRating: 'Satisfactory',
    csaScore: null,
  };
}

describe('FMCSA mock stub', () => {
  it('returns AUTHORIZED status when key is placeholder', () => {
    const result = mockFmcsaResult('MC-123456');
    expect(result.status).toBe('AUTHORIZED');
  });

  it('preserves the identifier as dotNumber', () => {
    const result = mockFmcsaResult('9876543');
    expect(result.dotNumber).toBe('9876543');
  });

  it('returns null csaScore from stub', () => {
    const result = mockFmcsaResult('MC-000001');
    expect(result.csaScore).toBeNull();
  });
});

// ─── Insurance expiry logic ───────────────────────────────────────────────────

function daysUntilExpiry(expiresAt: string): number {
  const exp = new Date(expiresAt).getTime();
  const now = Date.now();
  return Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
}

function getExpiryAlert(expiresAt: string | null): 'critical' | 'warning' | 'ok' | 'none' {
  if (!expiresAt) return 'none';
  const days = daysUntilExpiry(expiresAt);
  if (days <= 0) return 'critical';
  if (days <= 7) return 'critical';
  if (days <= 30) return 'warning';
  return 'ok';
}

describe('Insurance expiry alerts', () => {
  it('returns critical when insurance already expired', () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    expect(getExpiryAlert(past)).toBe('critical');
  });

  it('returns critical when expiring within 7 days', () => {
    const soon = new Date(Date.now() + 5 * 86400000).toISOString();
    expect(getExpiryAlert(soon)).toBe('critical');
  });

  it('returns warning when expiring in 20 days', () => {
    const warning = new Date(Date.now() + 20 * 86400000).toISOString();
    expect(getExpiryAlert(warning)).toBe('warning');
  });

  it('returns ok when expiring in 60 days', () => {
    const fine = new Date(Date.now() + 60 * 86400000).toISOString();
    expect(getExpiryAlert(fine)).toBe('ok');
  });

  it('returns none when no expiry date set', () => {
    expect(getExpiryAlert(null)).toBe('none');
  });
});

// ─── Verification status transitions ─────────────────────────────────────────

type VerificationStatus = 'pending' | 'verified' | 'failed' | 'expired';

function canPostTrucks(status: VerificationStatus, tier: string): boolean {
  // Free carriers: limited regardless of verification
  // Verified + any paid tier: yes
  if (tier === 'free') return false; // enforced by subscription gate
  return status === 'verified';
}

describe('Carrier can-post-trucks gate', () => {
  it('blocks unverified carrier from posting trucks', () => {
    expect(canPostTrucks('pending', 'carrier_pro')).toBe(false);
  });

  it('allows verified carrier_pro to post trucks', () => {
    expect(canPostTrucks('verified', 'carrier_pro')).toBe(true);
  });

  it('blocks free tier regardless of verification status', () => {
    expect(canPostTrucks('verified', 'free')).toBe(false);
  });

  it('blocks failed verification', () => {
    expect(canPostTrucks('failed', 'carrier_pro')).toBe(false);
  });

  it('blocks expired verification', () => {
    expect(canPostTrucks('expired', 'carrier_pro')).toBe(false);
  });
});
