/**
 * loads.schema — Zod validation tests
 *
 * Verifies that CreateLoadInputSchema correctly accepts null values
 * for optional fields (freight_class, packaging_type, po_number, shipper_reference)
 */
import { describe, it, expect } from 'vitest';
import { CreateLoadInputSchema } from '@/lib/schemas/loads.schema';

describe('CreateLoadInputSchema', () => {
  const validBaseLoad = {
    posted_by: 'user-123',
    company_id: 'company-456',
    equipment: 'van',
    origin_city: 'Nashville',
    origin_state: 'TN',
    dest_city: 'Atlanta',
    dest_state: 'GA',
    rate_usd: 3200,
    pickup_date: '2026-05-01',
    commodity: 'General Freight',
    weight_lbs: 42000,
    total_miles: 250,
  };

  describe('optional fields with null values', () => {
    it('accepts null for freight_class', () => {
      const load = {
        ...validBaseLoad,
        freight_class: null,
      };
      expect(() => CreateLoadInputSchema.parse(load)).not.toThrow();
    });

    it('accepts null for packaging_type', () => {
      const load = {
        ...validBaseLoad,
        packaging_type: null,
      };
      expect(() => CreateLoadInputSchema.parse(load)).not.toThrow();
    });

    it('accepts null for po_number', () => {
      const load = {
        ...validBaseLoad,
        po_number: null,
      };
      expect(() => CreateLoadInputSchema.parse(load)).not.toThrow();
    });

    it('accepts null for shipper_reference', () => {
      const load = {
        ...validBaseLoad,
        shipper_reference: null,
      };
      expect(() => CreateLoadInputSchema.parse(load)).not.toThrow();
    });

    it('accepts all optional fields as null together', () => {
      const load = {
        ...validBaseLoad,
        freight_class: null,
        packaging_type: null,
        po_number: null,
        shipper_reference: null,
      };
      expect(() => CreateLoadInputSchema.parse(load)).not.toThrow();
    });

    it('accepts load with all optional fields omitted (undefined)', () => {
      expect(() => CreateLoadInputSchema.parse(validBaseLoad)).not.toThrow();
    });
  });

  describe('valid enum values', () => {
    it('accepts valid freight_class enum values', () => {
      const validClasses = ['50', '55', '77.5', '100', '500'];
      validClasses.forEach((fc) => {
        const load = {
          ...validBaseLoad,
          freight_class: fc,
        };
        expect(() => CreateLoadInputSchema.parse(load)).not.toThrow();
      });
    });

    it('accepts valid packaging_type enum values', () => {
      const validTypes = ['pallets', 'crates', 'boxes', 'drums', 'bags', 'rolls', 'loose', 'other'];
      validTypes.forEach((pt) => {
        const load = {
          ...validBaseLoad,
          packaging_type: pt,
        };
        expect(() => CreateLoadInputSchema.parse(load)).not.toThrow();
      });
    });
  });

  describe('invalid values', () => {
    it('rejects invalid freight_class values', () => {
      const load = {
        ...validBaseLoad,
        freight_class: '999', // Not in enum
      };
      expect(() => CreateLoadInputSchema.parse(load)).toThrow();
    });

    it('rejects invalid packaging_type values', () => {
      const load = {
        ...validBaseLoad,
        packaging_type: 'invalid', // Not in enum
      };
      expect(() => CreateLoadInputSchema.parse(load)).toThrow();
    });

    it('rejects empty string for freight_class', () => {
      const load = {
        ...validBaseLoad,
        freight_class: '', // Empty string should fail
      };
      expect(() => CreateLoadInputSchema.parse(load)).toThrow();
    });

    it('rejects empty string for packaging_type', () => {
      const load = {
        ...validBaseLoad,
        packaging_type: '', // Empty string should fail
      };
      expect(() => CreateLoadInputSchema.parse(load)).toThrow();
    });
  });

  describe('required fields', () => {
    it('rejects load missing posted_by', () => {
      const { posted_by, ...load } = validBaseLoad;
      expect(() => CreateLoadInputSchema.parse(load)).toThrow();
    });

    it('rejects load missing equipment', () => {
      const { equipment, ...load } = validBaseLoad;
      expect(() => CreateLoadInputSchema.parse(load)).toThrow();
    });

    it('rejects load with invalid origin_state (not 2 chars)', () => {
      const load = {
        ...validBaseLoad,
        origin_state: 'TEN', // Must be exactly 2 chars
      };
      expect(() => CreateLoadInputSchema.parse(load)).toThrow();
    });

    it('rejects load with negative rate', () => {
      const load = {
        ...validBaseLoad,
        rate_usd: -100,
      };
      expect(() => CreateLoadInputSchema.parse(load)).toThrow();
    });
  });
});
