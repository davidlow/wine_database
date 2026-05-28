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

  // ─── moveBottle ──────────────────────────────────────────────────────────────

  it('moves all bottles to a new location', async () => {
    const item = await sqliteAdapter.addBottle(
      { wine_id: wineId, profile_id: profileId, location: 'Rack A', quantity: 3 },
      userId
    );

    await sqliteAdapter.moveBottle(
      { cellar_inventory_id: item.id, new_location: 'Fridge', quantity: 3 },
      userId
    );

    const inv = await sqliteAdapter.getCellarInventory(profileId, userId);
    expect(inv.find((i) => i.id === item.id)).toBeUndefined(); // source zeroed out
    const dest = inv.find((i) => i.location === 'Fridge');
    expect(dest).toBeDefined();
    expect(dest!.quantity).toBe(3);
  });

  it('moves partial quantity, leaving remainder at source', async () => {
    const item = await sqliteAdapter.addBottle(
      { wine_id: wineId, profile_id: profileId, location: 'Rack B', quantity: 4 },
      userId
    );

    await sqliteAdapter.moveBottle(
      { cellar_inventory_id: item.id, new_location: 'Fridge', quantity: 2 },
      userId
    );

    const inv = await sqliteAdapter.getCellarInventory(profileId, userId);
    const source = inv.find((i) => i.id === item.id);
    const dest = inv.find((i) => i.location === 'Fridge');

    expect(source!.quantity).toBe(2);
    expect(dest!.quantity).toBe(2);
  });

  it('merges into existing destination entry', async () => {
    const source = await sqliteAdapter.addBottle(
      { wine_id: wineId, profile_id: profileId, location: 'Rack C', quantity: 2 },
      userId
    );
    await sqliteAdapter.addBottle(
      { wine_id: wineId, profile_id: profileId, location: 'Fridge', quantity: 3 },
      userId
    );

    await sqliteAdapter.moveBottle(
      { cellar_inventory_id: source.id, new_location: 'Fridge', quantity: 2 },
      userId
    );

    const inv = await sqliteAdapter.getCellarInventory(profileId, userId);
    const fridge = inv.find((i) => i.location === 'Fridge');
    expect(fridge!.quantity).toBe(5); // 3 existing + 2 moved
  });

  it('records a move transaction with route in location field', async () => {
    const item = await sqliteAdapter.addBottle(
      { wine_id: wineId, profile_id: profileId, location: 'Rack D', quantity: 2 },
      userId
    );

    await sqliteAdapter.moveBottle(
      { cellar_inventory_id: item.id, new_location: 'Shelf 1', quantity: 1 },
      userId
    );

    const transactions = await sqliteAdapter.getTransactions(profileId, userId);
    const moveTx = transactions.find((t) => t.transaction_type === 'move');
    expect(moveTx).toBeDefined();
    expect(moveTx!.quantity).toBe(1);
    expect(moveTx!.location).toBe('Rack D → Shelf 1');
  });

  it('move transaction preserves optional notes', async () => {
    const item = await sqliteAdapter.addBottle(
      { wine_id: wineId, profile_id: profileId, location: 'Rack E', quantity: 2 },
      userId
    );

    await sqliteAdapter.moveBottle(
      { cellar_inventory_id: item.id, new_location: 'Wine Fridge', quantity: 1, notes: 'For dinner' },
      userId
    );

    const transactions = await sqliteAdapter.getTransactions(profileId, userId);
    const moveTx = transactions.find((t) => t.transaction_type === 'move');
    expect(moveTx!.notes).toBe('For dinner');
  });

  it('throws when moving more than available', async () => {
    const item = await sqliteAdapter.addBottle(
      { wine_id: wineId, profile_id: profileId, location: 'Rack F', quantity: 2 },
      userId
    );

    await expect(
      sqliteAdapter.moveBottle({ cellar_inventory_id: item.id, new_location: 'Fridge', quantity: 5 }, userId)
    ).rejects.toThrow();
  });

  it('throws when source and destination are the same location', async () => {
    const item = await sqliteAdapter.addBottle(
      { wine_id: wineId, profile_id: profileId, location: 'Rack G', quantity: 2 },
      userId
    );

    await expect(
      sqliteAdapter.moveBottle({ cellar_inventory_id: item.id, new_location: 'Rack G', quantity: 1 }, userId)
    ).rejects.toThrow('same location');
  });

  it('throws when moving from non-existent inventory entry', async () => {
    await expect(
      sqliteAdapter.moveBottle({ cellar_inventory_id: 'nonexistent', new_location: 'Fridge', quantity: 1 }, userId)
    ).rejects.toThrow();
  });
});

