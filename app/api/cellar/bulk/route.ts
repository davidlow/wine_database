import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentUserId } from '@/lib/auth';
import type { WineType } from '@/types';

interface BulkAddItem {
  barcode?: string;
  wine_id?: string;       // set when wine already exists in internal DB
  name: string;
  producer?: string;
  vintage_year?: number;
  variety?: string;
  wine_type?: WineType;
  region?: string;
  appellation?: string;
  country?: string;
  description?: string;
  quantity: number;
  purchase_price?: number;
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    if (!body.profile_id) return NextResponse.json({ error: 'profile_id required' }, { status: 400 });
    if (!Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ error: 'items array required' }, { status: 400 });
    }

    const db = await getDb();
    const profileId: string = body.profile_id;
    const location: string = body.location ?? ''; // '' = unlocated
    const items: BulkAddItem[] = body.items;

    let added = 0;
    const errors: string[] = [];

    for (const item of items) {
      if (!item.name?.trim()) { errors.push(`Skipped item with no name`); continue; }
      try {
        let wineId = item.wine_id;

        // If already in DB (from batch lookup), skip wine creation
        if (!wineId && item.barcode) {
          const existing = await db.getWineByBarcode(item.barcode);
          wineId = existing?.id;
        }

        if (!wineId) {
          // Create the wine record, barcode links future scans directly to it
          const wine = await db.createWine({
            name: item.name.trim(),
            producer: item.producer,
            vintage_year: item.vintage_year,
            variety: item.variety,
            wine_type: item.wine_type,
            region: item.region,
            appellation: item.appellation,
            country: item.country,
            description: item.description,
            barcode: item.barcode,
          });
          wineId = wine.id;
        }

        await db.addBottle({
          wine_id: wineId,
          profile_id: profileId,
          location,
          quantity: Math.max(1, item.quantity),
          purchase_price: item.purchase_price,
        }, userId);

        added++;
      } catch (err) {
        errors.push(`"${item.name}": ${err instanceof Error ? err.message : 'unknown error'}`);
      }
    }

    return NextResponse.json({ added, errors });
  } catch (err) {
    console.error('[POST /api/cellar/bulk]', err);
    return NextResponse.json({ error: 'Bulk add failed' }, { status: 500 });
  }
}
