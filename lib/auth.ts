export const DEV_USER_ID = 'dev-user-id';

export async function getCurrentUserId(): Promise<string | null> {
  if (process.env.DATABASE_PROVIDER !== 'supabase') {
    return DEV_USER_ID;
  }

  const { createClient } = await import('@/lib/supabase/server');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}
