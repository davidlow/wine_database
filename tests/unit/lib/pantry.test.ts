import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { sqliteAdapter, closeSqliteDb } from '@/lib/db/sqlite';

const TODAY = new Date().toISOString().slice(0, 10);
const PROFILE_USER = 'pantry-test-user';

let profileId: string;

beforeEach(async () => {
  closeSqliteDb();
  const profile = await sqliteAdapter.createProfile({ user_id: PROFILE_USER, name: 'Pantry Test Cellar' });
  profileId = profile.id;
});

afterEach(() => {
  closeSqliteDb();
});

// ─── addPantryItem ────────────────────────────────────────────────────────────

describe('addPantryItem', () => {
  it('creates an item with required fields', async () => {
    const item = await sqliteAdapter.addPantryItem(
      { profile_id: profileId, name: 'Tide Pods', quantity: 2, unit: 'pack', stored_date: TODAY },
      PROFILE_USER
    );
    expect(item.id).toBeDefined();
    expect(item.name).toBe('Tide Pods');
    expect(item.quantity).toBe(2);
    expect(item.unit).toBe('pack');
    expect(item.stored_date).toBe(TODAY);
    expect(item.profile_id).toBe(profileId);
  });

  it('creates an item with all optional fields', async () => {
    const item = await sqliteAdapter.addPantryItem(
      {
        profile_id: profileId,
        name: 'Shampoo',
        brand: 'Pantene',
        category: 'Personal Care',
        quantity: 3,
        unit: 'bottle',
        location: 'Bathroom Cabinet',
        stored_date: TODAY,
        best_by_days: 730,
        notes: 'Buy more when 1 left',
      },
      PROFILE_USER
    );
    expect(item.brand).toBe('Pantene');
    expect(item.category).toBe('Personal Care');
    expect(item.location).toBe('Bathroom Cabinet');
    expect(item.best_by_days).toBe(730);
    expect(item.notes).toBe('Buy more when 1 left');
  });

  it('auto-computes best_by_date from stored_date + best_by_days', async () => {
    const item = await sqliteAdapter.addPantryItem(
      { profile_id: profileId, name: 'Pasta', quantity: 5, unit: 'box', stored_date: '2026-01-01', best_by_days: 365 },
      PROFILE_USER
    );
    expect(item.best_by_date).toBe('2027-01-01');
  });

  it('uses provided best_by_date when given', async () => {
    const item = await sqliteAdapter.addPantryItem(
      {
        profile_id: profileId, name: 'Canned Beans', quantity: 4, unit: 'can',
        stored_date: '2026-01-01', best_by_date: '2028-06-15', best_by_days: 365,
      },
      PROFILE_USER
    );
    expect(item.best_by_date).toBe('2028-06-15');
  });

  it('defaults best_by_days to 365 when omitted', async () => {
    const item = await sqliteAdapter.addPantryItem(
      { profile_id: profileId, name: 'Oil', quantity: 1, unit: 'bottle', stored_date: '2026-06-01' },
      PROFILE_USER
    );
    expect(item.best_by_days).toBe(365);
  });

  it('defaults unit to "unit" when omitted', async () => {
    const item = await sqliteAdapter.addPantryItem(
      { profile_id: profileId, name: 'Widget', quantity: 1, stored_date: TODAY },
      PROFILE_USER
    );
    expect(item.unit).toBe('unit');
  });

  it('logs an "add" transaction', async () => {
    const item = await sqliteAdapter.addPantryItem(
      { profile_id: profileId, name: 'Detergent', quantity: 2, unit: 'box', stored_date: TODAY },
      PROFILE_USER
    );
    const txns = await sqliteAdapter.getPantryTransactions(profileId);
    const addTx = txns.find(t => t.pantry_item_id === item.id && t.action === 'add');
    expect(addTx).toBeDefined();
    expect(addTx!.quantity).toBe(2);
  });
});

// ─── getPantryItems ───────────────────────────────────────────────────────────

