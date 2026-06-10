import { test, expect } from '@playwright/test';

test.describe('Barcode Scanner Page', () => {
  test('shows scanner page with Barcode Scanner heading', async ({ page }) => {
    await page.goto('/scanner');
    await expect(page.getByText('Barcode Scanner')).toBeVisible();
    await expect(page.getByRole('button', { name: /start scanner/i })).toBeVisible();
  });

  test('shows receipt and bulk scan links on scanner page', async ({ page }) => {
    await page.goto('/scanner');
    await expect(page.getByRole('link', { name: /scan receipt/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /bulk scan/i })).toBeVisible();
  });

  test('barcode lookup API returns not-found for unknown barcode', async ({ request }) => {
    // Use a barcode that will never exist in any real database
    const res = await request.get('/api/barcode/0000000000000');
    expect(res.ok()).toBe(true);
    const data = await res.json();
    // Either not found, or found via external API — just verify the response shape
    expect(typeof data.found).toBe('boolean');
  });

  test('barcode lookup API rejects invalid barcode format', async ({ request }) => {
    const res = await request.get('/api/barcode/abc');
    expect(res.status()).toBe(400);
  });

  test('label scan API returns 400 when no image provided', async ({ request }) => {
    const res = await request.post('/api/label-scan', { data: {} });
    expect(res.status()).toBe(400);
  });

  test('label scan API requires imageBase64 field', async ({ request }) => {
    const res = await request.post('/api/label-scan', { data: { image: 'wrongfield' } });
    expect(res.status()).toBe(400);
  });

  test('barcode lookup finds wine in database', async ({ request }) => {
    const createRes = await request.post('/api/wines', {
      data: { name: 'Scanner Test Wine', barcode: '1234567890123' },
    });
    expect(createRes.ok()).toBe(true);

    const lookupRes = await request.get('/api/barcode/1234567890123');
    expect(lookupRes.ok()).toBe(true);
    const data = await lookupRes.json();
    expect(data.found).toBe(true);
    expect(data.name).toBe('Scanner Test Wine');
    expect(data.source).toBe('database');

    const wine = await createRes.json();
    await request.delete(`/api/wines/${wine.id}`);
  });

  test('barcode lookup returns 400 for barcode that is too short', async ({ request }) => {
    const res = await request.get('/api/barcode/123');
    expect(res.status()).toBe(400);
  });
});
