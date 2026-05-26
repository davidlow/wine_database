import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { sqliteAdapter, closeSqliteDb } from '@/lib/db/sqlite';

beforeEach(() => {
  closeSqliteDb();
});

afterEach(() => {
  closeSqliteDb();
});

// ─── Wine CRUD ───────────────────────────────────────────────────────────────

describe('Wine CRUD', () => {
  it('creates and retrieves a wine', async () => {
    const wine = await sqliteAdapter.createWine({
      name: 'Test Cabernet',
      producer: 'Test Winery',
      variety: 'Cabernet Sauvignon',
      wine_type: 'red',
      vintage_year: 2020,
    });

    expect(wine.id).toBeDefined();
    expect(wine.name).toBe('Test Cabernet');

    const fetched = await sqliteAdapter.getWineById(wine.id);
    expect(fetched).not.toBeNull();
    expect(fetched!.name).toBe('Test Cabernet');
    expect(fetched!.vintage_year).toBe(2020);
  });

  it('persists all optional wine fields', async () => {
    const wine = await sqliteAdapter.createWine({
      name: 'Full Field Wine',
      producer: 'Great Winery',
      variety: 'Cabernet Sauvignon',
      wine_type: 'red',
      region: 'Napa Valley',
      appellation: 'Oakville',
      country: 'USA',
      vintage_year: 2019,
      description: 'A bold, full-bodied red',
      average_price: 95.5,
      alcohol_content: 14.5,
      barcode: '9780201379624',
      image_url: 'https://example.com/wine.jpg',
    });

    const fetched = await sqliteAdapter.getWineById(wine.id);
    expect(fetched!.producer).toBe('Great Winery');
    expect(fetched!.variety).toBe('Cabernet Sauvignon');
    expect(fetched!.wine_type).toBe('red');
    expect(fetched!.region).toBe('Napa Valley');
    expect(fetched!.appellation).toBe('Oakville');
    expect(fetched!.country).toBe('USA');
    expect(fetched!.vintage_year).toBe(2019);
    expect(fetched!.description).toBe('A bold, full-bodied red');
    expect(fetched!.average_price).toBe(95.5);
    expect(fetched!.alcohol_content).toBe(14.5);
    expect(fetched!.barcode).toBe('9780201379624');
    expect(fetched!.image_url).toBe('https://example.com/wine.jpg');
  });

  it('creates wine with only required field (name)', async () => {
    const wine = await sqliteAdapter.createWine({ name: 'Minimal Wine' });
    expect(wine.id).toBeDefined();
    expect(wine.name).toBe('Minimal Wine');

    const fetched = await sqliteAdapter.getWineById(wine.id);
    expect(fetched!.producer).toBeFalsy();
    expect(fetched!.variety).toBeFalsy();
    expect(fetched!.wine_type).toBeFalsy();
  });

  it('returns null for non-existent wine id', async () => {
    const result = await sqliteAdapter.getWineById('nonexistent-id');
    expect(result).toBeNull();
  });

  it('assigns a unique id to each wine', async () => {
    const wine1 = await sqliteAdapter.createWine({ name: 'Wine 1' });
    const wine2 = await sqliteAdapter.createWine({ name: 'Wine 2' });
    expect(wine1.id).not.toBe(wine2.id);
  });

  it('sets created_at and updated_at timestamps on create', async () => {
    const before = new Date().toISOString();
    const wine = await sqliteAdapter.createWine({ name: 'Timestamp Test' });
    const after = new Date().toISOString();

    expect(wine.created_at >= before).toBe(true);
    expect(wine.created_at <= after).toBe(true);
    expect(wine.updated_at).toBe(wine.created_at);
  });

  it('searches wines by query', async () => {
    await sqliteAdapter.createWine({ name: 'Chateau Margaux', wine_type: 'red' });
    await sqliteAdapter.createWine({ name: 'Far Niente Chardonnay', wine_type: 'white' });

    const reds = await sqliteAdapter.getWines({ wine_type: 'red' });
    expect(reds.some((w) => w.name === 'Chateau Margaux')).toBe(true);
    expect(reds.every((w) => w.wine_type === 'red')).toBe(true);

    const results = await sqliteAdapter.getWines({ query: 'Margaux' });
    expect(results.some((w) => w.name === 'Chateau Margaux')).toBe(true);
  });

  it('query matches producer, variety, region, and country', async () => {
    await sqliteAdapter.createWine({ name: 'W1', producer: 'Famous Winery' });
    await sqliteAdapter.createWine({ name: 'W2', variety: 'Zinfandel' });
    await sqliteAdapter.createWine({ name: 'W3', region: 'Barossa Valley' });
    await sqliteAdapter.createWine({ name: 'W4', country: 'Argentina' });

    const byProducer = await sqliteAdapter.getWines({ query: 'Famous' });
    expect(byProducer.some((w) => w.producer === 'Famous Winery')).toBe(true);

    const byVariety = await sqliteAdapter.getWines({ query: 'Zinfandel' });
    expect(byVariety.some((w) => w.variety === 'Zinfandel')).toBe(true);

    const byRegion = await sqliteAdapter.getWines({ query: 'Barossa' });
    expect(byRegion.some((w) => w.region === 'Barossa Valley')).toBe(true);

    const byCountry = await sqliteAdapter.getWines({ query: 'Argentina' });
    expect(byCountry.some((w) => w.country === 'Argentina')).toBe(true);
  });

  it('filters wines by producer (partial match)', async () => {
    await sqliteAdapter.createWine({ name: 'Wine A', producer: 'Chateau Montelena' });
    await sqliteAdapter.createWine({ name: 'Wine B', producer: 'Robert Mondavi' });

    const results = await sqliteAdapter.getWines({ producer: 'Montelena' });
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.every((w) => w.producer?.includes('Montelena'))).toBe(true);
  });

  it('filters wines by country', async () => {
    await sqliteAdapter.createWine({ name: 'French Wine', country: 'France' });
    await sqliteAdapter.createWine({ name: 'Italian Wine', country: 'Italy' });

    const results = await sqliteAdapter.getWines({ country: 'France' });
    expect(results.some((w) => w.name === 'French Wine')).toBe(true);
    expect(results.every((w) => w.country === 'France')).toBe(true);
  });

  it('filters wines by region', async () => {
    await sqliteAdapter.createWine({ name: 'Napa Wine', region: 'Napa Valley' });
    await sqliteAdapter.createWine({ name: 'Sonoma Wine', region: 'Sonoma' });

    const results = await sqliteAdapter.getWines({ region: 'Napa Valley' });
    expect(results.some((w) => w.name === 'Napa Wine')).toBe(true);
    expect(results.every((w) => w.region === 'Napa Valley')).toBe(true);
  });

  it('filters wines by variety', async () => {
    await sqliteAdapter.createWine({ name: 'Cab', variety: 'Cabernet Sauvignon' });
    await sqliteAdapter.createWine({ name: 'Chard', variety: 'Chardonnay' });

    const results = await sqliteAdapter.getWines({ variety: 'Cabernet Sauvignon' });
    expect(results.some((w) => w.name === 'Cab')).toBe(true);
    expect(results.every((w) => w.variety === 'Cabernet Sauvignon')).toBe(true);
  });

  it('filters wines by vintage year', async () => {
    await sqliteAdapter.createWine({ name: '2019 Vintage', vintage_year: 2019 });
    await sqliteAdapter.createWine({ name: '2020 Vintage', vintage_year: 2020 });

    const results = await sqliteAdapter.getWines({ vintage_year: 2019 });
    expect(results.some((w) => w.name === '2019 Vintage')).toBe(true);
    expect(results.every((w) => w.vintage_year === 2019)).toBe(true);
  });

  it('combines multiple filters (AND logic)', async () => {
    await sqliteAdapter.createWine({ name: 'Red Napa', wine_type: 'red', region: 'Napa Valley' });
    await sqliteAdapter.createWine({ name: 'White Napa', wine_type: 'white', region: 'Napa Valley' });
    await sqliteAdapter.createWine({ name: 'Red Sonoma', wine_type: 'red', region: 'Sonoma' });

    const results = await sqliteAdapter.getWines({ wine_type: 'red', region: 'Napa Valley' });
    expect(results.length).toBe(1);
    expect(results[0].name).toBe('Red Napa');
  });

  it('returns wines sorted alphabetically by name', async () => {
    await sqliteAdapter.createWine({ name: 'Zinfandel Wine' });
    await sqliteAdapter.createWine({ name: 'Albariño Wine' });
    await sqliteAdapter.createWine({ name: 'Merlot Wine' });

    const results = await sqliteAdapter.getWines({});
    const names = results.map((w) => w.name);
    expect(names).toEqual([...names].sort());
  });

  it('updates a wine', async () => {
    const wine = await sqliteAdapter.createWine({ name: 'Update Test' });
    const updated = await sqliteAdapter.updateWine(wine.id, { name: 'Updated Name', vintage_year: 2021 });
    expect(updated.name).toBe('Updated Name');
    expect(updated.vintage_year).toBe(2021);
  });

  it('update preserves unchanged fields', async () => {
    const wine = await sqliteAdapter.createWine({
      name: 'Preserve Test',
      producer: 'Original Winery',
      variety: 'Merlot',
      wine_type: 'red',
      vintage_year: 2018,
      country: 'France',
    });

    const updated = await sqliteAdapter.updateWine(wine.id, { name: 'New Name' });
    expect(updated.name).toBe('New Name');
    expect(updated.producer).toBe('Original Winery');
    expect(updated.variety).toBe('Merlot');
    expect(updated.wine_type).toBe('red');
    expect(updated.vintage_year).toBe(2018);
    expect(updated.country).toBe('France');
  });

  it('update advances the updated_at timestamp', async () => {
    const wine = await sqliteAdapter.createWine({ name: 'Timestamp Update' });
    await new Promise((r) => setTimeout(r, 10));
    const updated = await sqliteAdapter.updateWine(wine.id, { name: 'New Name' });
    expect(updated.updated_at > wine.updated_at).toBe(true);
    expect(updated.created_at).toBe(wine.created_at);
  });

  it('throws when updating non-existent wine', async () => {
    await expect(sqliteAdapter.updateWine('nonexistent', { name: 'New Name' })).rejects.toThrow();
  });

  it('deletes a wine', async () => {
    const wine = await sqliteAdapter.createWine({ name: 'To Delete' });
    await sqliteAdapter.deleteWine(wine.id);
    const fetched = await sqliteAdapter.getWineById(wine.id);
    expect(fetched).toBeNull();
  });

  it('finds wine by barcode', async () => {
    await sqliteAdapter.createWine({ name: 'Barcode Wine', barcode: '0123456789012' });
    const found = await sqliteAdapter.getWineByBarcode('0123456789012');
    expect(found).not.toBeNull();
    expect(found!.name).toBe('Barcode Wine');

    const notFound = await sqliteAdapter.getWineByBarcode('9999999999999');
    expect(notFound).toBeNull();
  });
});

