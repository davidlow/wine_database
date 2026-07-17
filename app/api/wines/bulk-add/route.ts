import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentUserId } from '@/lib/auth';
import { checkProfileAccess } from '@/lib/permissions';
import type { WineType } from '@/types';

interface LocationAlloc {
  location: string;
  quantity: number;
  purchase_price?: number;
}

interface BulkWineEntry {
  name: string;
  producer?: string;
  vintage_year?: number;
  variety?: string;
  wine_type?: WineType;
  region?: string;
  appellation?: string;
  country?: string;
  alcohol_content?: number;
  average_price?: number;
  drink_from_year?: number;
  drink_by_year?: number;
  description?: string;
  acidity?: number;
  tannin?: number;
  sweetness?: number;
  body?: number;
  alcohol?: number;
  fruit_profile?: string;
  locations: LocationAlloc[];
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json() as { profile_id?: string; wines?: BulkWineEntry[] };
    const { profile_id, wines } = body;

    if (!profile_id) return NextResponse.json({ error: 'profile_id required' }, { status: 400 });
    if (!Array.isArray(wines) || wines.length === 0) {
      return NextResponse.json({ error: 'wines array required' }, { status: 400 });
    }

    const denied = await checkProfileAccess(profile_id, userId, 'write');
    if (denied) return denied;

    const db = await getDb();
    let added = 0;
    const errors: string[] = [];

    for (const entry of wines) {
      if (!entry.name?.trim()) { errors.push('Skipped entry with no name'); continue; }
      try {
        const wine = await db.createWine({
          name: entry.name.trim(),
          producer: entry.producer || undefined,
          vintage_year: entry.vintage_year || undefined,
          variety: entry.variety || undefined,
          wine_type: entry.wine_type || undefined,
          region: entry.region || undefined,
          appellation: entry.appellation || undefined,
          country: entry.country || undefined,
          alcohol_content: entry.alcohol_content || undefined,
          average_price: entry.average_price || undefined,
          drink_from_year: entry.drink_from_year || undefined,
          drink_by_year: entry.drink_by_year || undefined,
          description: entry.description || undefined,
          acidity: entry.acidity != null ? entry.acidity : undefined,
          tannin: entry.tannin != null ? entry.tannin : undefined,
          sweetness: entry.sweetness != null ? entry.sweetness : undefined,
          body: entry.body != null ? entry.body : undefined,
          alcohol: entry.alcohol != null ? entry.alcohol : undefined,
          fruit_profile: entry.fruit_profile || undefined,
        });

        const locs = entry.locations?.filter(l => (l.quantity ?? 0) >= 1);
        const allocations = locs?.length ? locs : [{ location: '', quantity: 1 }];

        for (const loc of allocations) {
          await db.addBottle({
            wine_id: wine.id,
            profile_id,
            location: loc.location?.trim() ?? '',
            quantity: Math.max(1, Math.round(loc.quantity)),
            purchase_price: loc.purchase_price || undefined,
          }, userId);
        }

        added++;
      } catch (err) {
        errors.push(`"${entry.name}": ${err instanceof Error ? err.message : 'unknown error'}`);
      }
    }

    return NextResponse.json({ added, errors });
  } catch (err) {
    console.error('[POST /api/wines/bulk-add]', err);
    return NextResponse.json({ error: 'Bulk add failed' }, { status: 500 });
  }
}
