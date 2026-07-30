import { describe, it, expect } from 'vitest';

// ─── Profile completeness ─────────────────────────────────────────────────────

interface Profile {
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  onboarding_complete: boolean;
}

interface Company {
  name: string;
  mc_number: string | null;
  dot_number: string | null;
  phone: string | null;
}

function profileCompleteness(profile: Profile, company: Company | null): number {
  const fields = [
    !!profile.full_name,
    !!profile.phone,
    !!profile.avatar_url,
    !!company?.name,
    !!company?.phone,
  ];
  return Math.round((fields.filter(Boolean).length / fields.length) * 100);
}

describe('Profile completeness', () => {
  it('returns 0% when all fields are empty', () => {
    const p: Profile = {
      full_name: null,
      phone: null,
      avatar_url: null,
      onboarding_complete: false,
    };
    expect(profileCompleteness(p, null)).toBe(0);
  });

  it('returns 100% when all fields filled', () => {
    const p: Profile = {
      full_name: 'Jane',
      phone: '555-0001',
      avatar_url: 'https://...',
      onboarding_complete: true,
    };
    const c: Company = {
      name: 'Acme Freight',
      mc_number: 'MC-123',
      dot_number: null,
      phone: '555-0002',
    };
    expect(profileCompleteness(p, c)).toBe(100);
  });

  it('counts company name toward completeness', () => {
    const p: Profile = {
      full_name: 'Jane',
      phone: null,
      avatar_url: null,
      onboarding_complete: false,
    };
    const c: Company = { name: 'Acme', mc_number: null, dot_number: null, phone: null };
    expect(profileCompleteness(p, c)).toBe(40);
  });
});

// ─── Role label formatting ────────────────────────────────────────────────────

type UserRole = 'carrier' | 'broker' | 'shipper' | 'admin';

function formatRole(role: UserRole): string {
  const map: Record<UserRole, string> = {
    carrier: 'Carrier',
    broker: 'Freight Broker',
    shipper: 'Shipper',
    admin: 'Administrator',
  };
  return map[role];
}

describe('Role label formatting', () => {
  it('formats carrier correctly', () => expect(formatRole('carrier')).toBe('Carrier'));
  it('formats broker correctly', () => expect(formatRole('broker')).toBe('Freight Broker'));
  it('formats shipper correctly', () => expect(formatRole('shipper')).toBe('Shipper'));
  it('formats admin correctly', () => expect(formatRole('admin')).toBe('Administrator'));
});

// ─── Phone number normalization ───────────────────────────────────────────────

function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (digits.length !== 10) return null;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

describe('Phone normalization', () => {
  it('formats 10-digit number', () => {
    expect(normalizePhone('5550001234')).toBe('(555) 000-1234');
  });

  it('strips dashes and spaces', () => {
    expect(normalizePhone('555-000-1234')).toBe('(555) 000-1234');
  });

  it('returns null for short number', () => {
    expect(normalizePhone('555123')).toBeNull();
  });

  it('returns null for 11-digit number', () => {
    expect(normalizePhone('15550001234')).toBeNull();
  });
});