// ─── Profile CRUD ────────────────────────────────────────────────────────────

describe('Profile CRUD', () => {
  const userId = 'test-user-id';

  it('creates and retrieves a profile', async () => {
    const profile = await sqliteAdapter.createProfile({ user_id: userId, name: 'Home' });
    expect(profile.id).toBeDefined();
    expect(profile.name).toBe('Home');

    const fetched = await sqliteAdapter.getProfileById(profile.id, userId);
    expect(fetched).not.toBeNull();
    expect(fetched!.name).toBe('Home');
  });

  it('persists optional description field', async () => {
    const profile = await sqliteAdapter.createProfile({
      user_id: userId,
      name: 'With Description',
      description: 'Main home cellar',
    });
    const fetched = await sqliteAdapter.getProfileById(profile.id, userId);
    expect(fetched!.description).toBe('Main home cellar');
  });

  it('profile without description has falsy description', async () => {
    const profile = await sqliteAdapter.createProfile({ user_id: userId, name: 'No Desc' });
    const fetched = await sqliteAdapter.getProfileById(profile.id, userId);
    expect(fetched!.description).toBeFalsy();
  });

  it('returns null for non-existent profile id', async () => {
    const result = await sqliteAdapter.getProfileById('nonexistent', userId);
    expect(result).toBeNull();
  });

  it('cannot access another user\'s profile', async () => {
    const profile = await sqliteAdapter.createProfile({ user_id: userId, name: 'Private' });
    const result = await sqliteAdapter.getProfileById(profile.id, 'attacker-user');
    expect(result).toBeNull();
  });

  it('lists profiles for a user only', async () => {
    await sqliteAdapter.createProfile({ user_id: userId, name: 'Profile A' });
    await sqliteAdapter.createProfile({ user_id: 'other-user', name: 'Other Profile' });

    const profiles = await sqliteAdapter.getProfiles(userId);
    expect(profiles.every((p) => p.user_id === userId)).toBe(true);
    expect(profiles.some((p) => p.name === 'Profile A')).toBe(true);
    expect(profiles.every((p) => p.name !== 'Other Profile')).toBe(true);
  });

  it('returns empty list for user with no profiles', async () => {
    const profiles = await sqliteAdapter.getProfiles('user-with-no-profiles');
    expect(profiles).toEqual([]);
  });

  it('updates a profile', async () => {
    const profile = await sqliteAdapter.createProfile({ user_id: userId, name: 'Old Name' });
    const updated = await sqliteAdapter.updateProfile(profile.id, userId, { name: 'New Name' });
    expect(updated.name).toBe('New Name');
  });

  it('update preserves unchanged profile fields', async () => {
    const profile = await sqliteAdapter.createProfile({
      user_id: userId,
      name: 'Original',
      description: 'Original description',
    });
    const updated = await sqliteAdapter.updateProfile(profile.id, userId, { name: 'New Name' });
    expect(updated.description).toBe('Original description');
    expect(updated.user_id).toBe(userId);
  });

  it('throws when updating non-existent profile', async () => {
    await expect(
      sqliteAdapter.updateProfile('nonexistent', userId, { name: 'New' })
    ).rejects.toThrow();
  });

  it('cannot update another user\'s profile', async () => {
    const profile = await sqliteAdapter.createProfile({ user_id: userId, name: 'Mine' });
    await expect(
      sqliteAdapter.updateProfile(profile.id, 'other-user', { name: 'Hijacked' })
    ).rejects.toThrow();
  });

  it('deletes a profile', async () => {
    const profile = await sqliteAdapter.createProfile({ user_id: userId, name: 'To Delete' });
    await sqliteAdapter.deleteProfile(profile.id, userId);
    const fetched = await sqliteAdapter.getProfileById(profile.id, userId);
    expect(fetched).toBeNull();
  });

  it('cannot delete another user\'s profile', async () => {
    const profile = await sqliteAdapter.createProfile({ user_id: userId, name: 'Mine' });
    await sqliteAdapter.deleteProfile(profile.id, 'other-user');
    // Profile should still exist because the DELETE WHERE clause includes user_id
    const fetched = await sqliteAdapter.getProfileById(profile.id, userId);
    expect(fetched).not.toBeNull();
  });
});

