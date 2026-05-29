import { describe, it, expect } from 'vitest';
import { parseSortString, serializeSortKeys } from '@/components/WineSort';

describe('parseSortString', () => {
  it('returns empty array for undefined', () => {
    expect(parseSortString(undefined)).toEqual([]);
  });

  it('parses single asc key', () => {
    expect(parseSortString('name:asc')).toEqual([{ field: 'name', dir: 'asc' }]);
  });

  it('parses single desc key', () => {
    expect(parseSortString('price:desc')).toEqual([{ field: 'price', dir: 'desc' }]);
  });

  it('defaults unknown dir to asc', () => {
    expect(parseSortString('vintage:up')).toEqual([{ field: 'vintage', dir: 'asc' }]);
  });

  it('parses multiple keys preserving order', () => {
    expect(parseSortString('drink_until:asc,price:desc')).toEqual([
      { field: 'drink_until', dir: 'asc' },
      { field: 'price', dir: 'desc' },
    ]);
  });
});

describe('serializeSortKeys', () => {
  it('returns undefined for empty array', () => {
    expect(serializeSortKeys([])).toBeUndefined();
  });

  it('serializes single key', () => {
    expect(serializeSortKeys([{ field: 'name', dir: 'asc' }])).toBe('name:asc');
  });

  it('serializes multiple keys in order', () => {
    expect(serializeSortKeys([
      { field: 'drink_until', dir: 'asc' },
      { field: 'price', dir: 'desc' },
    ])).toBe('drink_until:asc,price:desc');
  });

  it('round-trips through parseSortString', () => {
    const keys = [{ field: 'producer', dir: 'asc' as const }, { field: 'vintage', dir: 'desc' as const }];
    expect(parseSortString(serializeSortKeys(keys))).toEqual(keys);
  });
});
