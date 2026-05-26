import type { DbAdapter } from '@/types';

let adapter: DbAdapter | null = null;

export async function getDb(): Promise<DbAdapter> {
  if (adapter) return adapter;

  if (process.env.DATABASE_PROVIDER === 'supabase') {
    const { supabaseAdapter } = await import('./supabase-adapter');
    adapter = supabaseAdapter;
  } else {
    const { sqliteAdapter } = await import('./sqlite');
    adapter = sqliteAdapter;
  }

  return adapter;
}

export function resetDbAdapter(): void {
  adapter = null;
}
