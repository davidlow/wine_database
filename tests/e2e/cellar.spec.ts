import { test, expect } from '@playwright/test';

test.describe('Cellar Inventory', () => {
  let wineId: string;
  let profileId: string;
  let wineUrl: string;

  test.beforeEach(async ({ request }) => {
    // Create a profile and wine via API so tests are not dependent on UI form details
    const profileRes = await request.post('/api/profiles', {
      data: { name: 'Cellar Test Profile' },
    });
    expect(profileRes.ok()).toBe(true);
    const profile = await profileRes.json();
    profileId = profile.id;

    const wineRes = await request.post('/api/wines', {
      data: { name: 'Cellar Test Wine' },
    });
    expect(wineRes.ok()).toBe(true);
    const wine = await wineRes.json();
    wineId = wine.id;
    wineUrl = `/wines/${wineId}`;
  });

  test.afterEach(async ({ request }) => {
    if (wineId) await request.delete(`/api/wines/${wineId}`).catch(() => {});
    if (profileId) await request.delete(`/api/profiles/${profileId}`).catch(() => {});
  });

  test('shows inventory tab on wine detail page', async ({ page }) => {
    await page.goto(wineUrl);
    // Tab is a <button> element, not a role=tab — target it directly
    await expect(page.getByRole('button', { name: 'Inventory' })).toBeVisible();
  });

  test('shows Add Bottles button on wine detail', async ({ page }) => {
    await page.goto(wineUrl);
    await expect(page.getByRole('button', { name: /add bottles/i })).toBeVisible();
  });

  test('shows no bottles message initially', async ({ page }) => {
    await page.goto(wineUrl);
    await expect(page.getByText(/no bottles in cellar/i)).toBeVisible();
  });

  test('can add bottles via API', async ({ request }) => {
    const addRes = await request.post('/api/cellar', {
      data: {
        wine_id: wineId,
        profile_id: profileId,
        location: 'Rack A, Row 1',
        quantity: 3,
      },
    });
    expect(addRes.ok()).toBe(true);
    const item = await addRes.json();
    expect(item.quantity).toBe(3);

    // Verify it shows in inventory list (profile_id is required by the API)
    const listRes = await request.get(`/api/cellar?profile_id=${profileId}&wine_id=${wineId}`);
    expect(listRes.ok()).toBe(true);
    const inventory = await listRes.json();
    const found = inventory.find((i: { wine_id: string }) => i.wine_id === wineId);
    expect(found).toBeTruthy();
    expect(found.quantity).toBe(3);
  });

  test('can remove a bottle via API', async ({ request }) => {
    // Add 3 bottles
    const addRes = await request.post('/api/cellar', {
      data: {
        wine_id: wineId,
        profile_id: profileId,
        location: 'Rack B',
        quantity: 3,
      },
    });
    expect(addRes.ok()).toBe(true);
    const item = await addRes.json();

    // Remove 1 bottle using DELETE with quantity=1
    const removeRes = await request.delete(`/api/cellar/${item.id}`, {
      data: { quantity: 1 },
    });
    expect(removeRes.ok()).toBe(true);

    // Verify quantity decreased
    const listRes = await request.get(`/api/cellar?profile_id=${profileId}&wine_id=${wineId}`);
    const inventory = await listRes.json();
    const found = inventory.find((i: { wine_id: string }) => i.wine_id === wineId);
    expect(found.quantity).toBe(2);
  });

  test('inventory is scoped to profile', async ({ request }) => {
    // Add bottles to our profile
    await request.post('/api/cellar', {
      data: { wine_id: wineId, profile_id: profileId, location: 'Home Rack', quantity: 2 },
    });

    // Create a second profile and verify our wine is not in it
    const profile2Res = await request.post('/api/profiles', { data: { name: 'Other Profile' } });
    expect(profile2Res.ok()).toBe(true);
    const profile2 = await profile2Res.json();

    const listRes = await request.get(`/api/cellar?profile_id=${profile2.id}`);
    expect(listRes.ok()).toBe(true);
    const inventory = await listRes.json();
    const found = inventory.find((i: { wine_id: string }) => i.wine_id === wineId);
    expect(found).toBeUndefined();

    await request.delete(`/api/profiles/${profile2.id}`).catch(() => {});
  });

  test('shows inventory in profile detail page', async ({ request, page }) => {
    // Add bottles
    await request.post('/api/cellar', {
      data: { wine_id: wineId, profile_id: profileId, location: 'Test Location', quantity: 2 },
    });

    await page.goto(`/profiles/${profileId}`);
    await expect(page.getByText(/Bottles/)).toBeVisible({ timeout: 5000 });
  });
});
