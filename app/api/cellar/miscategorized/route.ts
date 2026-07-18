import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentUserId } from '@/lib/auth';
import { checkProfileAccess } from '@/lib/permissions';
import {
  detectLocationTheme,
  getMiscategorizedBottles,
  type CellarInventoryWithWine,
} from '@/lib/cellar-heuristics';

export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = request.nextUrl;
    const profileId = searchParams.get('profile_id');
    if (!profileId) return NextResponse.json({ error: 'profile_id required' }, { status: 400 });

    const denied = await checkProfileAccess(profileId, userId, 'read');
    if (denied) return denied;

    const db = await getDb();
    const [locations, allInventory] = await Promise.all([
      db.getLocations(profileId),
      db.getCellarInventory(profileId, userId),
    ]);

    // Group inventory by location
    const byLocation = new Map<string, CellarInventoryWithWine[]>();
    for (const loc of locations) byLocation.set(loc.name, []);
    for (const entry of allInventory) {
      if (entry.wine && byLocation.has(entry.location)) {
        byLocation.get(entry.location)!.push(entry as CellarInventoryWithWine);
      }
    }

    const results = [];
    for (const loc of locations) {
      if (loc.location_type === 'aging' || loc.location_type === 'daily') continue;
      const bottles = byLocation.get(loc.name) ?? [];
      if (bottles.length < 2) continue;

      const theme = detectLocationTheme(bottles);
      if (!theme) continue;

      const miscategorized = getMiscategorizedBottles(bottles, theme);
      if (miscategorized.length === 0) continue;

      results.push({ location: loc, theme, miscategorized });
    }

    return NextResponse.json(results);
  } catch (err) {
    console.error('[GET /api/cellar/miscategorized]', err);
    return NextResponse.json({ error: 'Failed to detect miscategorized bottles' }, { status: 500 });
  }
}
