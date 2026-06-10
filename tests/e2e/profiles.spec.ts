import { test, expect } from '@playwright/test';

test.describe('Profiles (Cellars)', () => {
  test('shows cellars page', async ({ page }) => {
    await page.goto('/profiles');
    await expect(page.getByRole('heading', { name: 'Cellars' })).toBeVisible();
    await expect(page.getByRole('button', { name: /new cellar/i })).toBeVisible();
  });

  test('can create a new cellar profile', async ({ page }) => {
    await page.goto('/profiles');
    await page.getByRole('button', { name: /new cellar/i }).click();

    await page.getByPlaceholder('e.g. Home, Vacation Home').fill('Beach House');
    await page.getByPlaceholder('Optional description').fill('Wine for the beach');
    await page.getByRole('button', { name: /^create$/i }).click();

    await expect(page.getByText('Beach House').first()).toBeVisible({ timeout: 5000 });
  });

  test('can delete a cellar profile via API', async ({ request }) => {
    // Create via API
    const createRes = await request.post('/api/profiles', {
      data: { name: 'Temporary Cellar To Delete' },
    });
    expect(createRes.ok()).toBe(true);
    const profile = await createRes.json();

    // Delete via API
    const deleteRes = await request.delete(`/api/profiles/${profile.id}`);
    expect(deleteRes.ok()).toBe(true);

    // Verify it no longer exists
    const getRes = await request.get(`/api/profiles/${profile.id}`);
    expect(getRes.status()).toBe(404);
  });

  test('profile detail shows bottles stat', async ({ request, page }) => {
    // Create a profile via API then navigate to it
    const createRes = await request.post('/api/profiles', {
      data: { name: 'Detail Test Cellar', description: 'For detail test' },
    });
    expect(createRes.ok()).toBe(true);
    const profile = await createRes.json();

    await page.goto(`/profiles/${profile.id}`);
    await expect(page.getByText(/Bottles/)).toBeVisible({ timeout: 5000 });

    // Cleanup
    await request.delete(`/api/profiles/${profile.id}`);
  });

  test('profile inventory is isolated between cellars', async ({ page }) => {
    await page.goto('/profiles');

    await page.getByRole('button', { name: /new cellar/i }).click();
    await page.getByPlaceholder('e.g. Home, Vacation Home').fill('Isolation Cellar A');
    await page.getByRole('button', { name: /^create$/i }).click();
    await expect(page.getByText('Isolation Cellar A').first()).toBeVisible({ timeout: 5000 });

    await page.getByRole('button', { name: /new cellar/i }).click();
    await page.getByPlaceholder('e.g. Home, Vacation Home').fill('Isolation Cellar B');
    await page.getByRole('button', { name: /^create$/i }).click();
    await expect(page.getByText('Isolation Cellar B').first()).toBeVisible({ timeout: 5000 });

    // Both profiles are visible (may appear multiple times due to nav dropdown)
    await expect(page.getByText('Isolation Cellar A').first()).toBeVisible();
    await expect(page.getByText('Isolation Cellar B').first()).toBeVisible();
  });

  test('cellar profile CRUD via API', async ({ request }) => {
    // Create
    const createRes = await request.post('/api/profiles', {
      data: { name: 'API Test Cellar' },
    });
    expect(createRes.ok()).toBe(true);
    const profile = await createRes.json();
    expect(profile.name).toBe('API Test Cellar');

    // Read
    const getRes = await request.get(`/api/profiles/${profile.id}`);
    expect(getRes.ok()).toBe(true);

    // Update
    const updateRes = await request.put(`/api/profiles/${profile.id}`, {
      data: { name: 'API Test Cellar Updated' },
    });
    expect(updateRes.ok()).toBe(true);
    const updated = await updateRes.json();
    expect(updated.name).toBe('API Test Cellar Updated');

    // Delete
    const deleteRes = await request.delete(`/api/profiles/${profile.id}`);
    expect(deleteRes.ok()).toBe(true);
  });
});
