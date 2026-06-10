import { test, expect } from '@playwright/test';

test.describe('Wine Search & Filters', () => {
  const createdWineIds: string[] = [];

  test.afterEach(async ({ request }) => {
    for (const id of createdWineIds) {
      await request.delete(`/api/wines/${id}`).catch(() => {});
    }
    createdWineIds.length = 0;
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function createWine(request: any, data: Record<string, unknown>) {
    const res = await request.post('/api/wines', { data });
    expect(res.ok()).toBe(true);
    const wine = await res.json();
    createdWineIds.push(wine.id);
    return wine;
  }

  test('GET /api/wines filters by drink_status=past_peak', async ({ request }) => {
    await createWine(request, { name: 'Past Peak Wine', drink_by_year: 2010 });
    await createWine(request, { name: 'Current Window Wine', drink_from_year: 2020, drink_by_year: 2035 });

    const currentYear = new Date().getFullYear();
    const res = await request.get('/api/wines?drink_status=past_peak');
    expect(res.ok()).toBe(true);
    const wines = await res.json();
    const names = wines.map((w: { name: string }) => w.name);
    expect(names).toContain('Past Peak Wine');
    expect(names).not.toContain('Current Window Wine');
    // Only count wines with drink_by_year < currentYear
    for (const w of wines) {
      expect(w.drink_by_year).toBeLessThan(currentYear);
    }
  });

  test('GET /api/wines filters by drink_status=too_young', async ({ request }) => {
    await createWine(request, { name: 'Too Young Wine', drink_from_year: 2099 });
    await createWine(request, { name: 'Ready Wine', drink_from_year: 2010, drink_by_year: 2035 });

    const res = await request.get('/api/wines?drink_status=too_young');
    expect(res.ok()).toBe(true);
    const wines = await res.json();
    const names = wines.map((w: { name: string }) => w.name);
    expect(names).toContain('Too Young Wine');
    expect(names).not.toContain('Ready Wine');
  });

  test('GET /api/wines filters by drink_status=in_window', async ({ request }) => {
    const currentYear = new Date().getFullYear();
    await createWine(request, {
      name: 'In Window Wine',
      drink_from_year: currentYear - 2,
      drink_by_year: currentYear + 5,
    });
    await createWine(request, { name: 'Too Young For Window', drink_from_year: currentYear + 10 });

    const res = await request.get('/api/wines?drink_status=in_window');
    expect(res.ok()).toBe(true);
    const wines = await res.json();
    const names = wines.map((w: { name: string }) => w.name);
    expect(names).toContain('In Window Wine');
    expect(names).not.toContain('Too Young For Window');
  });

  test('GET /api/wines filters by vintage_year', async ({ request }) => {
    await createWine(request, { name: 'Vintage 2015 Wine', vintage_year: 2015 });
    await createWine(request, { name: 'Vintage 2022 Wine', vintage_year: 2022 });

    const res = await request.get('/api/wines?vintage_year=2015');
    expect(res.ok()).toBe(true);
    const wines = await res.json();
    const names = wines.map((w: { name: string }) => w.name);
    expect(names).toContain('Vintage 2015 Wine');
    expect(names).not.toContain('Vintage 2022 Wine');
  });

  test('GET /api/wines filters by price_min and price_max', async ({ request }) => {
    await createWine(request, { name: 'Budget Wine', average_price: 15 });
    await createWine(request, { name: 'Mid Range Wine', average_price: 45 });
    await createWine(request, { name: 'Luxury Wine', average_price: 150 });

    const res = await request.get('/api/wines?price_min=30&price_max=100');
    expect(res.ok()).toBe(true);
    const wines = await res.json();
    const names = wines.map((w: { name: string }) => w.name);
    expect(names).toContain('Mid Range Wine');
    expect(names).not.toContain('Budget Wine');
    expect(names).not.toContain('Luxury Wine');
  });

  test('GET /api/wines filters by structural score range', async ({ request }) => {
    await createWine(request, { name: 'High Tannin Wine', tannin: 5, acidity: 3 });
    await createWine(request, { name: 'Low Tannin Wine', tannin: 1, acidity: 3 });

    const res = await request.get('/api/wines?tannin_min=4');
    expect(res.ok()).toBe(true);
    const wines = await res.json();
    const names = wines.map((w: { name: string }) => w.name);
    expect(names).toContain('High Tannin Wine');
    expect(names).not.toContain('Low Tannin Wine');
  });

  test('GET /api/wines/facets returns varieties matching query', async ({ request }) => {
    await createWine(request, { name: 'Facet Cabernet', variety: 'Cabernet Sauvignon' });

    const res = await request.get('/api/wines/facets?field=variety&q=cabernet');
    expect(res.ok()).toBe(true);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.some((v: string) => v.toLowerCase().includes('cabernet'))).toBe(true);
  });

  test('GET /api/wines/facets returns 400 for disallowed field', async ({ request }) => {
    const res = await request.get('/api/wines/facets?field=id');
    expect(res.status()).toBe(400);
  });

  test('GET /api/wines/expiring returns wines with drink window info', async ({ request }) => {
    const currentYear = new Date().getFullYear();
    await createWine(request, {
      name: 'Expiring Soon Wine',
      drink_from_year: currentYear - 3,
      drink_by_year: currentYear + 1,
    });

    const res = await request.get('/api/wines/expiring');
    expect(res.ok()).toBe(true);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    // Expiring wines should have status field
    if (data.length > 0) {
      expect(data[0]).toHaveProperty('status');
    }
  });

  test('GET /api/wines filters combine wine_type and query', async ({ request }) => {
    await createWine(request, { name: 'Combo Red Bordeaux', wine_type: 'red', region: 'Bordeaux' });
    await createWine(request, { name: 'Combo White Bordeaux', wine_type: 'white', region: 'Bordeaux' });

    const res = await request.get('/api/wines?wine_type=red&query=Bordeaux');
    expect(res.ok()).toBe(true);
    const wines = await res.json();
    const names = wines.map((w: { name: string }) => w.name);
    expect(names).toContain('Combo Red Bordeaux');
    expect(names).not.toContain('Combo White Bordeaux');
  });
});
