import { test, expect } from '@playwright/test';

test.describe('Wine Catalog', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('shows wine catalog page', async ({ page }) => {
    await page.goto('/wines');
    await expect(page.getByRole('heading', { name: 'Wines' })).toBeVisible();
    await expect(page.getByPlaceholder('Search name, producer, region, barcode…')).toBeVisible();
  });

  test('can add a wine manually', async ({ page }) => {
    await page.goto('/wines/new');
    await expect(page.getByText('Add Wine')).toBeVisible();

    await page.getByPlaceholder('e.g. Opus One', { exact: true }).fill('E2E Test Wine');
    await page.getByPlaceholder('e.g. Opus One Winery').fill('E2E Winery');
    await page.getByPlaceholder('e.g. 2019').fill('2021');

    await page.getByRole('button', { name: /save wine/i }).click();

    await page.waitForURL(/\/wines\/[a-f0-9-]+$/);
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('E2E Test Wine').first()).toBeVisible({ timeout: 10000 });
  });

  test('can search wines by name', async ({ page }) => {
    await page.goto('/wines');
    const searchInput = page.getByPlaceholder('Search name, producer, region, barcode…');
    await searchInput.fill('Test');
    await page.waitForTimeout(400); // debounce

    await expect(searchInput).toHaveValue('Test');
  });

  test('can filter wines by type', async ({ page }) => {
    await page.goto('/wines');
    await page.getByRole('button', { name: 'Red' }).click();
    await page.waitForTimeout(400);

    await expect(page.getByRole('button', { name: 'Red' })).toHaveClass(/bg-primary/);
  });

  test('can navigate to wine detail', async ({ page }) => {
    await page.goto('/wines/new');
    await page.getByPlaceholder('e.g. Opus One', { exact: true }).fill('Navigation Test Wine');
    await page.getByRole('button', { name: /save wine/i }).click();
    await page.waitForURL(/\/wines\/[a-f0-9-]+$/);
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Navigation Test Wine').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('a[title="Edit wine"]')).toBeVisible();
  });

  test('can edit a wine', async ({ page }) => {
    await page.goto('/wines/new');
    await page.getByPlaceholder('e.g. Opus One', { exact: true }).fill('Edit Test Wine');
    await page.getByRole('button', { name: /save wine/i }).click();
    await page.waitForURL(/\/wines\/[a-f0-9-]+$/);

    const url = page.url();
    await page.goto(url.replace(/\/$/, '') + '/edit');

    // Wait for async form load
    const nameInput = page.getByPlaceholder('e.g. Opus One', { exact: true });
    await nameInput.waitFor();
    await nameInput.clear();
    await nameInput.fill('Edited Wine Name');
    await page.getByRole('button', { name: /update wine/i }).click();

    await page.waitForURL(/\/wines\/[a-f0-9-]+$/);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h2').filter({ hasText: 'Edited Wine Name' })).toBeVisible({ timeout: 10000 });
  });

  test('can delete a wine via API', async ({ request }) => {
    const createRes = await request.post('/api/wines', {
      data: { name: 'Delete Me Wine' },
    });
    expect(createRes.ok()).toBe(true);
    const wine = await createRes.json();

    const deleteRes = await request.delete(`/api/wines/${wine.id}`);
    expect(deleteRes.ok()).toBe(true);

    const getRes = await request.get(`/api/wines/${wine.id}`);
    expect(getRes.status()).toBe(404);
  });

  test('wine API supports structural score fields', async ({ request }) => {
    const createRes = await request.post('/api/wines', {
      data: {
        name: 'Structural Test Wine',
        acidity: 4,
        tannin: 3,
        alcohol: 3,
        sweetness: 1,
        body: 5,
        fruit_profile: 'dark fruits',
      },
    });
    expect(createRes.ok()).toBe(true);
    const wine = await createRes.json();
    expect(wine.acidity).toBe(4);
    expect(wine.tannin).toBe(3);
    expect(wine.body).toBe(5);
    expect(wine.fruit_profile).toBe('dark fruits');

    await request.delete(`/api/wines/${wine.id}`);
  });
});
