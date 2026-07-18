import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentUserId } from '@/lib/auth';
import { checkProfileAccess } from '@/lib/permissions';

interface Assignment {
  cellar_inventory_id: string;
  new_location: string;
  quantity: number;
}

export async function POST(request: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { profile_id, assignments } = body as { profile_id: string; assignments: Assignment[] };

  if (!profile_id) return NextResponse.json({ error: 'profile_id required' }, { status: 400 });
  if (!Array.isArray(assignments) || assignments.length === 0)
    return NextResponse.json({ error: 'assignments must be a non-empty array' }, { status: 400 });

  const denied = await checkProfileAccess(profile_id, userId, 'write');
  if (denied) return denied;

  const db = await getDb();
  let moved = 0;
  const errors: string[] = [];

  for (const { cellar_inventory_id, new_location, quantity } of assignments) {
    if (!cellar_inventory_id || !new_location || !quantity || quantity < 1) {
      errors.push(`Skipped invalid assignment (id=${cellar_inventory_id})`);
      continue;
    }
    try {
      await db.moveBottle({ cellar_inventory_id, new_location, quantity }, userId);
      moved++;
    } catch (err) {
      errors.push(`${cellar_inventory_id}: ${err instanceof Error ? err.message : 'unknown'}`);
    }
  }

  return NextResponse.json({ moved, errors });
}
