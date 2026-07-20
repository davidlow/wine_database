import type {
  DbAdapter,
  Wine,
  Profile,
  CellarInventory,
  CellarShare,
  BottleTransaction,
  Location,
  LocationGroup,
  WineNote,
  WineSearchParams,
  AddBottleInput,
  RemoveBottleInput,
  MoveBottleInput,
  WineFoodPairing,
  WineCuisineTag,
  CuisineTag,
  FreezerItem,
  FreezerTransaction,
  FreezerLocation,
  AddFreezerInput,
  PantryItem,
  PantryTransaction,
  AddPantryInput,
  PantryUsageSetting,
} from '@/types';
import { generateId } from '@/lib/utils';
import { createClient } from '@supabase/supabase-js';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export const supabaseAdapter: DbAdapter = {
  // --- Wines ---

  async getWines(params: WineSearchParams): Promise<Wine[]> {
    const supabase = getSupabaseAdmin();
    let query = supabase.from('wines').select('*');

    if (params.query) {
      query = query.or(
        `name.ilike.%${params.query}%,producer.ilike.%${params.query}%,variety.ilike.%${params.query}%,region.ilike.%${params.query}%,country.ilike.%${params.query}%,barcode.ilike.%${params.query}%`
      );
    }
    // variety: partial match so "cab" finds Cabernet Sauvignon, Cab Franc, etc.
    if (params.variety) query = query.ilike('variety', `%${params.variety}%`);
    if (params.wine_type) query = query.eq('wine_type', params.wine_type);
    if (params.country) query = query.eq('country', params.country);
    if (params.region) query = query.eq('region', params.region);
    if (params.appellation) query = query.ilike('appellation', `%${params.appellation}%`);
    if (params.vintage_year) query = query.eq('vintage_year', params.vintage_year);
    if (params.producer) query = query.ilike('producer', `%${params.producer}%`);
    if (params.price_min != null) query = query.gte('average_price', params.price_min);
    if (params.price_max != null) query = query.lte('average_price', params.price_max);
    if (params.acidity_min != null) query = query.gte('acidity', params.acidity_min);
    if (params.acidity_max != null) query = query.lte('acidity', params.acidity_max);
    if (params.tannin_min != null) query = query.gte('tannin', params.tannin_min);
    if (params.tannin_max != null) query = query.lte('tannin', params.tannin_max);
    if (params.sweetness_min != null) query = query.gte('sweetness', params.sweetness_min);
    if (params.sweetness_max != null) query = query.lte('sweetness', params.sweetness_max);
    if (params.body_min != null) query = query.gte('body', params.body_min);
    if (params.body_max != null) query = query.lte('body', params.body_max);
    if (params.alcohol_str_min != null) query = query.gte('alcohol', params.alcohol_str_min);
    if (params.alcohol_str_max != null) query = query.lte('alcohol', params.alcohol_str_max);

    // Multi-select regions
    if (params.regions) {
      const regionList = params.regions.split(',').map(s => s.trim()).filter(Boolean);
      if (regionList.length > 0) {
        const regionOr = regionList.map(r => `region.eq.${r}`).join(',');
        const appellationOr = regionList.map(r => `appellation.eq.${r}`).join(',');
        query = query.or(`${regionOr},${appellationOr}`);
      }
    }

    // Apply sort — Supabase supports column-level order; bottles subquery done client-side
    const SUPABASE_SORT_COLS: Record<string, string> = {
      name: 'name', producer: 'producer', price: 'average_price',
      vintage: 'vintage_year', drink_from: 'drink_from_year', drink_until: 'drink_by_year',
    };
    let needsBottleSort = false;
    let bottleSortDir: 'asc' | 'desc' = 'desc';
    if (params.sort) {
      const keys = params.sort.split(',').map(s => s.trim()).filter(Boolean);
      for (const key of keys) {
        const [field, rawDir] = key.split(':');
        const ascending = rawDir !== 'desc';
        if (field === 'bottles') { needsBottleSort = true; bottleSortDir = ascending ? 'asc' : 'desc'; }
        else {
          const col = SUPABASE_SORT_COLS[field];
          if (col) query = query.order(col, { ascending, nullsFirst: false });
        }
      }
    } else {
      query = query.order('name');
    }

    const { data, error } = await query;
    if (error) throw error;
    let result = data as Wine[];

    if (needsBottleSort) {
      // Fetch bottle counts, then sort client-side
      const { data: inv } = await getSupabaseAdmin()
        .from('cellar_inventory').select('wine_id, quantity').gt('quantity', 0);
      const bottleCounts = new Map<string, number>();
      for (const row of inv ?? []) {
        bottleCounts.set(row.wine_id, (bottleCounts.get(row.wine_id) ?? 0) + (row.quantity as number));
      }
      result = result.sort((a, b) => {
        const diff = (bottleCounts.get(a.id) ?? 0) - (bottleCounts.get(b.id) ?? 0);
        return bottleSortDir === 'asc' ? diff : -diff;
      });
    }
    return result;
  },

  async getWineById(id: string): Promise<Wine | null> {
    const { data, error } = await getSupabaseAdmin().from('wines').select('*').eq('id', id).single();
    if (error) return null;
    return data as Wine;
  },

  async getWineByBarcode(barcode: string): Promise<Wine | null> {
    const { data, error } = await getSupabaseAdmin().from('wines').select('*').eq('barcode', barcode).single();
    if (error) return null;
    return data as Wine;
  },

  async createWine(data): Promise<Wine> {
    const now = new Date().toISOString();
    const wine: Wine = { ...data, id: generateId(), created_at: now, updated_at: now };
    const { data: created, error } = await getSupabaseAdmin().from('wines').insert(wine).select().single();
    if (error) throw error;
    return created as Wine;
  },

  async updateWine(id, data): Promise<Wine> {
    const { data: updated, error } = await getSupabaseAdmin()
      .from('wines')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return updated as Wine;
  },

  async deleteWine(id): Promise<void> {
    const { error } = await getSupabaseAdmin().from('wines').delete().eq('id', id);
    if (error) throw error;
  },

  // --- Profiles ---

  async getProfiles(userId: string): Promise<Profile[]> {
    const admin = getSupabaseAdmin();
    const [ownedRes, sharesRes] = await Promise.all([
      admin.from('profiles').select('*').eq('user_id', userId).order('name'),
      admin.from('cellar_shares').select('*').eq('shared_with_user_id', userId),
    ]);
    const owned = (ownedRes.data ?? []).map((p: Profile) => ({ ...p, is_owner: true, permission: 'owner' as const }));
    const sharedProfileIds = (sharesRes.data ?? []).map((s: CellarShare) => s.profile_id);
    let sharedProfiles: Profile[] = [];
    if (sharedProfileIds.length > 0) {
      const { data: profileData } = await admin.from('profiles').select('*').in('id', sharedProfileIds);
      const shareMap = new Map((sharesRes.data ?? []).map((s: CellarShare) => [s.profile_id, s.permission]));
      sharedProfiles = (profileData ?? []).map((p: Profile) => ({
        ...p,
        is_owner: false,
        permission: shareMap.get(p.id) as 'read' | 'write',
      }));
    }
    return [...owned, ...sharedProfiles].sort((a, b) => a.name.localeCompare(b.name));
  },

  async getProfileById(id: string, userId: string): Promise<Profile | null> {
    const admin = getSupabaseAdmin();
    const { data: owned } = await admin.from('profiles').select('*').eq('id', id).eq('user_id', userId).single();
    if (owned) return { ...owned, is_owner: true, permission: 'owner' } as Profile;
    const { data: share } = await admin.from('cellar_shares').select('*').eq('profile_id', id).eq('shared_with_user_id', userId).single();
    if (share) {
      const { data: profile } = await admin.from('profiles').select('*').eq('id', id).single();
      if (profile) return { ...profile, is_owner: false, permission: (share as CellarShare).permission } as Profile;
    }
    return null;
  },

  async createProfile(data): Promise<Profile> {
    const now = new Date().toISOString();
    const profile: Profile = { ...data, id: generateId(), created_at: now, updated_at: now };
    const { data: created, error } = await getSupabaseAdmin().from('profiles').insert(profile).select().single();
    if (error) throw error;
    return created as Profile;
  },

  async updateProfile(id, userId, data): Promise<Profile> {
    const { data: updated, error } = await getSupabaseAdmin()
      .from('profiles')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();
    if (error) throw error;
    return updated as Profile;
  },

  async deleteProfile(id, userId): Promise<void> {
    const { error } = await getSupabaseAdmin().from('profiles').delete().eq('id', id).eq('user_id', userId);
    if (error) throw error;
  },

  // --- Cellar ---

  async getCellarInventory(profileId: string, _userId: string): Promise<CellarInventory[]> {
    const { data, error } = await getSupabaseAdmin()
      .from('cellar_inventory')
      .select('*, wine:wines(*)')
      .eq('profile_id', profileId)
      .gt('quantity', 0)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data as CellarInventory[];
  },

  async getCellarInventoryByWine(wineId: string, profileId: string): Promise<CellarInventory[]> {
    const { data, error } = await getSupabaseAdmin()
      .from('cellar_inventory')
      .select('*')
      .eq('wine_id', wineId)
      .eq('profile_id', profileId)
      .gt('quantity', 0);
    if (error) throw error;
    return data as CellarInventory[];
  },

  async addBottle(input: AddBottleInput, _userId: string): Promise<CellarInventory> {
    const supabase = getSupabaseAdmin();
    const qty = input.quantity ?? 1;
    const now = new Date().toISOString();

    const { data: existing } = await supabase
      .from('cellar_inventory')
      .select('*')
      .eq('wine_id', input.wine_id)
      .eq('profile_id', input.profile_id)
      .eq('location', input.location)
      .single();

    if (existing) {
      const { data: updated, error } = await supabase
        .from('cellar_inventory')
        .update({ quantity: existing.quantity + qty, updated_at: now })
        .eq('id', existing.id)
        .select()
        .single();
      if (error) throw error;

      await supabase.from('bottle_transactions').insert({
        id: generateId(), wine_id: input.wine_id, profile_id: input.profile_id,
        cellar_inventory_id: existing.id, transaction_type: 'add', quantity: qty,
        location: input.location, created_at: now,
      });

      return updated as CellarInventory;
    }

    const inventory = {
      id: generateId(), ...input, quantity: qty, created_at: now, updated_at: now,
    };

    const { data: created, error } = await supabase.from('cellar_inventory').insert(inventory).select().single();
    if (error) throw error;

    await supabase.from('bottle_transactions').insert({
      id: generateId(), wine_id: input.wine_id, profile_id: input.profile_id,
      cellar_inventory_id: created.id, transaction_type: 'add', quantity: qty,
      location: input.location, created_at: now,
    });

    return created as CellarInventory;
  },

  async updateBottleInventory(id, data): Promise<CellarInventory> {
    const { data: updated, error } = await getSupabaseAdmin()
      .from('cellar_inventory')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return updated as CellarInventory;
  },

  async removeBottle(input: RemoveBottleInput, _userId: string): Promise<void> {
    const supabase = getSupabaseAdmin();
    const { data: existing, error: fetchErr } = await supabase
      .from('cellar_inventory')
      .select('*')
      .eq('id', input.cellar_inventory_id)
      .single();
    if (fetchErr || !existing) throw new Error('Inventory item not found');
    if (input.quantity > existing.quantity) throw new Error('Cannot remove more bottles than available');

    const now = new Date().toISOString();
    const { error: updateErr } = await supabase
      .from('cellar_inventory')
      .update({ quantity: existing.quantity - input.quantity, updated_at: now })
      .eq('id', input.cellar_inventory_id);
    if (updateErr) throw updateErr;

    await supabase.from('bottle_transactions').insert({
      id: generateId(), wine_id: existing.wine_id, profile_id: existing.profile_id,
      cellar_inventory_id: input.cellar_inventory_id, transaction_type: 'remove',
      quantity: input.quantity, location: existing.location, notes: input.notes ?? null, created_at: now,
    });
  },

  async moveBottle(input: MoveBottleInput, _userId: string): Promise<void> {
    const supabase = getSupabaseAdmin();
    const { data: existing, error: fetchErr } = await supabase
      .from('cellar_inventory').select('*').eq('id', input.cellar_inventory_id).single();
    if (fetchErr || !existing) throw new Error('Inventory item not found');
    if (input.quantity > existing.quantity) throw new Error('Cannot move more bottles than available');

    const now = new Date().toISOString();
    const remainingQty = existing.quantity - input.quantity;

    if (remainingQty > 0) {
      await supabase.from('cellar_inventory')
        .update({ quantity: remainingQty, updated_at: now })
        .eq('id', input.cellar_inventory_id);
    } else {
      await supabase.from('cellar_inventory').delete().eq('id', input.cellar_inventory_id);
    }

    const { data: dest } = await supabase.from('cellar_inventory').select('*')
      .eq('wine_id', existing.wine_id).eq('profile_id', existing.profile_id)
      .eq('location', input.new_location).single();

    if (dest) {
      await supabase.from('cellar_inventory')
        .update({ quantity: dest.quantity + input.quantity, updated_at: now })
        .eq('id', dest.id);
    } else {
      await supabase.from('cellar_inventory').insert({
        id: generateId(), wine_id: existing.wine_id, profile_id: existing.profile_id,
        location: input.new_location, quantity: input.quantity,
        purchase_price: existing.purchase_price, created_at: now, updated_at: now,
      });
    }

    await supabase.from('bottle_transactions').insert({
      id: generateId(), wine_id: existing.wine_id, profile_id: existing.profile_id,
      cellar_inventory_id: input.cellar_inventory_id, transaction_type: 'move',
      quantity: input.quantity, location: input.new_location,
      notes: input.notes ?? null, created_at: now,
    });
  },

  // --- Locations ---

  async getLocations(profileId: string): Promise<Location[]> {
    const { data, error } = await getSupabaseAdmin()
      .from('locations').select('*').eq('profile_id', profileId).order('name');
    if (error) throw error;
    return (data as Location[]).map(loc => ({ ...loc }));
  },

  async createLocation(data): Promise<Location> {
    const now = new Date().toISOString();
    const loc: Location = { ...data, id: generateId(), created_at: now, updated_at: now };
    const { data: created, error } = await getSupabaseAdmin()
      .from('locations').insert(loc).select().single();
    if (error) throw error;
    return created as Location;
  },

  async updateLocation(id, data): Promise<Location> {
    const patch = { ...data, group_name: data.group_name ?? null, updated_at: new Date().toISOString() };
    const { data: updated, error } = await getSupabaseAdmin()
      .from('locations')
      .update(patch)
      .eq('id', id).select().single();
    if (error) throw error;
    return updated as Location;
  },

  async deleteLocation(id): Promise<void> {
    const { error } = await getSupabaseAdmin().from('locations').delete().eq('id', id);
    if (error) throw error;
  },

  // --- Location groups ---

  async getLocationGroups(profileId: string): Promise<LocationGroup[]> {
    const { data, error } = await getSupabaseAdmin()
      .from('location_groups')
      .select('*')
      .eq('profile_id', profileId)
      .order('sort_order')
      .order('name');
    if (error) throw error;
    return (data ?? []) as LocationGroup[];
  },

  async getLocationGroupById(id: string): Promise<LocationGroup | null> {
    const { data, error } = await getSupabaseAdmin()
      .from('location_groups')
      .select('*')
      .eq('id', id)
      .single();
    if (error) return null;
    return data as LocationGroup;
  },

  async createLocationGroup(input: Pick<LocationGroup, 'profile_id' | 'name' | 'parent_id' | 'sort_order'>): Promise<LocationGroup> {
    const now = new Date().toISOString();
    const row = { ...input, id: crypto.randomUUID(), created_at: now, updated_at: now };
    const { data, error } = await getSupabaseAdmin()
      .from('location_groups')
      .insert(row)
      .select()
      .single();
    if (error) throw error;
    return data as LocationGroup;
  },

  async updateLocationGroup(id: string, updates: Partial<Pick<LocationGroup, 'name' | 'parent_id' | 'sort_order'>>): Promise<LocationGroup> {
    const { data, error } = await getSupabaseAdmin()
      .from('location_groups')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as LocationGroup;
  },

  async deleteLocationGroup(id: string): Promise<void> {
    const { error } = await getSupabaseAdmin().from('location_groups').delete().eq('id', id);
    if (error) throw error;
  },

  // --- Facets ---

  async getWineFacets(field: string, q: string): Promise<string[]> {
    const ALLOWED = ['variety', 'country', 'region', 'producer', 'appellation'];
    if (!ALLOWED.includes(field)) return [];
    const { data, error } = await getSupabaseAdmin()
      .from('wines')
      .select(field)
      .ilike(field, `%${q}%`)
      .not(field, 'is', null)
      .order(field)
      .limit(20);
    if (error) throw error;
    const seen = new Set<string>();
    const results: string[] = [];
    for (const row of (data ?? [])) {
      const val = (row as unknown as Record<string, string>)[field];
      if (val && !seen.has(val)) { seen.add(val); results.push(val); }
    }
    return results;
  },

  // --- Tasting Notes ---

  async getWineNotes(wineId: string): Promise<WineNote[]> {
    const { data, error } = await getSupabaseAdmin()
      .from('wine_notes')
      .select('*')
      .eq('wine_id', wineId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data as WineNote[];
  },

  async addWineNote(wineId: string, note: string, tastedAt?: string): Promise<WineNote> {
    const now = new Date().toISOString();
    const entry = { id: generateId(), wine_id: wineId, note, tasted_at: tastedAt ?? null, created_at: now };
    const { data, error } = await getSupabaseAdmin().from('wine_notes').insert(entry).select().single();
    if (error) throw error;
    return data as WineNote;
  },

  async deleteWineNote(noteId: string): Promise<void> {
    const { error } = await getSupabaseAdmin().from('wine_notes').delete().eq('id', noteId);
    if (error) throw error;
  },

  // --- Transactions ---

  async getTransactions(profileId: string, _userId: string, limit = 50): Promise<BottleTransaction[]> {
    const { data, error } = await getSupabaseAdmin()
      .from('bottle_transactions')
      .select('*, wine:wines(name, vintage_year)')
      .eq('profile_id', profileId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data as BottleTransaction[];
  },

  // --- Producers ---

  async getProducers() {
    // Supabase doesn't easily support cross-table aggregates via the JS client,
    // so we do two queries and merge client-side.
    const supabase = getSupabaseAdmin();
    const { data: wines, error } = await supabase
      .from('wines')
      .select('id, producer')
      .not('producer', 'is', null)
      .neq('producer', '');
    if (error) throw error;

    const { data: txs } = await supabase.from('bottle_transactions').select('wine_id');
    const { data: inv } = await supabase.from('cellar_inventory').select('wine_id, quantity').gt('quantity', 0);

    const txCount = new Map<string, number>();
    for (const t of txs ?? []) txCount.set(t.wine_id, (txCount.get(t.wine_id) ?? 0) + 1);

    const invQty = new Map<string, number>();
    for (const i of inv ?? []) invQty.set(i.wine_id, (invQty.get(i.wine_id) ?? 0) + i.quantity);

    const producerMap = new Map<string, { wine_count: number; bottle_count: number; transaction_count: number }>();
    for (const w of wines ?? []) {
      const p = w.producer as string;
      const cur = producerMap.get(p) ?? { wine_count: 0, bottle_count: 0, transaction_count: 0 };
      cur.wine_count += 1;
      cur.bottle_count += invQty.get(w.id) ?? 0;
      cur.transaction_count += txCount.get(w.id) ?? 0;
      producerMap.set(p, cur);
    }

    return [...producerMap.entries()]
      .map(([producer, stats]) => ({ producer, ...stats }))
      .sort((a, b) => b.transaction_count - a.transaction_count || b.wine_count - a.wine_count);
  },

  async getProducerWines(producer: string) {
    const supabase = getSupabaseAdmin();
    const { data: wines, error } = await supabase.from('wines').select('*').eq('producer', producer);
    if (error) throw error;

    const wineIds = (wines ?? []).map(w => w.id);
    if (wineIds.length === 0) return [];

    const { data: txs } = await supabase.from('bottle_transactions').select('wine_id').in('wine_id', wineIds);
    const { data: inv } = await supabase.from('cellar_inventory').select('wine_id, quantity').in('wine_id', wineIds).gt('quantity', 0);

    const txCount = new Map<string, number>();
    for (const t of txs ?? []) txCount.set(t.wine_id, (txCount.get(t.wine_id) ?? 0) + 1);

    const invQty = new Map<string, number>();
    for (const i of inv ?? []) invQty.set(i.wine_id, (invQty.get(i.wine_id) ?? 0) + i.quantity);

    return (wines ?? [])
      .map(w => ({
        ...w,
        transaction_count: txCount.get(w.id) ?? 0,
        bottle_count: invQty.get(w.id) ?? 0,
      }))
      .sort((a, b) => b.transaction_count - a.transaction_count || a.name.localeCompare(b.name));
  },

  // --- Food pairings ---

  async getFoodPairings(wineId: string) {
    const { data, error } = await getSupabaseAdmin()
      .from('wine_food_pairings').select('*').eq('wine_id', wineId).order('created_at');
    if (error) throw error;
    return (data ?? []) as WineFoodPairing[];
  },

  async addFoodPairing(wineId: string, food: string, source: 'gemini' | 'manual') {
    const row = { id: generateId(), wine_id: wineId, food: food.trim(), source, created_at: new Date().toISOString() };
    const { error } = await getSupabaseAdmin().from('wine_food_pairings').insert(row);
    if (error) throw error;
    return row as WineFoodPairing;
  },

  async deleteFoodPairing(id: string) {
    await getSupabaseAdmin().from('wine_food_pairings').delete().eq('id', id);
  },

  async getWinesWithPairings(foods: string[], fuzzy = false) {
    if (foods.length === 0) return [];
    const lower = foods.map(f => f.toLowerCase());
    const supabase = getSupabaseAdmin();
    let wineIds: string[];

    if (!fuzzy) {
      const { data: pairings } = await supabase.from('wine_food_pairings').select('wine_id').in('food', lower);
      wineIds = [...new Set((pairings ?? []).map((p: { wine_id: string }) => p.wine_id))];
    } else {
      const { data: exact } = await supabase.from('wine_food_pairings').select('wine_id').in('food', lower);
      const exactIds = new Set((exact ?? []).map((p: { wine_id: string }) => p.wine_id));
      // Fuzzy: LIKE on meaningful tokens
      const STOPWORDS = new Set(['with', 'and', 'the', 'for', 'from', 'that', 'this', 'over', 'into']);
      const tokens = [...new Set(lower.flatMap(f => f.split(/\W+/).filter(t => t.length > 3 && !STOPWORDS.has(t))))];
      const fuzzyIds = new Set<string>();
      for (const token of tokens) {
        const { data: fuzzyRows } = await supabase.from('wine_food_pairings').select('wine_id').ilike('food', `%${token}%`);
        (fuzzyRows ?? []).forEach((p: { wine_id: string }) => fuzzyIds.add(p.wine_id));
      }
      wineIds = [...new Set([...exactIds, ...fuzzyIds])];
    }

    if (wineIds.length === 0) return [];
    const { data, error } = await supabase.from('wines').select('*').in('id', wineIds);
    if (error) throw error;
    return (data ?? []) as Wine[];
  },

  async getAllFoods() {
    const { data } = await getSupabaseAdmin()
      .from('wine_food_pairings').select('food').order('food');
    const unique = [...new Set((data ?? []).map((r: { food: string }) => r.food.toLowerCase()))];
    return unique.sort();
  },

  // --- Cuisine tags ---

  async getCuisineTags(wineId: string) {
    const { data, error } = await getSupabaseAdmin()
      .from('wine_cuisine_tags').select('*').eq('wine_id', wineId).order('created_at');
    if (error) throw error;
    return (data ?? []) as WineCuisineTag[];
  },

  async addCuisineTag(wineId: string, tag: CuisineTag, source: 'gemini' | 'manual') {
    const supabase = getSupabaseAdmin();
    const row = { id: generateId(), wine_id: wineId, tag, source, created_at: new Date().toISOString() };
    const { error } = await supabase.from('wine_cuisine_tags').upsert(row, { onConflict: 'wine_id,tag', ignoreDuplicates: true });
    if (error) throw error;
    const { data: existing } = await supabase.from('wine_cuisine_tags').select('*').eq('wine_id', wineId).eq('tag', tag).single();
    return (existing ?? row) as WineCuisineTag;
  },

  async deleteCuisineTag(id: string) {
    await getSupabaseAdmin().from('wine_cuisine_tags').delete().eq('id', id);
  },

  async getWinesWithCuisineTags(tags: CuisineTag[]) {
    if (tags.length === 0) return [];
    const { data: rows } = await getSupabaseAdmin()
      .from('wine_cuisine_tags').select('wine_id').in('tag', tags);
    const wineIds = [...new Set((rows ?? []).map((r: { wine_id: string }) => r.wine_id))];
    if (wineIds.length === 0) return [];
    const { data, error } = await getSupabaseAdmin().from('wines').select('*').in('id', wineIds);
    if (error) throw error;
    return (data ?? []) as Wine[];
  },

  // --- Freezer ---

  async getFreezerItems(profileId: string): Promise<FreezerItem[]> {
    const { data, error } = await getSupabaseAdmin()
      .from('freezer_inventory')
      .select('*')
      .eq('profile_id', profileId)
      .gt('quantity', 0)
      .order('eat_by_date', { ascending: true });
    if (error) throw error;
    return (data ?? []) as FreezerItem[];
  },

  async addFreezerItem(input: AddFreezerInput, _userId: string): Promise<FreezerItem> {
    const now = new Date().toISOString();
    const storedDate = input.stored_date;
    const eatByDate = `${parseInt(storedDate.slice(0, 4), 10) + 1}${storedDate.slice(4)}`;
    const item = {
      id: generateId(),
      profile_id: input.profile_id,
      meat_cut: input.meat_cut,
      primal: input.primal ?? null,
      quantity: input.quantity,
      weight_lbs: input.weight_lbs ?? null,
      location: input.location?.trim() ?? '',
      stored_date: storedDate,
      eat_by_date: eatByDate,
      price_per_lb: input.price_per_lb ?? null,
      notes: input.notes ?? null,
      created_at: now,
      updated_at: now,
    };
    const { error } = await getSupabaseAdmin().from('freezer_inventory').insert(item);
    if (error) throw error;
    await getSupabaseAdmin().from('freezer_transactions').insert({
      id: generateId(), freezer_item_id: item.id, profile_id: item.profile_id,
      action: 'add', quantity: item.quantity, created_at: now,
    });
    return item as FreezerItem;
  },

  async removeFreezerItem(id: string, quantity: number, _userId: string): Promise<FreezerItem> {
    const { data: existing, error: fetchErr } = await getSupabaseAdmin()
      .from('freezer_inventory').select('*').eq('id', id).single();
    if (fetchErr || !existing) throw new Error(`Freezer item ${id} not found`);
    if (quantity > existing.quantity) throw new Error('Cannot remove more packs than available');
    const now = new Date().toISOString();
    const newQty = existing.quantity - quantity;
    const weightLbs = existing.weight_lbs != null ? quantity * existing.weight_lbs : null;
    const { error } = await getSupabaseAdmin()
      .from('freezer_inventory').update({ quantity: newQty, updated_at: now }).eq('id', id);
    if (error) throw error;
    await getSupabaseAdmin().from('freezer_transactions').insert({
      id: generateId(), freezer_item_id: id, profile_id: existing.profile_id,
      action: 'remove', quantity, weight_lbs: weightLbs, created_at: now,
    });
    return { ...existing, quantity: newQty, updated_at: now } as FreezerItem;
  },

  async getFreezerTransactions(profileId: string): Promise<FreezerTransaction[]> {
    const { data, error } = await getSupabaseAdmin()
      .from('freezer_transactions')
      .select('*, freezer_inventory(meat_cut)')
      .eq('profile_id', profileId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map((r: Record<string, unknown> & { freezer_inventory?: { meat_cut: string } }) => {
      const { freezer_inventory, ...rest } = r;
      return { ...rest, meat_cut: freezer_inventory?.meat_cut } as unknown as FreezerTransaction;
    });
  },

  // --- Sharing ---

  async getProfilePermission(profileId: string, userId: string): Promise<'owner' | 'read' | 'write' | null> {
    const admin = getSupabaseAdmin();
    const { data: owned } = await admin.from('profiles').select('id').eq('id', profileId).eq('user_id', userId).single();
    if (owned) return 'owner';
    const { data: share } = await admin.from('cellar_shares').select('permission').eq('profile_id', profileId).eq('shared_with_user_id', userId).single();
    return (share as { permission: 'read' | 'write' } | null)?.permission ?? null;
  },

  async getSharesForProfile(profileId: string): Promise<CellarShare[]> {
    const { data, error } = await getSupabaseAdmin().from('cellar_shares').select('*').eq('profile_id', profileId).order('created_at');
    if (error) throw error;
    return (data ?? []) as CellarShare[];
  },

  async createShare(profileId: string, ownerUserId: string, sharedWithUserId: string, sharedWithEmail: string, permission: 'read' | 'write'): Promise<CellarShare> {
    const share = { id: generateId(), profile_id: profileId, owner_user_id: ownerUserId, shared_with_user_id: sharedWithUserId, shared_with_email: sharedWithEmail, permission };
    const { data, error } = await getSupabaseAdmin().from('cellar_shares').insert(share).select().single();
    if (error) throw error;
    return data as CellarShare;
  },

  async deleteShare(shareId: string, ownerUserId: string): Promise<void> {
    const { error } = await getSupabaseAdmin().from('cellar_shares').delete().eq('id', shareId).eq('owner_user_id', ownerUserId);
    if (error) throw error;
  },

  async getUserByEmail(email: string): Promise<{ id: string; email: string } | null> {
    const { data } = await getSupabaseAdmin().auth.admin.listUsers();
    const user = data.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
    if (!user || !user.email) return null;
    return { id: user.id, email: user.email };
  },

  async getInventoryProfileId(inventoryId: string): Promise<string | null> {
    const { data } = await getSupabaseAdmin().from('cellar_inventory').select('profile_id').eq('id', inventoryId).single();
    return (data as { profile_id: string } | null)?.profile_id ?? null;
  },

  async getLocationProfileId(locationId: string): Promise<string | null> {
    const { data } = await getSupabaseAdmin().from('locations').select('profile_id').eq('id', locationId).single();
    return (data as { profile_id: string } | null)?.profile_id ?? null;
  },

  async getFreezerItemProfileId(itemId: string): Promise<string | null> {
    const { data } = await getSupabaseAdmin().from('freezer_inventory').select('profile_id').eq('id', itemId).single();
    return (data as { profile_id: string } | null)?.profile_id ?? null;
  },

  async getFreezerLocations(profileId: string): Promise<FreezerLocation[]> {
    const { data } = await getSupabaseAdmin().from('freezer_locations').select('*').eq('profile_id', profileId).order('name');
    return (data ?? []) as FreezerLocation[];
  },

  async addFreezerLocation(profileId: string, name: string): Promise<FreezerLocation> {
    const loc = { id: generateId(), profile_id: profileId, name: name.trim() };
    const { data, error } = await getSupabaseAdmin().from('freezer_locations').insert(loc).select().single();
    if (error) throw error;
    return data as FreezerLocation;
  },

  async renameFreezerLocation(id: string, name: string): Promise<FreezerLocation> {
    const { data, error } = await getSupabaseAdmin().from('freezer_locations').update({ name: name.trim() }).eq('id', id).select().single();
    if (error) throw error;
    return data as FreezerLocation;
  },

  async deleteFreezerLocation(id: string): Promise<void> {
    const { error } = await getSupabaseAdmin().from('freezer_locations').delete().eq('id', id);
    if (error) throw error;
  },

  async getFreezerLocationProfileId(id: string): Promise<string | null> {
    const { data } = await getSupabaseAdmin().from('freezer_locations').select('profile_id').eq('id', id).single();
    return (data as { profile_id: string } | null)?.profile_id ?? null;
  },

  async updateFreezerItem(id: string, updates: Partial<Pick<FreezerItem, 'meat_cut' | 'primal' | 'quantity' | 'weight_lbs' | 'location' | 'stored_date' | 'price_per_lb' | 'notes'>>): Promise<FreezerItem> {
    const storedDate = updates.stored_date;
    const eatByDate = storedDate
      ? `${parseInt(storedDate.slice(0, 4), 10) + 1}${storedDate.slice(4)}`
      : undefined;
    const patch: Record<string, unknown> = { ...updates, updated_at: new Date().toISOString() };
    if (eatByDate) patch.eat_by_date = eatByDate;
    const { data, error } = await getSupabaseAdmin().from('freezer_inventory').update(patch).eq('id', id).select().single();
    if (error) throw error;
    return data as FreezerItem;
  },

  // --- Pantry ---

  async getPantryItems(profileId: string): Promise<PantryItem[]> {
    const { data, error } = await getSupabaseAdmin()
      .from('pantry_items').select('*').eq('profile_id', profileId)
      .gt('quantity', 0).order('name').order('best_by_date');
    if (error) throw error;
    return (data ?? []) as PantryItem[];
  },

  async addPantryItem(input: AddPantryInput, _userId: string): Promise<PantryItem> {
    const now = new Date().toISOString();
    const bestByDays = input.best_by_days ?? 365;
    const bestByDate = input.best_by_date ?? (() => {
      const dt = new Date(input.stored_date + 'T00:00:00');
      dt.setDate(dt.getDate() + bestByDays);
      return dt.toISOString().slice(0, 10);
    })();
    const item = {
      id: generateId(),
      profile_id: input.profile_id,
      name: input.name.trim(),
      brand: input.brand?.trim() || null,
      category: input.category?.trim() || null,
      quantity: input.quantity,
      unit: input.unit?.trim() || 'unit',
      location: input.location?.trim() ?? '',
      stored_date: input.stored_date,
      best_by_date: bestByDate,
      best_by_days: bestByDays,
      notes: input.notes?.trim() || null,
      created_at: now,
      updated_at: now,
    };
    const { data, error } = await getSupabaseAdmin().from('pantry_items').insert(item).select().single();
    if (error) throw error;
    await getSupabaseAdmin().from('pantry_transactions').insert({
      id: generateId(), pantry_item_id: item.id, profile_id: item.profile_id,
      action: 'add', quantity: item.quantity, created_at: now,
    });
    return data as PantryItem;
  },

  async updatePantryItem(id: string, updates: Partial<Pick<PantryItem, 'name' | 'brand' | 'category' | 'quantity' | 'unit' | 'location' | 'stored_date' | 'best_by_date' | 'best_by_days' | 'notes'>>): Promise<PantryItem> {
    const patch: Record<string, unknown> = { ...updates, updated_at: new Date().toISOString() };
    const { data, error } = await getSupabaseAdmin().from('pantry_items').update(patch).eq('id', id).select().single();
    if (error) throw error;
    return data as PantryItem;
  },

  async removePantryItem(id: string, quantity: number, _userId: string): Promise<PantryItem> {
    const { data: existing, error: fetchErr } = await getSupabaseAdmin()
      .from('pantry_items').select('*').eq('id', id).single();
    if (fetchErr || !existing) throw new Error(`Pantry item ${id} not found`);
    if (quantity > existing.quantity) throw new Error('Cannot remove more than available');
    const now = new Date().toISOString();
    const newQty = existing.quantity - quantity;
    const { error } = await getSupabaseAdmin()
      .from('pantry_items').update({ quantity: newQty, updated_at: now }).eq('id', id);
    if (error) throw error;
    await getSupabaseAdmin().from('pantry_transactions').insert({
      id: generateId(), pantry_item_id: id, profile_id: existing.profile_id,
      action: 'remove', quantity, created_at: now,
    });
    return { ...existing, quantity: newQty, updated_at: now } as PantryItem;
  },

  async getPantryTransactions(profileId: string): Promise<PantryTransaction[]> {
    const { data, error } = await getSupabaseAdmin()
      .from('pantry_transactions')
      .select('*, pantry_items(name)')
      .eq('profile_id', profileId)
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) throw error;
    return (data ?? []).map((r: Record<string, unknown> & { pantry_items?: { name: string } }) => {
      const { pantry_items, ...rest } = r;
      return { ...rest, item_name: pantry_items?.name } as unknown as PantryTransaction;
    });
  },

  async getPantryItemProfileId(id: string): Promise<string | null> {
    const { data } = await getSupabaseAdmin().from('pantry_items').select('profile_id').eq('id', id).single();
    return (data as { profile_id: string } | null)?.profile_id ?? null;
  },

  async getPantryUsageSettings(profileId: string): Promise<PantryUsageSetting[]> {
    const { data, error } = await getSupabaseAdmin()
      .from('pantry_usage_settings').select('*').eq('profile_id', profileId).order('item_name');
    if (error) throw error;
    return (data ?? []) as PantryUsageSetting[];
  },

  async upsertPantryUsageSetting(profileId: string, itemName: string, updates: { days_per_unit?: number | null; reset_date?: string | null }): Promise<PantryUsageSetting> {
    const now = new Date().toISOString();
    const row = {
      profile_id: profileId,
      item_name: itemName,
      days_per_unit: updates.days_per_unit ?? null,
      reset_date: updates.reset_date ?? null,
      updated_at: now,
    };
    const { data, error } = await getSupabaseAdmin()
      .from('pantry_usage_settings')
      .upsert({ ...row, id: generateId(), created_at: now }, { onConflict: 'profile_id,item_name' })
      .select().single();
    if (error) throw error;
    return data as PantryUsageSetting;
  },
};
