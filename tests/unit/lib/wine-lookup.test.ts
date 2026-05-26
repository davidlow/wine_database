import { describe, it, expect, vi, beforeEach } from 'vitest';
import { lookupByBarcodeOpenFoodFacts } from '@/lib/wine-lookup/open-food-facts';

// Mock global fetch
beforeEach(() => {
  vi.restoreAllMocks();
});

function mockFetch(response: unknown, ok = true) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok,
    json: async () => response,
  }));
}

describe('lookupByBarcodeOpenFoodFacts', () => {
  it('returns found=true for a valid wine product', async () => {
    mockFetch({
      status: 1,
      product: {
        product_name: 'Chateau Test Red Wine',
        brands: 'Test Winery',
        countries_tags: ['en:france'],
        categories_tags: ['en:red-wines', 'en:wines'],
        nutriments: { alcohol: 13.5 },
        image_url: 'https://example.com/wine.jpg',
      },
    });

    const result = await lookupByBarcodeOpenFoodFacts('0123456789012');
    expect(result.found).toBe(true);
    expect(result.name).toBe('Chateau Test Red Wine');
    expect(result.producer).toBe('Test Winery');
    expect(result.wine_type).toBe('red');
    expect(result.country).toBe('France');
    expect(result.alcohol_content).toBe(13.5);
    expect(result.source).toBe('openfoodfacts');
  });

  it('returns found=false when product status is 0', async () => {
    mockFetch({ status: 0 });
    const result = await lookupByBarcodeOpenFoodFacts('0000000000000');
    expect(result.found).toBe(false);
  });

  it('returns found=false for non-ok HTTP response', async () => {
    mockFetch({}, false);
    const result = await lookupByBarcodeOpenFoodFacts('0000000000001');
    expect(result.found).toBe(false);
  });

  it('detects sparkling wine type from categories', async () => {
    mockFetch({
      status: 1,
      product: {
        product_name: 'Test Champagne',
        categories_tags: ['en:champagnes', 'en:sparkling-wines'],
        countries_tags: ['en:france'],
      },
    });

    const result = await lookupByBarcodeOpenFoodFacts('0123000000001');
    expect(result.wine_type).toBe('sparkling');
  });

  it('detects rosé wine type from categories', async () => {
    mockFetch({
      status: 1,
      product: {
        product_name: 'Test Rosé',
        categories_tags: ['en:rose-wines'],
        countries_tags: ['en:france'],
      },
    });

    const result = await lookupByBarcodeOpenFoodFacts('0123000000002');
    expect(result.wine_type).toBe('rosé');
  });

  it('handles fetch errors gracefully', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));
    const result = await lookupByBarcodeOpenFoodFacts('0123456789013');
    expect(result.found).toBe(false);
  });

  it('returns found=false when product has no name', async () => {
    mockFetch({
      status: 1,
      product: {
        brands: 'Some Brand',
        categories_tags: ['en:wines'],
      },
    });

    const result = await lookupByBarcodeOpenFoodFacts('0123456789014');
    expect(result.found).toBe(false);
  });
});

describe('label scan stub', () => {
  it('throws NotImplementedError', async () => {
    const { scanLabel, NotImplementedError } = await import('@/lib/wine-lookup/label-scan');
    await expect(scanLabel('base64data')).rejects.toThrow(NotImplementedError);
  });
});
