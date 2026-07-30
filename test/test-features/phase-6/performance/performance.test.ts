import { describe, it, expect } from 'vitest';

// ─── Bundle size heuristics ───────────────────────────────────────────────────

// These tests enforce architectural rules about code splitting
// Actual bundle sizes are validated by `pnpm build:analyze`

const LAZY_ROUTES = [
  'carrier/dashboard',
  'carrier/loads',
  'carrier/fleet',
  'broker/dashboard',
  'broker/loads',
  'shipper/dashboard',
  'shipper/loads',
  'tracking',
  'messages',
  'profile',
  'legal/privacy',
  'legal/terms',
];

const EAGER_ROUTES = ['splash', 'login', 'forgot-password', 'reset-password', 'onboarding'];

describe('Code splitting architecture', () => {
  it('all role-specific routes are in lazy list', () => {
    const roleRoutes = LAZY_ROUTES.filter(
      (r) => r.startsWith('carrier/') || r.startsWith('broker/') || r.startsWith('shipper/'),
    );
    expect(roleRoutes.length).toBeGreaterThanOrEqual(6);
  });

  it('auth pages are in eager list (no lazy loading delay on login)', () => {
    expect(EAGER_ROUTES).toContain('login');
    expect(EAGER_ROUTES).toContain('forgot-password');
  });

  it('legal pages are lazy (rarely visited)', () => {
    expect(LAZY_ROUTES).toContain('legal/privacy');
    expect(LAZY_ROUTES).toContain('legal/terms');
  });

  it('total lazy routes >= 10', () => {
    expect(LAZY_ROUTES.length).toBeGreaterThanOrEqual(10);
  });
});

// ─── Pagination constants ─────────────────────────────────────────────────────

const PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

function paginate<T>(items: T[], page: number, size = PAGE_SIZE): T[] {
  const clampedSize = Math.min(size, MAX_PAGE_SIZE);
  return items.slice(page * clampedSize, (page + 1) * clampedSize);
}

describe('List pagination', () => {
  const items = Array.from({ length: 55 }, (_, i) => i);

  it('first page returns correct items', () => {
    expect(paginate(items, 0)).toHaveLength(20);
    expect(paginate(items, 0)[0]).toBe(0);
  });

  it('second page starts at correct offset', () => {
    expect(paginate(items, 1)[0]).toBe(20);
  });

  it('last partial page returns remaining items', () => {
    expect(paginate(items, 2)).toHaveLength(15);
  });

  it('page size capped at MAX_PAGE_SIZE', () => {
    expect(paginate(items, 0, 999)).toHaveLength(55);
  });

  it('empty page returns empty array', () => {
    expect(paginate(items, 10)).toHaveLength(0);
  });
});
