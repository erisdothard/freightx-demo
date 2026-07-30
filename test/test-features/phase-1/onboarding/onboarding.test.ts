import { describe, it, expect } from 'vitest';

// ─── Onboarding step validation ───────────────────────────────────────────────

type UserRole = 'carrier' | 'broker' | 'shipper' | 'admin';

interface OnboardingStep1 {
  email: string;
  password: string;
  full_name: string;
}

interface OnboardingStep2 {
  role: UserRole;
}

interface OnboardingStep3 {
  company_name: string;
  mc_number?: string;
  dot_number?: string;
  broker_authority?: string;
  phone: string;
}

function validateStep1(data: Partial<OnboardingStep1>): string | null {
  if (!data.email?.includes('@')) return 'Valid email required';
  if (!data.password || data.password.length < 8) return 'Password must be at least 8 characters';
  if (!data.full_name?.trim()) return 'Full name required';
  return null;
}

function validateStep3(role: UserRole, data: Partial<OnboardingStep3>): string | null {
  if (!data.company_name?.trim()) return 'Company name required';
  if (!data.phone?.trim()) return 'Phone required';
  if (role === 'carrier' && !data.mc_number && !data.dot_number) return 'MC or DOT number required';
  if (role === 'broker' && !data.broker_authority) return 'Broker authority number required';
  return null;
}

describe('Onboarding step 1 validation', () => {
  it('passes with valid data', () => {
    expect(
      validateStep1({ email: 'a@b.com', password: 'secure123', full_name: 'Jane' }),
    ).toBeNull();
  });

  it('rejects email without @', () => {
    expect(
      validateStep1({ email: 'notanemail', password: 'secure123', full_name: 'Jane' }),
    ).not.toBeNull();
  });

  it('rejects password under 8 chars', () => {
    expect(
      validateStep1({ email: 'a@b.com', password: 'short', full_name: 'Jane' }),
    ).not.toBeNull();
  });

  it('rejects blank full name', () => {
    expect(
      validateStep1({ email: 'a@b.com', password: 'secure123', full_name: '   ' }),
    ).not.toBeNull();
  });
});

describe('Onboarding step 3 validation', () => {
  it('carrier requires MC or DOT', () => {
    expect(validateStep3('carrier', { company_name: 'Acme', phone: '555-0001' })).not.toBeNull();
  });

  it('carrier passes with MC number', () => {
    expect(
      validateStep3('carrier', { company_name: 'Acme', phone: '555-0001', mc_number: 'MC-123' }),
    ).toBeNull();
  });

  it('broker requires broker authority', () => {
    expect(validateStep3('broker', { company_name: 'BrokerCo', phone: '555-0002' })).not.toBeNull();
  });

  it('shipper only needs company name + phone', () => {
    expect(validateStep3('shipper', { company_name: 'ShipCo', phone: '555-0003' })).toBeNull();
  });

  it('missing company name always fails', () => {
    expect(validateStep3('shipper', { company_name: '', phone: '555-0003' })).not.toBeNull();
  });
});

// ─── Onboarding guard ─────────────────────────────────────────────────────────

function shouldShowOnboarding(onboardingComplete: boolean, role: UserRole): boolean {
  if (role === 'admin') return false;
  return !onboardingComplete;
}

describe('Onboarding guard', () => {
  it('shows onboarding when incomplete', () => {
    expect(shouldShowOnboarding(false, 'carrier')).toBe(true);
  });

  it('skips onboarding when complete', () => {
    expect(shouldShowOnboarding(true, 'carrier')).toBe(false);
  });

  it('never shows onboarding for admin', () => {
    expect(shouldShowOnboarding(false, 'admin')).toBe(false);
  });
});
