CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS wines (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  producer TEXT,
  variety TEXT,
  wine_type TEXT CHECK (wine_type IN ('red', 'white', 'rosé', 'sparkling', 'dessert', 'fortified', 'other')),
  region TEXT,
  appellation TEXT,
  country TEXT,
  vintage_year INTEGER,
  description TEXT,
  average_price REAL,
  alcohol_content REAL,
  drink_from_year INTEGER,
  drink_by_year INTEGER,
  barcode TEXT UNIQUE,
  image_url TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cellar_inventory (
  id TEXT PRIMARY KEY,
  wine_id TEXT NOT NULL REFERENCES wines(id) ON DELETE CASCADE,
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  location TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  purchase_price REAL,
  purchase_date TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  CONSTRAINT positive_quantity CHECK (quantity >= 0)
);

CREATE TABLE IF NOT EXISTS bottle_transactions (
  id TEXT PRIMARY KEY,
  wine_id TEXT REFERENCES wines(id) ON DELETE SET NULL,
  profile_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  cellar_inventory_id TEXT,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('add', 'remove', 'move')),
  quantity INTEGER NOT NULL,
  location TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Named storage locations with optional capacity tracking.
-- location TEXT in cellar_inventory matches locations.name for the same profile_id.
-- Bottles with location='' are "unlocated" (received but not yet placed).
CREATE TABLE IF NOT EXISTS locations (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  group_name TEXT,
  max_capacity INTEGER,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(profile_id, name)
);

-- Timestamped tasting notes per wine.
CREATE TABLE IF NOT EXISTS wine_notes (
  id TEXT PRIMARY KEY,
  wine_id TEXT NOT NULL REFERENCES wines(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  tasted_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_wine_notes_wine_id ON wine_notes(wine_id);

-- Per-wine food pairing recommendations (Gemini or manual)
CREATE TABLE IF NOT EXISTS wine_food_pairings (
  id TEXT PRIMARY KEY,
  wine_id TEXT NOT NULL REFERENCES wines(id) ON DELETE CASCADE,
  food TEXT NOT NULL,
  source TEXT DEFAULT 'manual',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_wfp_wine_id ON wine_food_pairings(wine_id);
CREATE INDEX IF NOT EXISTS idx_wfp_food ON wine_food_pairings(food);
CREATE INDEX IF NOT EXISTS idx_wines_barcode ON wines(barcode);
CREATE INDEX IF NOT EXISTS idx_wines_name ON wines(name);
CREATE INDEX IF NOT EXISTS idx_cellar_wine_id ON cellar_inventory(wine_id);
CREATE INDEX IF NOT EXISTS idx_cellar_profile_id ON cellar_inventory(profile_id);
CREATE INDEX IF NOT EXISTS idx_transactions_wine_id ON bottle_transactions(wine_id);
CREATE INDEX IF NOT EXISTS idx_transactions_profile_id ON bottle_transactions(profile_id);
CREATE INDEX IF NOT EXISTS idx_locations_profile_id ON locations(profile_id);