// ─── Wine data persistence ────────────────────────────────────────────────────

describe('Wine data persistence after inventory removal', () => {
  const userId = 'persist-test-user';

  it('wine record survives removing all bottles', async () => {
    const wine = await sqliteAdapter.createWine({ name: 'Persist Wine', vintage_year: 2020 });
    const profile = await sqliteAdapter.createProfile({ user_id: userId, name: 'Persist Cellar' });
    const item = await sqliteAdapter.addBottle({ wine_id: wine.id, profile_id: profile.id, location: 'Rack A', quantity: 3 }, userId);

    await sqliteAdapter.removeBottle({ cellar_inventory_id: item.id, quantity: 3 }, userId);

    // Inventory should be gone (quantity = 0 filtered out)
    const inv = await sqliteAdapter.getCellarInventory(profile.id, userId);
    expect(inv.find(i => i.wine_id === wine.id)).toBeUndefined();

    // Wine record must still exist
    const fetched = await sqliteAdapter.getWineById(wine.id);
    expect(fetched).not.toBeNull();
    expect(fetched!.name).toBe('Persist Wine');
    expect(fetched!.vintage_year).toBe(2020);
  });

  it('wine record survives removing all bottles across multiple locations', async () => {
    const wine = await sqliteAdapter.createWine({ name: 'Multi-loc Persist Wine' });
    const profile = await sqliteAdapter.createProfile({ user_id: userId, name: 'ML Persist Cellar' });
    const item1 = await sqliteAdapter.addBottle({ wine_id: wine.id, profile_id: profile.id, location: 'Rack A', quantity: 2 }, userId);
    const item2 = await sqliteAdapter.addBottle({ wine_id: wine.id, profile_id: profile.id, location: 'Rack B', quantity: 1 }, userId);

    await sqliteAdapter.removeBottle({ cellar_inventory_id: item1.id, quantity: 2 }, userId);
    await sqliteAdapter.removeBottle({ cellar_inventory_id: item2.id, quantity: 1 }, userId);

    const inv = await sqliteAdapter.getCellarInventory(profile.id, userId);
    expect(inv.filter(i => i.wine_id === wine.id).length).toBe(0);

    const fetched = await sqliteAdapter.getWineById(wine.id);
    expect(fetched).not.toBeNull();
    expect(fetched!.name).toBe('Multi-loc Persist Wine');
  });

  it('wine persists across all profiles after bottles removed from all', async () => {
    const wine = await sqliteAdapter.createWine({ name: 'All Profile Persist Wine' });
    const p1 = await sqliteAdapter.createProfile({ user_id: userId, name: 'Persist P1' });
    const p2 = await sqliteAdapter.createProfile({ user_id: userId, name: 'Persist P2' });

    const i1 = await sqliteAdapter.addBottle({ wine_id: wine.id, profile_id: p1.id, location: 'Rack', quantity: 1 }, userId);
    const i2 = await sqliteAdapter.addBottle({ wine_id: wine.id, profile_id: p2.id, location: 'Rack', quantity: 1 }, userId);

    await sqliteAdapter.removeBottle({ cellar_inventory_id: i1.id, quantity: 1 }, userId);
    await sqliteAdapter.removeBottle({ cellar_inventory_id: i2.id, quantity: 1 }, userId);

    expect(await sqliteAdapter.getWineById(wine.id)).not.toBeNull();
  });

  it('wine metadata (notes, description, drink window) survives inventory removal', async () => {
    const wine = await sqliteAdapter.createWine({
      name: 'Metadata Persist Wine',
      description: 'A great wine',
      drink_from_year: 2025,
      drink_by_year: 2035,
      average_price: 150,
    });
    const profile = await sqliteAdapter.createProfile({ user_id: userId, name: 'Meta Persist Cellar' });
    const item = await sqliteAdapter.addBottle({ wine_id: wine.id, profile_id: profile.id, location: 'Rack', quantity: 1 }, userId);

    await sqliteAdapter.removeBottle({ cellar_inventory_id: item.id, quantity: 1 }, userId);

    const fetched = await sqliteAdapter.getWineById(wine.id);
    expect(fetched!.description).toBe('A great wine');
    expect(fetched!.drink_from_year).toBe(2025);
    expect(fetched!.drink_by_year).toBe(2035);
    expect(fetched!.average_price).toBe(150);
  });

  it('getWines still returns wine after all inventory removed', async () => {
    const wine = await sqliteAdapter.createWine({ name: 'Catalog Persist Wine', wine_type: 'red' });
    const profile = await sqliteAdapter.createProfile({ user_id: userId, name: 'Cat Persist Cellar' });
    const item = await sqliteAdapter.addBottle({ wine_id: wine.id, profile_id: profile.id, location: 'Rack', quantity: 1 }, userId);

    await sqliteAdapter.removeBottle({ cellar_inventory_id: item.id, quantity: 1 }, userId);

    // Wine should appear in catalog search (no profile filter)
    const wines = await sqliteAdapter.getWines({});
    expect(wines.find(w => w.id === wine.id)).toBeDefined();

    // Wine should NOT appear when filtered by profile (no inventory)
    const filtered = await sqliteAdapter.getWines({ profile_ids: profile.id });
    expect(filtered.find(w => w.id === wine.id)).toBeUndefined();
  });
});