describe('getPantryItems', () => {
  it('returns empty array for new profile', async () => {
    const items = await sqliteAdapter.getPantryItems(profileId);
    expect(items).toEqual([]);
  });

  it('returns items for the correct profile only', async () => {
    const p2 = await sqliteAdapter.createProfile({ user_id: PROFILE_USER, name: 'Other Pantry' });
    await sqliteAdapter.addPantryItem(
      { profile_id: profileId, name: 'Mine', quantity: 1, stored_date: TODAY },
      PROFILE_USER
    );
    await sqliteAdapter.addPantryItem(
      { profile_id: p2.id, name: 'Theirs', quantity: 1, stored_date: TODAY },
      PROFILE_USER
    );

    const items = await sqliteAdapter.getPantryItems(profileId);
    expect(items.every(i => i.profile_id === profileId)).toBe(true);
    expect(items.some(i => i.name === 'Mine')).toBe(true);
    expect(items.every(i => i.name !== 'Theirs')).toBe(true);
  });

  it('excludes items with quantity 0', async () => {
    const item = await sqliteAdapter.addPantryItem(
      { profile_id: profileId, name: 'Used Up Item', quantity: 1, stored_date: TODAY },
      PROFILE_USER
    );
    await sqliteAdapter.removePantryItem(item.id, 1, PROFILE_USER);

    const items = await sqliteAdapter.getPantryItems(profileId);
    expect(items.find(i => i.id === item.id)).toBeUndefined();
  });

  it('returns items sorted by name ascending', async () => {
    await sqliteAdapter.addPantryItem({ profile_id: profileId, name: 'Zucchini', quantity: 1, stored_date: TODAY }, PROFILE_USER);
    await sqliteAdapter.addPantryItem({ profile_id: profileId, name: 'Apple Juice', quantity: 2, stored_date: TODAY }, PROFILE_USER);
    await sqliteAdapter.addPantryItem({ profile_id: profileId, name: 'Milk', quantity: 1, stored_date: TODAY }, PROFILE_USER);

    const items = await sqliteAdapter.getPantryItems(profileId);
    const names = items.map(i => i.name);
    expect(names).toEqual([...names].sort());
  });
});

// ─── updatePantryItem ─────────────────────────────────────────────────────────

describe('updatePantryItem', () => {
  it('updates name, quantity, unit, location, and notes', async () => {
    const item = await sqliteAdapter.addPantryItem(
      { profile_id: profileId, name: 'Old Name', quantity: 1, unit: 'unit', stored_date: TODAY },
      PROFILE_USER
    );
    const updated = await sqliteAdapter.updatePantryItem(item.id, {
      name: 'New Name',
      quantity: 3,
      unit: 'pack',
      location: 'Shelf B',
      notes: 'Updated',
    });
    expect(updated.name).toBe('New Name');
    expect(updated.quantity).toBe(3);
    expect(updated.unit).toBe('pack');
    expect(updated.location).toBe('Shelf B');
    expect(updated.notes).toBe('Updated');
  });

  it('preserves unchanged fields', async () => {
    const item = await sqliteAdapter.addPantryItem(
      { profile_id: profileId, name: 'Stable', brand: 'AcmeBrand', category: 'Food', quantity: 2, unit: 'can', stored_date: TODAY },
      PROFILE_USER
    );
    const updated = await sqliteAdapter.updatePantryItem(item.id, { quantity: 5 });
    expect(updated.name).toBe('Stable');
    expect(updated.brand).toBe('AcmeBrand');
    expect(updated.category).toBe('Food');
    expect(updated.unit).toBe('can');
  });

  it('recomputes best_by_date when best_by_days changes', async () => {
    const item = await sqliteAdapter.addPantryItem(
      { profile_id: profileId, name: 'Recompute BBD', quantity: 1, stored_date: '2026-01-01', best_by_days: 30 },
      PROFILE_USER
    );
    const updated = await sqliteAdapter.updatePantryItem(item.id, { best_by_days: 60 });
    expect(updated.best_by_date).toBe('2026-03-02'); // 2026-01-01 + 60 days
  });

  it('throws when updating a non-existent item', async () => {
    await expect(
      sqliteAdapter.updatePantryItem('nonexistent-id', { name: 'X' })
    ).rejects.toThrow();
  });
});

// ─── removePantryItem ─────────────────────────────────────────────────────────

describe('removePantryItem', () => {
  it('decrements quantity by the specified amount', async () => {
    const item = await sqliteAdapter.addPantryItem(
      { profile_id: profileId, name: 'Paper Towels', quantity: 6, unit: 'roll', stored_date: TODAY },
      PROFILE_USER
    );
    const updated = await sqliteAdapter.removePantryItem(item.id, 2, PROFILE_USER);
    expect(updated.quantity).toBe(4);
  });

  it('can remove all remaining quantity (down to 0)', async () => {
    const item = await sqliteAdapter.addPantryItem(
      { profile_id: profileId, name: 'Last One', quantity: 1, stored_date: TODAY },
      PROFILE_USER
    );
    const updated = await sqliteAdapter.removePantryItem(item.id, 1, PROFILE_USER);
    expect(updated.quantity).toBe(0);
  });

  it('throws when removing more than available', async () => {
    const item = await sqliteAdapter.addPantryItem(
      { profile_id: profileId, name: 'Small Stock', quantity: 2, stored_date: TODAY },
      PROFILE_USER
    );
    await expect(
      sqliteAdapter.removePantryItem(item.id, 5, PROFILE_USER)
    ).rejects.toThrow();
  });

  it('throws when item does not exist', async () => {
    await expect(
      sqliteAdapter.removePantryItem('nonexistent-id', 1, PROFILE_USER)
    ).rejects.toThrow();
  });

  it('logs a "remove" transaction', async () => {
    const item = await sqliteAdapter.addPantryItem(
      { profile_id: profileId, name: 'Tracked Item', quantity: 3, stored_date: TODAY },
      PROFILE_USER
    );
    await sqliteAdapter.removePantryItem(item.id, 2, PROFILE_USER);

    const txns = await sqliteAdapter.getPantryTransactions(profileId);
    const removeTx = txns.find(t => t.pantry_item_id === item.id && t.action === 'remove');
    expect(removeTx).toBeDefined();
    expect(removeTx!.quantity).toBe(2);
  });
});

