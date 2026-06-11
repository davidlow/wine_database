import { test, expect } from '@playwright/test';

const TODAY = new Date().toISOString().slice(0, 10);

// ─── Pantry API ───────────────────────────────────────────────────────────────

test.describe('Pantry API', () => {
  let profileId: string;

  test.beforeEach(async ({ request }) => {
    const res = await request.post('/api/profiles', { data: { name: 'Pantry API Test Profile' } });
    expect(res.ok()).toBe(true);
    profileId = (await res.json()).id;
  });

  test.afterEach(async ({ request }) => {
    if (profileId) await request.delete(`/api/profiles/${profileId}`).catch(() => {});
  });

  test('GET /api/pantry requires profile_id', async ({ request }) => {
    const res = await request.get('/api/pantry');
    expect(res.status()).toBe(400);
  });

  test('GET /api/pantry returns empty array for new profile', async ({ request }) => {
    const res = await request.get(`/api/pantry?profile_id=${profileId}`);
    expect(res.ok()).toBe(true);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data).toHaveLength(0);
  });

  test('POST /api/pantry creates a pantry item', async ({ request }) => {
    const res = await request.post('/api/pantry', {
      data: {
        profile_id: profileId,
        name: 'Tide Pods',
        brand: 'Tide',
        category: 'Laundry',
        quantity: 3,
        unit: 'pack',
        location: 'Laundry Room',
        stored_date: TODAY,
        best_by_days: 730,
      },
    });
    expect(res.status()).toBe(201);
    const item = await res.json();
    expect(item.id).toBeDefined();
    expect(item.name).toBe('Tide Pods');
    expect(item.brand).toBe('Tide');
    expect(item.category).toBe('Laundry');
    expect(item.quantity).toBe(3);
    expect(item.unit).toBe('pack');
    expect(item.location).toBe('Laundry Room');
    expect(item.stored_date).toBe(TODAY);
    expect(item.best_by_days).toBe(730);
  });

  test('POST /api/pantry auto-computes best_by_date', async ({ request }) => {
    const res = await request.post('/api/pantry', {
      data: {
        profile_id: profileId,
        name: 'Pasta',
        quantity: 5,
        unit: 'box',
        stored_date: '2026-01-01',
        best_by_days: 365,
      },
    });
    expect(res.ok()).toBe(true);
    const item = await res.json();
    expect(item.best_by_date).toBe('2027-01-01');
  });

  test('POST /api/pantry validates required fields', async ({ request }) => {
    const noProfile = await request.post('/api/pantry', {
      data: { name: 'Test', quantity: 1, stored_date: TODAY },
    });
    expect(noProfile.status()).toBe(400);

    const noName = await request.post('/api/pantry', {
      data: { profile_id: profileId, quantity: 1, stored_date: TODAY },
    });
    expect(noName.status()).toBe(400);

    const noDate = await request.post('/api/pantry', {
      data: { profile_id: profileId, name: 'Test', quantity: 1 },
    });
    expect(noDate.status()).toBe(400);
  });

  test('GET /api/pantry returns created items', async ({ request }) => {
    await request.post('/api/pantry', {
      data: { profile_id: profileId, name: 'Soap', quantity: 2, unit: 'bar', stored_date: TODAY },
    });
    await request.post('/api/pantry', {
      data: { profile_id: profileId, name: 'Shampoo', quantity: 1, unit: 'bottle', stored_date: TODAY },
    });

    const res = await request.get(`/api/pantry?profile_id=${profileId}`);
    expect(res.ok()).toBe(true);
    const items = await res.json();
    expect(items.length).toBe(2);
    expect(items.some((i: { name: string }) => i.name === 'Soap')).toBe(true);
    expect(items.some((i: { name: string }) => i.name === 'Shampoo')).toBe(true);
  });

  test('PUT /api/pantry/:id updates a pantry item', async ({ request }) => {
    const createRes = await request.post('/api/pantry', {
      data: { profile_id: profileId, name: 'Old Name', quantity: 1, stored_date: TODAY },
    });
    const item = await createRes.json();

    const updateRes = await request.put(`/api/pantry/${item.id}`, {
      data: { name: 'New Name', quantity: 4, unit: 'pack', stored_date: TODAY, best_by_days: 365 },
    });
    expect(updateRes.ok()).toBe(true);
    const updated = await updateRes.json();
    expect(updated.name).toBe('New Name');
    expect(updated.quantity).toBe(4);
  });

  test('DELETE /api/pantry/:id decrements quantity', async ({ request }) => {
    const createRes = await request.post('/api/pantry', {
      data: { profile_id: profileId, name: 'Paper Towels', quantity: 6, unit: 'roll', stored_date: TODAY },
    });
    const item = await createRes.json();

    const delRes = await request.delete(`/api/pantry/${item.id}`, { data: { quantity: 2 } });
    expect(delRes.ok()).toBe(true);
    const updated = await delRes.json();
    expect(updated.quantity).toBe(4);
  });

  test('DELETE /api/pantry/:id can remove all remaining quantity', async ({ request }) => {
    const createRes = await request.post('/api/pantry', {
      data: { profile_id: profileId, name: 'Last Item', quantity: 1, stored_date: TODAY },
    });
    const item = await createRes.json();

    const delRes = await request.delete(`/api/pantry/${item.id}`, { data: { quantity: 1 } });
    expect(delRes.ok()).toBe(true);
    expect((await delRes.json()).quantity).toBe(0);

    // Item should not appear in list (quantity 0 excluded)
    const listRes = await request.get(`/api/pantry?profile_id=${profileId}`);
    const items = await listRes.json();
    expect(items.find((i: { id: string }) => i.id === item.id)).toBeUndefined();
  });

  test('DELETE /api/pantry/:id fails when removing more than available', async ({ request }) => {
    const createRes = await request.post('/api/pantry', {
      data: { profile_id: profileId, name: 'Small Stock', quantity: 1, stored_date: TODAY },
    });
    const item = await createRes.json();

    const delRes = await request.delete(`/api/pantry/${item.id}`, { data: { quantity: 10 } });
    expect(delRes.ok()).toBe(false);
  });

  test('GET /api/pantry is scoped to profile', async ({ request }) => {
    const p2Res = await request.post('/api/profiles', { data: { name: 'Other Pantry Profile' } });
    const p2 = await p2Res.json();

    await request.post('/api/pantry', {
      data: { profile_id: profileId, name: 'Mine', quantity: 1, stored_date: TODAY },
    });
    await request.post('/api/pantry', {
      data: { profile_id: p2.id, name: 'Theirs', quantity: 1, stored_date: TODAY },
    });

    const myItems = await request.get(`/api/pantry?profile_id=${profileId}`);
    const myData = await myItems.json();
    expect(myData.some((i: { name: string }) => i.name === 'Mine')).toBe(true);
    expect(myData.every((i: { name: string }) => i.name !== 'Theirs')).toBe(true);

    await request.delete(`/api/profiles/${p2.id}`).catch(() => {});
  });
});