// ─── Drink window fields ──────────────────────────────────────────────────────

describe('Drink window fields', () => {
  const CURRENT_YEAR = new Date().getFullYear();

  it('persists drink_from_year and drink_by_year on create', async () => {
    const wine = await sqliteAdapter.createWine({
      name: 'Baroло Riserva',
      drink_from_year: CURRENT_YEAR + 5,
      drink_by_year: CURRENT_YEAR + 20,
    });

    const fetched = await sqliteAdapter.getWineById(wine.id);
    expect(fetched!.drink_from_year).toBe(CURRENT_YEAR + 5);
    expect(fetched!.drink_by_year).toBe(CURRENT_YEAR + 20);
  });

  it('drink_from_year and drink_by_year default to null when omitted', async () => {
    const wine = await sqliteAdapter.createWine({ name: 'No Window Wine' });
    const fetched = await sqliteAdapter.getWineById(wine.id);
    expect(fetched!.drink_from_year).toBeFalsy();
    expect(fetched!.drink_by_year).toBeFalsy();
  });

  it('updates drink_from_year and drink_by_year', async () => {
    const wine = await sqliteAdapter.createWine({
      name: 'Window Update Wine',
      drink_from_year: 2020,
      drink_by_year: 2030,
    });

    const updated = await sqliteAdapter.updateWine(wine.id, {
      drink_from_year: 2022,
      drink_by_year: 2035,
    });

    expect(updated.drink_from_year).toBe(2022);
    expect(updated.drink_by_year).toBe(2035);

    const fetched = await sqliteAdapter.getWineById(wine.id);
    expect(fetched!.drink_from_year).toBe(2022);
    expect(fetched!.drink_by_year).toBe(2035);
  });

  it('update preserves drink window when other fields change', async () => {
    const wine = await sqliteAdapter.createWine({
      name: 'Preserve Window',
      drink_from_year: CURRENT_YEAR + 3,
      drink_by_year: CURRENT_YEAR + 15,
    });

    const updated = await sqliteAdapter.updateWine(wine.id, { name: 'Updated Name' });
    expect(updated.drink_from_year).toBe(CURRENT_YEAR + 3);
    expect(updated.drink_by_year).toBe(CURRENT_YEAR + 15);
  });

  it('getCellarInventory includes drink_from_year and drink_by_year on wine sub-object', async () => {
    const userId = 'dw-test-user';
    const wine = await sqliteAdapter.createWine({
      name: 'Cellar Window Wine',
      drink_from_year: CURRENT_YEAR + 2,
      drink_by_year: CURRENT_YEAR + 10,
    });
    const profile = await sqliteAdapter.createProfile({ user_id: userId, name: 'DW Cellar' });
    await sqliteAdapter.addBottle({ wine_id: wine.id, profile_id: profile.id, location: 'Rack A', quantity: 1 }, userId);

    const inv = await sqliteAdapter.getCellarInventory(profile.id, userId);
    const item = inv.find(i => i.wine_id === wine.id);
    expect(item!.wine).toBeDefined();
    expect(item!.wine!.drink_from_year).toBe(CURRENT_YEAR + 2);
    expect(item!.wine!.drink_by_year).toBe(CURRENT_YEAR + 10);
  });

  it('identifies a too-young wine (drink_from_year > current year)', async () => {
    const userId = 'dw-young-user';
    const wine = await sqliteAdapter.createWine({
      name: 'Too Young Wine',
      drink_from_year: CURRENT_YEAR + 5,
      drink_by_year: CURRENT_YEAR + 20,
    });
    const profile = await sqliteAdapter.createProfile({ user_id: userId, name: 'Young Cellar' });
    await sqliteAdapter.addBottle({ wine_id: wine.id, profile_id: profile.id, location: 'Rack B', quantity: 2 }, userId);

    const inv = await sqliteAdapter.getCellarInventory(profile.id, userId);
    const item = inv.find(i => i.wine_id === wine.id);
    expect(item!.wine!.drink_from_year! > CURRENT_YEAR).toBe(true);
  });

  it('identifies a past-peak wine (drink_by_year < current year)', async () => {
    const userId = 'dw-peak-user';
    const wine = await sqliteAdapter.createWine({
      name: 'Past Peak Wine',
      drink_from_year: CURRENT_YEAR - 10,
      drink_by_year: CURRENT_YEAR - 1,
    });
    const profile = await sqliteAdapter.createProfile({ user_id: userId, name: 'Peak Cellar' });
    await sqliteAdapter.addBottle({ wine_id: wine.id, profile_id: profile.id, location: 'Rack C', quantity: 1 }, userId);

    const inv = await sqliteAdapter.getCellarInventory(profile.id, userId);
    const item = inv.find(i => i.wine_id === wine.id);
    expect(item!.wine!.drink_by_year! < CURRENT_YEAR).toBe(true);
  });

  it('identifies a wine in its drinking window', async () => {
    const userId = 'dw-ready-user';
    const wine = await sqliteAdapter.createWine({
      name: 'Ready To Drink Wine',
      drink_from_year: CURRENT_YEAR - 2,
      drink_by_year: CURRENT_YEAR + 5,
    });
    const profile = await sqliteAdapter.createProfile({ user_id: userId, name: 'Ready Cellar' });
    await sqliteAdapter.addBottle({ wine_id: wine.id, profile_id: profile.id, location: 'Rack D', quantity: 3 }, userId);

    const inv = await sqliteAdapter.getCellarInventory(profile.id, userId);
    const item = inv.find(i => i.wine_id === wine.id);
    const fromYear = item!.wine!.drink_from_year!;
    const byYear = item!.wine!.drink_by_year!;
    expect(fromYear <= CURRENT_YEAR && byYear >= CURRENT_YEAR).toBe(true);
  });
});

