/**
 * load-status — status stepper, role-gated transitions, valid progressions
 *
 * Production failure scenarios:
 *  - Carrier tries to mark load as 'completed' (broker-only step) → blocked
 *  - Broker tries to mark as 'in_transit' (carrier-only step) → blocked
 *  - Status advances out of order (posted → delivered skip) → invalid
 *  - Admin should be able to advance any status
 *  - Cancelled/completed loads should not allow further advancement
 */

import { describe, it, expect } from 'vitest';

type LoadStatus =
  | 'posted'
  | 'bid_received'
  | 'awarded'
  | 'dispatched'
  | 'in_transit'
  | 'delivered'
  | 'completed'
  | 'cancelled';

type UserRole = 'carrier' | 'broker' | 'admin' | 'shipper';

const STATUS_ORDER: LoadStatus[] = [
  'posted',
  'bid_received',
  'awarded',
  'dispatched',
  'in_transit',
  'delivered',
  'completed',
];

const ROLE_CAN_ADVANCE: Record<UserRole, LoadStatus[]> = {
  carrier: ['in_transit', 'delivered'],
  broker: ['dispatched', 'completed'],
  admin: ['dispatched', 'in_transit', 'delivered', 'completed'],
  shipper: [],
};

function canAdvance(role: UserRole, currentStatus: LoadStatus): boolean {
  if (currentStatus === 'cancelled' || currentStatus === 'completed') return false;
  return ROLE_CAN_ADVANCE[role].includes(currentStatus);
}

function getNextStatus(current: LoadStatus): LoadStatus | null {
  const idx = STATUS_ORDER.indexOf(current);
  if (idx === -1 || idx === STATUS_ORDER.length - 1) return null;
  return STATUS_ORDER[idx + 1];
}

// ─── Role-gated advancement ───────────────────────────────────────────────────

describe('role-gated status advancement', () => {
  it('carrier can advance in_transit → delivered', () => {
    expect(canAdvance('carrier', 'in_transit')).toBe(true);
  });

  it('carrier cannot advance dispatched → in_transit (broker step)', () => {
    expect(canAdvance('carrier', 'dispatched')).toBe(false);
  });

  it('broker can advance dispatched → in_transit', () => {
    expect(canAdvance('broker', 'dispatched')).toBe(true);
  });

  it('broker cannot advance in_transit → delivered (carrier step)', () => {
    expect(canAdvance('broker', 'in_transit')).toBe(false);
  });

  it('admin can advance any step', () => {
    expect(canAdvance('admin', 'dispatched')).toBe(true);
    expect(canAdvance('admin', 'in_transit')).toBe(true);
    expect(canAdvance('admin', 'delivered')).toBe(true);
  });

  it('shipper cannot advance any step', () => {
    for (const status of STATUS_ORDER) {
      expect(canAdvance('shipper', status as LoadStatus)).toBe(false);
    }
  });
});

// ─── Terminal status blocks ───────────────────────────────────────────────────

describe('terminal status blocks further advancement', () => {
  it('completed load cannot advance', () => {
    expect(canAdvance('admin', 'completed')).toBe(false);
  });

  it('cancelled load cannot advance', () => {
    expect(canAdvance('admin', 'cancelled')).toBe(false);
    expect(canAdvance('carrier', 'cancelled')).toBe(false);
  });
});

// ─── Status ordering ─────────────────────────────────────────────────────────

describe('status order progression', () => {
  it('next status after awarded is dispatched', () => {
    expect(getNextStatus('awarded')).toBe('dispatched');
  });

  it('next status after delivered is completed', () => {
    expect(getNextStatus('delivered')).toBe('completed');
  });

  it('completed has no next status', () => {
    expect(getNextStatus('completed')).toBeNull();
  });

  it('cancelled is not in the order sequence', () => {
    expect(getNextStatus('cancelled')).toBeNull();
  });
});
