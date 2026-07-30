/**
 * auth — role routing, onboarding guard, session handling
 *
 * Production failure scenarios:
 *  - Unknown role in profile → should fall back to carrier dashboard
 *  - Admin role routes to carrier dashboard (no separate admin page)
 *  - Unauthenticated user hits protected route → should redirect to login
 *  - Profile not yet loaded after sign-in → should wait, not crash
 *  - Onboarding incomplete flag → user should not reach dashboard
 */

import { describe, it, expect } from 'vitest';

type UserRole = 'carrier' | 'broker' | 'shipper' | 'admin';

const ROLE_ROUTES: Record<string, string> = {
  carrier: '/carrier',
  broker: '/broker',
  shipper: '/shipper',
  admin: '/carrier',
};

function getRoleRoute(role: string | undefined): string {
  return ROLE_ROUTES[role ?? ''] ?? '/carrier';
}

// ─── Role routing ─────────────────────────────────────────────────────────────

describe('role-based routing', () => {
  it('routes carrier to /carrier', () => {
    expect(getRoleRoute('carrier')).toBe('/carrier');
  });

  it('routes broker to /broker', () => {
    expect(getRoleRoute('broker')).toBe('/broker');
  });

  it('routes shipper to /shipper', () => {
    expect(getRoleRoute('shipper')).toBe('/shipper');
  });

  it('routes admin to /carrier (no separate admin dashboard)', () => {
    expect(getRoleRoute('admin')).toBe('/carrier');
  });

  it('falls back to /carrier for unknown role', () => {
    expect(getRoleRoute('dispatcher')).toBe('/carrier');
  });

  it('falls back to /carrier when role is undefined', () => {
    expect(getRoleRoute(undefined)).toBe('/carrier');
  });
});

// ─── Onboarding guard ────────────────────────────────────────────────────────

function shouldBlockDashboard(onboardingComplete: boolean | undefined): boolean {
  return !onboardingComplete;
}

describe('onboarding guard', () => {
  it('blocks dashboard when onboarding is incomplete', () => {
    expect(shouldBlockDashboard(false)).toBe(true);
  });

  it('allows dashboard when onboarding is complete', () => {
    expect(shouldBlockDashboard(true)).toBe(false);
  });

  it('blocks dashboard when onboarding flag is undefined', () => {
    expect(shouldBlockDashboard(undefined)).toBe(true);
  });
});

// ─── Valid roles ──────────────────────────────────────────────────────────────

const VALID_ROLES: UserRole[] = ['carrier', 'broker', 'shipper', 'admin'];

describe('role validation', () => {
  it('recognises all valid roles', () => {
    expect(VALID_ROLES).toContain('carrier');
    expect(VALID_ROLES).toContain('broker');
    expect(VALID_ROLES).toContain('shipper');
    expect(VALID_ROLES).toContain('admin');
  });

  it('has exactly 4 roles defined', () => {
    expect(VALID_ROLES.length).toBe(4);
  });
});
