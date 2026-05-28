import type {
  DbAdapter,
  Wine,
  Profile,
  CellarInventory,
  BottleTransaction,
  Location,
  WineNote,
  WineSearchParams,
  AddBottleInput,
  RemoveBottleInput,
  MoveBottleInput,
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

    // Multi-select regions
    if (params.regions) {
      const regionList = params.regions.split(',').map(s => s.trim()).filter(Boolean);
      if (regionList.length > 0) {
        const regionOr = regionList.map(r => `region.eq.${r}`).join(',');
        const appellationOr = regionList.map(r => `appellation.eq.${r}`).join(',');
        query = query.or(`${regionOr},${appellationOr}`);
      }
    }

    const { data, error } = await query.order('name');
    if (error) throw error;
    return data as Wine[];
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
    const { data, error } = await getSupabaseAdmin()
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .order('name');
    if (error) throw error;
    return data as Profile[];
  },

  async getProfileById(id: string, userId: string): Promise<Profile | null> {
    const { data, error } = await getSupabaseAdmin()
      .from('profiles')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();
    if (error) return null;
    return data as Profile;
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
};
