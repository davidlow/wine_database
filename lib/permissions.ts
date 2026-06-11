import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

const LEVELS = { owner: 3, write: 2, read: 1 } as const;
type Level = keyof typeof LEVELS;

export async function checkProfileAccess(
  profileId: string,
  userId: string,
  minLevel: Level
): Promise<NextResponse | null> {
  const db = await getDb();
  const perm = await db.getProfilePermission(profileId, userId);
  if (!perm || LEVELS[perm] < LEVELS[minLevel]) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return null;
}
