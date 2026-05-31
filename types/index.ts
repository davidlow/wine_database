export type WineType =
  | 'red'
  | 'white'
  | 'rosé'
  | 'sparkling'
  | 'dessert'
  | 'fortified'
  | 'other';

export type TransactionType = 'add' | 'remove' | 'move';

export interface Wine {
  id: string;
  name: string;
  producer?: string;
  variety?: string;
  wine_type?: WineType;
  region?: string;
  appellation?: string;
  country?: string;
  vintage_year?: number;
  description?: string;
  average_price?: number;
  alcohol_content?: number;
  drink_from_year?: number;
  drink_by_year?: number;
  barcode?: string;
  image_url?: string;
  // Label photo: base64 WebP (no data: prefix) — omitted from list queries for performance
  label_image?: string;
  // Structural element scores 0–5 (0 = low, 5 = high)
  acidity?: number;
  tannin?: number;
  alcohol?: number;
  sweetness?: number;
  body?: number;
  fruit_profile?: string;
  created_at: string;
  updated_at: string;
}

// Five-dimension structural vector: [acidity, tannin, alcohol, sweetness, body]
export type WineStructureVector = [number, number, number, number, number];

export interface WineFoodPairing {
  id: string;
  wine_id: string;
  food: string;
  source: 'gemini' | 'manual';
  created_at: string;
}

export interface Profile {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  group_name?: string;
  created_at: string;
  updated_at: string;
}

// A named physical location (rack, fridge, shelf) with optional capacity.
// Rows in cellar_inventory reference these by name (within the same profile).
// Bottles with location='' are "unlocated" — received but not yet placed.
export interface Location {
  id: string;
  profile_id: string;
  name: string;
  group_name?: string;
  max_capacity?: number;
  notes?: string;
  created_at: string;
  updated_at: string;
  // Computed fields (populated by getLocations join)
  current_quantity?: number;
  available_capacity?: number;
}

export interface CellarInventory {
  id: string;
  wine_id: string;
  profile_id: string;
  location: string;  // '' = unlocated
  quantity: number;
  purchase_price?: number;
  purchase_date?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  wine?: Wine;
  profile?: Profile;
}

export interface BottleTransaction {
  id: string;
  wine_id?: string;
  profile_id?: string;
  cellar_inventory_id?: string;
  transaction_type: TransactionType;
  quantity: number;
  location?: string;
  notes?: string;
  created_at: string;
  wine?: Wine;
}

export type DrinkStatusFilter = 'past_peak' | 'too_young' | 'in_window';

export interface WineSearchParams {
  query?: string;
  variety?: string;        // partial match (LIKE) — includes autocomplete flow
  wine_type?: WineType;
  country?: string;
  region?: string;         // single exact-match region
  regions?: string;        // comma-separated multi-select (matches region OR appellation)
  appellation?: string;
  vintage_year?: number;
  producer?: string;
  profile_id?: string;
  // Comma-separated profile IDs — filters to wines in those profiles' inventories
  profile_ids?: string;
  // Drink window status filter
  drink_status?: DrinkStatusFilter;
  // Price range
  price_min?: number;
  price_max?: number;
  // Multi-level sort: comma-separated "field:dir" pairs, e.g. "drink_until:asc,price:desc"
  // Supported fields: name | producer | price | vintage | drink_from | drink_until | bottles
  sort?: string;
  // Structural score range filters (0–5 each)
  acidity_min?: number;
  acidity_max?: number;
  tannin_min?: number;
  tannin_max?: number;
  sweetness_min?: number;
  sweetness_max?: number;
  body_min?: number;
  body_max?: number;
  alcohol_str_min?: number;  // alcohol structural score (not ABV %)
  alcohol_str_max?: number;
}

export interface WineNote {
  id: string;
  wine_id: string;
  note: string;
  tasted_at?: string;
  created_at: string;
}

// One wine item extracted from a receipt or packing slip by Gemini
export interface ScannedWineItem {
  name: string;
  producer?: string;
  vintage_year?: number;
  variety?: string;
  wine_type?: string;
  quantity: number;
  unit_price?: number;
  confidence?: number;
}

export interface ProducerStats {
  producer: string;
  wine_count: number;
  bottle_count: number;
  transaction_count: number;
}

