import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentUserId } from '@/lib/auth';
import { checkProfileAccess } from '@/lib/permissions';
import type { WineType, CuisineTag, PairingWeight } from '@/types';

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
  // Source affects barcode-dedup logic: 'barcode' reuses existing, others create new
  source?: string;
  // Gemini structural characteristics
  acidity?: number;
  tannin?: number;
  alcohol?: number;
  sweetness?: number;
  body?: number;
  minerality?: number;
  oak_influence?: number;
  fruit_intensity?: number;
  fruit_profile?: string;
  pairing_weight?: PairingWeight;
  pairing_rationale?: string;
  food_pairings?: string[];
  cuisine_tags?: string[];
  label_image?: string;
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

    const denied = await checkProfileAccess(body.profile_id, userId, 'write');
    if (denied) return denied;

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

        // Reuse existing wine by barcode only when the item came from a barcode lookup.
        // Gemini/manual identifications may assign a different wine to the same barcode —
        // those should create a new record rather than silently add to the wrong wine.
        if (!wineId && item.barcode && item.source === 'barcode') {
          const existing = await db.getWineByBarcode(item.barcode);
          wineId = existing?.id;
        }

        if (!wineId) {
          const wineData = {
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
            label_image: item.label_image,
            acidity: item.acidity,
            tannin: item.tannin,
            alcohol: item.alcohol,
            sweetness: item.sweetness,
            body: item.body,
            minerality: item.minerality,
            oak_influence: item.oak_influence,
            fruit_intensity: item.fruit_intensity,
            fruit_profile: item.fruit_profile,
            pairing_weight: item.pairing_weight,
            pairing_rationale: item.pairing_rationale,
          };
          let wine;
          try {
            wine = await db.createWine(wineData);
          } catch (err) {
            // Barcode UNIQUE conflict — another wine has this barcode; save without it
            if (String(err).includes('UNIQUE constraint failed: wines.barcode')) {
              wine = await db.createWine({ ...wineData, barcode: undefined });
            } else {
              throw err;
            }
          }
          wineId = wine.id;

          // Save food pairings and cuisine tags (fire-and-forget; don't block on failures)
          if (item.food_pairings?.length) {
            Promise.all(
              item.food_pairings.map(f => db.addFoodPairing(wineId!, f, 'gemini'))
            ).catch(() => {});
          }
          if (item.cuisine_tags?.length) {
            Promise.all(
              item.cuisine_tags.map(t => db.addCuisineTag(wineId!, t as CuisineTag, 'gemini'))
            ).catch(() => {});
          }
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
