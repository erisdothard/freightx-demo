import { describe, it, expect } from 'vitest';

// ─── Onboarding checklist completion logic ────────────────────────────────────

type UserRole = 'carrier' | 'broker' | 'shipper' | 'admin';

interface ChecklistState {
  profileComplete: boolean;
  companyComplete: boolean;
  firstActionDone: boolean;
}

function allStepsDone(state: ChecklistState): boolean {
  return state.profileComplete && state.companyComplete && state.firstActionDone;
}

function completionPercent(state: ChecklistState): number {
  const steps = [state.profileComplete, state.companyComplete, state.firstActionDone];
  return Math.round((steps.filter(Boolean).length / steps.length) * 100);
}

function getFirstActionLabel(role: UserRole): string {
  if (role === 'carrier') return 'Post your first truck';
  if (role === 'broker') return 'Post your first load';
  if (role === 'shipper') return 'Post your first shipment';
  return '';
}

describe('Onboarding checklist state', () => {
  it('returns 0% when nothing done', () => {
    expect(
      completionPercent({ profileComplete: false, companyComplete: false, firstActionDone: false }),
    ).toBe(0);
  });

  it('returns 33% when profile complete', () => {
    expect(
      completionPercent({ profileComplete: true, companyComplete: false, firstActionDone: false }),
    ).toBe(33);
  });

  it('returns 67% when profile + company done', () => {
    expect(
      completionPercent({ profileComplete: true, companyComplete: true, firstActionDone: false }),
    ).toBe(67);
  });

  it('returns 100% when all done', () => {
    expect(
      completionPercent({ profileComplete: true, companyComplete: true, firstActionDone: true }),
    ).toBe(100);
  });

  it('allStepsDone returns true only when all complete', () => {
    expect(
      allStepsDone({ profileComplete: true, companyComplete: true, firstActionDone: true }),
    ).toBe(true);
    expect(
      allStepsDone({ profileComplete: true, companyComplete: true, firstActionDone: false }),
    ).toBe(false);
  });
});

describe('Onboarding first-action label by role', () => {
  it('carrier gets truck label', () => expect(getFirstActionLabel('carrier')).toContain('truck'));
  it('broker gets load label', () => expect(getFirstActionLabel('broker')).toContain('load'));
  it('shipper gets shipment label', () =>
    expect(getFirstActionLabel('shipper')).toContain('shipment'));
  it('admin gets empty string', () => expect(getFirstActionLabel('admin')).toBe(''));
});

// ─── Checklist dismissal ──────────────────────────────────────────────────────

function shouldShowChecklist(allDone: boolean, dismissed: boolean): boolean {
  return !allDone && !dismissed;
}

describe('Checklist visibility', () => {
  it('shows when not done and not dismissed', () => {
    expect(shouldShowChecklist(false, false)).toBe(true);
  });

  it('hides when all done', () => {
    expect(shouldShowChecklist(true, false)).toBe(false);
  });

  it('hides when dismissed', () => {
    expect(shouldShowChecklist(false, true)).toBe(false);
  });
});
