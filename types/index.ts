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
  barcode?: string;
  image_url?: string;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface CellarInventory {
  id: string;
  wine_id: string;
  profile_id: string;
  location: string;
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

export interface WineSearchParams {
  query?: string;
  variety?: string;
  wine_type?: WineType;
  country?: string;
  region?: string;
  vintage_year?: number;
  producer?: string;
  profile_id?: string;
}

export interface AddBottleInput {
  wine_id: string;
  profile_id: string;
  location: string;
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

  // Cellar inventory
  getCellarInventory(profileId: string, userId: string): Promise<CellarInventory[]>;
  getCellarInventoryByWine(wineId: string, profileId: string): Promise<CellarInventory[]>;
  addBottle(input: AddBottleInput, userId: string): Promise<CellarInventory>;
  updateBottleInventory(id: string, data: Partial<Pick<CellarInventory, 'location' | 'quantity' | 'purchase_price' | 'purchase_date' | 'notes'>>): Promise<CellarInventory>;
  removeBottle(input: RemoveBottleInput, userId: string): Promise<void>;

  // Transactions
  getTransactions(profileId: string, userId: string, limit?: number): Promise<BottleTransaction[]>;
}
