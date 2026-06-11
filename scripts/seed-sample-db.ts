/**
 * Creates wine-sample.db with pre-populated wines, cellar inventory, and freezer data.
 * Run with: npx tsx scripts/seed-sample-db.ts
 * Then launch with: SQLITE_DB_PATH=./wine-sample.db npm run dev
 */

import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = resolve(__dirname, '../wine-sample.db');
const SCHEMA_PATH = resolve(__dirname, '../lib/db/schema.sql');

const USER_ID = 'dev-user-id'; // matches lib/auth.ts DEV_USER_ID

function id() {
  return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
}

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function addYear(date: string) {
  return `${parseInt(date.slice(0, 4), 10) + 1}${date.slice(4)}`;
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Apply schema
const schema = readFileSync(SCHEMA_PATH, 'utf8');
for (const stmt of schema.split(';').map(s => s.trim()).filter(Boolean)) {
  db.exec(stmt + ';');
}

// ── Profile ───────────────────────────────────────────────────────────────────
const profileId = id();
db.prepare(`
  INSERT INTO profiles (id, user_id, name, description, created_at, updated_at)
  VALUES (?, ?, 'Sample Cellar', 'Pre-populated demo cellar', datetime('now'), datetime('now'))
`).run(profileId, USER_ID);

// ── Cellar wine locations ─────────────────────────────────────────────────────
const cellarLocations = ['Stair Rack', 'Under Stairs', 'Basement Rack'];
for (const name of cellarLocations) {
  db.prepare(`INSERT INTO locations (id, profile_id, name, max_capacity, created_at, updated_at) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`).run(id(), profileId, name, name === 'Basement Rack' ? 120 : 48);
}

// ── Wines ─────────────────────────────────────────────────────────────────────
const wines: Array<{
  id: string; name: string; producer: string; variety: string; wine_type: string;
  region: string; country: string; vintage_year: number; average_price: number;
  drink_from_year: number; drink_by_year: number;
}> = [
  { id: id(), name: 'Château Margaux',         producer: 'Château Margaux',    variety: 'Cabernet Sauvignon Blend', wine_type: 'red',      region: 'Margaux',              country: 'France',    vintage_year: 2015, average_price: 550,  drink_from_year: 2025, drink_by_year: 2055 },
  { id: id(), name: 'Opus One',                producer: 'Opus One Winery',    variety: 'Cabernet Sauvignon Blend', wine_type: 'red',      region: 'Napa Valley',          country: 'USA',       vintage_year: 2018, average_price: 375,  drink_from_year: 2024, drink_by_year: 2045 },
  { id: id(), name: 'Penfolds Grange',         producer: 'Penfolds',           variety: 'Shiraz',                   wine_type: 'red',      region: 'South Australia',      country: 'Australia', vintage_year: 2016, average_price: 700,  drink_from_year: 2026, drink_by_year: 2050 },
  { id: id(), name: 'Sassicaia',               producer: 'Tenuta San Guido',   variety: 'Cabernet Sauvignon Blend', wine_type: 'red',      region: 'Bolgheri',             country: 'Italy',     vintage_year: 2017, average_price: 200,  drink_from_year: 2023, drink_by_year: 2040 },
  { id: id(), name: 'Caymus Special Selection',producer: 'Caymus Vineyards',   variety: 'Cabernet Sauvignon',       wine_type: 'red',      region: 'Napa Valley',          country: 'USA',       vintage_year: 2019, average_price: 150,  drink_from_year: 2023, drink_by_year: 2038 },
  { id: id(), name: 'Ridge Monte Bello',       producer: 'Ridge Vineyards',    variety: 'Cabernet Sauvignon Blend', wine_type: 'red',      region: 'Santa Cruz Mountains', country: 'USA',       vintage_year: 2017, average_price: 300,  drink_from_year: 2025, drink_by_year: 2047 },
  { id: id(), name: 'Kistler Sonoma Coast Pinot Noir', producer: 'Kistler Vineyards', variety: 'Pinot Noir',         wine_type: 'red',      region: 'Sonoma Coast',         country: 'USA',       vintage_year: 2020, average_price: 95,   drink_from_year: 2023, drink_by_year: 2032 },
  { id: id(), name: 'Stag\'s Leap Artemis',   producer: 'Stag\'s Leap Wine Cellars', variety: 'Cabernet Sauvignon', wine_type: 'red',     region: 'Napa Valley',          country: 'USA',       vintage_year: 2020, average_price: 70,   drink_from_year: 2023, drink_by_year: 2035 },
  { id: id(), name: 'Puligny-Montrachet 1er Cru', producer: 'Domaine Leflaive', variety: 'Chardonnay',             wine_type: 'white',    region: 'Puligny-Montrachet',   country: 'France',    vintage_year: 2019, average_price: 180,  drink_from_year: 2022, drink_by_year: 2032 },
  { id: id(), name: 'Cloudy Bay Sauvignon Blanc', producer: 'Cloudy Bay',      variety: 'Sauvignon Blanc',          wine_type: 'white',    region: 'Marlborough',          country: 'New Zealand', vintage_year: 2022, average_price: 28,  drink_from_year: 2022, drink_by_year: 2026 },
  { id: id(), name: 'Peter Michael Chardonnay', producer: 'Peter Michael Winery', variety: 'Chardonnay',           wine_type: 'white',    region: 'Knights Valley',       country: 'USA',       vintage_year: 2021, average_price: 90,   drink_from_year: 2023, drink_by_year: 2030 },
  { id: id(), name: 'Domaine Weinbach Riesling', producer: 'Domaine Weinbach',  variety: 'Riesling',               wine_type: 'white',    region: 'Alsace',               country: 'France',    vintage_year: 2021, average_price: 55,   drink_from_year: 2023, drink_by_year: 2035 },
  { id: id(), name: 'Bollinger Special Cuvée', producer: 'Bollinger',          variety: 'Champagne Blend',          wine_type: 'sparkling', region: 'Champagne',           country: 'France',    vintage_year: 2020, average_price: 75,   drink_from_year: 2022, drink_by_year: 2028 },
  { id: id(), name: 'Taylor Fladgate 20yr Tawny', producer: 'Taylor Fladgate', variety: 'Touriga Nacional Blend',  wine_type: 'fortified', region: 'Douro',               country: 'Portugal',  vintage_year: 2004, average_price: 55,   drink_from_year: 2024, drink_by_year: 2040 },
  { id: id(), name: 'Masseto',                 producer: 'Masseto',            variety: 'Merlot',                   wine_type: 'red',      region: 'Bolgheri',             country: 'Italy',     vintage_year: 2014, average_price: 550,  drink_from_year: 2022, drink_by_year: 2040 },
];

const insertWine = db.prepare(`
  INSERT INTO wines (id, name, producer, variety, wine_type, region, country, vintage_year, average_price, drink_from_year, drink_by_year, created_at, updated_at)
  VALUES (@id, @name, @producer, @variety, @wine_type, @region, @country, @vintage_year, @average_price, @drink_from_year, @drink_by_year, datetime('now'), datetime('now'))
`);

for (const wine of wines) insertWine.run(wine);

// ── Cellar inventory ──────────────────────────────────────────────────────────
const insertInv = db.prepare(`
  INSERT INTO cellar_inventory (id, wine_id, profile_id, location, quantity, purchase_price, purchase_date, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
`);
const insertTx = db.prepare(`
  INSERT INTO bottle_transactions (id, wine_id, profile_id, transaction_type, quantity, location, created_at)
  VALUES (?, ?, ?, 'add', ?, ?, datetime('now'))
`);

const invEntries: Array<[string, number, string, number, number, string]> = [
  [wines[0].id, 6, 'Basement Rack', 520, 520, '2022-03-15'],
  [wines[1].id, 4, 'Stair Rack',    350, 350, '2023-06-01'],
  [wines[2].id, 3, 'Basement Rack', 680, 680, '2021-09-10'],
  [wines[3].id, 6, 'Under Stairs',  185, 185, '2022-11-20'],
  [wines[4].id, 12, 'Stair Rack',   140, 140, '2023-01-05'],
  [wines[5].id, 4, 'Basement Rack', 280, 280, '2022-08-30'],
  [wines[6].id, 6, 'Stair Rack',    90,  90,  '2023-04-15'],
  [wines[7].id, 12, 'Under Stairs', 65,  65,  '2023-09-22'],
  [wines[8].id, 3, 'Basement Rack', 170, 170, '2022-05-18'],
  [wines[9].id, 6, 'Stair Rack',    26,  26,  '2024-02-10'],
  [wines[10].id,3, 'Under Stairs',  85,  85,  '2023-07-12'],
  [wines[11].id,6, 'Basement Rack', 50,  50,  '2023-03-08'],
  [wines[12].id,6, 'Stair Rack',    70,  70,  '2023-10-01'],
  [wines[13].id,2, 'Under Stairs',  50,  50,  '2022-12-25'],
  [wines[14].id,2, 'Basement Rack', 530, 530, '2021-04-20'],
];

for (const [wineId, qty, loc, price,, purchDate] of invEntries) {
  const invId = id();
  insertInv.run(invId, wineId, profileId, loc, qty, price, purchDate);
  insertTx.run(id(), wineId, profileId, qty, loc);
}

// ── Freezer locations ─────────────────────────────────────────────────────────
const flocs = ['Garage Freezer', 'Kitchen Freezer'];
const flocIds: Record<string, string> = {};
for (const name of flocs) {
  const fid = id();
  flocIds[name] = fid;
  db.prepare(`INSERT INTO freezer_locations (id, profile_id, name, created_at) VALUES (?, ?, ?, datetime('now'))`).run(fid, profileId, name);
}

// ── Freezer items ─────────────────────────────────────────────────────────────
const insertFreezer = db.prepare(`
  INSERT INTO freezer_inventory (id, profile_id, meat_cut, primal, quantity, weight_lbs, location, stored_date, eat_by_date, price_per_lb, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
`);
const insertFTx = db.prepare(`
  INSERT INTO freezer_transactions (id, freezer_item_id, profile_id, action, quantity, created_at)
  VALUES (?, ?, ?, 'add', ?, datetime('now'))
`);

const freezerItems: Array<{
  cut: string; primal: string; qty: number; wt: number; loc: string; daysBack: number; price: number;
}> = [
  { cut: 'Beef Ribeye Steak',   primal: 'Rib',            qty: 4,  wt: 1.2, loc: 'Garage Freezer',  daysBack: 90,  price: 22 },
  { cut: 'Beef NY Strip Steak', primal: 'Short Loin',     qty: 3,  wt: 1.0, loc: 'Garage Freezer',  daysBack: 45,  price: 18 },
  { cut: 'Beef Chuck Roast',    primal: 'Chuck',          qty: 2,  wt: 3.5, loc: 'Garage Freezer',  daysBack: 240, price: 8  },
  { cut: 'Beef Ground',         primal: 'Various',        qty: 8,  wt: 1.0, loc: 'Garage Freezer',  daysBack: 30,  price: 7  },
  { cut: 'Beef Brisket',        primal: 'Brisket',        qty: 1,  wt: 8.0, loc: 'Garage Freezer',  daysBack: 300, price: 9  },
  { cut: 'Beef Short Rib',      primal: 'Chuck / Plate',  qty: 3,  wt: 2.0, loc: 'Garage Freezer',  daysBack: 60,  price: 12 },
  { cut: 'Pork Loin Chop',      primal: 'Loin',           qty: 3,  wt: 0.8, loc: 'Kitchen Freezer', daysBack: 60,  price: 7  },
  { cut: 'Pork Belly',          primal: 'Belly',          qty: 2,  wt: 2.5, loc: 'Garage Freezer',  daysBack: 150, price: 6  },
  { cut: 'Pork Butt',           primal: 'Shoulder',       qty: 1,  wt: 6.0, loc: 'Garage Freezer',  daysBack: 210, price: 5  },
  { cut: 'Chicken Breast',      primal: 'Breast',         qty: 6,  wt: 0.6, loc: 'Kitchen Freezer', daysBack: 21,  price: 5  },
  { cut: 'Chicken Thigh',       primal: 'Thigh',          qty: 4,  wt: 0.5, loc: 'Kitchen Freezer', daysBack: 120, price: 4  },
  { cut: 'Beef Flank Steak',    primal: 'Flank',          qty: 2,  wt: 1.5, loc: 'Garage Freezer',  daysBack: 75,  price: 11 },
];

const fItemIds: Record<string, string> = {};
for (const fi of freezerItems) {
  const fid = id();
  const stored = daysAgo(fi.daysBack);
  insertFreezer.run(fid, profileId, fi.cut, fi.primal, fi.qty, fi.wt, fi.loc, stored, addYear(stored), fi.price);
  insertFTx.run(id(), fid, profileId, fi.qty);
  fItemIds[fi.cut] = fid;
}

// ── Freezer remove transactions (historical consumption) ──────────────────────
const insertRemoveTx = db.prepare(`
  INSERT INTO freezer_transactions (id, freezer_item_id, profile_id, action, quantity, created_at)
  VALUES (?, ?, ?, 'remove', ?, ?)
`);

const now = new Date();
function daysAgoISO(n: number) {
  const d = new Date(now);
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

// Simulate past consumption so the Reorder Monitor has data
const history: Array<[string, number, number]> = [
  ['Beef Ribeye Steak',   2, 60],
  ['Beef Ribeye Steak',   2, 150],
  ['Beef Ribeye Steak',   2, 240],
  ['Chicken Breast',      4, 50],
  ['Chicken Breast',      4, 100],
  ['Chicken Breast',      2, 180],
  ['Beef Ground',         2, 40],
  ['Beef Ground',         4, 90],
  ['Pork Loin Chop',      2, 120],
  ['Pork Loin Chop',      2, 220],
  ['Beef Chuck Roast',    1, 180],
  ['Beef NY Strip Steak', 2, 80],
  ['Beef NY Strip Steak', 2, 160],
];

for (const [cut, qty, daysBack] of history) {
  const itemId = fItemIds[cut];
  if (itemId) {
    insertRemoveTx.run(id(), itemId, profileId, qty, daysAgoISO(daysBack));
  }
}

db.close();
console.log(`Created ${DB_PATH}`);
console.log('Launch with: SQLITE_DB_PATH=./wine-sample.db npm run dev');
