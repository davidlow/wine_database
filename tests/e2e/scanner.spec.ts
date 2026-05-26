import { test, expect } from '@playwright/test';

test.describe('Barcode Scanner Page', () => {
  test('shows scanner page with camera section and label scan stub', async ({ page }) => {
    await page.goto('/scanner');
    await expect(page.getByText('Barcode Scanner')).toBeVisible();
    await expect(page.getByRole('button', { name: /start scanner/i })).toBeVisible();
    await expect(page.getByText(/scan label.*coming soon/i)).toBeVisible();
  });

  test('barcode lookup API returns not-found for unknown barcode', async ({ request }) => {
    const res = await request.get('/api/barcode/9999999999999');
    expect(res.ok()).toBe(true);
    const data = await res.json();
    expect(data.found).toBe(false);
  });

  test('barcode lookup API rejects invalid barcode format', async ({ request }) => {
    const res = await request.get('/api/barcode/abc');
    expect(res.status()).toBe(400);
  });

  test('label scan API returns 501 Not Implemented', async ({ request }) => {
    const res = await request.post('/api/label-scan', { data: { image: 'base64data' } });
    expect(res.status()).toBe(501);
  });

  test('barcode lookup finds wine in database', async ({ request }) => {
    // First create a wine with a known barcode
    const createRes = await request.post('/api/wines', {
      data: { name: 'Scanner Test Wine', barcode: '1234567890123' },
    });
    expect(createRes.ok()).toBe(true);

    // Now look it up by barcode
    const lookupRes = await request.get('/api/barcode/1234567890123');
    expect(lookupRes.ok()).toBe(true);
    const data = await lookupRes.json();
    expect(data.found).toBe(true);
    expect(data.name).toBe('Scanner Test Wine');
    expect(data.source).toBe('database');

    // Clean up
    const wine = await createRes.json();
    await request.delete(`/api/wines/${wine.id}`);
  });
});
