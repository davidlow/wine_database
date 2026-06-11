import { test, expect } from '@playwright/test';

const STORED_DATE = '2026-01-15';
const EAT_BY_DATE = '2027-01-15';

test.describe('Freezer API', () => {
  let profileId: string;

  test.beforeEach(async ({ request }) => {
    const res = await request.post('/api/profiles', { data: { name: 'Freezer API Test Profile' } });
    expect(res.ok()).toBe(true);
    profileId = (await res.json()).id;
  });

  test.afterEach(async ({ request }) => {
    if (profileId) await request.delete(`/api/profiles/${profileId}`).catch(() => {});
  });

  test('GET /api/freezer requires profile_id', async ({ request }) => {
    const res = await request.get('/api/freezer');
    expect(res.status()).toBe(400);
  });

  test('GET /api/freezer returns empty array for new profile', async ({ request }) => {
    const res = await request.get(`/api/freezer?profile_id=${profileId}`);
    expect(res.ok()).toBe(true);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data).toHaveLength(0);
  });

  test('POST /api/freezer creates a freezer item', async ({ request }) => {
    const res = await request.post('/api/freezer', {
      data: {
        profile_id: profileId,
        meat_cut: 'Beef Ribeye Steak',
        primal: 'Rib',
        quantity: 2,
        weight_lbs: 1.5,
        location: 'Garage Freezer',
        stored_date: STORED_DATE,
        price_per_lb: 18.99,
      },
    });
    expect(res.status()).toBe(201);
    const item = await res.json();
    expect(item.id).toBeDefined();
    expect(item.meat_cut).toBe('Beef Ribeye Steak');
    expect(item.primal).toBe('Rib');
    expect(item.quantity).toBe(2);
    expect(item.location).toBe('Garage Freezer');
    expect(item.stored_date).toBe(STORED_DATE);
    expect(item.price_per_lb).toBe(18.99);
  });

  test('POST /api/freezer computes eat_by_date as stored_date + 1 year', async ({ request }) => {
    const res = await request.post('/api/freezer', {
      data: { profile_id: profileId, meat_cut: 'Beef Chuck Roast', quantity: 1, stored_date: STORED_DATE },
    });
    expect(res.ok()).toBe(true);
    const item = await res.json();
    expect(item.eat_by_date).toBe(EAT_BY_DATE);
  });

  test('POST /api/freezer validates required fields', async ({ request }) => {
    const noProfile = await request.post('/api/freezer', {
      data: { meat_cut: 'Beef Ribeye Steak', quantity: 1, stored_date: STORED_DATE },
    });
    expect(noProfile.status()).toBe(400);

    const noCut = await request.post('/api/freezer', {
      data: { profile_id: profileId, quantity: 1, stored_date: STORED_DATE },
    });
    expect(noCut.status()).toBe(400);

    const noDate = await request.post('/api/freezer', {
      data: { profile_id: profileId, meat_cut: 'Beef Chuck Roast', quantity: 1 },
    });
    expect(noDate.status()).toBe(400);
  });

  test('DELETE /api/freezer/:id removes one pack by default', async ({ request }) => {
    const addRes = await request.post('/api/freezer', {
      data: { profile_id: profileId, meat_cut: 'Beef Tri-Tip', quantity: 3, stored_date: STORED_DATE },
    });
    const item = await addRes.json();

    const delRes = await request.delete(`/api/freezer/${item.id}`, { data: { quantity: 1 } });
    expect(delRes.ok()).toBe(true);
    const updated = await delRes.json();
    expect(updated.quantity).toBe(2);
  });

  test('DELETE /api/freezer/:id can remove multiple packs', async ({ request }) => {
    const addRes = await request.post('/api/freezer', {
      data: { profile_id: profileId, meat_cut: 'Pork Butt', quantity: 5, stored_date: STORED_DATE },
    });
    const item = await addRes.json();

    const delRes = await request.delete(`/api/freezer/${item.id}`, { data: { quantity: 3 } });
    expect(delRes.ok()).toBe(true);
    expect((await delRes.json()).quantity).toBe(2);
  });

  test('DELETE /api/freezer/:id fails when removing more than available', async ({ request }) => {
    const addRes = await request.post('/api/freezer', {
      data: { profile_id: profileId, meat_cut: 'Beef NY Strip Steak', quantity: 1, stored_date: STORED_DATE },
    });
    const item = await addRes.json();

    const delRes = await request.delete(`/api/freezer/${item.id}`, { data: { quantity: 5 } });
    expect(delRes.ok()).toBe(false);
  });

  test('GET /api/freezer only shows items with quantity > 0', async ({ request }) => {
    const addRes = await request.post('/api/freezer', {
      data: { profile_id: profileId, meat_cut: 'Beef Top Round', quantity: 1, stored_date: STORED_DATE },
    });
    const item = await addRes.json();

    await request.delete(`/api/freezer/${item.id}`, { data: { quantity: 1 } });

    const listRes = await request.get(`/api/freezer?profile_id=${profileId}`);
    const items = await listRes.json();
    expect(items.find((i: { id: string }) => i.id === item.id)).toBeUndefined();
  });

  test('GET /api/freezer is scoped to profile', async ({ request }) => {
    const profile2Res = await request.post('/api/profiles', { data: { name: 'Other Freezer Profile' } });
    const profile2 = await profile2Res.json();

    await request.post('/api/freezer', {
      data: { profile_id: profileId, meat_cut: 'Beef Ribeye Steak', quantity: 2, stored_date: STORED_DATE },
    });

    const otherItems = await request.get(`/api/freezer?profile_id=${profile2.id}`);
    expect((await otherItems.json())).toHaveLength(0);

    await request.delete(`/api/profiles/${profile2.id}`).catch(() => {});
  });

  test('GET /api/freezer/transactions returns transaction log', async ({ request }) => {
    const addRes = await request.post('/api/freezer', {
      data: { profile_id: profileId, meat_cut: 'Beef Short Rib', quantity: 4, stored_date: STORED_DATE },
    });
    const item = await addRes.json();
    await request.delete(`/api/freezer/${item.id}`, { data: { quantity: 2 } });

    const txRes = await request.get(`/api/freezer/transactions?profile_id=${profileId}`);
    expect(txRes.ok()).toBe(true);
    const txs = await txRes.json();
    expect(Array.isArray(txs)).toBe(true);
    expect(txs.some((t: { action: string }) => t.action === 'add')).toBe(true);
    expect(txs.some((t: { action: string }) => t.action === 'remove')).toBe(true);
  });

  test('GET /api/freezer/transactions includes meat_cut', async ({ request }) => {
    const addRes = await request.post('/api/freezer', {
      data: { profile_id: profileId, meat_cut: 'Pork Loin Chop', quantity: 2, stored_date: STORED_DATE },
    });
    const item = await addRes.json();
    await request.delete(`/api/freezer/${item.id}`, { data: { quantity: 1 } });

    const txRes = await request.get(`/api/freezer/transactions?profile_id=${profileId}`);
    const txs = await txRes.json();
    expect(txs.every((t: { meat_cut: string }) => t.meat_cut === 'Pork Loin Chop')).toBe(true);
  });
});

