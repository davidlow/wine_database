import { test, expect } from '@playwright/test';

test.describe('Transaction Log', () => {
  let profileId: string;
  let wineId: string;

  test.beforeEach(async ({ request }) => {
    const profileRes = await request.post('/api/profiles', { data: { name: 'TX Test Profile' } });
    expect(profileRes.ok()).toBe(true);
    profileId = (await profileRes.json()).id;

    const wineRes = await request.post('/api/wines', { data: { name: 'TX Test Wine' } });
    expect(wineRes.ok()).toBe(true);
    wineId = (await wineRes.json()).id;
  });

  test.afterEach(async ({ request }) => {
    if (wineId) await request.delete(`/api/wines/${wineId}`).catch(() => {});
    if (profileId) await request.delete(`/api/profiles/${profileId}`).catch(() => {});
  });

  test('GET /api/transactions requires profile_id', async ({ request }) => {
    const res = await request.get('/api/transactions');
    expect(res.status()).toBe(400);
  });

  test('GET /api/transactions returns empty array for new profile', async ({ request }) => {
    const res = await request.get(`/api/transactions?profile_id=${profileId}`);
    expect(res.ok()).toBe(true);
    expect(await res.json()).toEqual([]);
  });

  test('adding bottles creates an add transaction', async ({ request }) => {
    await request.post('/api/cellar', {
      data: { wine_id: wineId, profile_id: profileId, location: 'Rack A', quantity: 2 },
    });

    const txRes = await request.get(`/api/transactions?profile_id=${profileId}`);
    const transactions = await txRes.json();
    const addTx = transactions.find((t: { transaction_type: string }) => t.transaction_type === 'add');
    expect(addTx).toBeTruthy();
    expect(addTx.quantity).toBe(2);
    expect(addTx.wine_id).toBe(wineId);
    expect(addTx.location).toBe('Rack A');
  });

  test('removing bottles creates a remove transaction', async ({ request }) => {
    const addRes = await request.post('/api/cellar', {
      data: { wine_id: wineId, profile_id: profileId, location: 'Rack B', quantity: 3 },
    });
    const item = await addRes.json();

    await request.delete(`/api/cellar/${item.id}`, { data: { quantity: 1, notes: 'Enjoyed at dinner' } });

    const txRes = await request.get(`/api/transactions?profile_id=${profileId}`);
    const transactions = await txRes.json();
    const removeTx = transactions.find((t: { transaction_type: string }) => t.transaction_type === 'remove');
    expect(removeTx).toBeTruthy();
    expect(removeTx.quantity).toBe(1);
  });

  test('moving bottles creates a move transaction', async ({ request }) => {
    const addRes = await request.post('/api/cellar', {
      data: { wine_id: wineId, profile_id: profileId, location: 'Source Rack', quantity: 4 },
    });
    const item = await addRes.json();

    const moveRes = await request.post(`/api/cellar/${item.id}/move`, {
      data: { new_location: 'Dest Rack', quantity: 2 },
    });
    expect(moveRes.ok()).toBe(true);

    const txRes = await request.get(`/api/transactions?profile_id=${profileId}`);
    const transactions = await txRes.json();
    const moveTx = transactions.find((t: { transaction_type: string }) => t.transaction_type === 'move');
    expect(moveTx).toBeTruthy();
    expect(moveTx.quantity).toBe(2);
  });

  test('transactions are scoped to profile', async ({ request }) => {
    const profile2Res = await request.post('/api/profiles', { data: { name: 'Other TX Profile' } });
    const profile2 = await profile2Res.json();

    await request.post('/api/cellar', {
      data: { wine_id: wineId, profile_id: profileId, location: 'Rack A', quantity: 1 },
    });

    const txRes = await request.get(`/api/transactions?profile_id=${profile2.id}`);
    expect((await txRes.json())).toHaveLength(0);

    await request.delete(`/api/profiles/${profile2.id}`);
  });

  test('GET /api/transactions respects limit parameter', async ({ request }) => {
    for (let i = 0; i < 5; i++) {
      await request.post('/api/cellar', {
        data: { wine_id: wineId, profile_id: profileId, location: `Rack ${i}`, quantity: 1 },
      });
    }

    const limitedRes = await request.get(`/api/transactions?profile_id=${profileId}&limit=2`);
    const limited = await limitedRes.json();
    expect(limited.length).toBeLessThanOrEqual(2);
  });

  test('transaction records include wine_id and location', async ({ request }) => {
    await request.post('/api/cellar', {
      data: { wine_id: wineId, profile_id: profileId, location: 'Main Rack', quantity: 1 },
    });

    const txRes = await request.get(`/api/transactions?profile_id=${profileId}`);
    const transactions = await txRes.json();
    expect(transactions.length).toBeGreaterThan(0);
    expect(transactions[0].wine_id).toBe(wineId);
  });

  test('profile delete cascades: transactions are removed with profile', async ({ request }) => {
    await request.post('/api/cellar', {
      data: { wine_id: wineId, profile_id: profileId, location: 'Rack', quantity: 1 },
    });

    await request.delete(`/api/profiles/${profileId}`);
    profileId = '';

    // Profile is gone — a fresh profile of the same name should have no transactions
    const newProfileRes = await request.post('/api/profiles', { data: { name: 'Fresh TX Profile' } });
    const newProfile = await newProfileRes.json();
    const txRes = await request.get(`/api/transactions?profile_id=${newProfile.id}`);
    expect((await txRes.json())).toHaveLength(0);
    await request.delete(`/api/profiles/${newProfile.id}`);
  });
});