// ─── getPantryTransactions ────────────────────────────────────────────────────

describe('getPantryTransactions', () => {
  it('returns empty array for new profile', async () => {
    const txns = await sqliteAdapter.getPantryTransactions(profileId);
    expect(txns).toEqual([]);
  });

  it('includes item_name from join', async () => {
    const item = await sqliteAdapter.addPantryItem(
      { profile_id: profileId, name: 'Soap Bar', quantity: 4, stored_date: TODAY },
      PROFILE_USER
    );
    await sqliteAdapter.removePantryItem(item.id, 1, PROFILE_USER);

    const txns = await sqliteAdapter.getPantryTransactions(profileId);
    expect(txns.every(t => t.item_name === 'Soap Bar')).toBe(true);
  });

  it('returns both add and remove transactions', async () => {
    const item = await sqliteAdapter.addPantryItem(
      { profile_id: profileId, name: 'Mixed Tx', quantity: 3, stored_date: TODAY },
      PROFILE_USER
    );
    await sqliteAdapter.removePantryItem(item.id, 1, PROFILE_USER);

    const txns = await sqliteAdapter.getPantryTransactions(profileId);
    expect(txns.some(t => t.action === 'add')).toBe(true);
    expect(txns.some(t => t.action === 'remove')).toBe(true);
  });

  it('is scoped to the profile', async () => {
    const p2 = await sqliteAdapter.createProfile({ user_id: PROFILE_USER, name: 'Other Profile' });
    await sqliteAdapter.addPantryItem(
      { profile_id: profileId, name: 'My Item', quantity: 1, stored_date: TODAY },
      PROFILE_USER
    );
    await sqliteAdapter.addPantryItem(
      { profile_id: p2.id, name: 'Their Item', quantity: 1, stored_date: TODAY },
      PROFILE_USER
    );

    const txns = await sqliteAdapter.getPantryTransactions(profileId);
    expect(txns.every(t => t.profile_id === profileId)).toBe(true);
  });

  it('returns transactions ordered newest first', async () => {
    const item = await sqliteAdapter.addPantryItem(
      { profile_id: profileId, name: 'Order Test', quantity: 5, stored_date: TODAY },
      PROFILE_USER
    );
    await sqliteAdapter.removePantryItem(item.id, 1, PROFILE_USER);
    await sqliteAdapter.removePantryItem(item.id, 1, PROFILE_USER);

    const txns = await sqliteAdapter.getPantryTransactions(profileId);
    for (let i = 1; i < txns.length; i++) {
      expect(txns[i - 1].created_at >= txns[i].created_at).toBe(true);
    }
  });
});

// ─── getPantryUsageSettings ───────────────────────────────────────────────────

describe('getPantryUsageSettings', () => {
  it('returns empty array when no settings exist', async () => {
    const settings = await sqliteAdapter.getPantryUsageSettings(profileId);
    expect(settings).toEqual([]);
  });
});

// ─── upsertPantryUsageSetting ─────────────────────────────────────────────────