test.describe('Freezer UI', () => {
  let profileId: string;

  test.beforeEach(async ({ request, page }) => {
    const res = await request.post('/api/profiles', { data: { name: 'Freezer UI Test Profile' } });
    expect(res.ok()).toBe(true);
    profileId = (await res.json()).id;
    // Set the active profile in localStorage before any page load so the hook picks it up
    await page.goto('/');
    await page.evaluate((id) => localStorage.setItem('activeProfileId', id), profileId);
  });

  test.afterEach(async ({ request }) => {
    if (profileId) await request.delete(`/api/profiles/${profileId}`).catch(() => {});
  });

  test('Freezer link appears in navigation', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: /freezer/i }).first()).toBeVisible();
  });

  test('/freezer page loads with heading and Add Item button', async ({ page }) => {
    await page.goto('/freezer');
    await expect(page.getByRole('heading', { name: /freezer/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /add item/i })).toBeVisible();
  });

  test('shows empty state when no items', async ({ page }) => {
    await page.goto('/freezer');
    await expect(page.getByText(/no items in the freezer yet/i)).toBeVisible({ timeout: 5000 });
  });

  test('Add Item button opens dialog with cut dropdown', async ({ page }) => {
    await page.goto('/freezer');
    await page.getByRole('button', { name: /add item/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    // The meat cut field is a <select> element inside the dialog
    await expect(page.locator('dialog select, [role="dialog"] select').first()).toBeVisible();
  });

  test('selecting a predefined cut auto-fills the primal field', async ({ page }) => {
    await page.goto('/freezer');
    await page.getByRole('button', { name: /add item/i }).click();

    // Select Beef Ribeye Steak
    await page.locator('select').selectOption('Beef Ribeye Steak');

    // Primal should auto-fill with "Rib"
    const primalInput = page.getByPlaceholder(/auto-filled/i);
    await expect(primalInput).toHaveValue('Rib', { timeout: 2000 });
  });

  // Helper: add a freezer item via the UI form and wait for the dialog to close
  async function addItemViaUI(
    page: import('@playwright/test').Page,
    cut: string,
    quantity: string,
    storedDate: string,
  ) {
    await page.getByRole('button', { name: /add item/i }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.locator('select').first().selectOption(cut);
    await dialog.locator('input[type="number"]').first().fill(quantity);
    await dialog.locator('input[type="date"]').fill(storedDate);
    await dialog.getByRole('button', { name: /add to freezer/i }).click();
    await expect(dialog).not.toBeVisible({ timeout: 10000 });
  }

  test('can add an item via the UI form — dialog closes on success', async ({ page }) => {
    await page.goto('/freezer');
    await addItemViaUI(page, 'Beef Chuck Roast', '2', STORED_DATE);
    // Search bar appears once items exist; search to reveal the item card
    const searchInput = page.getByPlaceholder(/search cuts/i);
    await expect(searchInput).toBeVisible({ timeout: 5000 });
    await searchInput.fill('chuck');
    await expect(page.getByText('Beef Chuck Roast')).toBeVisible({ timeout: 5000 });
  });

  test('search bar appears and filters items by cut name', async ({ page }) => {
    await page.goto('/freezer');

    // Add two items through the UI so they land in whatever profile is active
    await addItemViaUI(page, 'Beef Ribeye Steak', '2', STORED_DATE);
    await addItemViaUI(page, 'Beef Chuck Roast', '1', STORED_DATE);

    // Search bar should now be visible
    const searchInput = page.getByPlaceholder(/search cuts/i);
    await expect(searchInput).toBeVisible({ timeout: 5000 });

    // Filter by "ribeye" — ribeye visible, chuck hidden
    await searchInput.fill('ribeye');
    await expect(page.getByText('Beef Ribeye Steak')).toBeVisible({ timeout: 2000 });
    await expect(page.getByText('Beef Chuck Roast')).not.toBeVisible();

    // Filter by "chuck" — chuck visible, ribeye hidden
    await searchInput.fill('chuck');
    await expect(page.getByText('Beef Chuck Roast')).toBeVisible({ timeout: 2000 });
    await expect(page.getByText('Beef Ribeye Steak')).not.toBeVisible();

    // Clear filter — items hidden (search-first UI shows cards only when a query is active)
    await searchInput.fill('');
    await expect(page.getByText('Beef Ribeye Steak')).not.toBeVisible();
    await expect(page.getByText('Beef Chuck Roast')).not.toBeVisible();
  });

  test('no-results state shown when search matches nothing', async ({ page }) => {
    await page.goto('/freezer');
    await addItemViaUI(page, 'Beef Ribeye Steak', '1', STORED_DATE);

    const searchInput = page.getByPlaceholder(/search cuts/i);
    await expect(searchInput).toBeVisible({ timeout: 5000 });

    await searchInput.fill('lamb shank');
    await expect(page.getByText(/no cuts match/i)).toBeVisible({ timeout: 2000 });
  });

  test('eat-by date is displayed for each item', async ({ page }) => {
    await page.goto('/freezer');
    await addItemViaUI(page, 'Pork Butt', '1', '2026-03-01');

    // Search to reveal the item card, then verify eat-by date (stored + 1 year)
    const searchInput = page.getByPlaceholder(/search cuts/i);
    await expect(searchInput).toBeVisible({ timeout: 5000 });
    await searchInput.fill('pork');
    await expect(page.getByText(/eat by/i)).toBeVisible({ timeout: 2000 });
    await expect(page.getByText(/mar 1, 2027/i)).toBeVisible({ timeout: 2000 });
  });
});