// ─── Pantry Transactions API ──────────────────────────────────────────────────

test.describe('Pantry Transactions API', () => {
  let profileId: string;

  test.beforeEach(async ({ request }) => {
    const res = await request.post('/api/profiles', { data: { name: 'Pantry Tx Test Profile' } });
    expect(res.ok()).toBe(true);
    profileId = (await res.json()).id;
  });

  test.afterEach(async ({ request }) => {
    if (profileId) await request.delete(`/api/profiles/${profileId}`).catch(() => {});
  });

  test('GET /api/pantry/transactions requires profile_id', async ({ request }) => {
    const res = await request.get('/api/pantry/transactions');
    expect(res.status()).toBe(400);
  });

  test('GET /api/pantry/transactions returns empty array for new profile', async ({ request }) => {
    const res = await request.get(`/api/pantry/transactions?profile_id=${profileId}`);
    expect(res.ok()).toBe(true);
    expect(await res.json()).toEqual([]);
  });

  test('GET /api/pantry/transactions includes add and remove actions', async ({ request }) => {
    const createRes = await request.post('/api/pantry', {
      data: { profile_id: profileId, name: 'Tracked Item', quantity: 5, stored_date: TODAY },
    });
    const item = await createRes.json();
    await request.delete(`/api/pantry/${item.id}`, { data: { quantity: 2 } });

    const txRes = await request.get(`/api/pantry/transactions?profile_id=${profileId}`);
    expect(txRes.ok()).toBe(true);
    const txns = await txRes.json();
    expect(Array.isArray(txns)).toBe(true);
    expect(txns.some((t: { action: string }) => t.action === 'add')).toBe(true);
    expect(txns.some((t: { action: string }) => t.action === 'remove')).toBe(true);
  });

  test('GET /api/pantry/transactions includes item_name', async ({ request }) => {
    const createRes = await request.post('/api/pantry', {
      data: { profile_id: profileId, name: 'Named Item', quantity: 3, stored_date: TODAY },
    });
    const item = await createRes.json();
    await request.delete(`/api/pantry/${item.id}`, { data: { quantity: 1 } });

    const txRes = await request.get(`/api/pantry/transactions?profile_id=${profileId}`);
    const txns = await txRes.json();
    expect(txns.every((t: { item_name: string }) => t.item_name === 'Named Item')).toBe(true);
  });
});