export interface AddBottleInput {
  wine_id: string;
  profile_id: string;
  location?: string;  // undefined/empty = unlocated (stored as '')
  quantity?: number;
  purchase_price?: number;
  purchase_date?: string;
  notes?: string;
}

export interface RemoveBottleInput {
  cellar_inventory_id: string;
  quantity: number;
  notes?: string;
}

export interface MoveBottleInput {
  cellar_inventory_id: string;
  new_location: string;
  quantity: number;
  notes?: string;
}

// One item in a bulk scan batch — after barcode lookup enrichment.
export interface BulkScanItem {
  barcode: string;
  quantity: number;
  wine_id?: string;        // set when the barcode already exists in the DB
  name?: string;
  producer?: string;
  vintage_year?: number;
  variety?: string;
  wine_type?: WineType;
  region?: string;
  appellation?: string;
  country?: string;
  description?: string;
  average_price?: number;
  drink_from_year?: number;
  drink_by_year?: number;
  purchase_price?: number;       // per-item override; pre-populated from average_price
  source?: 'database' | 'openfoodfacts' | 'gemini-batch' | 'manual';
  found?: boolean;
  confidence?: number;
}

export interface DbAdapter {
  // Wines
  getWines(params: WineSearchParams): Promise<Wine[]>;
  getWineById(id: string): Promise<Wine | null>;
  getWineByBarcode(barcode: string): Promise<Wine | null>;
  createWine(data: Omit<Wine, 'id' | 'created_at' | 'updated_at'>): Promise<Wine>;
  updateWine(id: string, data: Partial<Omit<Wine, 'id' | 'created_at' | 'updated_at'>>): Promise<Wine>;
  deleteWine(id: string): Promise<void>;

  // Profiles
  getProfiles(userId: string): Promise<Profile[]>;
  getProfileById(id: string, userId: string): Promise<Profile | null>;
  createProfile(data: Omit<Profile, 'id' | 'created_at' | 'updated_at'>): Promise<Profile>;
  updateProfile(id: string, userId: string, data: Partial<Omit<Profile, 'id' | 'created_at' | 'updated_at'>>): Promise<Profile>;
  deleteProfile(id: string, userId: string): Promise<void>;

  // Locations
  getLocations(profileId: string): Promise<Location[]>;
  createLocation(data: Omit<Location, 'id' | 'created_at' | 'updated_at' | 'current_quantity' | 'available_capacity'>): Promise<Location>;
  updateLocation(id: string, data: Partial<Pick<Location, 'name' | 'group_name' | 'max_capacity' | 'notes'>>): Promise<Location>;
  deleteLocation(id: string): Promise<void>;

  // Cellar inventory
  getCellarInventory(profileId: string, userId: string): Promise<CellarInventory[]>;
  getCellarInventoryByWine(wineId: string, profileId: string): Promise<CellarInventory[]>;
  addBottle(input: AddBottleInput, userId: string): Promise<CellarInventory>;
  updateBottleInventory(id: string, data: Partial<Pick<CellarInventory, 'location' | 'quantity' | 'purchase_price' | 'purchase_date' | 'notes'>>): Promise<CellarInventory>;
  removeBottle(input: RemoveBottleInput, userId: string): Promise<void>;
  moveBottle(input: MoveBottleInput, userId: string): Promise<void>;

  // Facets (distinct field values for autocomplete)
  getWineFacets(field: string, q: string): Promise<string[]>;

  // Transactions
  getTransactions(profileId: string, userId: string, limit?: number): Promise<BottleTransaction[]>;

  // Tasting notes
  getWineNotes(wineId: string): Promise<WineNote[]>;
  addWineNote(wineId: string, note: string, tastedAt?: string): Promise<WineNote>;
  deleteWineNote(noteId: string): Promise<void>;

  // Producers
  getProducers(): Promise<ProducerStats[]>;
  getProducerWines(producer: string): Promise<(Wine & { transaction_count: number; bottle_count: number })[]>;

  // Food pairings
  getFoodPairings(wineId: string): Promise<WineFoodPairing[]>;
  addFoodPairing(wineId: string, food: string, source: 'gemini' | 'manual'): Promise<WineFoodPairing>;
  deleteFoodPairing(id: string): Promise<void>;
  getWinesWithPairings(foods: string[]): Promise<Wine[]>;
  getAllFoods(): Promise<string[]>;
}