describe('upsertPantryUsageSetting', () => {
  it('creates a new setting', async () => {
    const setting = await sqliteAdapter.upsertPantryUsageSetting(
      profileId, 'Tide Pods', { days_per_unit: 14, reset_date: null }
    );
    expect(setting.id).toBeDefined();
    expect(setting.item_name).toBe('Tide Pods');
    expect(setting.days_per_unit).toBe(14);
    expect(setting.profile_id).toBe(profileId);
  });

  it('updates an existing setting', async () => {
    await sqliteAdapter.upsertPantryUsageSetting(profileId, 'Shampoo', { days_per_unit: 30 });
    const updated = await sqliteAdapter.upsertPantryUsageSetting(profileId, 'Shampoo', { days_per_unit: 45 });
    expect(updated.days_per_unit).toBe(45);
  });

  it('can set reset_date', async () => {
    const setting = await sqliteAdapter.upsertPantryUsageSetting(
      profileId, 'Detergent', { reset_date: '2026-06-01' }
    );
    expect(setting.reset_date).toBe('2026-06-01');
  });

  it('can clear days_per_unit (set to null)', async () => {
    await sqliteAdapter.upsertPantryUsageSetting(profileId, 'Coffee', { days_per_unit: 7 });
    const cleared = await sqliteAdapter.upsertPantryUsageSetting(
      profileId, 'Coffee', { days_per_unit: null }
    );
    expect(cleared.days_per_unit).toBeFalsy();
  });

  it('preserves reset_date when only days_per_unit is updated', async () => {
    await sqliteAdapter.upsertPantryUsageSetting(
      profileId, 'Soap', { days_per_unit: 21, reset_date: '2026-01-15' }
    );
    const updated = await sqliteAdapter.upsertPantryUsageSetting(
      profileId, 'Soap', { days_per_unit: 28 }
    );
    expect(updated.reset_date).toBe('2026-01-15');
  });

  it('is scoped per profile — same item name in different profiles is separate', async () => {
    const p2 = await sqliteAdapter.createProfile({ user_id: PROFILE_USER, name: 'Other Pantry Profile' });
    await sqliteAdapter.upsertPantryUsageSetting(profileId, 'Toothpaste', { days_per_unit: 30 });
    await sqliteAdapter.upsertPantryUsageSetting(p2.id, 'Toothpaste', { days_per_unit: 60 });

    const s1 = (await sqliteAdapter.getPantryUsageSettings(profileId)).find(s => s.item_name === 'Toothpaste');
    const s2 = (await sqliteAdapter.getPantryUsageSettings(p2.id)).find(s => s.item_name === 'Toothpaste');
    expect(s1!.days_per_unit).toBe(30);
    expect(s2!.days_per_unit).toBe(60);
  });

  it('getPantryUsageSettings returns settings sorted by item_name', async () => {
    await sqliteAdapter.upsertPantryUsageSetting(profileId, 'Zest', { days_per_unit: 10 });
    await sqliteAdapter.upsertPantryUsageSetting(profileId, 'Ajax', { days_per_unit: 20 });
    await sqliteAdapter.upsertPantryUsageSetting(profileId, 'Mop & Glo', { days_per_unit: 30 });

    const settings = await sqliteAdapter.getPantryUsageSettings(profileId);
    const names = settings.map(s => s.item_name);
    expect(names).toEqual([...names].sort());
  });
});

// ─── getPantryItemProfileId ───────────────────────────────────────────────────

describe('getPantryItemProfileId', () => {
  it('returns the profile_id for an existing item', async () => {
    const item = await sqliteAdapter.addPantryItem(
      { profile_id: profileId, name: 'Lookup Item', quantity: 1, stored_date: TODAY },
      PROFILE_USER
    );
    const result = await sqliteAdapter.getPantryItemProfileId(item.id);
    expect(result).toBe(profileId);
  });

  it('returns null for a non-existent item', async () => {
    const result = await sqliteAdapter.getPantryItemProfileId('nonexistent-id');
    expect(result).toBeNull();
  });
});

// ─── Integration: usage prediction flow ──────────────────────────────────────

describe('pantry usage prediction integration', () => {
  it('tracks multiple removals and enables usage calculation', async () => {
    const item = await sqliteAdapter.addPantryItem(
      { profile_id: profileId, name: 'Laundry Pods', quantity: 50, unit: 'pod', stored_date: TODAY },
      PROFILE_USER
    );

    // Simulate 3 removal events with delays
    await sqliteAdapter.removePantryItem(item.id, 10, PROFILE_USER);
    await sqliteAdapter.removePantryItem(item.id, 10, PROFILE_USER);
    await sqliteAdapter.removePantryItem(item.id, 10, PROFILE_USER);

    const txns = await sqliteAdapter.getPantryTransactions(profileId);
    const removes = txns.filter(t => t.action === 'remove' && t.item_name === 'Laundry Pods');
    expect(removes.length).toBe(3);
    expect(removes.every(t => t.quantity === 10)).toBe(true);
  });

  it('usage setting is retrievable after upserting', async () => {
    await sqliteAdapter.upsertPantryUsageSetting(
      profileId, 'Olive Oil', { days_per_unit: 45, reset_date: '2026-01-01' }
    );
    const settings = await sqliteAdapter.getPantryUsageSettings(profileId);
    const s = settings.find(s => s.item_name === 'Olive Oil');
    expect(s).toBeDefined();
    expect(s!.days_per_unit).toBe(45);
    expect(s!.reset_date).toBe('2026-01-01');
  });
});
