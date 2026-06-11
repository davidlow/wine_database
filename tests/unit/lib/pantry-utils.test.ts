import { describe, it, expect } from 'vitest';
import { computeUsagePrediction, formatDays } from '@/lib/pantry-utils';
import type { PantryTransaction } from '@/types';

// ─── computeUsagePrediction ───────────────────────────────────────────────────

function makeTx(
  overrides: Partial<PantryTransaction> & { created_at: string }
): PantryTransaction {
  return {
    id: Math.random().toString(36).slice(2),
    pantry_item_id: 'item-1',
    profile_id: 'profile-1',
    action: 'remove',
    quantity: 1,
    item_name: 'Test Item',
    ...overrides,
  };
}

describe('computeUsagePrediction', () => {
  it('returns null when there are no transactions', () => {
    expect(computeUsagePrediction([], 'Test Item')).toBeNull();
  });

  it('returns null when there is only one remove event', () => {
    const txns = [makeTx({ created_at: '2026-01-01T10:00:00.000Z' })];
    expect(computeUsagePrediction(txns, 'Test Item')).toBeNull();
  });

  it('returns null when all removes happened on the same day (< 0.1 day apart)', () => {
    const txns = [
      makeTx({ created_at: '2026-01-01T10:00:00.000Z' }),
      makeTx({ created_at: '2026-01-01T10:01:00.000Z' }), // 1 minute later
    ];
    expect(computeUsagePrediction(txns, 'Test Item')).toBeNull();
  });

  it('computes daysPerUnit correctly with 2 removes', () => {
    const txns = [
      makeTx({ created_at: '2026-01-01T00:00:00.000Z', quantity: 1 }),
      makeTx({ created_at: '2026-02-01T00:00:00.000Z', quantity: 1 }), // 31 days later
    ];
    const result = computeUsagePrediction(txns, 'Test Item');
    expect(result).not.toBeNull();
    // 31 days / 2 units = 15.5 days per unit
    expect(result!.daysPerUnit).toBeCloseTo(31 / 2, 1);
    expect(result!.eventCount).toBe(2);
  });

  it('accounts for total quantity removed across multiple events', () => {
    const txns = [
      makeTx({ created_at: '2026-01-01T00:00:00.000Z', quantity: 2 }),
      makeTx({ created_at: '2026-01-31T00:00:00.000Z', quantity: 3 }), // 30 days, 5 total units
    ];
    const result = computeUsagePrediction(txns, 'Test Item');
    expect(result).not.toBeNull();
    expect(result!.daysPerUnit).toBeCloseTo(30 / 5, 1); // 6 days per unit
  });

  it('returns eventCount equal to number of remove transactions', () => {
    const txns = [
      makeTx({ created_at: '2026-01-01T00:00:00.000Z' }),
      makeTx({ created_at: '2026-01-15T00:00:00.000Z' }),
      makeTx({ created_at: '2026-02-01T00:00:00.000Z' }),
    ];
    const result = computeUsagePrediction(txns, 'Test Item');
    expect(result!.eventCount).toBe(3);
  });

  it('filters by item name case-insensitively', () => {
    const txns = [
      makeTx({ created_at: '2026-01-01T00:00:00.000Z', item_name: 'tide pods' }),
      makeTx({ created_at: '2026-02-01T00:00:00.000Z', item_name: 'TIDE PODS' }),
    ];
    const result = computeUsagePrediction(txns, 'Tide Pods');
    expect(result).not.toBeNull();
  });

  it('ignores add transactions', () => {
    const txns: PantryTransaction[] = [
      { ...makeTx({ created_at: '2025-01-01T00:00:00.000Z' }), action: 'add' },
      makeTx({ created_at: '2026-01-01T00:00:00.000Z' }),
      // Only 1 remove event, should return null
    ];
    expect(computeUsagePrediction(txns, 'Test Item')).toBeNull();
  });

  it('ignores transactions from other items', () => {
    const txns = [
      makeTx({ created_at: '2026-01-01T00:00:00.000Z', item_name: 'Other Item' }),
      makeTx({ created_at: '2026-02-01T00:00:00.000Z', item_name: 'Other Item' }),
    ];
    expect(computeUsagePrediction(txns, 'Test Item')).toBeNull();
  });

  it('respects resetDate — ignores transactions before it', () => {
    const txns = [
      makeTx({ created_at: '2025-01-01T00:00:00.000Z' }),
      makeTx({ created_at: '2025-06-01T00:00:00.000Z' }),
      // Only these two should be ignored if resetDate is 2026-01-01
      makeTx({ created_at: '2026-03-01T00:00:00.000Z' }),
      // Only one event after reset, returns null
    ];
    expect(computeUsagePrediction(txns, 'Test Item', '2026-01-01')).toBeNull();
  });

  it('uses transactions on or after resetDate', () => {
    const txns = [
      makeTx({ created_at: '2025-01-01T00:00:00.000Z' }), // ignored (before reset)
      makeTx({ created_at: '2026-01-01T00:00:00.000Z' }), // included (on reset date)
      makeTx({ created_at: '2026-02-01T00:00:00.000Z' }), // included
    ];
    const result = computeUsagePrediction(txns, 'Test Item', '2026-01-01');
    expect(result).not.toBeNull();
    expect(result!.eventCount).toBe(2);
  });

  it('works when resetDate is null (no filter)', () => {
    const txns = [
      makeTx({ created_at: '2020-01-01T00:00:00.000Z' }),
      makeTx({ created_at: '2020-02-01T00:00:00.000Z' }),
    ];
    expect(computeUsagePrediction(txns, 'Test Item', null)).not.toBeNull();
  });

  it('handles transactions out of chronological order', () => {
    const txns = [
      makeTx({ created_at: '2026-02-01T00:00:00.000Z', quantity: 1 }),
      makeTx({ created_at: '2026-01-01T00:00:00.000Z', quantity: 1 }),
    ];
    const result = computeUsagePrediction(txns, 'Test Item');
    // Should sort correctly: 31-day span / 2 units
    expect(result).not.toBeNull();
    expect(result!.daysPerUnit).toBeCloseTo(31 / 2, 0);
  });
});

// ─── formatDays ──────────────────────────────────────────────────────────────

describe('formatDays', () => {
  it('returns "1 day" for 0 days', () => {
    expect(formatDays(0)).toBe('1 day');
  });

  it('returns "1 day" for 1 day', () => {
    expect(formatDays(1)).toBe('1 day');
  });

  it('returns "1 day" for values < 2', () => {
    expect(formatDays(1.5)).toBe('1 day');
  });

  it('returns days string for 2–13 days', () => {
    expect(formatDays(2)).toBe('2 days');
    expect(formatDays(7)).toBe('7 days');
    expect(formatDays(13)).toBe('13 days');
  });

  it('returns weeks string for 14–55 days', () => {
    expect(formatDays(14)).toBe('2 weeks');
    expect(formatDays(21)).toBe('3 weeks');
    expect(formatDays(28)).toBe('4 weeks');
    expect(formatDays(55)).toBe('8 weeks');
  });

  it('returns months string for 56–364 days', () => {
    expect(formatDays(56)).toBe('2 months');
    expect(formatDays(90)).toBe('3 months');
    expect(formatDays(180)).toBe('6 months');
    expect(formatDays(330)).toBe('11 months');
  });

  it('returns years string for 365+ days', () => {
    expect(formatDays(365)).toBe('1.0 years');
    expect(formatDays(730)).toBe('2.0 years');
    expect(formatDays(547)).toBe('1.5 years');
  });
});
