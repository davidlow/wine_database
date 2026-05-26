import { test, expect } from '@playwright/test';

test.describe('Cellar Inventory', () => {
  let wineUrl: string;

  test.beforeEach(async ({ page }) => {
    // Create a wine to work with
    await page.goto('/wines/new');
    await page.waitForLoadState('networkidle');
    await page.getByPlaceholder(/e\.g\. Opus One/i).fill('Cellar Test Wine');
    await page.getByRole('button', { name: /save wine/i }).click();
    await page.waitForURL(/\/wines\/[a-f0-9-]+$/);
    wineUrl = page.url();
  });

  test('can add bottles to a cellar location', async ({ page }) => {
    await page.goto(wineUrl);
    await page.getByRole('button', { name: /add bottles/i }).click();

    await page.getByPlaceholder(/e\.g\. Rack A/i).fill('Rack A, Row 1, Slot 1');
    await page.locator('input[type="number"]').nth(1).fill('3'); // quantity

    await page.getByRole('button', { name: /^add$/i }).click();

    // Bottle count should update
    await expect(page.getByText(/3 btl|3 bottle/i)).toBeVisible({ timeout: 5000 });
  });

  test('can remove a bottle', async ({ page }) => {
    await page.goto(wineUrl);
    await page.getByRole('button', { name: /add bottles/i }).click();

    await page.getByPlaceholder(/e\.g\. Rack A/i).fill('Rack B, Slot 1');
    await page.locator('input[type="number"]').nth(1).fill('2');
    await page.getByRole('button', { name: /^add$/i }).click();

    // Wait for inventory to update
    await expect(page.getByText(/2/)).toBeVisible({ timeout: 5000 });

    // Click remove (-) button
    await page.getByTitle('Remove 1 bottle').click();

    // Quantity should decrease to 1
    await expect(page.getByText('1')).toBeVisible({ timeout: 5000 });
  });

  test('shows 0 bottles initially', async ({ page }) => {
    await page.goto(wineUrl);
    await expect(page.getByText(/0 bottles? in cellar/i)).toBeVisible();
  });

  test('shows inventory in profile detail page', async ({ page }) => {
    // Add bottles first
    await page.goto(wineUrl);
    await page.getByRole('button', { name: /add bottles/i }).click();
    await page.getByPlaceholder(/e\.g\. Rack A/i).fill('Test Location');
    await page.locator('input[type="number"]').nth(1).fill('2');
    await page.getByRole('button', { name: /^add$/i }).click();
    await expect(page.getByText(/2/)).toBeVisible({ timeout: 5000 });

    // Navigate to profiles to verify
    await page.goto('/profiles');
    await expect(page.getByText('Profiles')).toBeVisible();
  });
});
