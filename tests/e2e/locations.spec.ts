import { test, expect } from '@playwright/test';

test.describe('Locations API', () => {
  let profileId: string;

  test.beforeEach(async ({ request }) => {
    const res = await request.post('/api/profiles', { data: { name: 'Locations Test Profile' } });
    expect(res.ok()).toBe(true);
    profileId = (await res.json()).id;
  });

  test.afterEach(async ({ request }) => {
    if (profileId) await request.delete(`/api/profiles/${profileId}`).catch(() => {});
  });

  test('GET /api/locations requires profile_id', async ({ request }) => {
    const res = await request.get('/api/locations');
    expect(res.status()).toBe(400);
  });

  test('GET /api/locations returns empty array for new profile', async ({ request }) => {
    const res = await request.get(`/api/locations?profile_id=${profileId}`);
    expect(res.ok()).toBe(true);
    expect(await res.json()).toEqual([]);
  });

  test('POST /api/locations creates a location', async ({ request }) => {
    const res = await request.post('/api/locations', {
      data: { profile_id: profileId, name: 'Wine Fridge' },
    });
    expect(res.status()).toBe(201);
    const loc = await res.json();
    expect(loc.id).toBeDefined();
    expect(loc.name).toBe('Wine Fridge');
    expect(loc.profile_id).toBe(profileId);
  });

  test('POST /api/locations rejects missing profile_id', async ({ request }) => {
    const res = await request.post('/api/locations', { data: { name: 'No Profile Location' } });
    expect(res.status()).toBe(400);
  });

  test('POST /api/locations rejects missing name', async ({ request }) => {
    const res = await request.post('/api/locations', { data: { profile_id: profileId } });
    expect(res.status()).toBe(400);
  });

  test('POST /api/locations accepts max_capacity, group_name, and notes', async ({ request }) => {
    const res = await request.post('/api/locations', {
      data: {
        profile_id: profileId,
        name: 'Cellar Rack B',
        max_capacity: 48,
        notes: 'Bottom rack, temperature 55°F',
        group_name: 'Main Cellar',
      },
    });
    expect(res.status()).toBe(201);
    const loc = await res.json();
    expect(loc.max_capacity).toBe(48);
    expect(loc.group_name).toBe('Main Cellar');
    expect(loc.notes).toContain('55°F');
  });

  test('location current_quantity reflects bottles added to that name', async ({ request }) => {
    const locRes = await request.post('/api/locations', {
      data: { profile_id: profileId, name: 'Rack A', max_capacity: 12 },
    });
    const loc = await locRes.json();

    const wineRes = await request.post('/api/wines', { data: { name: 'Rack Wine' } });
    const wine = await wineRes.json();

    await request.post('/api/cellar', {
      data: { wine_id: wine.id, profile_id: profileId, location: 'Rack A', quantity: 3 },
    });

    const listRes = await request.get(`/api/locations?profile_id=${profileId}`);
    const locations = await listRes.json();
    const found = locations.find((l: { id: string }) => l.id === loc.id);
    expect(found.current_quantity).toBe(3);
    expect(found.available_capacity).toBe(9);

    await request.delete(`/api/wines/${wine.id}`);
  });

  test('available_capacity is null/undefined when max_capacity not set', async ({ request }) => {
    const locRes = await request.post('/api/locations', {
      data: { profile_id: profileId, name: 'Unlimited Rack' },
    });
    const loc = await locRes.json();

    const listRes = await request.get(`/api/locations?profile_id=${profileId}`);
    const locations = await listRes.json();
    const found = locations.find((l: { id: string }) => l.id === loc.id);
    expect(found.available_capacity == null).toBe(true);
  });

  test('PUT /api/locations/:id updates name and capacity', async ({ request }) => {
    const createRes = await request.post('/api/locations', {
      data: { profile_id: profileId, name: 'Old Name' },
    });
    const loc = await createRes.json();

    const updateRes = await request.put(`/api/locations/${loc.id}`, {
      data: { name: 'New Name', max_capacity: 24 },
    });
    expect(updateRes.ok()).toBe(true);
    const updated = await updateRes.json();
    expect(updated.name).toBe('New Name');
    expect(updated.max_capacity).toBe(24);
  });

  test('DELETE /api/locations/:id removes the location', async ({ request }) => {
    const createRes = await request.post('/api/locations', {
      data: { profile_id: profileId, name: 'Temp Location' },
    });
    const loc = await createRes.json();

    const delRes = await request.delete(`/api/locations/${loc.id}`);
    expect(delRes.ok()).toBe(true);

    const listRes = await request.get(`/api/locations?profile_id=${profileId}`);
    const locations = await listRes.json();
    expect(locations.find((l: { id: string }) => l.id === loc.id)).toBeUndefined();
  });

  test('locations are scoped to profile', async ({ request }) => {
    const profile2Res = await request.post('/api/profiles', { data: { name: 'Other Locations Profile' } });
    const profile2 = await profile2Res.json();

    await request.post('/api/locations', {
      data: { profile_id: profileId, name: 'My Location' },
    });

    const listRes = await request.get(`/api/locations?profile_id=${profile2.id}`);
    expect((await listRes.json())).toHaveLength(0);

    await request.delete(`/api/profiles/${profile2.id}`);
  });

  test('multiple locations can be created for same profile', async ({ request }) => {
    await request.post('/api/locations', { data: { profile_id: profileId, name: 'Fridge 1' } });
    await request.post('/api/locations', { data: { profile_id: profileId, name: 'Fridge 2' } });
    await request.post('/api/locations', { data: { profile_id: profileId, name: 'Cellar Rack' } });

    const listRes = await request.get(`/api/locations?profile_id=${profileId}`);
    const locations = await listRes.json();
    expect(locations.length).toBe(3);
  });
});
