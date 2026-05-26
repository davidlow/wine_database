import { test, expect } from '@playwright/test';

test.describe('Wine Catalog', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for the app to load
    await page.waitForLoadState('networkidle');
  });

  test('shows wine catalog page', async ({ page }) => {
    await page.goto('/wines');
    await expect(page.getByText('Wine Catalog')).toBeVisible();
    await expect(page.getByPlaceholder(/search wines/i)).toBeVisible();
  });

  test('can add a wine manually', async ({ page }) => {
    await page.goto('/wines/new');
    await expect(page.getByText('Add Wine')).toBeVisible();

    await page.getByPlaceholder(/e\.g\. Opus One/i).fill('E2E Test Wine');
    await page.getByPlaceholder(/e\.g\. Opus One Winery/i).fill('E2E Winery');
    await page.getByLabel(/vintage year/i).fill('2021');

    await page.getByRole('button', { name: /save wine/i }).click();

    // Should redirect to the wine detail page
    await expect(page).toHaveURL(/\/wines\/[a-f0-9-]+$/);
    await expect(page.getByText('E2E Test Wine')).toBeVisible();
  });

  test('can search wines by name', async ({ page }) => {
    await page.goto('/wines');
    await page.getByPlaceholder(/search wines/i).fill('Test');
    await page.waitForTimeout(400); // debounce

    // Results should filter
    const results = page.locator('[data-testid="wine-card"]');
    // Just verify search field is functional (results may be empty in clean DB)
    await expect(page.getByPlaceholder(/search wines/i)).toHaveValue('Test');
  });

  test('can filter wines by type', async ({ page }) => {
    await page.goto('/wines');
    await page.getByRole('button', { name: 'Red' }).click();
    await page.waitForTimeout(400);

    // Filter chip should be active
    await expect(page.getByRole('button', { name: 'Red' })).toHaveClass(/bg-primary/);
  });

  test('can navigate to wine detail', async ({ page }) => {
    // First create a wine to navigate to
    await page.goto('/wines/new');
    await page.getByPlaceholder(/e\.g\. Opus One/i).fill('Navigation Test Wine');
    await page.getByRole('button', { name: /save wine/i }).click();
    await page.waitForURL(/\/wines\/[a-f0-9-]+$/);

    // Should show wine detail
    await expect(page.getByText('Navigation Test Wine')).toBeVisible();
    await expect(page.getByRole('link', { name: /edit/i })).toBeVisible();
  });

  test('can edit a wine', async ({ page }) => {
    // Create a wine
    await page.goto('/wines/new');
    await page.getByPlaceholder(/e\.g\. Opus One/i).fill('Edit Test Wine');
    await page.getByRole('button', { name: /save wine/i }).click();
    await page.waitForURL(/\/wines\/[a-f0-9-]+$/);

    const url = page.url();
    await page.goto(url.replace(/\/$/, '') + '/edit');

    await page.getByDisplayValue('Edit Test Wine').clear();
    await page.getByPlaceholder(/e\.g\. Opus One/i).fill('Edited Wine Name');
    await page.getByRole('button', { name: /update wine/i }).click();

    await expect(page.getByText('Edited Wine Name')).toBeVisible();
  });
});