// ─── Profile group_name ──────────────────────────────────────────────────────

describe('Profile group_name', () => {
  const userId = 'group-test-user';

  it('creates profile with group_name', async () => {
    const profile = await sqliteAdapter.createProfile({
      user_id: userId,
      name: 'Home Cellar',
      group_name: 'Production',
    });

    const fetched = await sqliteAdapter.getProfileById(profile.id, userId);
    expect(fetched!.group_name).toBe('Production');
  });

  it('profile without group_name has falsy group_name', async () => {
    const profile = await sqliteAdapter.createProfile({ user_id: userId, name: 'Ungrouped' });
    const fetched = await sqliteAdapter.getProfileById(profile.id, userId);
    expect(fetched!.group_name).toBeFalsy();
  });

  it('updates group_name on profile', async () => {
    const profile = await sqliteAdapter.createProfile({
      user_id: userId,
      name: 'Vacation Cellar',
      group_name: 'Old Group',
    });

    const updated = await sqliteAdapter.updateProfile(profile.id, userId, { group_name: 'New Group' });
    expect(updated.group_name).toBe('New Group');

    const fetched = await sqliteAdapter.getProfileById(profile.id, userId);
    expect(fetched!.group_name).toBe('New Group');
  });

  it('preserves group_name through unrelated updates', async () => {
    const profile = await sqliteAdapter.createProfile({
      user_id: userId,
      name: 'Stable Group Cellar',
      group_name: 'Stable Group',
    });

    const updated = await sqliteAdapter.updateProfile(profile.id, userId, { description: 'New desc' });
    expect(updated.group_name).toBe('Stable Group');
  });

  it('can clear group_name by setting it to empty string', async () => {
    const profile = await sqliteAdapter.createProfile({
      user_id: userId,
      name: 'Clear Group',
      group_name: 'Some Group',
    });

    const updated = await sqliteAdapter.updateProfile(profile.id, userId, { group_name: '' });
    const fetched = await sqliteAdapter.getProfileById(updated.id, userId);
    expect(fetched!.group_name).toBeFalsy();
  });

  it('getProfiles returns group_name for all profiles', async () => {
    await sqliteAdapter.createProfile({ user_id: userId, name: 'Group A1', group_name: 'Group A' });
    await sqliteAdapter.createProfile({ user_id: userId, name: 'Group B1', group_name: 'Group B' });
    await sqliteAdapter.createProfile({ user_id: userId, name: 'Ungrouped' });

    const profiles = await sqliteAdapter.getProfiles(userId);
    expect(profiles.some(p => p.group_name === 'Group A')).toBe(true);
    expect(profiles.some(p => p.group_name === 'Group B')).toBe(true);
    expect(profiles.some(p => !p.group_name)).toBe(true);
  });
});

