import { describe, it, expect } from 'vitest';

// ─── Admin role access logic ───────────────────────────────────────────────────

type UserRole = 'carrier' | 'broker' | 'shipper' | 'admin';

function getDefaultRoute(role: UserRole): string {
  const routes: Record<UserRole, string> = {
    carrier: '/carrier',
    broker: '/broker',
    shipper: '/shipper',
    admin: '/admin',
  };
  return routes[role];
}

function canAccessAdminPanel(role: UserRole): boolean {
  return role === 'admin';
}

function canModerateContent(role: UserRole): boolean {
  return role === 'admin';
}

describe('Admin role routing', () => {
  it('admin default route is /admin', () => {
    expect(getDefaultRoute('admin')).toBe('/admin');
  });

  it('non-admin roles have their own default routes', () => {
    expect(getDefaultRoute('carrier')).toBe('/carrier');
    expect(getDefaultRoute('broker')).toBe('/broker');
    expect(getDefaultRoute('shipper')).toBe('/shipper');
  });
});

describe('Admin access control', () => {
  it('only admin can access admin panel', () => {
    expect(canAccessAdminPanel('admin')).toBe(true);
    expect(canAccessAdminPanel('carrier')).toBe(false);
    expect(canAccessAdminPanel('broker')).toBe(false);
    expect(canAccessAdminPanel('shipper')).toBe(false);
  });

  it('only admin can moderate content', () => {
    expect(canModerateContent('admin')).toBe(true);
    expect(canModerateContent('carrier')).toBe(false);
  });
});

// ─── Admin stats aggregation ──────────────────────────────────────────────────

interface PlatformStats {
  totalUsers: number;
  totalLoads: number;
  activeLoads: number;
  completedLoads: number;
  pendingVerifications: number;
}

function calcCompletionRate(stats: PlatformStats): number {
  if (stats.totalLoads === 0) return 0;
  return Math.round((stats.completedLoads / stats.totalLoads) * 100);
}

function hasPendingWorkItems(stats: PlatformStats): boolean {
  return stats.pendingVerifications > 0;
}

describe('Admin platform stats', () => {
  const stats: PlatformStats = {
    totalUsers: 100,
    totalLoads: 500,
    activeLoads: 120,
    completedLoads: 350,
    pendingVerifications: 5,
  };

  it('calculates completion rate correctly', () => {
    expect(calcCompletionRate(stats)).toBe(70);
  });

  it('returns 0 completion rate when no loads', () => {
    expect(calcCompletionRate({ ...stats, totalLoads: 0, completedLoads: 0 })).toBe(0);
  });

  it('detects pending work items', () => {
    expect(hasPendingWorkItems(stats)).toBe(true);
    expect(hasPendingWorkItems({ ...stats, pendingVerifications: 0 })).toBe(false);
  });
});

// ─── Verification queue management ────────────────────────────────────────────

type VerificationStatus = 'pending' | 'approved' | 'rejected' | 'expired';

function canApproveVerification(adminRole: UserRole, status: VerificationStatus): boolean {
  return adminRole === 'admin' && status === 'pending';
}

function canRejectVerification(adminRole: UserRole, status: VerificationStatus): boolean {
  return adminRole === 'admin' && (status === 'pending' || status === 'approved');
}

describe('Verification queue admin actions', () => {
  it('admin can approve pending verifications', () => {
    expect(canApproveVerification('admin', 'pending')).toBe(true);
  });

  it('admin cannot approve already-approved verifications', () => {
    expect(canApproveVerification('admin', 'approved')).toBe(false);
  });

  it('admin can reject pending or approved verifications', () => {
    expect(canRejectVerification('admin', 'pending')).toBe(true);
    expect(canRejectVerification('admin', 'approved')).toBe(true);
  });

  it('non-admin cannot take verification actions', () => {
    expect(canApproveVerification('carrier', 'pending')).toBe(false);
    expect(canRejectVerification('broker', 'pending')).toBe(false);
  });
});
