import { describe, it, expect } from 'vitest';
import { extractScannedWines } from '@/lib/receipt-scan';

const VALID_RESPONSE = JSON.stringify([
  {
    name: 'Cabernet Sauvignon Reserve',
    producer: 'Jordan Winery',
    vintage_year: 2019,
    variety: 'Cabernet Sauvignon',
    wine_type: 'red',
    quantity: 2,
    unit_price: 65.00,
    confidence: 0.98,
  },
  {
    name: 'Chardonnay Estate',
    producer: 'Sonoma-Cutrer',
    vintage_year: 2021,
    variety: 'Chardonnay',
    wine_type: 'white',
    quantity: 1,
    unit_price: 42.00,
    confidence: 0.95,
  },
]);

describe('extractScannedWines', () => {
  it('parses a well-formed JSON array', () => {
    const result = extractScannedWines(VALID_RESPONSE);
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('Cabernet Sauvignon Reserve');
    expect(result[0].producer).toBe('Jordan Winery');
    expect(result[0].vintage_year).toBe(2019);
    expect(result[0].quantity).toBe(2);
    expect(result[0].unit_price).toBe(65.00);
    expect(result[0].confidence).toBe(0.98);
  });

  it('strips markdown code fences', () => {
    const fenced = '```json\n' + VALID_RESPONSE + '\n```';
    const result = extractScannedWines(fenced);
    expect(result).toHaveLength(2);
  });

  it('strips plain code fences', () => {
    const fenced = '```\n' + VALID_RESPONSE + '\n```';
    const result = extractScannedWines(fenced);
    expect(result).toHaveLength(2);
  });

  it('extracts JSON array embedded in surrounding text', () => {
    const wrapped = 'Sure! Here are the wines:\n' + VALID_RESPONSE + '\nHope that helps.';
    const result = extractScannedWines(wrapped);
    expect(result).toHaveLength(2);
  });

  it('returns empty array for empty JSON array', () => {
    expect(extractScannedWines('[]')).toEqual([]);
  });

  it('returns empty array for non-JSON response', () => {
    expect(extractScannedWines('No wines found in this image.')).toEqual([]);
  });

  it('skips items without a name field', () => {
    const data = JSON.stringify([
      { producer: 'Orphan', quantity: 1 },
      { name: 'Good Wine', quantity: 1 },
    ]);
    const result = extractScannedWines(data);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Good Wine');
  });

  it('defaults quantity to 1 when missing or invalid', () => {
    const data = JSON.stringify([{ name: 'Test Wine' }]);
    const result = extractScannedWines(data);
    expect(result[0].quantity).toBe(1);
  });

  it('rejects unrealistic vintage years', () => {
    const data = JSON.stringify([{ name: 'Test', vintage_year: 1800 }, { name: 'Test2', vintage_year: 2020 }]);
    const result = extractScannedWines(data);
    expect(result[0].vintage_year).toBeUndefined();
    expect(result[1].vintage_year).toBe(2020);
  });

  it('clamps confidence to [0, 1]', () => {
    const data = JSON.stringify([
      { name: 'A', confidence: 1.5 },
      { name: 'B', confidence: -0.2 },
    ]);
    const result = extractScannedWines(data);
    expect(result[0].confidence).toBe(1);
    expect(result[1].confidence).toBe(0);
  });

  it('rounds fractional quantities', () => {
    const data = JSON.stringify([{ name: 'Half', quantity: 1.7 }]);
    const result = extractScannedWines(data);
    expect(result[0].quantity).toBe(2);
  });

  it('preserves undefined for optional fields when absent', () => {
    const data = JSON.stringify([{ name: 'Minimal Wine', quantity: 1 }]);
    const result = extractScannedWines(data);
    expect(result[0].producer).toBeUndefined();
    expect(result[0].vintage_year).toBeUndefined();
    expect(result[0].unit_price).toBeUndefined();
  });

  it('handles empty producer string by returning undefined', () => {
    const data = JSON.stringify([{ name: 'Wine', producer: '', quantity: 1 }]);
    const result = extractScannedWines(data);
    expect(result[0].producer).toBeUndefined();
  });
});