// ─── Location CRUD ───────────────────────────────────────────────────────────

describe('Location CRUD', () => {
  const userId = 'loc-test-user';
  let profileId: string;

  beforeEach(async () => {
    closeSqliteDb();
    const profile = await sqliteAdapter.createProfile({ user_id: userId, name: 'Location Test Cellar' });
    profileId = profile.id;
  });

  it('creates and retrieves a location', async () => {
    const loc = await sqliteAdapter.createLocation({
      profile_id: profileId,
      name: 'Rack A',
    });

    expect(loc.id).toBeDefined();
    expect(loc.name).toBe('Rack A');
    expect(loc.profile_id).toBe(profileId);

    const locs = await sqliteAdapter.getLocations(profileId);
    expect(locs.some(l => l.id === loc.id)).toBe(true);
  });

  it('persists all optional location fields', async () => {
    const loc = await sqliteAdapter.createLocation({
      profile_id: profileId,
      name: 'Wine Fridge',
      group_name: 'Kitchen',
      max_capacity: 24,
      notes: 'Temperature controlled',
    });

    const locs = await sqliteAdapter.getLocations(profileId);
    const found = locs.find(l => l.id === loc.id);
    expect(found!.group_name).toBe('Kitchen');
    expect(found!.max_capacity).toBe(24);
    expect(found!.notes).toBe('Temperature controlled');
  });

  it('getLocations returns current_quantity of zero for empty location', async () => {
    await sqliteAdapter.createLocation({ profile_id: profileId, name: 'Empty Rack', max_capacity: 12 });

    const locs = await sqliteAdapter.getLocations(profileId);
    const loc = locs.find(l => l.name === 'Empty Rack');
    expect(loc!.current_quantity).toBe(0);
  });

  it('getLocations tracks current_quantity as bottles are added', async () => {
    await sqliteAdapter.createLocation({ profile_id: profileId, name: 'Filling Rack', max_capacity: 20 });
    const wine = await sqliteAdapter.createWine({ name: 'Capacity Test Wine' });
    await sqliteAdapter.addBottle({ wine_id: wine.id, profile_id: profileId, location: 'Filling Rack', quantity: 5 }, userId);

    const locs = await sqliteAdapter.getLocations(profileId);
    const loc = locs.find(l => l.name === 'Filling Rack');
    expect(loc!.current_quantity).toBe(5);
  });

  it('available_capacity decreases as bottles are added', async () => {
    await sqliteAdapter.createLocation({ profile_id: profileId, name: 'Capacity Rack', max_capacity: 10 });
    const wine = await sqliteAdapter.createWine({ name: 'Available Cap Wine' });
    await sqliteAdapter.addBottle({ wine_id: wine.id, profile_id: profileId, location: 'Capacity Rack', quantity: 4 }, userId);

    const locs = await sqliteAdapter.getLocations(profileId);
    const loc = locs.find(l => l.name === 'Capacity Rack');
    expect(loc!.available_capacity).toBe(6);
  });

  it('available_capacity is undefined when max_capacity not set', async () => {
    await sqliteAdapter.createLocation({ profile_id: profileId, name: 'Unlimited Rack' });

    const locs = await sqliteAdapter.getLocations(profileId);
    const loc = locs.find(l => l.name === 'Unlimited Rack');
    expect(loc!.available_capacity).toBeUndefined();
  });

  it('available_capacity floors at zero (overfill scenario)', async () => {
    await sqliteAdapter.createLocation({ profile_id: profileId, name: 'Overfull Rack', max_capacity: 3 });
    const wine = await sqliteAdapter.createWine({ name: 'Overfull Wine' });
    // Add more bottles than capacity
    await sqliteAdapter.addBottle({ wine_id: wine.id, profile_id: profileId, location: 'Overfull Rack', quantity: 5 }, userId);

    const locs = await sqliteAdapter.getLocations(profileId);
    const loc = locs.find(l => l.name === 'Overfull Rack');
    expect(loc!.available_capacity).toBe(0);
  });

  it('updates location name, group, capacity, and notes', async () => {
    const loc = await sqliteAdapter.createLocation({
      profile_id: profileId,
      name: 'Old Name',
      max_capacity: 10,
    });

    const updated = await sqliteAdapter.updateLocation(loc.id, {
      name: 'New Name',
      group_name: 'Updated Group',
      max_capacity: 20,
      notes: 'New notes',
    });

    expect(updated.name).toBe('New Name');
    expect(updated.group_name).toBe('Updated Group');
    expect(updated.max_capacity).toBe(20);
    expect(updated.notes).toBe('New notes');
  });

  it('updateLocation preserves unchanged fields', async () => {
    const loc = await sqliteAdapter.createLocation({
      profile_id: profileId,
      name: 'Stable Rack',
      group_name: 'Storage',
      max_capacity: 15,
    });

    const updated = await sqliteAdapter.updateLocation(loc.id, { notes: 'Just added a note' });
    expect(updated.name).toBe('Stable Rack');
    expect(updated.group_name).toBe('Storage');
    expect(updated.max_capacity).toBe(15);
  });

  it('throws when updating non-existent location', async () => {
    await expect(sqliteAdapter.updateLocation('nonexistent', { name: 'X' })).rejects.toThrow();
  });

  it('deletes a location', async () => {
    const loc = await sqliteAdapter.createLocation({ profile_id: profileId, name: 'Delete Me' });
    await sqliteAdapter.deleteLocation(loc.id);

    const locs = await sqliteAdapter.getLocations(profileId);
    expect(locs.find(l => l.id === loc.id)).toBeUndefined();
  });

  it('getLocations returns sorted alphabetically by name', async () => {
    await sqliteAdapter.createLocation({ profile_id: profileId, name: 'Rack Z' });
    await sqliteAdapter.createLocation({ profile_id: profileId, name: 'Rack A' });
    await sqliteAdapter.createLocation({ profile_id: profileId, name: 'Rack M' });

    const locs = await sqliteAdapter.getLocations(profileId);
    const names = locs.map(l => l.name);
    expect(names).toEqual([...names].sort());
  });

  it('locations are isolated per profile', async () => {
    const profile2 = await sqliteAdapter.createProfile({ user_id: userId, name: 'Other Cellar' });
    await sqliteAdapter.createLocation({ profile_id: profileId, name: 'My Rack' });
    await sqliteAdapter.createLocation({ profile_id: profile2.id, name: 'Other Rack' });

    const locs1 = await sqliteAdapter.getLocations(profileId);
    const locs2 = await sqliteAdapter.getLocations(profile2.id);

    expect(locs1.every(l => l.profile_id === profileId)).toBe(true);
    expect(locs2.every(l => l.profile_id === profile2.id)).toBe(true);
    expect(locs1.some(l => l.name === 'Other Rack')).toBe(false);
  });
});

