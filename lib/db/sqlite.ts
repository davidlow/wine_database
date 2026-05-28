import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import type {
  DbAdapter,
  Wine,
  Profile,
  Location,
  CellarInventory,
  BottleTransaction,
  WineNote,
  WineSearchParams,
  AddBottleInput,
  RemoveBottleInput,
  MoveBottleInput,
} from '@/types';
import { generateId } from '@/lib/utils';

// Read schema once at module load — it's static, no need to re-read on every reconnect.
const SCHEMA = fs.readFileSync(path.join(process.cwd(), 'lib', 'db', 'schema.sql'), 'utf-8');

// In Next.js dev mode, hot reload re-evaluates modules and resets module-level vars,
// forcing a new DB connection (and schema re-run) on every file save. Persisting via
// globalThis survives module re-evaluation and keeps the connection alive across reloads.
// Tests use ':memory:' which is intentionally NOT persisted here; closeSqliteDb() resets
// it between test cases via the module-level memoryDb variable instead.
const g = globalThis as typeof globalThis & { __wineSqliteDb?: Database.Database };
let memoryDb: Database.Database | null = null;

function openDb(resolvedPath: string): Database.Database {
  const conn = new Database(resolvedPath);
  conn.pragma('journal_mode = WAL');
  conn.pragma('foreign_keys = ON');
  conn.pragma('synchronous = NORMAL');    // safe with WAL; avoids fsync on every write
  conn.pragma('cache_size = -20000');     // 20 MB page cache (default is ~2 MB)
  conn.pragma('temp_store = MEMORY');     // temp tables and indices stay in RAM
  conn.pragma('mmap_size = 268435456');  // 256 MB memory-mapped reads
  conn.exec(SCHEMA);
  // Idempotent column migrations — ignored if column already exists
  try { conn.exec('ALTER TABLE locations ADD COLUMN group_name TEXT'); } catch {}
  try { conn.exec('ALTER TABLE profiles ADD COLUMN group_name TEXT'); } catch {}
  try { conn.exec('ALTER TABLE wines ADD COLUMN drink_from_year INTEGER'); } catch {}
  try { conn.exec('ALTER TABLE wines ADD COLUMN drink_by_year INTEGER'); } catch {}
  return conn;
}

function getDb(): Database.Database {
  const dbPath = process.env.SQLITE_DB_PATH ?? './wine.db';

  if (dbPath === ':memory:') {
    if (!memoryDb) memoryDb = openDb(':memory:');
    return memoryDb;
  }

  if (!g.__wineSqliteDb) {
    g.__wineSqliteDb = openDb(path.resolve(process.cwd(), dbPath));
  }
  return g.__wineSqliteDb;
}

// better-sqlite3 named params require ALL referenced keys to exist (even as null)
function nullify(obj: Record<string, unknown>, keys: readonly string[]): Record<string, unknown> {
  return Object.fromEntries(keys.map(k => [k, obj[k] ?? null]));
}

const WINE_COLS = ['id', 'name', 'producer', 'variety', 'wine_type', 'region', 'appellation', 'country', 'vintage_year', 'description', 'average_price', 'alcohol_content', 'drink_from_year', 'drink_by_year', 'barcode', 'image_url', 'created_at', 'updated_at'] as const;
const PROFILE_COLS = ['id', 'user_id', 'name', 'description', 'group_name', 'created_at', 'updated_at'] as const;
const INVENTORY_COLS = ['id', 'wine_id', 'profile_id', 'location', 'quantity', 'purchase_price', 'purchase_date', 'notes', 'created_at', 'updated_at'] as const;
const LOCATION_COLS = ['id', 'profile_id', 'name', 'group_name', 'max_capacity', 'notes', 'created_at', 'updated_at'] as const;

export function closeSqliteDb(): void {
  if (memoryDb) { memoryDb.close(); memoryDb = null; }
  if (g.__wineSqliteDb) { g.__wineSqliteDb.close(); g.__wineSqliteDb = undefined; }
}

