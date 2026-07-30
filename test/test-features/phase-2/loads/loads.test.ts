import { describe, it, expect } from 'vitest';

// ─── Load number generation ───────────────────────────────────────────────────

function generateLoadNumber(date: Date, sequence: number): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `FX-${y}${m}${d}-${String(sequence).padStart(4, '0')}`;
}

describe('Load number generation', () => {
  it('formats correctly', () => {
    expect(generateLoadNumber(new Date('2026-02-19'), 1)).toBe('FX-20260219-0001');
  });

  it('pads sequence to 4 digits', () => {
    expect(generateLoadNumber(new Date('2026-02-19'), 42)).toBe('FX-20260219-0042');
  });

  it('handles sequence over 9999', () => {
    expect(generateLoadNumber(new Date('2026-02-19'), 10000)).toBe('FX-20260219-10000');
  });
});

// ─── Load form validation ─────────────────────────────────────────────────────

interface LoadForm {
  origin_city: string;
  origin_state: string;
  dest_city: string;
  dest_state: string;
  pickup_date: string;
  delivery_date: string;
  equipment: string;
  commodity: string;
  weight_lbs: number;
  rate_usd: number;
}

function validateLoadForm(form: Partial<LoadForm>): string | null {
  if (!form.origin_city || !form.origin_state) return 'Origin required';
  if (!form.dest_city || !form.dest_state) return 'Destination required';
  if (!form.pickup_date) return 'Pickup date required';
  if (!form.delivery_date) return 'Delivery date required';
  if (form.pickup_date && form.delivery_date && form.delivery_date < form.pickup_date)
    return 'Delivery date must be after pickup date';
  if (!form.equipment) return 'Equipment type required';
  if (!form.commodity) return 'Commodity required';
  if (!form.weight_lbs || form.weight_lbs <= 0) return 'Weight must be greater than 0';
  if (!form.rate_usd || form.rate_usd <= 0) return 'Rate must be greater than 0';
  return null;
}

describe('Load form validation', () => {
  const valid: LoadForm = {
    origin_city: 'Dallas',
    origin_state: 'TX',
    dest_city: 'Chicago',
    dest_state: 'IL',
    pickup_date: '2026-03-01',
    delivery_date: '2026-03-03',
    equipment: 'van',
    commodity: 'General Freight',
    weight_lbs: 40000,
    rate_usd: 2500,
  };

  it('passes with valid data', () => expect(validateLoadForm(valid)).toBeNull());

  it('rejects missing origin', () => {
    expect(validateLoadForm({ ...valid, origin_city: '' })).not.toBeNull();
  });

  it('rejects delivery before pickup', () => {
    expect(validateLoadForm({ ...valid, delivery_date: '2026-02-28' })).not.toBeNull();
  });

  it('rejects zero weight', () => {
    expect(validateLoadForm({ ...valid, weight_lbs: 0 })).not.toBeNull();
  });

  it('rejects zero rate', () => {
    expect(validateLoadForm({ ...valid, rate_usd: 0 })).not.toBeNull();
  });

  it('rejects negative rate', () => {
    expect(validateLoadForm({ ...valid, rate_usd: -100 })).not.toBeNull();
  });
});

// ─── Load filtering ───────────────────────────────────────────────────────────

interface Load {
  equipment: string;
  origin_state: string;
  dest_state: string;
  rate_usd: number;
  status: string;
}

function filterLoads(
  loads: Load[],
  filters: {
    equipment?: string;
    originState?: string;
    destState?: string;
    minRate?: number;
  },
): Load[] {
  return loads.filter((l) => {
    if (filters.equipment && l.equipment !== filters.equipment) return false;
    if (filters.originState && l.origin_state !== filters.originState) return false;
    if (filters.destState && l.dest_state !== filters.destState) return false;
    if (filters.minRate && l.rate_usd < filters.minRate) return false;
    return true;
  });
}

const LOADS: Load[] = [
  { equipment: 'van', origin_state: 'TX', dest_state: 'IL', rate_usd: 2500, status: 'posted' },
  { equipment: 'reefer', origin_state: 'CA', dest_state: 'TX', rate_usd: 3200, status: 'posted' },
  { equipment: 'van', origin_state: 'TX', dest_state: 'FL', rate_usd: 1800, status: 'posted' },
];

describe('Load filtering', () => {
  it('filters by equipment', () => {
    expect(filterLoads(LOADS, { equipment: 'reefer' })).toHaveLength(1);
  });

  it('filters by origin state', () => {
    expect(filterLoads(LOADS, { originState: 'TX' })).toHaveLength(2);
  });

  it('filters by min rate', () => {
    expect(filterLoads(LOADS, { minRate: 2000 })).toHaveLength(2);
  });

  it('combines filters', () => {
    expect(filterLoads(LOADS, { equipment: 'van', originState: 'TX', minRate: 2000 })).toHaveLength(
      1,
    );
  });

  it('returns all loads when no filters applied', () => {
    expect(filterLoads(LOADS, {})).toHaveLength(3);
  });
});