// ─── Pantry Usage Settings API ────────────────────────────────────────────────

test.describe('Pantry Usage Settings API', () => {
  let profileId: string;

  test.beforeEach(async ({ request }) => {
    const res = await request.post('/api/profiles', { data: { name: 'Usage Settings Test Profile' } });
    expect(res.ok()).toBe(true);
    profileId = (await res.json()).id;
  });

  test.afterEach(async ({ request }) => {
    if (profileId) await request.delete(`/api/profiles/${profileId}`).catch(() => {});
  });

  test('GET /api/pantry/usage-settings requires profile_id', async ({ request }) => {
    const res = await request.get('/api/pantry/usage-settings');
    expect(res.status()).toBe(400);
  });

  test('GET /api/pantry/usage-settings returns empty array for new profile', async ({ request }) => {
    const res = await request.get(`/api/pantry/usage-settings?profile_id=${profileId}`);
    expect(res.ok()).toBe(true);
    expect(await res.json()).toEqual([]);
  });

  test('POST /api/pantry/usage-settings creates a setting', async ({ request }) => {
    const res = await request.post('/api/pantry/usage-settings', {
      data: {
        profile_id: profileId,
        item_name: 'Laundry Detergent',
        days_per_unit: 14,
      },
    });
    expect(res.ok()).toBe(true);
    const setting = await res.json();
    expect(setting.item_name).toBe('Laundry Detergent');
    expect(setting.days_per_unit).toBe(14);
  });

  test('POST /api/pantry/usage-settings upserts — updates existing', async ({ request }) => {
    await request.post('/api/pantry/usage-settings', {
      data: { profile_id: profileId, item_name: 'Coffee', days_per_unit: 7 },
    });
    const updateRes = await request.post('/api/pantry/usage-settings', {
      data: { profile_id: profileId, item_name: 'Coffee', days_per_unit: 10 },
    });
    expect(updateRes.ok()).toBe(true);
    const updated = await updateRes.json();
    expect(updated.days_per_unit).toBe(10);
  });

  test('POST /api/pantry/usage-settings can set reset_date', async ({ request }) => {
    const res = await request.post('/api/pantry/usage-settings', {
      data: { profile_id: profileId, item_name: 'Tea', reset_date: '2026-06-01' },
    });
    expect(res.ok()).toBe(true);
    const setting = await res.json();
    expect(setting.reset_date).toBe('2026-06-01');
  });

  test('POST /api/pantry/usage-settings requires profile_id', async ({ request }) => {
    const res = await request.post('/api/pantry/usage-settings', {
      data: { item_name: 'Soap', days_per_unit: 30 },
    });
    expect(res.status()).toBe(400);
  });

  test('POST /api/pantry/usage-settings requires item_name', async ({ request }) => {
    const res = await request.post('/api/pantry/usage-settings', {
      data: { profile_id: profileId, days_per_unit: 30 },
    });
    expect(res.status()).toBe(400);
  });

  test('GET /api/pantry/usage-settings returns created settings', async ({ request }) => {
    await request.post('/api/pantry/usage-settings', {
      data: { profile_id: profileId, item_name: 'Dish Soap', days_per_unit: 21 },
    });

    const getRes = await request.get(`/api/pantry/usage-settings?profile_id=${profileId}`);
    expect(getRes.ok()).toBe(true);
    const settings = await getRes.json();
    const s = settings.find((s: { item_name: string }) => s.item_name === 'Dish Soap');
    expect(s).toBeDefined();
    expect(s.days_per_unit).toBe(21);
  });
});

