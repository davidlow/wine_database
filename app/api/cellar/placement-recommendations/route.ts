import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentUserId } from '@/lib/auth';
import { checkProfileAccess } from '@/lib/permissions';
import {
  getPlacementRecommendations,
  type CellarInventoryWithWine,
  type LocationWithBottles,
} from '@/lib/cellar-heuristics';
import type { Wine } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = request.nextUrl;
    const profileId = searchParams.get('profile_id');
    const wineId = searchParams.get('wine_id');

    if (!profileId) return NextResponse.json({ error: 'profile_id required' }, { status: 400 });
    if (!wineId) return NextResponse.json({ error: 'wine_id required' }, { status: 400 });

    const denied = await checkProfileAccess(profileId, userId, 'read');
    if (denied) return denied;

    const db = await getDb();
    const [wine, locations, allInventory] = await Promise.all([
      db.getWineById(wineId),
      db.getLocations(profileId),
      db.getCellarInventory(profileId, userId),
    ]);

    if (!wine) return NextResponse.json({ error: 'Wine not found' }, { status: 404 });

    // Group inventory by location for heuristic scoring
    const inventoryByLocation = new Map<string, CellarInventoryWithWine[]>();
    for (const loc of locations) inventoryByLocation.set(loc.name, []);
    for (const entry of allInventory) {
      if (entry.wine && inventoryByLocation.has(entry.location)) {
        inventoryByLocation.get(entry.location)!.push(entry as CellarInventoryWithWine);
      }
    }

    const locationsWithBottles: LocationWithBottles[] = locations.map(loc => ({
      location: loc,
      bottles: inventoryByLocation.get(loc.name) ?? [],
    }));

    const recommendations = getPlacementRecommendations(
      wine as Partial<Wine>,
      locationsWithBottles,
      new Date().getFullYear(),
    );

    return NextResponse.json(
      recommendations.map(r => ({
        location_id: r.location.id,
        location_name: r.location.name,
        location_type: r.location.location_type,
        score: r.score,
        reason: r.reason,
        available_capacity: r.location.available_capacity,
      }))
    );
  } catch (err) {
    console.error('[GET /api/cellar/placement-recommendations]', err);
    return NextResponse.json({ error: 'Failed to compute recommendations' }, { status: 500 });
  }
}