// ─── Unlocated bottles ───────────────────────────────────────────────────────

describe('Unlocated bottles', () => {
  const userId = 'unlocated-test-user';
  let wineId: string;
  let profileId: string;

  beforeEach(async () => {
    closeSqliteDb();
    const wine = await sqliteAdapter.createWine({ name: 'Unlocated Wine' });
    const profile = await sqliteAdapter.createProfile({ user_id: userId, name: 'Unlocated Cellar' });
    wineId = wine.id;
    profileId = profile.id;
  });

  it('stores bottles with empty string location', async () => {
    const item = await sqliteAdapter.addBottle(
      { wine_id: wineId, profile_id: profileId, location: '', quantity: 2 },
      userId
    );
    expect(item.location).toBe('');
  });

  it('normalises undefined location to empty string', async () => {
    const item = await sqliteAdapter.addBottle(
      { wine_id: wineId, profile_id: profileId, location: undefined as unknown as string, quantity: 1 },
      userId
    );
    expect(item.location).toBe('');
  });

  it('unlocated bottles appear in getCellarInventory', async () => {
    await sqliteAdapter.addBottle({ wine_id: wineId, profile_id: profileId, location: '', quantity: 3 }, userId);

    const inv = await sqliteAdapter.getCellarInventory(profileId, userId);
    const unlocated = inv.find(i => i.location === '' && i.wine_id === wineId);
    expect(unlocated).toBeDefined();
    expect(unlocated!.quantity).toBe(3);
  });

  it('aggregates additional bottles at empty-string location', async () => {
    await sqliteAdapter.addBottle({ wine_id: wineId, profile_id: profileId, location: '', quantity: 2 }, userId);
    const item = await sqliteAdapter.addBottle({ wine_id: wineId, profile_id: profileId, location: '', quantity: 3 }, userId);
    expect(item.quantity).toBe(5);
  });

  it('unlocated and located entries are separate inventory rows', async () => {
    const unlocated = await sqliteAdapter.addBottle({ wine_id: wineId, profile_id: profileId, location: '', quantity: 1 }, userId);
    const located = await sqliteAdapter.addBottle({ wine_id: wineId, profile_id: profileId, location: 'Rack A', quantity: 2 }, userId);
    expect(unlocated.id).not.toBe(located.id);

    const inv = await sqliteAdapter.getCellarInventory(profileId, userId);
    expect(inv.length).toBeGreaterThanOrEqual(2);
  });
});

