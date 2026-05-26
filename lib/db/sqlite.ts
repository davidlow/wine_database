import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import type {
  DbAdapter,
  Wine,
  Profile,
  CellarInventory,
  BottleTransaction,
  WineSearchParams,
  AddBottleInput,
  RemoveBottleInput,
} from '@/types';
import { generateId } from '@/lib/utils';

let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (db) return db;

  const dbPath = process.env.SQLITE_DB_PATH ?? './wine.db';
  // ':memory:' is a special SQLite path for an in-memory DB — don't resolve it as a file path
  const resolvedPath = dbPath === ':memory:' ? ':memory:' : path.resolve(process.cwd(), dbPath);

  db = new Database(resolvedPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  const schemaPath = path.join(process.cwd(), 'lib', 'db', 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  db.exec(schema);

  return db;
}

// better-sqlite3 named params require ALL referenced keys to exist (even as null)
function nullify(obj: Record<string, unknown>, keys: readonly string[]): Record<string, unknown> {
  return Object.fromEntries(keys.map(k => [k, obj[k] ?? null]));
}

const WINE_COLS = ['id', 'name', 'producer', 'variety', 'wine_type', 'region', 'appellation', 'country', 'vintage_year', 'description', 'average_price', 'alcohol_content', 'barcode', 'image_url', 'created_at', 'updated_at'] as const;
const PROFILE_COLS = ['id', 'user_id', 'name', 'description', 'created_at', 'updated_at'] as const;
const INVENTORY_COLS = ['id', 'wine_id', 'profile_id', 'location', 'quantity', 'purchase_price', 'purchase_date', 'notes', 'created_at', 'updated_at'] as const;

export function closeSqliteDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

export const sqliteAdapter: DbAdapter = {
  // --- Wines ---

  async getWines(params: WineSearchParams): Promise<Wine[]> {
    const d = getDb();
    const conditions: string[] = [];
    const values: unknown[] = [];

    if (params.query) {
      conditions.push(
        "(name LIKE ? OR producer LIKE ? OR variety LIKE ? OR region LIKE ? OR appellation LIKE ? OR country LIKE ?)"
      );
      const q = `%${params.query}%`;
      values.push(q, q, q, q, q, q);
    }
    if (params.variety) { conditions.push('variety = ?'); values.push(params.variety); }
    if (params.wine_type) { conditions.push('wine_type = ?'); values.push(params.wine_type); }
    if (params.country) { conditions.push('country = ?'); values.push(params.country); }
    if (params.region) { conditions.push('region = ?'); values.push(params.region); }
    if (params.vintage_year) { conditions.push('vintage_year = ?'); values.push(params.vintage_year); }
    if (params.producer) { conditions.push('producer LIKE ?'); values.push(`%${params.producer}%`); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `SELECT * FROM wines ${where} ORDER BY name ASC`;
    return d.prepare(sql).all(...values) as Wine[];
  },

  async getWineById(id: string): Promise<Wine | null> {
    return (getDb().prepare('SELECT * FROM wines WHERE id = ?').get(id) as Wine | undefined) ?? null;
  },

  async getWineByBarcode(barcode: string): Promise<Wine | null> {
    return (getDb().prepare('SELECT * FROM wines WHERE barcode = ?').get(barcode) as Wine | undefined) ?? null;
  },

  async createWine(data): Promise<Wine> {
    const d = getDb();
    const now = new Date().toISOString();
    const wine: Wine = { ...data, id: generateId(), created_at: now, updated_at: now };
    d.prepare(`
      INSERT INTO wines (id, name, producer, variety, wine_type, region, appellation, country,
        vintage_year, description, average_price, alcohol_content, barcode, image_url, created_at, updated_at)
      VALUES (@id, @name, @producer, @variety, @wine_type, @region, @appellation, @country,
        @vintage_year, @description, @average_price, @alcohol_content, @barcode, @image_url, @created_at, @updated_at)
    `).run(nullify(wine as Record<string, unknown>, WINE_COLS));
    return wine;
  },

  async updateWine(id, data): Promise<Wine> {
    const d = getDb();
    const existing = await sqliteAdapter.getWineById(id);
    if (!existing) throw new Error(`Wine ${id} not found`);
    const updated: Wine = { ...existing, ...data, id, updated_at: new Date().toISOString() };
    d.prepare(`
      UPDATE wines SET name=@name, producer=@producer, variety=@variety, wine_type=@wine_type,
        region=@region, appellation=@appellation, country=@country, vintage_year=@vintage_year,
        description=@description, average_price=@average_price, alcohol_content=@alcohol_content,
        barcode=@barcode, image_url=@image_url, updated_at=@updated_at
      WHERE id=@id
    `).run(nullify(updated as Record<string, unknown>, WINE_COLS));
    return updated;
  },

  async deleteWine(id): Promise<void> {
    getDb().prepare('DELETE FROM wines WHERE id = ?').run(id);
  },

  // --- Profiles ---

  async getProfiles(userId: string): Promise<Profile[]> {
    return getDb().prepare('SELECT * FROM profiles WHERE user_id = ? ORDER BY name ASC').all(userId) as Profile[];
  },

  async getProfileById(id: string, userId: string): Promise<Profile | null> {
    return (getDb().prepare('SELECT * FROM profiles WHERE id = ? AND user_id = ?').get(id, userId) as Profile | undefined) ?? null;
  },

  async createProfile(data): Promise<Profile> {
    const d = getDb();
    const now = new Date().toISOString();
    const profile: Profile = { ...data, id: generateId(), created_at: now, updated_at: now };
    d.prepare(`
      INSERT INTO profiles (id, user_id, name, description, created_at, updated_at)
      VALUES (@id, @user_id, @name, @description, @created_at, @updated_at)
    `).run(nullify(profile as Record<string, unknown>, PROFILE_COLS));
    return profile;
  },

  async updateProfile(id, userId, data): Promise<Profile> {
    const d = getDb();
    const existing = await sqliteAdapter.getProfileById(id, userId);
    if (!existing) throw new Error(`Profile ${id} not found`);
    const updated: Profile = { ...existing, ...data, id, updated_at: new Date().toISOString() };
    d.prepare(`
      UPDATE profiles SET name=@name, description=@description, updated_at=@updated_at
      WHERE id=@id AND user_id=@user_id
    `).run(nullify(updated as Record<string, unknown>, PROFILE_COLS));
    return updated;
  },

  async deleteProfile(id, userId): Promise<void> {
    getDb().prepare('DELETE FROM profiles WHERE id = ? AND user_id = ?').run(id, userId);
  },

  // --- Cellar ---

  async getCellarInventory(profileId: string, _userId: string): Promise<CellarInventory[]> {
    const rows = getDb().prepare(`
      SELECT ci.*, w.name as wine_name, w.producer, w.variety, w.wine_type, w.vintage_year,
             w.region, w.country, w.image_url
      FROM cellar_inventory ci
      JOIN wines w ON w.id = ci.wine_id
      WHERE ci.profile_id = ? AND ci.quantity > 0
      ORDER BY w.name ASC
    `).all(profileId) as (CellarInventory & Record<string, unknown>)[];

    return rows.map(({ wine_name, producer, variety, wine_type, vintage_year, region, country, image_url, ...ci }) => ({
      ...ci,
      wine: {
        id: ci.wine_id,
        name: wine_name as string,
        producer: producer as string | undefined,
        variety: variety as string | undefined,
        wine_type: wine_type as Wine['wine_type'],
        vintage_year: vintage_year as number | undefined,
        region: region as string | undefined,
        country: country as string | undefined,
        image_url: image_url as string | undefined,
        created_at: '',
        updated_at: '',
      },
    }));
  },

  async getCellarInventoryByWine(wineId: string, profileId: string): Promise<CellarInventory[]> {
    return getDb().prepare(`
      SELECT * FROM cellar_inventory WHERE wine_id = ? AND profile_id = ? AND quantity > 0
    `).all(wineId, profileId) as CellarInventory[];
  },

  async addBottle(input: AddBottleInput, _userId: string): Promise<CellarInventory> {
    const d = getDb();
    const existing = d.prepare(`
      SELECT * FROM cellar_inventory WHERE wine_id = ? AND profile_id = ? AND location = ?
    `).get(input.wine_id, input.profile_id, input.location) as CellarInventory | undefined;

    const now = new Date().toISOString();
    const qty = input.quantity ?? 1;

    if (existing) {
      const updated: CellarInventory = {
        ...existing,
        quantity: existing.quantity + qty,
        updated_at: now,
      };
      d.prepare('UPDATE cellar_inventory SET quantity = @quantity, updated_at = @updated_at WHERE id = @id').run({ id: updated.id, quantity: updated.quantity, updated_at: updated.updated_at });

      d.prepare(`
        INSERT INTO bottle_transactions (id, wine_id, profile_id, cellar_inventory_id, transaction_type, quantity, location, created_at)
        VALUES (?, ?, ?, ?, 'add', ?, ?, ?)
      `).run(generateId(), input.wine_id, input.profile_id, existing.id, qty, input.location, now);

      return updated;
    }

    const inventory: CellarInventory = {
      id: generateId(),
      wine_id: input.wine_id,
      profile_id: input.profile_id,
      location: input.location,
      quantity: qty,
      purchase_price: input.purchase_price,
      purchase_date: input.purchase_date,
      notes: input.notes,
      created_at: now,
      updated_at: now,
    };

    d.prepare(`
      INSERT INTO cellar_inventory (id, wine_id, profile_id, location, quantity, purchase_price, purchase_date, notes, created_at, updated_at)
      VALUES (@id, @wine_id, @profile_id, @location, @quantity, @purchase_price, @purchase_date, @notes, @created_at, @updated_at)
    `).run(nullify(inventory as Record<string, unknown>, INVENTORY_COLS));

    d.prepare(`
      INSERT INTO bottle_transactions (id, wine_id, profile_id, cellar_inventory_id, transaction_type, quantity, location, created_at)
      VALUES (?, ?, ?, ?, 'add', ?, ?, ?)
    `).run(generateId(), input.wine_id, input.profile_id, inventory.id, qty, input.location, now);

    return inventory;
  },

  async updateBottleInventory(id, data): Promise<CellarInventory> {
    const d = getDb();
    const existing = d.prepare('SELECT * FROM cellar_inventory WHERE id = ?').get(id) as CellarInventory | undefined;
    if (!existing) throw new Error(`Inventory ${id} not found`);
    const updated: CellarInventory = { ...existing, ...data, id, updated_at: new Date().toISOString() };
    d.prepare(`
      UPDATE cellar_inventory SET location=@location, quantity=@quantity, purchase_price=@purchase_price,
        purchase_date=@purchase_date, notes=@notes, updated_at=@updated_at
      WHERE id=@id
    `).run(nullify(updated as Record<string, unknown>, INVENTORY_COLS));
    return updated;
  },

  async removeBottle(input: RemoveBottleInput, _userId: string): Promise<void> {
    const d = getDb();
    const existing = d.prepare('SELECT * FROM cellar_inventory WHERE id = ?').get(input.cellar_inventory_id) as CellarInventory | undefined;
    if (!existing) throw new Error(`Inventory ${input.cellar_inventory_id} not found`);
    if (input.quantity > existing.quantity) throw new Error('Cannot remove more bottles than available');

    const newQty = existing.quantity - input.quantity;
    const now = new Date().toISOString();

    d.prepare('UPDATE cellar_inventory SET quantity = ?, updated_at = ? WHERE id = ?').run(newQty, now, input.cellar_inventory_id);

    d.prepare(`
      INSERT INTO bottle_transactions (id, wine_id, profile_id, cellar_inventory_id, transaction_type, quantity, location, notes, created_at)
      VALUES (?, ?, ?, ?, 'remove', ?, ?, ?, ?)
    `).run(generateId(), existing.wine_id, existing.profile_id, input.cellar_inventory_id, input.quantity, existing.location, input.notes ?? null, now);
  },

  // --- Transactions ---

  async getTransactions(profileId: string, _userId: string, limit = 50): Promise<BottleTransaction[]> {
    return getDb().prepare(`
      SELECT bt.*, w.name as wine_name, w.vintage_year
      FROM bottle_transactions bt
      LEFT JOIN wines w ON w.id = bt.wine_id
      WHERE bt.profile_id = ?
      ORDER BY bt.created_at DESC
      LIMIT ?
    `).all(profileId, limit) as BottleTransaction[];
  },
};
