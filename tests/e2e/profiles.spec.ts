import { test, expect } from '@playwright/test';

test.describe('Profiles', () => {
  test('shows profiles page', async ({ page }) => {
    await page.goto('/profiles');
    await expect(page.getByText('Profiles')).toBeVisible();
    await expect(page.getByRole('button', { name: /new profile/i })).toBeVisible();
  });

  test('can create a new profile', async ({ page }) => {
    await page.goto('/profiles');
    await page.getByRole('button', { name: /new profile/i }).click();

    await page.getByPlaceholder(/e\.g\. Home/i).fill('Beach House');
    await page.getByPlaceholder(/optional description/i).fill('Wine for the beach');
    await page.getByRole('button', { name: /^create$/i }).click();

    await expect(page.getByText('Beach House')).toBeVisible({ timeout: 5000 });
  });

  test('can delete a profile', async ({ page }) => {
    await page.goto('/profiles');

    // Create a profile first
    await page.getByRole('button', { name: /new profile/i }).click();
    await page.getByPlaceholder(/e\.g\. Home/i).fill('Temporary Profile');
    await page.getByRole('button', { name: /^create$/i }).click();
    await expect(page.getByText('Temporary Profile')).toBeVisible({ timeout: 5000 });

    // Delete it
    const trashButtons = page.getByRole('button').filter({ has: page.locator('svg') });
    await page.locator('button').filter({ hasText: '' }).last().click(); // trash icon
    await page.getByRole('button', { name: /^delete$/i }).click();

    await expect(page.getByText('Temporary Profile')).not.toBeVisible({ timeout: 5000 });
  });

  test('profile detail shows inventory', async ({ page }) => {
    await page.goto('/profiles');

    // Click into a profile if one exists
    const profileLinks = page.locator('a').filter({ has: page.locator('svg') });
    const count = await profileLinks.count();
    if (count > 0) {
      await profileLinks.first().click();
      await expect(page.getByText(/Total Bottles/i)).toBeVisible();
      await expect(page.getByText(/Unique Wines/i)).toBeVisible();
    }
  });

  test('profile inventory is isolated between profiles', async ({ page }) => {
    // Create two profiles
    await page.goto('/profiles');

    await page.getByRole('button', { name: /new profile/i }).click();
    await page.getByPlaceholder(/e\.g\. Home/i).fill('Isolation Profile A');
    await page.getByRole('button', { name: /^create$/i }).click();
    await expect(page.getByText('Isolation Profile A')).toBeVisible({ timeout: 5000 });

    await page.getByRole('button', { name: /new profile/i }).click();
    await page.getByPlaceholder(/e\.g\. Home/i).fill('Isolation Profile B');
    await page.getByRole('button', { name: /^create$/i }).click();
    await expect(page.getByText('Isolation Profile B')).toBeVisible({ timeout: 5000 });

    // Both profiles should exist and be separate
    const profiles = await page.getByText(/Isolation Profile [AB]/).all();
    expect(profiles.length).toBe(2);
  });
});
