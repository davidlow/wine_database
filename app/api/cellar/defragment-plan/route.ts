import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentUserId } from '@/lib/auth';
import { checkProfileAccess } from '@/lib/permissions';
import { computeDefragmentPlan, type CellarInventoryWithWine } from '@/lib/cellar-heuristics';

export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = request.nextUrl;
    const profileId = searchParams.get('profile_id');
    if (!profileId) return NextResponse.json({ error: 'profile_id required' }, { status: 400 });

    const carryLimit = Math.max(1, Math.min(12, parseInt(searchParams.get('carry_limit') ?? '4', 10)));
    const includeAging = searchParams.get('include_aging') === 'true';

    const denied = await checkProfileAccess(profileId, userId, 'read');
    if (denied) return denied;

    const db = await getDb();
    const [locations, allInventory] = await Promise.all([
      db.getLocations(profileId),
      db.getCellarInventory(profileId, userId),
    ]);

    const inventoryWithWine = allInventory.filter(e => e.wine) as CellarInventoryWithWine[];

    const plan = computeDefragmentPlan(inventoryWithWine, locations, { carryLimit, includeAging });

    return NextResponse.json(plan);
  } catch (err) {
    console.error('[GET /api/cellar/defragment-plan]', err);
    return NextResponse.json({ error: 'Failed to compute defragment plan' }, { status: 500 });
  }
}
