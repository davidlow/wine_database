import { describe, it, expect } from 'vitest';
import { generateId, formatPrice, formatDate, wineTypeLabel, wineTypeColor, wineTypeBorderColor } from '@/lib/utils';

describe('generateId', () => {
  it('returns a non-empty string', () => {
    expect(generateId()).toBeTruthy();
    expect(typeof generateId()).toBe('string');
  });

  it('returns a UUID-shaped string (8-4-4-4-12 hex)', () => {
    const id = generateId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('returns a unique id on each call', () => {
    const ids = new Set(Array.from({ length: 20 }, () => generateId()));
    expect(ids.size).toBe(20);
  });
});

describe('formatPrice', () => {
  it('formats a whole-dollar amount', () => {
    expect(formatPrice(50)).toBe('$50.00');
  });

  it('formats a decimal price', () => {
    expect(formatPrice(29.99)).toBe('$29.99');
  });

  it('formats zero as $0.00', () => {
    expect(formatPrice(0)).toBe('$0.00');
  });

  it('formats large price with commas', () => {
    expect(formatPrice(1250)).toBe('$1,250.00');
  });

  it('returns "N/A" for null', () => {
    expect(formatPrice(null)).toBe('N/A');
  });

  it('returns "N/A" for undefined', () => {
    expect(formatPrice(undefined)).toBe('N/A');
  });
});

describe('formatDate', () => {
  it('formats a valid ISO date string', () => {
    const result = formatDate('2024-03-15T00:00:00Z');
    // Result is locale-dependent but should include 2024 and March/Mar
    expect(result).toMatch(/2024/);
    expect(result).toMatch(/Mar/i);
  });

  it('returns "N/A" for null', () => {
    expect(formatDate(null)).toBe('N/A');
  });

  it('returns "N/A" for undefined', () => {
    expect(formatDate(undefined)).toBe('N/A');
  });

  it('returns "N/A" for empty string', () => {
    expect(formatDate('')).toBe('N/A');
  });
});

describe('wineTypeLabel', () => {
  it('returns "Red" for "red"', () => {
    expect(wineTypeLabel('red')).toBe('Red');
  });

  it('returns "White" for "white"', () => {
    expect(wineTypeLabel('white')).toBe('White');
  });

  it('returns "Rosé" for "rosé"', () => {
    expect(wineTypeLabel('rosé')).toBe('Rosé');
  });

  it('returns "Sparkling" for "sparkling"', () => {
    expect(wineTypeLabel('sparkling')).toBe('Sparkling');
  });

  it('returns "Dessert" for "dessert"', () => {
    expect(wineTypeLabel('dessert')).toBe('Dessert');
  });

  it('returns "Fortified" for "fortified"', () => {
    expect(wineTypeLabel('fortified')).toBe('Fortified');
  });

  it('returns "Other" for "other"', () => {
    expect(wineTypeLabel('other')).toBe('Other');
  });

  it('returns "Unknown" for undefined', () => {
    expect(wineTypeLabel(undefined)).toBe('Unknown');
  });

  it('echoes an unrecognized type string', () => {
    expect(wineTypeLabel('petnat')).toBe('petnat');
  });
});

describe('wineTypeColor', () => {
  it('returns a non-empty class string for each recognized type', () => {
    const types = ['red', 'white', 'rosé', 'sparkling', 'dessert', 'fortified', 'other'] as const;
    types.forEach((type) => {
      const cls = wineTypeColor(type);
      expect(cls).toBeTruthy();
      expect(typeof cls).toBe('string');
    });
  });

  it('red and white have different color classes', () => {
    expect(wineTypeColor('red')).not.toBe(wineTypeColor('white'));
  });

  it('returns a fallback class for undefined', () => {
    const cls = wineTypeColor(undefined);
    expect(cls).toBeTruthy();
  });

  it('returns a fallback class for unrecognized type', () => {
    const cls = wineTypeColor('unknown-type');
    expect(cls).toBeTruthy();
  });
});

describe('wineTypeBorderColor', () => {
  it('returns a ring class for each recognized type', () => {
    const types = ['red', 'white', 'rosé', 'sparkling', 'dessert', 'fortified', 'other'] as const;
    types.forEach((type) => {
      const cls = wineTypeBorderColor(type);
      expect(cls).toMatch(/^ring-/);
    });
  });

  it('red has a darker ring than white', () => {
    expect(wineTypeBorderColor('red')).not.toBe(wineTypeBorderColor('white'));
  });

  it('returns ring-gray-300 for undefined', () => {
    expect(wineTypeBorderColor(undefined)).toBe('ring-gray-300');
  });

  it('returns ring-gray-400 for unrecognized type', () => {
    expect(wineTypeBorderColor('unknown')).toBe('ring-gray-400');
  });
});