// ─── Pantry UI ────────────────────────────────────────────────────────────────

test.describe('Pantry UI', () => {
  let profileId: string;

  test.beforeEach(async ({ request, page }) => {
    const res = await request.post('/api/profiles', { data: { name: 'Pantry UI Test Profile' } });
    expect(res.ok()).toBe(true);
    profileId = (await res.json()).id;
    await page.goto('/');
    await page.evaluate((id) => localStorage.setItem('activeProfileId', id), profileId);
  });

  test.afterEach(async ({ request }) => {
    if (profileId) await request.delete(`/api/profiles/${profileId}`).catch(() => {});
  });

  test('Pantry link appears in navigation', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: /pantry/i }).first()).toBeVisible();
  });

  test('/pantry page loads with heading and Add Item button', async ({ page }) => {
    await page.goto('/pantry');
    await expect(page.getByRole('heading', { name: /pantry/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /add item/i })).toBeVisible();
  });

  test('shows empty state when no items', async ({ page }) => {
    await page.goto('/pantry');
    await expect(page.getByText(/no pantry items yet/i)).toBeVisible({ timeout: 5000 });
  });

  test('Add Item button opens the add dialog', async ({ page }) => {
    await page.goto('/pantry');
    await page.getByRole('button', { name: /add item/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('dialog').getByText(/add pantry item/i)).toBeVisible();
  });

  test('can add an item via form and it appears in the list', async ({ page }) => {
    await page.goto('/pantry');
    await page.getByRole('button', { name: /add item/i }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Fill in the form
    await dialog.getByPlaceholder(/e.g. tide pods/i).fill('Test Shampoo');
    // Clear the quantity and re-type
    await dialog.locator('input[type="number"]').first().fill('3');
    await dialog.getByRole('button', { name: /add to pantry/i }).click();

    await expect(dialog).not.toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Test Shampoo')).toBeVisible({ timeout: 5000 });
  });

  test('item quantity is displayed', async ({ page }) => {
    // Add item via API for reliable setup
    await page.request.post('/api/pantry', {
      data: { profile_id: profileId, name: 'Quantity Item', quantity: 4, unit: 'box', stored_date: TODAY },
    });

    await page.goto('/pantry');
    await expect(page.getByText(/4 box/i)).toBeVisible({ timeout: 5000 });
  });

  test('search bar appears and filters items', async ({ page }) => {
    // Seed two items via API
    await page.request.post('/api/pantry', {
      data: { profile_id: profileId, name: 'Apple Juice', quantity: 2, unit: 'bottle', stored_date: TODAY },
    });
    await page.request.post('/api/pantry', {
      data: { profile_id: profileId, name: 'Banana Chips', quantity: 1, unit: 'bag', stored_date: TODAY },
    });

    await page.goto('/pantry');
    const searchInput = page.getByPlaceholder(/search items/i);
    await expect(searchInput).toBeVisible({ timeout: 5000 });

    await searchInput.fill('apple');
    await expect(page.getByText('Apple Juice')).toBeVisible({ timeout: 2000 });
    await expect(page.getByText('Banana Chips')).not.toBeVisible();

    await searchInput.fill('');
    await expect(page.getByText('Banana Chips')).toBeVisible({ timeout: 2000 });
  });

  test('no results state shown when search matches nothing', async ({ page }) => {
    await page.request.post('/api/pantry', {
      data: { profile_id: profileId, name: 'Olive Oil', quantity: 1, stored_date: TODAY },
    });

    await page.goto('/pantry');
    const searchInput = page.getByPlaceholder(/search items/i);
    await expect(searchInput).toBeVisible({ timeout: 5000 });

    await searchInput.fill('zzz nonexistent item');
    await expect(page.getByText(/no items match/i)).toBeVisible({ timeout: 2000 });
  });

  test('Remove button decrements item quantity', async ({ page }) => {
    await page.request.post('/api/pantry', {
      data: { profile_id: profileId, name: 'Remove Test Item', quantity: 3, unit: 'pack', stored_date: TODAY },
    });

    await page.goto('/pantry');
    await expect(page.getByText('Remove Test Item')).toBeVisible({ timeout: 5000 });

    // Click the Remove button
    await page.getByRole('button', { name: /^remove$/i }).first().click();

    // Quantity should decrease from 3 to 2
    await expect(page.getByText(/2 pack/i)).toBeVisible({ timeout: 5000 });
  });

  test('edit button opens the edit dialog', async ({ page }) => {
    await page.request.post('/api/pantry', {
      data: { profile_id: profileId, name: 'Editable Item', quantity: 2, stored_date: TODAY },
    });

    await page.goto('/pantry');
    await expect(page.getByText('Editable Item')).toBeVisible({ timeout: 5000 });

    await page.getByRole('button', { name: /edit/i }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('dialog').getByText(/edit pantry item/i)).toBeVisible();
  });

  test('past best-by section appears for expired items', async ({ page }) => {
    // Add item with past best_by_date
    await page.request.post('/api/pantry', {
      data: {
        profile_id: profileId,
        name: 'Expired Item',
        quantity: 1,
        stored_date: '2024-01-01',
        best_by_date: '2024-06-01',
        best_by_days: 150,
      },
    });

    await page.goto('/pantry');
    await expect(page.getByText(/past best-by date/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Expired Item').first()).toBeVisible();
  });

  test('category stats appear when items have categories', async ({ page }) => {
    await page.request.post('/api/pantry', {
      data: { profile_id: profileId, name: 'Soap', category: 'Personal Care', quantity: 2, stored_date: TODAY },
    });

    await page.goto('/pantry');
    // The category stat badge shows "Personal Care 1" (name + count)
    await expect(page.getByText(/personal care/i).first()).toBeVisible({ timeout: 5000 });
  });
});

// ─── Dark Mode Toggle ─────────────────────────────────────────────────────────

test.describe('Dark Mode Toggle', () => {
  test('dark mode toggle is visible in desktop sidebar', async ({ page }) => {
    await page.goto('/');
    // Desktop viewport — sidebar is visible
    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(
      page.locator('button', { hasText: /dark mode|light mode/i }).first()
    ).toBeVisible();
  });

  test('dark mode toggle in desktop sidebar toggles theme class on html element', async ({ page }) => {
    await page.goto('/');
    await page.setViewportSize({ width: 1280, height: 800 });

    const htmlEl = page.locator('html');
    const initialClass = await htmlEl.getAttribute('class') ?? '';

    // Click the toggle
    await page.locator('button', { hasText: /dark mode|light mode/i }).first().click();

    const newClass = await htmlEl.getAttribute('class') ?? '';
    // Class should have changed (either added or removed 'dark')
    expect(newClass).not.toBe(initialClass);
  });

  test('dark mode toggle visible in mobile header', async ({ page }) => {
    await page.goto('/');
    await page.setViewportSize({ width: 390, height: 844 }); // iPhone size
    // The mobile header has a sun/moon button
    const themeBtn = page.locator('header button[aria-label="Toggle theme"]');
    await expect(themeBtn).toBeVisible();
  });

  test('mobile dark mode toggle changes theme', async ({ page }) => {
    await page.goto('/');
    await page.setViewportSize({ width: 390, height: 844 });

    const htmlEl = page.locator('html');
    const initialClass = await htmlEl.getAttribute('class') ?? '';

    await page.locator('header button[aria-label="Toggle theme"]').click();

    const newClass = await htmlEl.getAttribute('class') ?? '';
    expect(newClass).not.toBe(initialClass);
  });
});
