/**
 * Creates wine-sample.db with pre-populated wines, cellar inventory, freezer data,
 * structural profiles, and food pairings.
 *
 * Run with: npx tsx scripts/seed-sample-db.ts
 * Then launch with: SQLITE_DB_PATH=./wine-sample.db npm run dev
 *
 * Deletes and recreates the DB each run so it is always idempotent.
 */

import Database from 'better-sqlite3';
import { readFileSync, existsSync, unlinkSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = resolve(__dirname, '../wine-sample.db');
const SCHEMA_PATH = resolve(__dirname, '../lib/db/schema.sql');

const USER_ID = 'dev-user-id'; // matches lib/auth.ts DEV_USER_ID

// Fixed IDs — keeping these stable means re-seeding never orphans pairings.
const PROFILE_ID = '7v40q3cxqgti416r';

function rid() {
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

// Delete and recreate so re-runs are always clean.
if (existsSync(DB_PATH)) unlinkSync(DB_PATH);

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Apply schema
const schema = readFileSync(SCHEMA_PATH, 'utf8');
for (const stmt of schema.split(';').map(s => s.trim()).filter(Boolean)) {
  db.exec(stmt + ';');
}

// ── Profile ───────────────────────────────────────────────────────────────────
db.prepare(`
  INSERT INTO profiles (id, user_id, name, description, created_at, updated_at)
  VALUES (?, ?, 'Sample Cellar', 'Pre-populated demo cellar', datetime('now'), datetime('now'))
`).run(PROFILE_ID, USER_ID);

// ── Cellar wine locations ─────────────────────────────────────────────────────
const cellarLocations = ['Stair Rack', 'Under Stairs', 'Basement Rack'];
for (const name of cellarLocations) {
  db.prepare(`INSERT INTO locations (id, profile_id, name, max_capacity, created_at, updated_at) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`).run(rid(), PROFILE_ID, name, name === 'Basement Rack' ? 120 : 48);
}

// ── Wines (fixed IDs + structural profiles) ───────────────────────────────────
const wines: Array<{
  id: string; name: string; producer: string; variety: string; wine_type: string;
  region: string; country: string; vintage_year: number; average_price: number;
  drink_from_year: number; drink_by_year: number;
  acidity: number; tannin: number; sweetness: number; body: number; alcohol: number;
}> = [
  { id: 'wztw4828495rkb0h', name: 'Château Margaux',           producer: 'Château Margaux',         variety: 'Cabernet Sauvignon Blend', wine_type: 'red',       region: 'Margaux',              country: 'France',      vintage_year: 2015, average_price: 550,  drink_from_year: 2025, drink_by_year: 2055, acidity: 3.5, tannin: 4.0, sweetness: 1.5, body: 4.5, alcohol: 13.5 },
  { id: 'wssjf6g2h4vf0f9o', name: 'Opus One',                  producer: 'Opus One Winery',         variety: 'Cabernet Sauvignon Blend', wine_type: 'red',       region: 'Napa Valley',          country: 'USA',         vintage_year: 2018, average_price: 375,  drink_from_year: 2024, drink_by_year: 2045, acidity: 3.0, tannin: 4.5, sweetness: 2.0, body: 5.0, alcohol: 14.5 },
  { id: 'brhtzk3sztxdw0zo', name: 'Penfolds Grange',           producer: 'Penfolds',               variety: 'Shiraz',                   wine_type: 'red',       region: 'South Australia',      country: 'Australia',   vintage_year: 2016, average_price: 700,  drink_from_year: 2026, drink_by_year: 2050, acidity: 3.5, tannin: 4.5, sweetness: 1.5, body: 5.0, alcohol: 14.5 },
  { id: 'lnx7of1k2t4uxat5', name: 'Sassicaia',                 producer: 'Tenuta San Guido',       variety: 'Cabernet Sauvignon Blend', wine_type: 'red',       region: 'Bolgheri',             country: 'Italy',       vintage_year: 2017, average_price: 200,  drink_from_year: 2023, drink_by_year: 2040, acidity: 3.5, tannin: 4.0, sweetness: 1.5, body: 4.5, alcohol: 14.0 },
  { id: 'bvlom0iwno39ig8b', name: 'Caymus Special Selection',  producer: 'Caymus Vineyards',       variety: 'Cabernet Sauvignon',       wine_type: 'red',       region: 'Napa Valley',          country: 'USA',         vintage_year: 2019, average_price: 150,  drink_from_year: 2023, drink_by_year: 2038, acidity: 2.5, tannin: 4.0, sweetness: 2.5, body: 5.0, alcohol: 15.0 },
  { id: 'uq0gbipbgtuzt3su', name: 'Ridge Monte Bello',         producer: 'Ridge Vineyards',        variety: 'Cabernet Sauvignon Blend', wine_type: 'red',       region: 'Santa Cruz Mountains', country: 'USA',         vintage_year: 2017, average_price: 300,  drink_from_year: 2025, drink_by_year: 2047, acidity: 4.0, tannin: 4.0, sweetness: 1.5, body: 4.5, alcohol: 13.5 },
  { id: 'buhd72wud77oqce0', name: 'Kistler Sonoma Coast Pinot Noir', producer: 'Kistler Vineyards', variety: 'Pinot Noir',              wine_type: 'red',       region: 'Sonoma Coast',         country: 'USA',         vintage_year: 2020, average_price: 95,   drink_from_year: 2023, drink_by_year: 2032, acidity: 4.0, tannin: 2.5, sweetness: 1.5, body: 3.0, alcohol: 14.0 },
  { id: 'yhjxt8h38bb8tuec', name: "Stag's Leap Artemis",       producer: "Stag's Leap Wine Cellars", variety: 'Cabernet Sauvignon',    wine_type: 'red',       region: 'Napa Valley',          country: 'USA',         vintage_year: 2020, average_price: 70,   drink_from_year: 2023, drink_by_year: 2035, acidity: 3.0, tannin: 3.5, sweetness: 2.0, body: 4.0, alcohol: 14.5 },
  { id: 'i1j9i6pyg5f68k43', name: 'Puligny-Montrachet 1er Cru', producer: 'Domaine Leflaive',     variety: 'Chardonnay',               wine_type: 'white',     region: 'Puligny-Montrachet',   country: 'France',      vintage_year: 2019, average_price: 180,  drink_from_year: 2022, drink_by_year: 2032, acidity: 4.5, tannin: 1.0, sweetness: 1.0, body: 3.5, alcohol: 13.0 },
  { id: 'qwoaeegx0cpu5ggz', name: 'Cloudy Bay Sauvignon Blanc', producer: 'Cloudy Bay',           variety: 'Sauvignon Blanc',          wine_type: 'white',     region: 'Marlborough',          country: 'New Zealand', vintage_year: 2022, average_price: 28,   drink_from_year: 2022, drink_by_year: 2026, acidity: 4.5, tannin: 1.0, sweetness: 1.5, body: 2.0, alcohol: 13.0 },
  { id: '9ikejdrrs1ay8et7', name: 'Peter Michael Chardonnay',  producer: 'Peter Michael Winery',   variety: 'Chardonnay',               wine_type: 'white',     region: 'Knights Valley',       country: 'USA',         vintage_year: 2021, average_price: 90,   drink_from_year: 2023, drink_by_year: 2030, acidity: 4.0, tannin: 1.0, sweetness: 1.5, body: 4.0, alcohol: 14.0 },
  { id: '08waibqt4hi2n41x', name: 'Domaine Weinbach Riesling', producer: 'Domaine Weinbach',       variety: 'Riesling',                 wine_type: 'white',     region: 'Alsace',               country: 'France',      vintage_year: 2021, average_price: 55,   drink_from_year: 2023, drink_by_year: 2035, acidity: 4.5, tannin: 1.0, sweetness: 2.0, body: 2.5, alcohol: 12.5 },
  { id: 'wvfogdo76rkaz973', name: 'Bollinger Special Cuvée',   producer: 'Bollinger',              variety: 'Champagne Blend',          wine_type: 'sparkling', region: 'Champagne',            country: 'France',      vintage_year: 2020, average_price: 75,   drink_from_year: 2022, drink_by_year: 2028, acidity: 4.5, tannin: 1.5, sweetness: 1.5, body: 3.0, alcohol: 12.5 },
  { id: 'lifv2mbi908j4mds', name: 'Taylor Fladgate 20yr Tawny', producer: 'Taylor Fladgate',      variety: 'Touriga Nacional Blend',   wine_type: 'fortified', region: 'Douro',                country: 'Portugal',    vintage_year: 2004, average_price: 55,   drink_from_year: 2024, drink_by_year: 2040, acidity: 3.0, tannin: 3.5, sweetness: 5.0, body: 4.0, alcohol: 20.0 },
  { id: 'wyny0s22qzafs1nb', name: 'Masseto',                   producer: 'Masseto',                variety: 'Merlot',                   wine_type: 'red',       region: 'Bolgheri',             country: 'Italy',       vintage_year: 2014, average_price: 550,  drink_from_year: 2022, drink_by_year: 2040, acidity: 3.5, tannin: 3.5, sweetness: 2.0, body: 4.5, alcohol: 14.5 },
];

const insertWine = db.prepare(`
  INSERT INTO wines (id, name, producer, variety, wine_type, region, country, vintage_year, average_price,
                     drink_from_year, drink_by_year, acidity, tannin, sweetness, body, alcohol, created_at, updated_at)
  VALUES (@id, @name, @producer, @variety, @wine_type, @region, @country, @vintage_year, @average_price,
          @drink_from_year, @drink_by_year, @acidity, @tannin, @sweetness, @body, @alcohol, datetime('now'), datetime('now'))
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

// [wine index, qty, location, purchase_price, _, purchase_date]
const invEntries: Array<[number, number, string, number, number, string]> = [
  [0,  6, 'Basement Rack', 520, 520, '2022-03-15'],
  [1,  4, 'Stair Rack',    350, 350, '2023-06-01'],
  [2,  3, 'Basement Rack', 680, 680, '2021-09-10'],
  [3,  6, 'Under Stairs',  185, 185, '2022-11-20'],
  [4,  12, 'Stair Rack',   140, 140, '2023-01-05'],
  [5,  4, 'Basement Rack', 280, 280, '2022-08-30'],
  [6,  6, 'Stair Rack',    90,  90,  '2023-04-15'],
  [7,  12, 'Under Stairs', 65,  65,  '2023-09-22'],
  [8,  3, 'Basement Rack', 170, 170, '2022-05-18'],
  [9,  6, 'Stair Rack',    26,  26,  '2024-02-10'],
  [10, 3, 'Under Stairs',  85,  85,  '2023-07-12'],
  [11, 6, 'Basement Rack', 50,  50,  '2023-03-08'],
  [12, 6, 'Stair Rack',    70,  70,  '2023-10-01'],
  [13, 2, 'Under Stairs',  50,  50,  '2022-12-25'],
  [14, 2, 'Basement Rack', 530, 530, '2021-04-20'],
];

for (const [wi, qty, loc, price,, purchDate] of invEntries) {
  const invId = rid();
  insertInv.run(invId, wines[wi].id, PROFILE_ID, loc, qty, price, purchDate);
  insertTx.run(rid(), wines[wi].id, PROFILE_ID, qty, loc);
}

// ── Food pairings ─────────────────────────────────────────────────────────────
const insertPairing = db.prepare(`
  INSERT INTO wine_food_pairings (id, wine_id, food, source, created_at)
  VALUES (?, ?, ?, 'manual', datetime('now'))
`);

const pairings: Array<[string, string[]]> = [
  ['wztw4828495rkb0h', ['lamb chops', 'filet mignon', 'roast beef', 'duck confit', 'aged cheddar', 'truffle dishes', 'mushroom risotto', 'venison']],
  ['wssjf6g2h4vf0f9o', ['ribeye steak', 'braised short rib', 'grilled lamb', 'portobello mushroom', 'aged gouda', 'dark chocolate', 'roasted venison']],
  ['brhtzk3sztxdw0zo', ['pepper steak', 'prime rib', 'braised lamb shanks', 'barbecued brisket', 'game meat', 'smoked ribs', 'aged cheddar']],
  ['lnx7of1k2t4uxat5', ['bistecca alla fiorentina', 'roasted lamb', 'grilled beef', 'truffle pasta', 'wild boar', 'aged pecorino', 'porcini mushroom']],
  ['bvlom0iwno39ig8b', ['ribeye', 'grilled lamb chops', 'barbecue brisket', 'portobello mushroom', 'dark chocolate', 'aged cheddar']],
  ['uq0gbipbgtuzt3su', ['filet mignon', 'braised short rib', 'grilled lamb', 'roasted duck', 'mushroom dishes', 'aged hard cheese']],
  ['buhd72wud77oqce0', ['roasted chicken', 'duck breast', 'salmon', 'mushroom risotto', 'pork tenderloin', 'grilled tuna', 'pinot noir braised lamb', 'brie']],
  ['yhjxt8h38bb8tuec', ['grilled steak', 'lamb chops', 'braised beef', 'roasted vegetables', 'mushroom pasta', 'aged cheddar']],
  ['i1j9i6pyg5f68k43', ['lobster', 'scallops', 'Dover sole', 'crab', 'poached halibut', 'chicken in cream sauce', 'soft cheese']],
  ['qwoaeegx0cpu5ggz', ['oysters', 'sushi', 'asparagus', 'goat cheese', 'ceviche', 'green salad', 'shellfish', 'Thai food']],
  ['9ikejdrrs1ay8et7', ['lobster bisque', 'scallops in beurre blanc', 'crab', 'roasted chicken', 'creamy pasta', 'cauliflower gratin', 'brie']],
  ['08waibqt4hi2n41x', ['sushi', 'Thai food', 'foie gras', 'pork belly', 'soft cheese', 'apple tart', 'Alsatian choucroute', 'Vietnamese food']],
  ['wvfogdo76rkaz973', ['oysters', 'caviar', 'sushi', 'light canapés', 'soft cheese', 'fried chicken', 'fish and chips', 'cheese soufflé']],
  ['lifv2mbi908j4mds', ['blue cheese', 'dark chocolate truffles', 'crème brûlée', 'pecan pie', 'walnut tart', 'tiramisu', 'nuts and dried fruit']],
  ['wyny0s22qzafs1nb', ['beef tenderloin', 'braised oxtail', 'roasted lamb', 'duck breast', 'truffle risotto', 'wild mushroom pasta', 'aged parmesan']],
];

for (const [wineId, foods] of pairings) {
  for (const food of foods) {
    insertPairing.run(rid(), wineId, food);
  }
}

// ── Freezer locations ─────────────────────────────────────────────────────────
const flocs = ['Garage Freezer', 'Kitchen Freezer'];
const flocIds: Record<string, string> = {};
for (const name of flocs) {
  const fid = rid();
  flocIds[name] = fid;
  db.prepare(`INSERT INTO freezer_locations (id, profile_id, name, created_at) VALUES (?, ?, ?, datetime('now'))`).run(fid, PROFILE_ID, name);
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
  const fid = rid();
  const stored = daysAgo(fi.daysBack);
  insertFreezer.run(fid, PROFILE_ID, fi.cut, fi.primal, fi.qty, fi.wt, fi.loc, stored, addYear(stored), fi.price);
  insertFTx.run(rid(), fid, PROFILE_ID, fi.qty);
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
    insertRemoveTx.run(rid(), itemId, PROFILE_ID, qty, daysAgoISO(daysBack));
  }
}

db.close();
console.log(`Created ${DB_PATH}`);
console.log(`  15 wines with structural profiles`);
console.log(`  ${pairings.reduce((s, [, f]) => s + f.length, 0)} food pairings`);
console.log('Launch with: SQLITE_DB_PATH=./wine-sample.db npm run dev');
