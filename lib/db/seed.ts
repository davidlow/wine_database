import { sqliteAdapter, closeSqliteDb } from './sqlite';

const DEV_USER_ID = 'dev-user-id';
const CURRENT_YEAR = new Date().getFullYear();

async function seed() {
  console.log('Seeding database...');

  // ── Cellars (Profiles) ──────────────────────────────────────────────────────
  const home = await sqliteAdapter.createProfile({
    user_id: DEV_USER_ID,
    name: 'Home',
    description: 'Main residence cellar – under the stairs',
    group_name: 'Production',
  });
  const vacation = await sqliteAdapter.createProfile({
    user_id: DEV_USER_ID,
    name: 'Vacation Home',
    description: 'Mountain cabin – compact collection',
    group_name: 'Production',
  });
  const testing = await sqliteAdapter.createProfile({
    user_id: DEV_USER_ID,
    name: 'Testing',
    description: 'Automated test data – safe to delete',
    group_name: 'Testing',
  });

  console.log('Profiles:', home.name, vacation.name, testing.name);

  // ── Named Locations ─────────────────────────────────────────────────────────
  await sqliteAdapter.createLocation({ profile_id: home.id, name: 'Stair Rack A', group_name: 'Stair Rack', max_capacity: 24 });
  await sqliteAdapter.createLocation({ profile_id: home.id, name: 'Stair Rack B', group_name: 'Stair Rack', max_capacity: 24 });
  await sqliteAdapter.createLocation({ profile_id: home.id, name: 'Wine Fridge', group_name: 'Fridge', max_capacity: 12 });
  await sqliteAdapter.createLocation({ profile_id: home.id, name: 'Display Shelf', max_capacity: 6 });

  await sqliteAdapter.createLocation({ profile_id: vacation.id, name: 'Kitchen Cabinet', max_capacity: 8 });
  await sqliteAdapter.createLocation({ profile_id: vacation.id, name: 'Garage Rack', max_capacity: 20 });

  await sqliteAdapter.createLocation({ profile_id: testing.id, name: 'Test Rack 1', group_name: 'Test Group', max_capacity: 10 });
  await sqliteAdapter.createLocation({ profile_id: testing.id, name: 'Test Rack 2', group_name: 'Test Group', max_capacity: 10 });

  // ── Wines ───────────────────────────────────────────────────────────────────

  // ── Reds ──
  const opusOne = await sqliteAdapter.createWine({
    name: 'Opus One',
    producer: 'Opus One Winery',
    variety: 'Cabernet Sauvignon Blend',
    wine_type: 'red',
    region: 'Napa Valley',
    appellation: 'Oakville',
    country: 'USA',
    vintage_year: 2019,
    average_price: 380,
    alcohol_content: 14.5,
    drink_from_year: 2025,
    drink_by_year: 2045,
    barcode: '0012345678901',
    description: 'Bordeaux-style blend, dark fruit with cedar and spice.',
  });

  const drc = await sqliteAdapter.createWine({
    name: 'Romanée-Conti',
    producer: 'Domaine de la Romanée-Conti',
    variety: 'Pinot Noir',
    wine_type: 'red',
    region: 'Burgundy',
    appellation: 'Romanée-Conti Grand Cru',
    country: 'France',
    vintage_year: 2018,
    average_price: 4500,
    alcohol_content: 13.0,
    drink_from_year: 2026,
    drink_by_year: 2050,
    description: 'The most celebrated Burgundy, silky and profound.',
  });

  const sassicaia = await sqliteAdapter.createWine({
    name: 'Sassicaia',
    producer: 'Tenuta San Guido',
    variety: 'Cabernet Sauvignon / Cabernet Franc',
    wine_type: 'red',
    region: 'Tuscany',
    appellation: 'Bolgheri Sassicaia DOC',
    country: 'Italy',
    vintage_year: 2020,
    average_price: 225,
    alcohol_content: 14.0,
    drink_from_year: 2026,
    drink_by_year: 2040,
    barcode: '0012345678904',
    description: 'Italy\'s iconic "Super Tuscan", elegant and structured.',
  });

  const caymus = await sqliteAdapter.createWine({
    name: 'Caymus Special Selection Cabernet Sauvignon',
    producer: 'Caymus Vineyards',
    variety: 'Cabernet Sauvignon',
    wine_type: 'red',
    region: 'Napa Valley',
    appellation: 'Napa Valley',
    country: 'USA',
    vintage_year: 2021,
    average_price: 120,
    alcohol_content: 14.8,
    drink_from_year: 2024,
    drink_by_year: 2035,
    barcode: '0012345678905',
    description: 'Rich, ripe Napa Cab with velvety tannins.',
  });

  const merlotOverhillPeak = await sqliteAdapter.createWine({
    name: 'Overhill Peak Merlot',
    producer: 'Overhill Peak Winery',
    variety: 'Merlot',
    wine_type: 'red',
    region: 'Sonoma',
    appellation: 'Alexander Valley',
    country: 'USA',
    vintage_year: 2018,
    average_price: 42,
    alcohol_content: 14.2,
    // drink_by_year in the past → "past peak" test case
    drink_from_year: 2020,
    drink_by_year: CURRENT_YEAR - 1,
    barcode: '0012345678906',
    description: 'Plum and chocolate, now past its peak – drink up.',
  });

  const pinotArgentina = await sqliteAdapter.createWine({
    name: 'Achaval Ferrer Malbec',
    producer: 'Achaval Ferrer',
    variety: 'Malbec',
    wine_type: 'red',
    region: 'Mendoza',
    appellation: 'Luján de Cuyo',
    country: 'Argentina',
    vintage_year: 2022,
    average_price: 28,
    alcohol_content: 14.5,
    drink_from_year: 2024,
    drink_by_year: CURRENT_YEAR + 8,
    barcode: '0012345678910',
    description: 'Deep violet, ripe blackberry and mocha.',
  });

  // ── Whites ──
  const farNieteChardonay = await sqliteAdapter.createWine({
    name: 'Far Niente Chardonnay',
    producer: 'Far Niente Winery',
    variety: 'Chardonnay',
    wine_type: 'white',
    region: 'Napa Valley',
    appellation: 'Napa Valley',
    country: 'USA',
    vintage_year: 2022,
    average_price: 65,
    alcohol_content: 13.8,
    drink_from_year: 2023,
    drink_by_year: CURRENT_YEAR + 3,
    barcode: '0012345678902',
    description: 'Rich and creamy with vanilla, toasted oak and fresh apple.',
  });

  const rachelsBurg = await sqliteAdapter.createWine({
    name: 'Trimbach Riesling Clos Ste Hune',
    producer: 'Trimbach',
    variety: 'Riesling',
    wine_type: 'white',
    region: 'Alsace',
    appellation: 'Alsace Grand Cru',
    country: 'France',
    vintage_year: 2017,
    average_price: 180,
    alcohol_content: 12.5,
    drink_from_year: 2027,
    drink_by_year: 2045,
    description: 'Iconic dry Alsatian Riesling, still too young to drink.',
  });

  const sauvBlanc = await sqliteAdapter.createWine({
    name: 'Cloudy Bay Sauvignon Blanc',
    producer: 'Cloudy Bay',
    variety: 'Sauvignon Blanc',
    wine_type: 'white',
    region: 'Marlborough',
    appellation: 'Marlborough',
    country: 'New Zealand',
    vintage_year: 2023,
    average_price: 22,
    alcohol_content: 13.0,
    drink_from_year: CURRENT_YEAR,
    drink_by_year: CURRENT_YEAR + 2,
    barcode: '0012345678907',
    description: 'Zesty, crisp with gooseberry and fresh lime.',
  });

  // ── Sparkling ──
  const domPerignon = await sqliteAdapter.createWine({
    name: 'Dom Pérignon Vintage',
    producer: 'Moët & Chandon',
    variety: 'Chardonnay / Pinot Noir',
    wine_type: 'sparkling',
    region: 'Champagne',
    appellation: 'Champagne AOC',
    country: 'France',
    vintage_year: 2013,
    average_price: 220,
    alcohol_content: 12.5,
    drink_from_year: 2023,
    drink_by_year: 2033,
    barcode: '0012345678903',
    description: 'Creamy, complex vintage Champagne with exceptional depth.',
  });

  const prosecco = await sqliteAdapter.createWine({
    name: 'Bisol Crede Prosecco',
    producer: 'Bisol',
    variety: 'Glera',
    wine_type: 'sparkling',
    region: 'Veneto',
    appellation: 'Prosecco di Valdobbiadene DOCG',
    country: 'Italy',
    vintage_year: 2023,
    average_price: 18,
    alcohol_content: 11.5,
    drink_from_year: CURRENT_YEAR,
    drink_by_year: CURRENT_YEAR + 2,
    barcode: '0012345678908',
    description: 'Fresh and fruity, ideal as an aperitif.',
  });

  // ── Rosé ──
  const minuty = await sqliteAdapter.createWine({
    name: 'Château Minuty Rosé',
    producer: 'Château Minuty',
    variety: 'Grenache / Cinsault',
    wine_type: 'rosé',
    region: 'Provence',
    appellation: 'Côtes de Provence',
    country: 'France',
    vintage_year: 2023,
    average_price: 32,
    alcohol_content: 13.0,
    drink_from_year: CURRENT_YEAR,
    drink_by_year: CURRENT_YEAR + 2,
    barcode: '0012345678909',
    description: 'Pale salmon, delicate and fresh Provence rosé.',
  });

  // ── Dessert ──
  const sauternes = await sqliteAdapter.createWine({
    name: "Château d'Yquem",
    producer: "Château d'Yquem",
    variety: 'Sémillon / Sauvignon Blanc',
    wine_type: 'dessert',
    region: 'Bordeaux',
    appellation: 'Sauternes AOC',
    country: 'France',
    vintage_year: 2015,
    average_price: 320,
    alcohol_content: 13.5,
    drink_from_year: 2025,
    drink_by_year: 2075,
    description: 'World\'s greatest sweet wine, honeyed and complex.',
  });

  // ── Testing wine ──
  const testWine = await sqliteAdapter.createWine({
    name: 'Test Merlot',
    producer: 'Test Winery',
    variety: 'Merlot',
    wine_type: 'red',
    region: 'California',
    country: 'USA',
    vintage_year: 2020,
    average_price: 25,
    drink_from_year: CURRENT_YEAR,
    drink_by_year: CURRENT_YEAR + 5,
    barcode: '9999999999999',
    description: 'Test wine for automated testing.',
  });

  // Expiring VERY soon (within 2 years) – for the dashboard expiry section
  const expiringSoonWine = await sqliteAdapter.createWine({
    name: 'Valley Glen Pinot Noir',
    producer: 'Valley Glen',
    variety: 'Pinot Noir',
    wine_type: 'red',
    region: 'Oregon',
    appellation: 'Willamette Valley',
    country: 'USA',
    vintage_year: 2019,
    average_price: 48,
    drink_from_year: 2022,
    drink_by_year: CURRENT_YEAR + 1,
    description: 'Drinking well now, finish within a year.',
  });

  // Too young – for the dashboard too-young section
  const tooYoungWine = await sqliteAdapter.createWine({
    name: 'Barolo Gran Riserva',
    producer: 'Giacomo Conterno',
    variety: 'Nebbiolo',
    wine_type: 'red',
    region: 'Piedmont',
    appellation: 'Barolo DOCG',
    country: 'Italy',
    vintage_year: 2020,
    average_price: 280,
    drink_from_year: CURRENT_YEAR + 5,
    drink_by_year: CURRENT_YEAR + 30,
    description: 'Needs years of cellaring, do not open yet.',
  });

  console.log('Created', 17, 'wines');

  // ── Home cellar inventory ────────────────────────────────────────────────────
  await sqliteAdapter.addBottle({ wine_id: opusOne.id, profile_id: home.id, location: 'Stair Rack A', quantity: 6, purchase_price: 370, purchase_date: '2023-05-10' }, DEV_USER_ID);
  await sqliteAdapter.addBottle({ wine_id: drc.id, profile_id: home.id, location: 'Display Shelf', quantity: 1, purchase_price: 4200 }, DEV_USER_ID);
  await sqliteAdapter.addBottle({ wine_id: sassicaia.id, profile_id: home.id, location: 'Stair Rack A', quantity: 4, purchase_price: 210, purchase_date: '2024-01-15' }, DEV_USER_ID);
  await sqliteAdapter.addBottle({ wine_id: caymus.id, profile_id: home.id, location: 'Stair Rack B', quantity: 3, purchase_price: 115 }, DEV_USER_ID);
  await sqliteAdapter.addBottle({ wine_id: farNieteChardonay.id, profile_id: home.id, location: 'Wine Fridge', quantity: 5, purchase_price: 60, purchase_date: '2024-06-01' }, DEV_USER_ID);
  await sqliteAdapter.addBottle({ wine_id: domPerignon.id, profile_id: home.id, location: 'Wine Fridge', quantity: 2, purchase_price: 210 }, DEV_USER_ID);
  await sqliteAdapter.addBottle({ wine_id: minuty.id, profile_id: home.id, location: 'Wine Fridge', quantity: 4, purchase_price: 30 }, DEV_USER_ID);
  await sqliteAdapter.addBottle({ wine_id: sauternes.id, profile_id: home.id, location: 'Display Shelf', quantity: 1, purchase_price: 310 }, DEV_USER_ID);
  await sqliteAdapter.addBottle({ wine_id: pinotArgentina.id, profile_id: home.id, location: 'Stair Rack B', quantity: 6, purchase_price: 25 }, DEV_USER_ID);
  // Expiry test cases
  await sqliteAdapter.addBottle({ wine_id: merlotOverhillPeak.id, profile_id: home.id, location: 'Stair Rack B', quantity: 3, purchase_price: 38 }, DEV_USER_ID);
  await sqliteAdapter.addBottle({ wine_id: expiringSoonWine.id, profile_id: home.id, location: 'Stair Rack A', quantity: 2, purchase_price: 45 }, DEV_USER_ID);
  await sqliteAdapter.addBottle({ wine_id: tooYoungWine.id, profile_id: home.id, location: 'Stair Rack B', quantity: 2, purchase_price: 265 }, DEV_USER_ID);
  // Unlocated bottle (received, not yet placed)
  await sqliteAdapter.addBottle({ wine_id: prosecco.id, profile_id: home.id, location: '', quantity: 3, purchase_price: 17 }, DEV_USER_ID);

  // ── Vacation cellar inventory ────────────────────────────────────────────────
  await sqliteAdapter.addBottle({ wine_id: opusOne.id, profile_id: vacation.id, location: 'Garage Rack', quantity: 2 }, DEV_USER_ID);
  await sqliteAdapter.addBottle({ wine_id: sauvBlanc.id, profile_id: vacation.id, location: 'Kitchen Cabinet', quantity: 6, purchase_price: 20 }, DEV_USER_ID);
  await sqliteAdapter.addBottle({ wine_id: prosecco.id, profile_id: vacation.id, location: 'Kitchen Cabinet', quantity: 4, purchase_price: 17 }, DEV_USER_ID);
  await sqliteAdapter.addBottle({ wine_id: domPerignon.id, profile_id: vacation.id, location: 'Garage Rack', quantity: 1, purchase_price: 205 }, DEV_USER_ID);
  await sqliteAdapter.addBottle({ wine_id: rachelsBurg.id, profile_id: vacation.id, location: 'Garage Rack', quantity: 3, purchase_price: 170 }, DEV_USER_ID);
  await sqliteAdapter.addBottle({ wine_id: minuty.id, profile_id: vacation.id, location: 'Kitchen Cabinet', quantity: 2 }, DEV_USER_ID);

  // ── Testing cellar inventory ─────────────────────────────────────────────────
  await sqliteAdapter.addBottle({ wine_id: testWine.id, profile_id: testing.id, location: 'Test Rack 1', quantity: 5, purchase_price: 22 }, DEV_USER_ID);
  await sqliteAdapter.addBottle({ wine_id: caymus.id, profile_id: testing.id, location: 'Test Rack 2', quantity: 2 }, DEV_USER_ID);

  console.log('Inventory seeded successfully.');
  console.log('');
  console.log('Summary:');
  const homeInv = await sqliteAdapter.getCellarInventory(home.id, DEV_USER_ID);
  const vacInv = await sqliteAdapter.getCellarInventory(vacation.id, DEV_USER_ID);
  const testInv = await sqliteAdapter.getCellarInventory(testing.id, DEV_USER_ID);
  console.log(`  Home: ${homeInv.reduce((s, i) => s + i.quantity, 0)} bottles, ${new Set(homeInv.map(i => i.wine_id)).size} wines`);
  console.log(`  Vacation: ${vacInv.reduce((s, i) => s + i.quantity, 0)} bottles, ${new Set(vacInv.map(i => i.wine_id)).size} wines`);
  console.log(`  Testing: ${testInv.reduce((s, i) => s + i.quantity, 0)} bottles, ${new Set(testInv.map(i => i.wine_id)).size} wines`);
  closeSqliteDb();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
