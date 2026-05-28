import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserId } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { lookupByBarcodeOpenFoodFacts } from '@/lib/wine-lookup/open-food-facts';
import { lookupBarcodesBatch } from '@/lib/wine-lookup/gemini-batch';
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

    // Step 2: send all still-unknown barcodes to Gemini in one call
    const unknownBarcodes = results.filter(r => !r.found).map(r => r.barcode);

    if (unknownBarcodes.length > 0 && process.env.GEMINI_API_KEY) {
      try {
        const geminiResults = await lookupBarcodesBatch(unknownBarcodes);
        const geminiMap = new Map(geminiResults.map(r => [r.barcode, r]));

        for (const item of results) {
          if (!item.found) {
            const gr = geminiMap.get(item.barcode);
            if (gr?.found && gr.name) {
              Object.assign(item, {
                found: true,
                name: gr.name,
                producer: gr.producer,
                vintage_year: gr.vintage_year,
                variety: gr.variety,
                wine_type: gr.wine_type,
                region: gr.region,
                appellation: gr.appellation,
                country: gr.country,
                average_price: gr.average_price,
                drink_from_year: gr.drink_from_year,
                drink_by_year: gr.drink_by_year,
                confidence: gr.confidence,
                source: 'gemini-batch',
              });
            }
          }
        }
      } catch (err) {
        // Gemini failure is non-fatal — items remain as "not found"
        console.error('[Gemini batch lookup]', err);
      }
    }

    return NextResponse.json(results);
  } catch (err) {
    console.error('[POST /api/barcode/batch]', err);
    return NextResponse.json({ error: 'Batch lookup failed' }, { status: 500 });
  }
}
