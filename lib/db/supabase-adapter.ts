import type {
  DbAdapter,
  Wine,
  Profile,
  CellarInventory,
  BottleTransaction,
  WineSearchParams,
  AddBottleInput,
  RemoveBottleInput,
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
        `name.ilike.%${params.query}%,producer.ilike.%${params.query}%,variety.ilike.%${params.query}%,region.ilike.%${params.query}%,country.ilike.%${params.query}%`
      );
    }
    if (params.variety) query = query.eq('variety', params.variety);
    if (params.wine_type) query = query.eq('wine_type', params.wine_type);
    if (params.country) query = query.eq('country', params.country);
    if (params.region) query = query.eq('region', params.region);
    if (params.vintage_year) query = query.eq('vintage_year', params.vintage_year);
    if (params.producer) query = query.ilike('producer', `%${params.producer}%`);

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
};
