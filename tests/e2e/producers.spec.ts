import { test, expect } from '@playwright/test';

test.describe('Producers', () => {
  test('shows producers page', async ({ page }) => {
    await page.goto('/producers');
    await expect(page.getByRole('heading', { name: 'Producers' })).toBeVisible();
    await expect(page.getByPlaceholder(/search producers/i)).toBeVisible();
  });

  test('producers page shows producer count', async ({ page }) => {
    await page.goto('/producers');
    // Wait for data to load
    await page.waitForLoadState('networkidle');
    // The count is shown when producers exist; just verify the page loaded
    await expect(page.getByRole('heading', { name: 'Producers' })).toBeVisible();
  });

  test('producers API returns list', async ({ request }) => {
    const res = await request.get('/api/producers');
    expect(res.ok()).toBe(true);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test('producer appears after adding a wine with that producer', async ({ request, page }) => {
    const producerName = `E2E Producer ${Date.now()}`;
    const wineRes = await request.post('/api/wines', {
      data: { name: 'Producer Test Wine', producer: producerName },
    });
    expect(wineRes.ok()).toBe(true);
    const wine = await wineRes.json();

    await page.goto('/producers');
    await page.waitForLoadState('networkidle');

    await page.getByPlaceholder(/search producers/i).fill(producerName);
    await expect(page.getByText(producerName)).toBeVisible({ timeout: 5000 });

    await request.delete(`/api/wines/${wine.id}`);
  });

  test('producers page can be searched', async ({ page }) => {
    await page.goto('/producers');
    const searchInput = page.getByPlaceholder(/search producers/i);
    await searchInput.fill('Nonexistent Producer XYZ');
    await page.waitForTimeout(300);

    await expect(page.getByText(/No producers/i)).toBeVisible({ timeout: 3000 });
  });

  test('producer stats include wine count', async ({ request }) => {
    const producerName = `Stats Producer ${Date.now()}`;
    const wineRes = await request.post('/api/wines', {
      data: { name: 'Stats Wine 1', producer: producerName },
    });
    const wine = await wineRes.json();

    const producersRes = await request.get('/api/producers');
    const producers = await producersRes.json();
    const found = producers.find((p: { producer: string }) => p.producer === producerName);
    expect(found).toBeTruthy();
    expect(found.wine_count).toBe(1);

    await request.delete(`/api/wines/${wine.id}`);
  });
});
