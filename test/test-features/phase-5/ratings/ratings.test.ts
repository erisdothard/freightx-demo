import { describe, it, expect } from 'vitest';

// ─── Rating validation ────────────────────────────────────────────────────────

function validateRating(params: {
  overall: number;
  communication?: number;
  reliability?: number;
  professionalism?: number;
  comment?: string;
}): string | null {
  if (!Number.isInteger(params.overall) || params.overall < 1 || params.overall > 5) {
    return 'Overall rating must be 1–5';
  }
  for (const key of ['communication', 'reliability', 'professionalism'] as const) {
    const val = params[key];
    if (val !== undefined && (val < 1 || val > 5)) {
      return `${key} must be 1–5`;
    }
  }
  if (params.comment && params.comment.length > 500) {
    return 'Comment exceeds 500 characters';
  }
  return null;
}

describe('Rating validation', () => {
  it('accepts a valid overall rating of 5', () => {
    expect(validateRating({ overall: 5 })).toBeNull();
  });

  it('rejects overall rating of 0', () => {
    expect(validateRating({ overall: 0 })).not.toBeNull();
  });

  it('rejects overall rating of 6', () => {
    expect(validateRating({ overall: 6 })).not.toBeNull();
  });

  it('rejects non-integer overall', () => {
    expect(validateRating({ overall: 4.5 })).not.toBeNull();
  });

  it('rejects sub-rating of 6', () => {
    expect(validateRating({ overall: 4, communication: 6 })).not.toBeNull();
  });

  it('accepts sub-rating of 1', () => {
    expect(validateRating({ overall: 3, reliability: 1 })).toBeNull();
  });

  it('rejects comment over 500 chars', () => {
    const longComment = 'a'.repeat(501);
    expect(validateRating({ overall: 4, comment: longComment })).not.toBeNull();
  });

  it('accepts comment of exactly 500 chars', () => {
    const maxComment = 'b'.repeat(500);
    expect(validateRating({ overall: 4, comment: maxComment })).toBeNull();
  });
});

// ─── Average rating calculation ───────────────────────────────────────────────

interface RatingRow {
  overall: number;
}

function calcAverageRating(ratings: RatingRow[]): number | null {
  if (!ratings.length) return null;
  const sum = ratings.reduce((acc, r) => acc + r.overall, 0);
  return Math.round((sum / ratings.length) * 10) / 10;
}

describe('Average rating calculation', () => {
  it('returns null for empty ratings array', () => {
    expect(calcAverageRating([])).toBeNull();
  });

  it('returns the single rating when only one', () => {
    expect(calcAverageRating([{ overall: 4 }])).toBe(4);
  });

  it('calculates average of 3 ratings correctly', () => {
    const ratings = [{ overall: 5 }, { overall: 3 }, { overall: 4 }];
    expect(calcAverageRating(ratings)).toBe(4);
  });

  it('rounds to one decimal place', () => {
    const ratings = [{ overall: 5 }, { overall: 4 }, { overall: 3 }];
    // avg = 12/3 = 4.0
    expect(calcAverageRating(ratings)).toBe(4);
  });

  it('handles all 1-star ratings', () => {
    const ratings = Array.from({ length: 5 }, () => ({ overall: 1 }));
    expect(calcAverageRating(ratings)).toBe(1);
  });

  it('handles all 5-star ratings', () => {
    const ratings = Array.from({ length: 10 }, () => ({ overall: 5 }));
    expect(calcAverageRating(ratings)).toBe(5);
  });
});

// ─── One-rating-per-load constraint ──────────────────────────────────────────

interface ExistingRating {
  load_id: string;
  rater_id: string;
}

function canSubmitRating(loadId: string, raterId: string, existing: ExistingRating[]): boolean {
  return !existing.some((r) => r.load_id === loadId && r.rater_id === raterId);
}

describe('One-rating-per-load constraint', () => {
  const existing: ExistingRating[] = [
    { load_id: 'load-1', rater_id: 'user-A' },
    { load_id: 'load-2', rater_id: 'user-B' },
  ];

  it('allows rating when no prior rating for this load/rater', () => {
    expect(canSubmitRating('load-1', 'user-B', existing)).toBe(true);
  });

  it('blocks duplicate rating for same load and rater', () => {
    expect(canSubmitRating('load-1', 'user-A', existing)).toBe(false);
  });

  it('allows same user to rate a different load', () => {
    expect(canSubmitRating('load-3', 'user-A', existing)).toBe(true);
  });

  it('blocks same rater same load even with many existing ratings', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({
      load_id: `load-${i}`,
      rater_id: 'user-A',
    }));
    many.push({ load_id: 'target-load', rater_id: 'user-A' });
    expect(canSubmitRating('target-load', 'user-A', many)).toBe(false);
  });
});
