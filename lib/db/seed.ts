import { sqliteAdapter, closeSqliteDb } from './sqlite';

const DEV_USER_ID = 'dev-user-id';

async function seed() {
  console.log('Seeding database...');

  // Profiles
  const home = await sqliteAdapter.createProfile({ user_id: DEV_USER_ID, name: 'Home', description: 'Main residence wine cellar' });
  const vacation = await sqliteAdapter.createProfile({ user_id: DEV_USER_ID, name: 'Vacation Home', description: 'Mountain cabin collection' });
  const testing = await sqliteAdapter.createProfile({ user_id: DEV_USER_ID, name: 'Testing', description: 'Automated test profile' });

  console.log('Created profiles:', home.name, vacation.name, testing.name);

  // Wines
  const cab = await sqliteAdapter.createWine({
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
    barcode: '0012345678901',
    description: 'Bordeaux-style blend, dark fruit with cedar and spice.',
  });

  const chard = await sqliteAdapter.createWine({
    name: 'Far Niente Chardonnay',
    producer: 'Far Niente Winery',
    variety: 'Chardonnay',
    wine_type: 'white',
    region: 'Napa Valley',
    appellation: 'Napa Valley',
    country: 'USA',
    vintage_year: 2021,
    average_price: 65,
    alcohol_content: 13.8,
    barcode: '0012345678902',
  });

  const champagne = await sqliteAdapter.createWine({
    name: 'Dom Pérignon Vintage',
    producer: 'Moët & Chandon',
    variety: 'Chardonnay/Pinot Noir',
    wine_type: 'sparkling',
    region: 'Champagne',
    appellation: 'Épernay',
    country: 'France',
    vintage_year: 2013,
    average_price: 220,
    alcohol_content: 12.5,
    barcode: '0012345678903',
  });

  const pinot = await sqliteAdapter.createWine({
    name: 'Domaine de la Romanée-Conti',
    producer: 'DRC',
    variety: 'Pinot Noir',
    wine_type: 'red',
    region: 'Burgundy',
    appellation: 'Romanée-Conti',
    country: 'France',
    vintage_year: 2018,
    average_price: 4500,
    alcohol_content: 13.0,
  });

  const testWine = await sqliteAdapter.createWine({
    name: 'Test Merlot',
    producer: 'Test Winery',
    variety: 'Merlot',
    wine_type: 'red',
    region: 'California',
    country: 'USA',
    vintage_year: 2020,
    average_price: 25,
    barcode: '9999999999999',
  });

  console.log('Created wines:', cab.name, chard.name, champagne.name, pinot.name, testWine.name);

  // Inventory — Home
  await sqliteAdapter.addBottle({ wine_id: cab.id, profile_id: home.id, location: 'Rack A, Row 1, Slot 1', quantity: 3, purchase_price: 370 }, DEV_USER_ID);
  await sqliteAdapter.addBottle({ wine_id: chard.id, profile_id: home.id, location: 'Rack A, Row 2, Slot 1', quantity: 6, purchase_price: 60 }, DEV_USER_ID);
  await sqliteAdapter.addBottle({ wine_id: champagne.id, profile_id: home.id, location: 'Fridge, Shelf 1', quantity: 2, purchase_price: 210 }, DEV_USER_ID);
  await sqliteAdapter.addBottle({ wine_id: pinot.id, profile_id: home.id, location: 'Rack B, Row 1, Slot 1', quantity: 1, purchase_price: 4200 }, DEV_USER_ID);

  // Inventory — Vacation
  await sqliteAdapter.addBottle({ wine_id: cab.id, profile_id: vacation.id, location: 'Cabinet, Shelf 1', quantity: 2 }, DEV_USER_ID);
  await sqliteAdapter.addBottle({ wine_id: champagne.id, profile_id: vacation.id, location: 'Fridge', quantity: 1 }, DEV_USER_ID);

  // Inventory — Testing
  await sqliteAdapter.addBottle({ wine_id: testWine.id, profile_id: testing.id, location: 'Test Rack, Slot 1', quantity: 5 }, DEV_USER_ID);

  console.log('Inventory seeded successfully.');
  closeSqliteDb();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
