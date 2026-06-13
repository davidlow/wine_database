import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserId } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { lookupByBarcodeOpenFoodFacts } from '@/lib/wine-lookup/open-food-facts';
import type { BulkScanItem } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { barcodes } = await request.json();
    if (!Array.isArray(barcodes) || barcodes.length === 0) {
      return NextResponse.json({ error: 'barcodes array required' }, { status: 400 });
    }
    if (barcodes.length > 100) {
      return NextResponse.json({ error: 'Maximum 100 barcodes per batch' }, { status: 400 });
    }

    const db = await getDb();

    // Step 1: check internal DB + Open Food Facts for each barcode in parallel
    const results: BulkScanItem[] = await Promise.all(
      (barcodes as string[]).map(async (barcode): Promise<BulkScanItem> => {
        // Internal DB first — returns wine_id so we skip re-creating the wine later
        const existing = await db.getWineByBarcode(barcode);
        if (existing) {
          return {
            barcode, quantity: 1, found: true,
            wine_id: existing.id,
            name: existing.name, producer: existing.producer,
            vintage_year: existing.vintage_year, variety: existing.variety,
            wine_type: existing.wine_type, region: existing.region,
            appellation: existing.appellation, country: existing.country,
            description: existing.description,
            source: 'database',
          };
        }

        // Open Food Facts
        const off = await lookupByBarcodeOpenFoodFacts(barcode);
        if (off.found) {
          return {
            barcode, quantity: 1, found: true,
            name: off.name, producer: off.producer,
            wine_type: off.wine_type, country: off.country,
            alcohol_content: off.alcohol_content,
            source: 'openfoodfacts',
          } as BulkScanItem;
        }

        return { barcode, quantity: 1, found: false };
      })
    );

    // Unknown barcodes are returned as found:false — the caller handles label scanning.
    return NextResponse.json(results);
  } catch (err) {
    console.error('[POST /api/barcode/batch]', err);
    return NextResponse.json({ error: 'Batch lookup failed' }, { status: 500 });
  }
}