// ─── Cellar inventory ─────────────────────────────────────────────────────────

describe('Cellar inventory', () => {
  const userId = 'cellar-test-user';
  let wineId: string;
  let profileId: string;

  beforeEach(async () => {
    closeSqliteDb();
    const wine = await sqliteAdapter.createWine({ name: 'Inventory Test Wine', producer: 'Test Winery' });
    const profile = await sqliteAdapter.createProfile({ user_id: userId, name: 'Test Cellar' });
    wineId = wine.id;
    profileId = profile.id;
  });

  it('adds bottles and tracks quantity', async () => {
    const item = await sqliteAdapter.addBottle(
      { wine_id: wineId, profile_id: profileId, location: 'Rack A, Slot 1', quantity: 3 },
      userId
    );
    expect(item.quantity).toBe(3);
    expect(item.location).toBe('Rack A, Slot 1');
  });

  it('adds a single bottle when quantity omitted', async () => {
    const item = await sqliteAdapter.addBottle(
      { wine_id: wineId, profile_id: profileId, location: 'Rack A' },
      userId
    );
    expect(item.quantity).toBe(1);
  });

  it('persists all optional inventory fields', async () => {
    const item = await sqliteAdapter.addBottle(
      {
        wine_id: wineId,
        profile_id: profileId,
        location: 'Rack B',
        quantity: 2,
        purchase_price: 45.99,
        purchase_date: '2024-01-15',
        notes: 'Anniversary gift',
      },
      userId
    );
    expect(item.purchase_price).toBe(45.99);
    expect(item.purchase_date).toBe('2024-01-15');
    expect(item.notes).toBe('Anniversary gift');
  });

  it('aggregates bottles at same location', async () => {
    await sqliteAdapter.addBottle(
      { wine_id: wineId, profile_id: profileId, location: 'Rack A', quantity: 2 },
      userId
    );
    const item = await sqliteAdapter.addBottle(
      { wine_id: wineId, profile_id: profileId, location: 'Rack A', quantity: 3 },
      userId
    );
    expect(item.quantity).toBe(5);
  });

  it('tracks same wine at different locations as separate entries', async () => {
    const itemA = await sqliteAdapter.addBottle(
      { wine_id: wineId, profile_id: profileId, location: 'Location A', quantity: 3 },
      userId
    );
    const itemB = await sqliteAdapter.addBottle(
      { wine_id: wineId, profile_id: profileId, location: 'Location B', quantity: 2 },
      userId
    );

    expect(itemA.id).not.toBe(itemB.id);

    const inventory = await sqliteAdapter.getCellarInventory(profileId, userId);
    const locA = inventory.find((i) => i.location === 'Location A');
    const locB = inventory.find((i) => i.location === 'Location B');
    expect(locA!.quantity).toBe(3);
    expect(locB!.quantity).toBe(2);
  });

  it('removes bottles and decrements quantity', async () => {
    const item = await sqliteAdapter.addBottle(
      { wine_id: wineId, profile_id: profileId, location: 'Rack B', quantity: 4 },
      userId
    );
    await sqliteAdapter.removeBottle({ cellar_inventory_id: item.id, quantity: 2 }, userId);

    const inventory = await sqliteAdapter.getCellarInventory(profileId, userId);
    const updated = inventory.find((i) => i.id === item.id);
    expect(updated?.quantity).toBe(2);
  });

  it('removes from specific location without affecting other locations', async () => {
    const itemA = await sqliteAdapter.addBottle(
      { wine_id: wineId, profile_id: profileId, location: 'Location A', quantity: 3 },
      userId
    );
    const itemB = await sqliteAdapter.addBottle(
      { wine_id: wineId, profile_id: profileId, location: 'Location B', quantity: 2 },
      userId
    );

    await sqliteAdapter.removeBottle({ cellar_inventory_id: itemB.id, quantity: 1 }, userId);

    const inventory = await sqliteAdapter.getCellarInventory(profileId, userId);
    const locA = inventory.find((i) => i.id === itemA.id);
    const locB = inventory.find((i) => i.id === itemB.id);

    expect(locA!.quantity).toBe(3); // unchanged
    expect(locB!.quantity).toBe(1); // decremented only this location
  });

  it('removes all bottles from a location (quantity reaches zero, entry excluded)', async () => {
    const item = await sqliteAdapter.addBottle(
      { wine_id: wineId, profile_id: profileId, location: 'Rack C', quantity: 2 },
      userId
    );
    await sqliteAdapter.removeBottle({ cellar_inventory_id: item.id, quantity: 2 }, userId);

    const inventory = await sqliteAdapter.getCellarInventory(profileId, userId);
    expect(inventory.find((i) => i.id === item.id)).toBeUndefined();
  });

  it('prevents removing more than available', async () => {
    const item = await sqliteAdapter.addBottle(
      { wine_id: wineId, profile_id: profileId, location: 'Rack C', quantity: 1 },
      userId
    );
    await expect(
      sqliteAdapter.removeBottle({ cellar_inventory_id: item.id, quantity: 5 }, userId)
    ).rejects.toThrow();
  });

  it('throws when removing from non-existent inventory entry', async () => {
    await expect(
      sqliteAdapter.removeBottle({ cellar_inventory_id: 'nonexistent', quantity: 1 }, userId)
    ).rejects.toThrow();
  });

  it('includes wine data in getCellarInventory results', async () => {
    await sqliteAdapter.addBottle(
      { wine_id: wineId, profile_id: profileId, location: 'Rack G', quantity: 1 },
      userId
    );

    const inventory = await sqliteAdapter.getCellarInventory(profileId, userId);
    const item = inventory.find((i) => i.wine_id === wineId);
    expect(item!.wine).toBeDefined();
    expect(item!.wine!.name).toBe('Inventory Test Wine');
    expect(item!.wine!.id).toBe(wineId);
  });

  it('getCellarInventoryByWine returns only that wine\'s entries', async () => {
    const wine2 = await sqliteAdapter.createWine({ name: 'Second Wine' });
    await sqliteAdapter.addBottle(
      { wine_id: wineId, profile_id: profileId, location: 'Rack H', quantity: 2 },
      userId
    );
    await sqliteAdapter.addBottle(
      { wine_id: wine2.id, profile_id: profileId, location: 'Rack I', quantity: 1 },
      userId
    );

    const results = await sqliteAdapter.getCellarInventoryByWine(wineId, profileId);
    expect(results.length).toBe(1);
    expect(results[0].wine_id).toBe(wineId);
  });

  it('profile isolation: cannot see other profile\'s inventory', async () => {
    const profile2 = await sqliteAdapter.createProfile({ user_id: userId, name: 'Profile 2' });
    await sqliteAdapter.addBottle(
      { wine_id: wineId, profile_id: profileId, location: 'Rack J', quantity: 1 },
      userId
    );
    await sqliteAdapter.addBottle(
      { wine_id: wineId, profile_id: profile2.id, location: 'Rack K', quantity: 1 },
      userId
    );

    const inv1 = await sqliteAdapter.getCellarInventory(profileId, userId);
    const inv2 = await sqliteAdapter.getCellarInventory(profile2.id, userId);

    expect(inv1.every((i) => i.profile_id === profileId)).toBe(true);
    expect(inv2.every((i) => i.profile_id === profile2.id)).toBe(true);
  });

  it('updateBottleInventory changes location, quantity, and notes', async () => {
    const item = await sqliteAdapter.addBottle(
      { wine_id: wineId, profile_id: profileId, location: 'Old Location', quantity: 3 },
      userId
    );

    const updated = await sqliteAdapter.updateBottleInventory(item.id, {
      location: 'New Location',
      quantity: 5,
      notes: 'Moved to new rack',
    });

    expect(updated.location).toBe('New Location');
    expect(updated.quantity).toBe(5);
    expect(updated.notes).toBe('Moved to new rack');
  });

  it('updateBottleInventory preserves unchanged fields', async () => {
    const item = await sqliteAdapter.addBottle(
      {
        wine_id: wineId,
        profile_id: profileId,
        location: 'Rack L',
        quantity: 2,
        purchase_price: 49.99,
      },
      userId
    );

    const updated = await sqliteAdapter.updateBottleInventory(item.id, { notes: 'New note' });
    expect(updated.quantity).toBe(2);
    expect(updated.purchase_price).toBe(49.99);
    expect(updated.location).toBe('Rack L');
  });

  it('throws when updating non-existent inventory entry', async () => {
    await expect(
      sqliteAdapter.updateBottleInventory('nonexistent', { quantity: 1 })
    ).rejects.toThrow();
  });

  it('excludes zero-quantity items from inventory list', async () => {
    const item = await sqliteAdapter.addBottle(
      { wine_id: wineId, profile_id: profileId, location: 'Rack E', quantity: 1 },
      userId
    );
    await sqliteAdapter.removeBottle({ cellar_inventory_id: item.id, quantity: 1 }, userId);

    const inventory = await sqliteAdapter.getCellarInventory(profileId, userId);
    expect(inventory.find((i) => i.id === item.id)).toBeUndefined();
  });

  it('records transactions on add and remove', async () => {
    const item = await sqliteAdapter.addBottle(
      { wine_id: wineId, profile_id: profileId, location: 'Rack D', quantity: 2 },
      userId
    );
    await sqliteAdapter.removeBottle({ cellar_inventory_id: item.id, quantity: 1 }, userId);

    const transactions = await sqliteAdapter.getTransactions(profileId, userId);
    expect(transactions.some((t) => t.transaction_type === 'add')).toBe(true);
    expect(transactions.some((t) => t.transaction_type === 'remove')).toBe(true);
  });

  it('transaction records include correct wine_id, quantity, and location', async () => {
    const item = await sqliteAdapter.addBottle(
      { wine_id: wineId, profile_id: profileId, location: 'Rack T', quantity: 3 },
      userId
    );

    const transactions = await sqliteAdapter.getTransactions(profileId, userId);
    const addTx = transactions.find((t) => t.transaction_type === 'add');

    expect(addTx!.wine_id).toBe(wineId);
    expect(addTx!.quantity).toBe(3);
    expect(addTx!.location).toBe('Rack T');
    expect(addTx!.cellar_inventory_id).toBe(item.id);
  });

  it('remove transaction preserves notes', async () => {
    const item = await sqliteAdapter.addBottle(
      { wine_id: wineId, profile_id: profileId, location: 'Rack U', quantity: 2 },
      userId
    );
    await sqliteAdapter.removeBottle(
      { cellar_inventory_id: item.id, quantity: 1, notes: 'Drank at dinner party' },
      userId
    );

    const transactions = await sqliteAdapter.getTransactions(profileId, userId);
    const removeTx = transactions.find((t) => t.transaction_type === 'remove');
    expect(removeTx!.notes).toBe('Drank at dinner party');
  });

  it('getTransactions respects limit parameter', async () => {
    // Create 6 add+remove pairs = 12 transactions total
    for (let i = 0; i < 6; i++) {
      const item = await sqliteAdapter.addBottle(
        { wine_id: wineId, profile_id: profileId, location: `Slot ${i}`, quantity: 1 },
        userId
      );
      await sqliteAdapter.removeBottle({ cellar_inventory_id: item.id, quantity: 1 }, userId);
    }

    const limited = await sqliteAdapter.getTransactions(profileId, userId, 5);
    expect(limited.length).toBe(5);
  });

  it('deleting a wine cascades to cellar inventory', async () => {
    const wine2 = await sqliteAdapter.createWine({ name: 'Cascade Test Wine' });
    await sqliteAdapter.addBottle(
      { wine_id: wine2.id, profile_id: profileId, location: 'Rack X', quantity: 2 },
      userId
    );

    await sqliteAdapter.deleteWine(wine2.id);

    const inv = await sqliteAdapter.getCellarInventory(profileId, userId);
    expect(inv.find((i) => i.wine_id === wine2.id)).toBeUndefined();
  });
});
