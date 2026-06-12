-- PostgreSQL schema for Supabase deployment.
-- Run this in the Supabase SQL Editor (Project → SQL Editor → New query).
-- Timestamps use TEXT to match the ISO strings the app writes; defaults are
-- omitted because the application always provides created_at/updated_at.

CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  group_name TEXT,
  created_at TEXT,
  updated_at TEXT
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
  label_image TEXT,
  acidity REAL,
  tannin REAL,
  alcohol REAL,
  sweetness REAL,
  body REAL,
  fruit_profile TEXT,
  created_at TEXT,
  updated_at TEXT
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
  created_at TEXT,
  updated_at TEXT,
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
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS locations (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  group_name TEXT,
  max_capacity INTEGER,
  notes TEXT,
  created_at TEXT,
  updated_at TEXT,
  UNIQUE(profile_id, name)
);

CREATE TABLE IF NOT EXISTS wine_notes (
  id TEXT PRIMARY KEY,
  wine_id TEXT NOT NULL REFERENCES wines(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  tasted_at TEXT,
  created_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_wine_notes_wine_id ON wine_notes(wine_id);

CREATE TABLE IF NOT EXISTS wine_food_pairings (
  id TEXT PRIMARY KEY,
  wine_id TEXT NOT NULL REFERENCES wines(id) ON DELETE CASCADE,
  food TEXT NOT NULL,
  source TEXT DEFAULT 'manual',
  created_at TEXT
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

CREATE TABLE IF NOT EXISTS freezer_inventory (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  meat_cut TEXT NOT NULL,
  primal TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  weight_lbs REAL,
  location TEXT NOT NULL DEFAULT '',
  stored_date TEXT NOT NULL,
  eat_by_date TEXT NOT NULL,
  price_per_lb REAL,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CONSTRAINT positive_quantity CHECK (quantity >= 0)
);

CREATE TABLE IF NOT EXISTS freezer_transactions (
  id TEXT PRIMARY KEY,
  freezer_item_id TEXT NOT NULL REFERENCES freezer_inventory(id) ON DELETE CASCADE,
  profile_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('add', 'remove')),
  quantity INTEGER NOT NULL,
  weight_lbs REAL,
  notes TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_freezer_profile_id ON freezer_inventory(profile_id);
CREATE INDEX IF NOT EXISTS idx_freezer_tx_item_id ON freezer_transactions(freezer_item_id);
CREATE INDEX IF NOT EXISTS idx_freezer_tx_profile_id ON freezer_transactions(profile_id);

CREATE TABLE IF NOT EXISTS freezer_locations (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(profile_id, name)
);
CREATE INDEX IF NOT EXISTS idx_freezer_locations_profile ON freezer_locations(profile_id);

CREATE TABLE IF NOT EXISTS pantry_items (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  brand TEXT,
  category TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit TEXT NOT NULL DEFAULT 'unit',
  location TEXT NOT NULL DEFAULT '',
  stored_date TEXT NOT NULL,
  best_by_date TEXT,
  best_by_days INTEGER NOT NULL DEFAULT 365,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CONSTRAINT positive_pantry_qty CHECK (quantity >= 0)
);

CREATE TABLE IF NOT EXISTS pantry_transactions (
  id TEXT PRIMARY KEY,
  pantry_item_id TEXT NOT NULL REFERENCES pantry_items(id) ON DELETE CASCADE,
  profile_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('add', 'remove')),
  quantity INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pantry_profile_id ON pantry_items(profile_id);
CREATE INDEX IF NOT EXISTS idx_pantry_name ON pantry_items(name);
CREATE INDEX IF NOT EXISTS idx_pantry_tx_profile_id ON pantry_transactions(profile_id);

CREATE TABLE IF NOT EXISTS pantry_usage_settings (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  days_per_unit REAL,
  reset_date TEXT,
  date_mode TEXT DEFAULT 'full',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(profile_id, item_name)
);
CREATE INDEX IF NOT EXISTS idx_pantry_usage_profile ON pantry_usage_settings(profile_id);

CREATE TABLE IF NOT EXISTS cellar_shares (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  owner_user_id TEXT NOT NULL,
  shared_with_user_id TEXT NOT NULL,
  shared_with_email TEXT NOT NULL,
  permission TEXT NOT NULL CHECK (permission IN ('read', 'write')),
  created_at TEXT,
  UNIQUE(profile_id, shared_with_user_id)
);

CREATE INDEX IF NOT EXISTS idx_shares_profile_id ON cellar_shares(profile_id);
CREATE INDEX IF NOT EXISTS idx_shares_shared_with ON cellar_shares(shared_with_user_id);