export const sqliteAdapter: DbAdapter = {
  // --- Wines ---

  async getWines(params: WineSearchParams): Promise<Wine[]> {
    const d = getDb();
    const conditions: string[] = [];
    const values: unknown[] = [];

    const profileIds = params.profile_ids
      ? params.profile_ids.split(',').map(s => s.trim()).filter(Boolean)
      : [];

    if (params.query) {
      conditions.push(
        "(w.name LIKE ? OR w.producer LIKE ? OR w.variety LIKE ? OR w.region LIKE ? OR w.appellation LIKE ? OR w.country LIKE ? OR w.barcode LIKE ?)"
      );
      const q = `%${params.query}%`;
      values.push(q, q, q, q, q, q, q);
    }
    // variety: partial match so "cab" finds all Cabernet varieties
    if (params.variety) { conditions.push('w.variety LIKE ?'); values.push(`%${params.variety}%`); }
    if (params.wine_type) { conditions.push('w.wine_type = ?'); values.push(params.wine_type); }
    if (params.country) { conditions.push('w.country = ?'); values.push(params.country); }
    if (params.region) { conditions.push('w.region = ?'); values.push(params.region); }
    if (params.appellation) { conditions.push('w.appellation LIKE ?'); values.push(`%${params.appellation}%`); }
    if (params.vintage_year) { conditions.push('w.vintage_year = ?'); values.push(params.vintage_year); }
    if (params.producer) { conditions.push('w.producer LIKE ?'); values.push(`%${params.producer}%`); }
    if (params.price_min != null) { conditions.push('w.average_price >= ?'); values.push(params.price_min); }
    if (params.price_max != null) { conditions.push('w.average_price <= ?'); values.push(params.price_max); }

    // Multi-select regions (matches region OR appellation for any of the values)
    if (params.regions) {
      const regionList = params.regions.split(',').map(s => s.trim()).filter(Boolean);
      if (regionList.length > 0) {
        const ph = regionList.map(() => '?').join(', ');
        conditions.push(`(w.region IN (${ph}) OR w.appellation IN (${ph}))`);
        values.push(...regionList, ...regionList);
      }
    }

    if (profileIds.length > 0) {
      const placeholders = profileIds.map(() => '?').join(', ');
      conditions.push(
        `EXISTS (SELECT 1 FROM cellar_inventory ci WHERE ci.wine_id = w.id AND ci.profile_id IN (${placeholders}) AND ci.quantity > 0)`
      );
      values.push(...profileIds);
    }

    if (params.drink_status) {
      const yr = new Date().getFullYear();
      if (params.drink_status === 'past_peak') {
        conditions.push('(w.drink_by_year IS NOT NULL AND w.drink_by_year < ?)');
        values.push(yr);
      } else if (params.drink_status === 'too_young') {
        conditions.push('(w.drink_from_year IS NOT NULL AND w.drink_from_year > ?)');
        values.push(yr);
      } else if (params.drink_status === 'in_window') {
        conditions.push(
          '((w.drink_from_year IS NULL OR w.drink_from_year <= ?) AND (w.drink_by_year IS NULL OR w.drink_by_year >= ?) AND (w.drink_from_year IS NOT NULL OR w.drink_by_year IS NOT NULL))'
        );
        values.push(yr, yr);
      }
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `SELECT DISTINCT w.* FROM wines w ${where} ORDER BY w.name ASC`;
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
        vintage_year, description, average_price, alcohol_content, drink_from_year, drink_by_year,
        barcode, image_url, created_at, updated_at)
      VALUES (@id, @name, @producer, @variety, @wine_type, @region, @appellation, @country,
        @vintage_year, @description, @average_price, @alcohol_content, @drink_from_year, @drink_by_year,
        @barcode, @image_url, @created_at, @updated_at)
    `).run(nullify(wine as unknown as Record<string, unknown>, WINE_COLS));
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
        drink_from_year=@drink_from_year, drink_by_year=@drink_by_year,
        barcode=@barcode, image_url=@image_url, updated_at=@updated_at
      WHERE id=@id
    `).run(nullify(updated as unknown as Record<string, unknown>, WINE_COLS));
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
      INSERT INTO profiles (id, user_id, name, description, group_name, created_at, updated_at)
      VALUES (@id, @user_id, @name, @description, @group_name, @created_at, @updated_at)
    `).run(nullify(profile as unknown as Record<string, unknown>, PROFILE_COLS));
    return profile;
  },

  async updateProfile(id, userId, data): Promise<Profile> {
    const d = getDb();
    const existing = await sqliteAdapter.getProfileById(id, userId);
    if (!existing) throw new Error(`Profile ${id} not found`);
    const updated: Profile = { ...existing, ...data, id, updated_at: new Date().toISOString() };
    d.prepare(`
      UPDATE profiles SET name=@name, description=@description, group_name=@group_name, updated_at=@updated_at
      WHERE id=@id AND user_id=@user_id
    `).run(nullify(updated as unknown as Record<string, unknown>, PROFILE_COLS));
    return updated;
  },

  async deleteProfile(id, userId): Promise<void> {
    getDb().prepare('DELETE FROM profiles WHERE id = ? AND user_id = ?').run(id, userId);
  },

  // --- Cellar ---

  async getCellarInventory(profileId: string, _userId: string): Promise<CellarInventory[]> {
    const rows = getDb().prepare(`
      SELECT ci.*, w.name as wine_name, w.producer, w.variety, w.wine_type, w.vintage_year,
             w.region, w.country, w.image_url, w.drink_from_year, w.drink_by_year
      FROM cellar_inventory ci
      JOIN wines w ON w.id = ci.wine_id
      WHERE ci.profile_id = ? AND ci.quantity > 0
      ORDER BY w.name ASC
    `).all(profileId) as (CellarInventory & Record<string, unknown>)[];

    return rows.map(({ wine_name, producer, variety, wine_type, vintage_year, region, country, image_url, drink_from_year, drink_by_year, ...ci }) => ({
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
        drink_from_year: drink_from_year as number | undefined,
        drink_by_year: drink_by_year as number | undefined,
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
    // '' = unlocated sentinel; normalise undefined/null to empty string
    const loc = input.location?.trim() ?? '';
    const existing = d.prepare(`
      SELECT * FROM cellar_inventory WHERE wine_id = ? AND profile_id = ? AND location = ?
    `).get(input.wine_id, input.profile_id, loc) as CellarInventory | undefined;

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
      `).run(generateId(), input.wine_id, input.profile_id, existing.id, qty, loc, now);

      return updated;
    }

    const inventory: CellarInventory = {
      id: generateId(),
      wine_id: input.wine_id,
      profile_id: input.profile_id,
      location: loc,
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
    `).run(nullify(inventory as unknown as Record<string, unknown>, INVENTORY_COLS));

    d.prepare(`
      INSERT INTO bottle_transactions (id, wine_id, profile_id, cellar_inventory_id, transaction_type, quantity, location, created_at)
      VALUES (?, ?, ?, ?, 'add', ?, ?, ?)
    `).run(generateId(), input.wine_id, input.profile_id, inventory.id, qty, loc || null, now);

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
    `).run(nullify(updated as unknown as Record<string, unknown>, INVENTORY_COLS));
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

  async moveBottle(input: MoveBottleInput, _userId: string): Promise<void> {
    const d = getDb();
    const newLoc = input.new_location.trim();

    d.transaction(() => {
      const source = d.prepare('SELECT * FROM cellar_inventory WHERE id = ?').get(input.cellar_inventory_id) as CellarInventory | undefined;
      if (!source) throw new Error(`Inventory ${input.cellar_inventory_id} not found`);
      if (input.quantity > source.quantity) throw new Error('Cannot move more bottles than available');
      if (newLoc === source.location) throw new Error('Source and destination are the same location');

      const now = new Date().toISOString();

      // Decrement (or zero out) the source entry
      d.prepare('UPDATE cellar_inventory SET quantity = ?, updated_at = ? WHERE id = ?')
        .run(source.quantity - input.quantity, now, source.id);

      // Upsert the destination entry
      const dest = d.prepare(
        'SELECT * FROM cellar_inventory WHERE wine_id = ? AND profile_id = ? AND location = ?'
      ).get(source.wine_id, source.profile_id, newLoc) as CellarInventory | undefined;

      if (dest) {
        d.prepare('UPDATE cellar_inventory SET quantity = ?, updated_at = ? WHERE id = ?')
          .run(dest.quantity + input.quantity, now, dest.id);
      } else {
        const entry: CellarInventory = {
          id: generateId(),
          wine_id: source.wine_id,
          profile_id: source.profile_id,
          location: newLoc,
          quantity: input.quantity,
          purchase_price: source.purchase_price,
          purchase_date: source.purchase_date,
          notes: source.notes,
          created_at: now,
          updated_at: now,
        };
        d.prepare(`
          INSERT INTO cellar_inventory (id, wine_id, profile_id, location, quantity, purchase_price, purchase_date, notes, created_at, updated_at)
          VALUES (@id, @wine_id, @profile_id, @location, @quantity, @purchase_price, @purchase_date, @notes, @created_at, @updated_at)
        `).run(nullify(entry as unknown as Record<string, unknown>, INVENTORY_COLS));
      }

      // Record a 'move' transaction; store the route in the location field
      d.prepare(`
        INSERT INTO bottle_transactions (id, wine_id, profile_id, cellar_inventory_id, transaction_type, quantity, location, notes, created_at)
        VALUES (?, ?, ?, ?, 'move', ?, ?, ?, ?)
      `).run(
        generateId(), source.wine_id, source.profile_id, source.id,
        input.quantity, `${source.location} → ${newLoc}`, input.notes ?? null, now,
      );
    })();
  },

  // --- Locations ---

  async getLocations(profileId: string): Promise<Location[]> {
    const rows = getDb().prepare(`
      SELECT l.*,
             COALESCE(SUM(CASE WHEN ci.quantity > 0 THEN ci.quantity ELSE 0 END), 0) AS current_quantity
      FROM locations l
      LEFT JOIN cellar_inventory ci
        ON ci.profile_id = l.profile_id AND ci.location = l.name
      WHERE l.profile_id = ?
      GROUP BY l.id
      ORDER BY l.name ASC
    `).all(profileId) as (Location & { current_quantity: number })[];

    return rows.map(r => ({
      ...r,
      available_capacity: r.max_capacity != null ? Math.max(0, r.max_capacity - r.current_quantity) : undefined,
    }));
  },

  async createLocation(data): Promise<Location> {
    const d = getDb();
    const now = new Date().toISOString();
    const location: Location = { ...data, id: generateId(), created_at: now, updated_at: now };
    d.prepare(`
      INSERT INTO locations (id, profile_id, name, group_name, max_capacity, notes, created_at, updated_at)
      VALUES (@id, @profile_id, @name, @group_name, @max_capacity, @notes, @created_at, @updated_at)
    `).run(nullify(location as unknown as Record<string, unknown>, LOCATION_COLS));
    return location;
  },

  async updateLocation(id, data): Promise<Location> {
    const d = getDb();
    const existing = d.prepare('SELECT * FROM locations WHERE id = ?').get(id) as Location | undefined;
    if (!existing) throw new Error(`Location ${id} not found`);
    const updated: Location = { ...existing, ...data, id, updated_at: new Date().toISOString() };
    d.prepare(`
      UPDATE locations SET name=@name, group_name=@group_name, max_capacity=@max_capacity, notes=@notes, updated_at=@updated_at
      WHERE id=@id
    `).run(nullify(updated as unknown as Record<string, unknown>, LOCATION_COLS));
    return updated;
  },

  async deleteLocation(id): Promise<void> {
    getDb().prepare('DELETE FROM locations WHERE id = ?').run(id);
  },

  // --- Facets ---

  async getWineFacets(field: string, q: string): Promise<string[]> {
    const ALLOWED = ['variety', 'country', 'region', 'producer', 'appellation'];
    if (!ALLOWED.includes(field)) return [];
    const d = getDb();
    const rows = d.prepare(`
      SELECT DISTINCT ${field} FROM wines
      WHERE ${field} IS NOT NULL AND ${field} != '' AND ${field} LIKE ?
      ORDER BY ${field} ASC
      LIMIT 20
    `).all(`%${q}%`) as Record<string, string>[];
    return rows.map(r => r[field]);
  },

  // --- Tasting Notes ---

  async getWineNotes(wineId: string): Promise<WineNote[]> {
    return getDb().prepare(
      'SELECT * FROM wine_notes WHERE wine_id = ? ORDER BY created_at DESC'
    ).all(wineId) as WineNote[];
  },

  async addWineNote(wineId: string, note: string, tastedAt?: string): Promise<WineNote> {
    const d = getDb();
    const now = new Date().toISOString();
    const entry: WineNote = {
      id: generateId(),
      wine_id: wineId,
      note,
      tasted_at: tastedAt ?? undefined,
      created_at: now,
    };
    d.prepare(
      'INSERT INTO wine_notes (id, wine_id, note, tasted_at, created_at) VALUES (?, ?, ?, ?, ?)'
    ).run(entry.id, entry.wine_id, entry.note, entry.tasted_at ?? null, entry.created_at);
    return entry;
  },

  async deleteWineNote(noteId: string): Promise<void> {
    getDb().prepare('DELETE FROM wine_notes WHERE id = ?').run(noteId);
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

  // --- Producers ---

  async getProducers() {
    return getDb().prepare(`
      SELECT
        w.producer,
        COUNT(DISTINCT w.id) AS wine_count,
        COALESCE(SUM(ci.quantity), 0) AS bottle_count,
        COUNT(bt.id) AS transaction_count
      FROM wines w
      LEFT JOIN cellar_inventory ci ON ci.wine_id = w.id AND ci.quantity > 0
      LEFT JOIN bottle_transactions bt ON bt.wine_id = w.id
      WHERE w.producer IS NOT NULL AND w.producer != ''
      GROUP BY w.producer
      ORDER BY transaction_count DESC, wine_count DESC
    `).all() as import('@/types').ProducerStats[];
  },

  async getProducerWines(producer: string) {
    return getDb().prepare(`
      SELECT w.*,
        COUNT(DISTINCT bt.id) AS transaction_count,
        COALESCE(SUM(ci.quantity), 0) AS bottle_count
      FROM wines w
      LEFT JOIN bottle_transactions bt ON bt.wine_id = w.id
      LEFT JOIN cellar_inventory ci ON ci.wine_id = w.id AND ci.quantity > 0
      WHERE w.producer = ?
      GROUP BY w.id
      ORDER BY transaction_count DESC, w.name ASC
    `).all(producer) as (import('@/types').Wine & { transaction_count: number; bottle_count: number })[];
  },
};