// ─── profile_ids filter ──────────────────────────────────────────────────────

describe('profile_ids filter on getWines', () => {
  const userId = 'pid-filter-user';

  it('returns only wines in specified profile', async () => {
    const p1 = await sqliteAdapter.createProfile({ user_id: userId, name: 'P1' });
    const p2 = await sqliteAdapter.createProfile({ user_id: userId, name: 'P2' });
    const wine1 = await sqliteAdapter.createWine({ name: 'P1 Wine' });
    const wine2 = await sqliteAdapter.createWine({ name: 'P2 Wine' });
    await sqliteAdapter.addBottle({ wine_id: wine1.id, profile_id: p1.id, location: 'A', quantity: 1 }, userId);
    await sqliteAdapter.addBottle({ wine_id: wine2.id, profile_id: p2.id, location: 'A', quantity: 1 }, userId);

    const results = await sqliteAdapter.getWines({ profile_ids: p1.id });
    const ids = results.map(w => w.id);
    expect(ids).toContain(wine1.id);
    expect(ids).not.toContain(wine2.id);
  });

  it('returns wines from multiple profiles when comma-separated', async () => {
    const p1 = await sqliteAdapter.createProfile({ user_id: userId, name: 'MP1' });
    const p2 = await sqliteAdapter.createProfile({ user_id: userId, name: 'MP2' });
    const wine1 = await sqliteAdapter.createWine({ name: 'Multi P1 Wine' });
    const wine2 = await sqliteAdapter.createWine({ name: 'Multi P2 Wine' });
    await sqliteAdapter.addBottle({ wine_id: wine1.id, profile_id: p1.id, location: 'B', quantity: 1 }, userId);
    await sqliteAdapter.addBottle({ wine_id: wine2.id, profile_id: p2.id, location: 'B', quantity: 1 }, userId);

    const results = await sqliteAdapter.getWines({ profile_ids: `${p1.id},${p2.id}` });
    const ids = results.map(w => w.id);
    expect(ids).toContain(wine1.id);
    expect(ids).toContain(wine2.id);
  });

  it('excludes wines with zero quantity in the profile', async () => {
    const p1 = await sqliteAdapter.createProfile({ user_id: userId, name: 'ZeroQ Profile' });
    const wine = await sqliteAdapter.createWine({ name: 'Zero Qty Wine' });
    const item = await sqliteAdapter.addBottle({ wine_id: wine.id, profile_id: p1.id, location: 'C', quantity: 1 }, userId);
    await sqliteAdapter.removeBottle({ cellar_inventory_id: item.id, quantity: 1 }, userId);

    const results = await sqliteAdapter.getWines({ profile_ids: p1.id });
    expect(results.find(w => w.id === wine.id)).toBeUndefined();
  });

  it('profile_ids can be combined with wine_type filter', async () => {
    const p1 = await sqliteAdapter.createProfile({ user_id: userId, name: 'Mixed Profile' });
    const redWine = await sqliteAdapter.createWine({ name: 'Mixed Red', wine_type: 'red' });
    const whiteWine = await sqliteAdapter.createWine({ name: 'Mixed White', wine_type: 'white' });
    await sqliteAdapter.addBottle({ wine_id: redWine.id, profile_id: p1.id, location: 'D', quantity: 1 }, userId);
    await sqliteAdapter.addBottle({ wine_id: whiteWine.id, profile_id: p1.id, location: 'D', quantity: 1 }, userId);

    const results = await sqliteAdapter.getWines({ profile_ids: p1.id, wine_type: 'red' });
    const ids = results.map(w => w.id);
    expect(ids).toContain(redWine.id);
    expect(ids).not.toContain(whiteWine.id);
  });
});

// ─── Wine facets ─────────────────────────────────────────────────────────────

