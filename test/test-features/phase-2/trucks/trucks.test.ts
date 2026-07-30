import { describe, it, expect } from 'vitest';

// ─── Truck form validation ────────────────────────────────────────────────────

interface TruckForm {
  origin_city: string;
  origin_state: string;
  available_date: string;
  equipment: string;
  length_ft?: number;
  weight_capacity_lbs?: number;
}

function validateTruckForm(form: Partial<TruckForm>): string | null {
  if (!form.origin_city || !form.origin_state) return 'Origin required';
  if (!form.available_date) return 'Available date required';
  if (!form.equipment) return 'Equipment type required';
  if (form.length_ft !== undefined && form.length_ft <= 0) return 'Length must be greater than 0';
  if (form.weight_capacity_lbs !== undefined && form.weight_capacity_lbs <= 0)
    return 'Weight capacity must be greater than 0';
  return null;
}

describe('Truck form validation', () => {
  const valid: TruckForm = {
    origin_city: 'Houston',
    origin_state: 'TX',
    available_date: '2026-03-01',
    equipment: 'van',
    length_ft: 53,
    weight_capacity_lbs: 45000,
  };

  it('passes with valid data', () => expect(validateTruckForm(valid)).toBeNull());
  it('rejects missing origin city', () => {
    expect(validateTruckForm({ ...valid, origin_city: '' })).not.toBeNull();
  });
  it('rejects missing available date', () => {
    expect(validateTruckForm({ ...valid, available_date: '' })).not.toBeNull();
  });
  it('rejects zero length', () => {
    expect(validateTruckForm({ ...valid, length_ft: 0 })).not.toBeNull();
  });
  it('rejects negative weight capacity', () => {
    expect(validateTruckForm({ ...valid, weight_capacity_lbs: -1 })).not.toBeNull();
  });
  it('passes without optional fields', () => {
    const { length_ft, weight_capacity_lbs, ...minimal } = valid;
    expect(validateTruckForm(minimal)).toBeNull();
  });
});

// ─── Truck status transitions ─────────────────────────────────────────────────

type TruckStatus = 'available' | 'booked' | 'inactive';

function canTransitionTruck(from: TruckStatus, to: TruckStatus): boolean {
  const allowed: Record<TruckStatus, TruckStatus[]> = {
    available: ['booked', 'inactive'],
    booked: ['available', 'inactive'],
    inactive: ['available'],
  };
  return allowed[from].includes(to);
}

describe('Truck status transitions', () => {
  it('available → booked is valid', () =>
    expect(canTransitionTruck('available', 'booked')).toBe(true));
  it('available → inactive is valid', () =>
    expect(canTransitionTruck('available', 'inactive')).toBe(true));
  it('booked → available is valid (load cancelled)', () =>
    expect(canTransitionTruck('booked', 'available')).toBe(true));
  it('inactive → available is valid (reactivate)', () =>
    expect(canTransitionTruck('inactive', 'available')).toBe(true));
  it('inactive → booked is invalid', () =>
    expect(canTransitionTruck('inactive', 'booked')).toBe(false));
});

// ─── Equipment type display ───────────────────────────────────────────────────

type EquipmentType =
  | 'van'
  | 'reefer'
  | 'flatbed'
  | 'step_deck'
  | 'lowboy'
  | 'tanker'
  | 'box_truck'
  | 'sprinter';

const EQUIPMENT_LABELS: Record<EquipmentType, string> = {
  van: 'Dry Van',
  reefer: 'Refrigerated',
  flatbed: 'Flatbed',
  step_deck: 'Step Deck',
  lowboy: 'Lowboy',
  tanker: 'Tanker',
  box_truck: 'Box Truck',
  sprinter: 'Sprinter Van',
};

describe('Equipment type display labels', () => {
  it('van → Dry Van', () => expect(EQUIPMENT_LABELS['van']).toBe('Dry Van'));
  it('reefer → Refrigerated', () => expect(EQUIPMENT_LABELS['reefer']).toBe('Refrigerated'));
  it('step_deck → Step Deck', () => expect(EQUIPMENT_LABELS['step_deck']).toBe('Step Deck'));
  it('all 8 types have labels', () => {
    const types: EquipmentType[] = [
      'van',
      'reefer',
      'flatbed',
      'step_deck',
      'lowboy',
      'tanker',
      'box_truck',
      'sprinter',
    ];
    types.forEach((t) => expect(EQUIPMENT_LABELS[t]).toBeTruthy());
  });
});
