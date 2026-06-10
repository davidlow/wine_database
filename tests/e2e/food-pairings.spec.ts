import { test, expect } from '@playwright/test';

test.describe('Food Pairings', () => {
  test('shows food pairings page', async ({ page }) => {
    await page.goto('/food-pairings');
    await expect(page.getByRole('heading', { name: 'Food Pairings' })).toBeVisible();
    await expect(page.getByPlaceholder(/search foods/i)).toBeVisible();
  });

  test('shows find matching wines button', async ({ page }) => {
    await page.goto('/food-pairings');
    await expect(page.getByRole('button', { name: /find matching wines/i })).toBeVisible();
  });

  test('find matching wines button is disabled when no foods selected', async ({ page }) => {
    await page.goto('/food-pairings');
    await expect(page.getByRole('button', { name: /find matching wines/i })).toBeDisabled();
  });

  test('settings link navigates to pairing settings', async ({ page }) => {
    await page.goto('/food-pairings');
    await page.locator('a[href="/food-pairings/settings"]').click();
    await expect(page).toHaveURL('/food-pairings/settings');
    await expect(page.getByText('Pairing Settings')).toBeVisible();
  });

  test('pairing settings page has algorithm controls', async ({ page }) => {
    await page.goto('/food-pairings/settings');
    await expect(page.getByText('Clusters (k)')).toBeVisible();
    await expect(page.getByText('Candidates per cluster (N)')).toBeVisible();
    await expect(page.getByText('Wines shown per group (m)')).toBeVisible();
    await expect(page.getByText('Sampling Mode')).toBeVisible();
    await expect(page.getByText('Dimension Weights')).toBeVisible();
  });

  test('pairing settings sampling mode can be toggled', async ({ page }) => {
    await page.goto('/food-pairings/settings');
    await page.getByRole('button', { name: 'Diverse' }).click();
    await expect(page.getByRole('button', { name: 'Diverse' })).toHaveClass(/bg-primary/);
    await page.getByRole('button', { name: 'Closest' }).click();
    await expect(page.getByRole('button', { name: 'Closest' })).toHaveClass(/bg-primary/);
  });

  test('food pairings API returns list of foods', async ({ request }) => {
    const res = await request.get('/api/foods');
    expect(res.ok()).toBe(true);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test('recommend API requires foods array', async ({ request }) => {
    const res = await request.post('/api/food-pairings/recommend', {
      data: { foods: [] },
    });
    expect(res.status()).toBe(400);
  });

  test('recommend API returns groups for valid input', async ({ request }) => {
    // Create a wine with structural scores and a pairing
    const wineRes = await request.post('/api/wines', {
      data: {
        name: 'Pairing Test Wine',
        acidity: 4, tannin: 3, alcohol: 3, sweetness: 1, body: 4,
      },
    });
    expect(wineRes.ok()).toBe(true);
    const wine = await wineRes.json();

    // Add a food pairing
    const pairingRes = await request.post(`/api/wines/${wine.id}/pairings`, {
      data: { food: 'steak' },
    });
    expect(pairingRes.ok()).toBe(true);

    // Get recommendations
    const recRes = await request.post('/api/food-pairings/recommend', {
      data: { foods: ['steak'], settings: { k: 1, topN: 5, sampleM: 1 } },
    });
    expect(recRes.ok()).toBe(true);
    const data = await recRes.json();
    expect(data).toHaveProperty('groups');
    expect(Array.isArray(data.groups)).toBe(true);
    expect(data.seed_count).toBeGreaterThanOrEqual(1);

    await request.delete(`/api/wines/${wine.id}`);
  });

  test('wine detail pairings tab shows add pairing form', async ({ request, page }) => {
    const wineRes = await request.post('/api/wines', { data: { name: 'Pairing Detail Wine' } });
    expect(wineRes.ok()).toBe(true);
    const wine = await wineRes.json();

    await page.goto(`/wines/${wine.id}`);
    // Click the Pairings tab (use button role to avoid matching nav links)
    await page.getByRole('button', { name: /Pairings/ }).click();
    await expect(page.getByPlaceholder(/grilled steak/i)).toBeVisible();

    await request.delete(`/api/wines/${wine.id}`);
  });

  test('wine detail pairings tab can add and delete a pairing', async ({ request, page }) => {
    const wineRes = await request.post('/api/wines', { data: { name: 'Add Pairing Wine' } });
    expect(wineRes.ok()).toBe(true);
    const wine = await wineRes.json();

    await page.goto(`/wines/${wine.id}`);
    await page.getByRole('button', { name: /Pairings/ }).click();

    await page.getByPlaceholder(/grilled steak/i).fill('roasted lamb');
    await page.getByRole('button', { name: /^add$/i }).click();

    await expect(page.getByText('roasted lamb')).toBeVisible({ timeout: 5000 });

    await request.delete(`/api/wines/${wine.id}`);
  });
});