describe('getWineFacets', () => {
  beforeEach(async () => {
    closeSqliteDb();
    // Seed a set of wines to test against
    await sqliteAdapter.createWine({ name: 'W1', variety: 'Cabernet Sauvignon', country: 'USA', region: 'Napa Valley', producer: 'Stag\'s Leap', appellation: 'Oakville' });
    await sqliteAdapter.createWine({ name: 'W2', variety: 'Merlot', country: 'France', region: 'Bordeaux', producer: 'Château Pétrus', appellation: 'Pomerol' });
    await sqliteAdapter.createWine({ name: 'W3', variety: 'Chardonnay', country: 'France', region: 'Burgundy', producer: 'Louis Jadot', appellation: 'Meursault' });
    await sqliteAdapter.createWine({ name: 'W4', variety: 'Cabernet Sauvignon', country: 'Australia', region: 'Barossa Valley', producer: 'Penfolds', appellation: 'Barossa' });
    await sqliteAdapter.createWine({ name: 'W5', variety: 'Pinot Noir', country: 'USA', region: 'Willamette Valley' });
  });

  it('returns all distinct varieties when query is empty', async () => {
    const result = await sqliteAdapter.getWineFacets('variety', '');
    expect(result).toContain('Cabernet Sauvignon');
    expect(result).toContain('Merlot');
    expect(result).toContain('Chardonnay');
    expect(result).toContain('Pinot Noir');
    // Cabernet Sauvignon appears twice but should only return once
    expect(result.filter(v => v === 'Cabernet Sauvignon').length).toBe(1);
  });

  it('filters varieties by partial match', async () => {
    const result = await sqliteAdapter.getWineFacets('variety', 'cab');
    expect(result).toContain('Cabernet Sauvignon');
    expect(result).not.toContain('Merlot');
    expect(result).not.toContain('Chardonnay');
  });

  it('returns distinct countries', async () => {
    const result = await sqliteAdapter.getWineFacets('country', '');
    expect(result).toContain('USA');
    expect(result).toContain('France');
    expect(result).toContain('Australia');
    expect(result.filter(c => c === 'USA').length).toBe(1);
  });

  it('filters countries by partial match', async () => {
    const result = await sqliteAdapter.getWineFacets('country', 'fra');
    expect(result).toContain('France');
    expect(result).not.toContain('USA');
  });

  it('returns distinct regions', async () => {
    const result = await sqliteAdapter.getWineFacets('region', '');
    expect(result).toContain('Napa Valley');
    expect(result).toContain('Bordeaux');
    expect(result).toContain('Burgundy');
  });

  it('filters regions by partial match', async () => {
    const result = await sqliteAdapter.getWineFacets('region', 'valley');
    expect(result.some(r => r.toLowerCase().includes('valley'))).toBe(true);
    expect(result).not.toContain('Bordeaux');
  });

  it('returns distinct producers', async () => {
    const result = await sqliteAdapter.getWineFacets('producer', '');
    expect(result).toContain('Penfolds');
    expect(result).toContain('Louis Jadot');
  });

  it('filters producers by partial match', async () => {
    const result = await sqliteAdapter.getWineFacets('producer', 'jadot');
    expect(result).toContain('Louis Jadot');
    expect(result).not.toContain('Penfolds');
  });

  it('returns distinct appellations', async () => {
    const result = await sqliteAdapter.getWineFacets('appellation', '');
    expect(result).toContain('Oakville');
    expect(result).toContain('Pomerol');
    expect(result).toContain('Meursault');
  });

  it('returns results sorted alphabetically', async () => {
    const result = await sqliteAdapter.getWineFacets('variety', '');
    expect(result).toEqual([...result].sort());
  });

  it('excludes null values from results', async () => {
    // W5 has no appellation — ensure it does not produce a null entry
    const result = await sqliteAdapter.getWineFacets('appellation', '');
    expect(result.every(r => r !== null && r !== undefined && r !== '')).toBe(true);
  });

  it('excludes empty string values from results', async () => {
    await sqliteAdapter.createWine({ name: 'Empty Variety', variety: '' });
    const result = await sqliteAdapter.getWineFacets('variety', '');
    expect(result.every(v => v !== '')).toBe(true);
  });

  it('returns empty array for disallowed field (SQL injection guard)', async () => {
    const result = await sqliteAdapter.getWineFacets('barcode', '');
    expect(result).toEqual([]);
  });

  it('returns empty array for another disallowed field', async () => {
    const result = await sqliteAdapter.getWineFacets('id', '');
    expect(result).toEqual([]);
  });

  it('returns empty array when no wines match the query', async () => {
    const result = await sqliteAdapter.getWineFacets('variety', 'zzznomatch');
    expect(result).toEqual([]);
  });

  it('is case-insensitive for LIKE matching', async () => {
    const upper = await sqliteAdapter.getWineFacets('variety', 'CABERNET');
    const lower = await sqliteAdapter.getWineFacets('variety', 'cabernet');
    expect(upper).toContain('Cabernet Sauvignon');
    expect(lower).toContain('Cabernet Sauvignon');
  });

  it('limits results to 20', async () => {
    // Insert 25 distinct varieties
    for (let i = 1; i <= 25; i++) {
      await sqliteAdapter.createWine({ name: `Limit Wine ${i}`, variety: `Variety ${String(i).padStart(2, '0')}` });
    }
    const result = await sqliteAdapter.getWineFacets('variety', 'Variety');
    expect(result.length).toBeLessThanOrEqual(20);
  });
});
