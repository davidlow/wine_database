import type { WineLookupResult } from './types';
import { lookupByBarcodeOpenFoodFacts } from './open-food-facts';
import { getDb } from '@/lib/db';

export async function lookupByBarcode(barcode: string): Promise<WineLookupResult> {
  const db = await getDb();

  // 1. Check own database first
  const existing = await db.getWineByBarcode(barcode);
  if (existing) {
    return {
      found: true,
      barcode,
      name: existing.name,
      producer: existing.producer,
      variety: existing.variety,
      wine_type: existing.wine_type,
      region: existing.region,
      appellation: existing.appellation,
      country: existing.country,
      vintage_year: existing.vintage_year,
      description: existing.description,
      average_price: existing.average_price,
      alcohol_content: existing.alcohol_content,
      image_url: existing.image_url,
      source: 'database',
    };
  }

  // 2. Try Open Food Facts
  const offResult = await lookupByBarcodeOpenFoodFacts(barcode);
  if (offResult.found) return offResult;

  // 3. Not found anywhere
  return { found: false, barcode };
}

export type { WineLookupResult } from './types';
