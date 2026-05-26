import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { sqliteAdapter, closeSqliteDb } from '@/lib/db/sqlite';

// Use in-memory DB for tests (set in setup.ts via SQLITE_DB_PATH=:memory:)

beforeEach(() => {
  closeSqliteDb(); // reset between tests
});

afterEach(() => {
  closeSqliteDb();
});

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

  it('searches wines by query', async () => {
    await sqliteAdapter.createWine({ name: 'Chateau Margaux', wine_type: 'red' });
    await sqliteAdapter.createWine({ name: 'Far Niente Chardonnay', wine_type: 'white' });

    const reds = await sqliteAdapter.getWines({ wine_type: 'red' });
    expect(reds.some((w) => w.name === 'Chateau Margaux')).toBe(true);
    expect(reds.every((w) => w.wine_type === 'red')).toBe(true);

    const results = await sqliteAdapter.getWines({ query: 'Margaux' });
    expect(results.some((w) => w.name === 'Chateau Margaux')).toBe(true);
  });

  it('updates a wine', async () => {
    const wine = await sqliteAdapter.createWine({ name: 'Update Test' });
    const updated = await sqliteAdapter.updateWine(wine.id, { name: 'Updated Name', vintage_year: 2021 });
    expect(updated.name).toBe('Updated Name');
    expect(updated.vintage_year).toBe(2021);
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

  it('lists profiles for a user only', async () => {
    await sqliteAdapter.createProfile({ user_id: userId, name: 'Profile A' });
    await sqliteAdapter.createProfile({ user_id: 'other-user', name: 'Other Profile' });

    const profiles = await sqliteAdapter.getProfiles(userId);
    expect(profiles.every((p) => p.user_id === userId)).toBe(true);
    expect(profiles.some((p) => p.name === 'Profile A')).toBe(true);
    expect(profiles.every((p) => p.name !== 'Other Profile')).toBe(true);
  });

  it('updates a profile', async () => {
    const profile = await sqliteAdapter.createProfile({ user_id: userId, name: 'Old Name' });
    const updated = await sqliteAdapter.updateProfile(profile.id, userId, { name: 'New Name' });
    expect(updated.name).toBe('New Name');
  });

  it('deletes a profile', async () => {
    const profile = await sqliteAdapter.createProfile({ user_id: userId, name: 'To Delete' });
    await sqliteAdapter.deleteProfile(profile.id, userId);
    const fetched = await sqliteAdapter.getProfileById(profile.id, userId);
    expect(fetched).toBeNull();
  });
});

describe('Cellar inventory', () => {
  const userId = 'cellar-test-user';
  let wineId: string;
  let profileId: string;

  beforeEach(async () => {
    closeSqliteDb();
    const wine = await sqliteAdapter.createWine({ name: 'Inventory Test Wine' });
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

  it('aggregates bottles at same location', async () => {
    await sqliteAdapter.addBottle({ wine_id: wineId, profile_id: profileId, location: 'Rack A', quantity: 2 }, userId);
    const item = await sqliteAdapter.addBottle({ wine_id: wineId, profile_id: profileId, location: 'Rack A', quantity: 3 }, userId);
    expect(item.quantity).toBe(5); // 2 + 3
  });

  it('removes bottles and decrements quantity', async () => {
    const item = await sqliteAdapter.addBottle({ wine_id: wineId, profile_id: profileId, location: 'Rack B', quantity: 4 }, userId);
    await sqliteAdapter.removeBottle({ cellar_inventory_id: item.id, quantity: 2 }, userId);

    const inventory = await sqliteAdapter.getCellarInventory(profileId, userId);
    const updated = inventory.find((i) => i.id === item.id);
    expect(updated?.quantity).toBe(2);
  });

  it('prevents removing more than available', async () => {
    const item = await sqliteAdapter.addBottle({ wine_id: wineId, profile_id: profileId, location: 'Rack C', quantity: 1 }, userId);
    await expect(
      sqliteAdapter.removeBottle({ cellar_inventory_id: item.id, quantity: 5 }, userId)
    ).rejects.toThrow();
  });

  it('records transactions on add and remove', async () => {
    const item = await sqliteAdapter.addBottle({ wine_id: wineId, profile_id: profileId, location: 'Rack D', quantity: 2 }, userId);
    await sqliteAdapter.removeBottle({ cellar_inventory_id: item.id, quantity: 1 }, userId);

    const transactions = await sqliteAdapter.getTransactions(profileId, userId);
    expect(transactions.some((t) => t.transaction_type === 'add')).toBe(true);
    expect(transactions.some((t) => t.transaction_type === 'remove')).toBe(true);
  });

  it('excludes zero-quantity items from inventory list', async () => {
    const item = await sqliteAdapter.addBottle({ wine_id: wineId, profile_id: profileId, location: 'Rack E', quantity: 1 }, userId);
    await sqliteAdapter.removeBottle({ cellar_inventory_id: item.id, quantity: 1 }, userId);

    const inventory = await sqliteAdapter.getCellarInventory(profileId, userId);
    expect(inventory.find((i) => i.id === item.id)).toBeUndefined();
  });
});
