import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { scanLabel, enrichWineByText } from '@/lib/wine-lookup/label-scan';
import { nameSimilarity } from '@/lib/wine-duplicates';
import type { WineLookupResult } from '@/lib/wine-lookup/types';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; wineId: string }> }) {
  try {
    const { id, wineId } = await params;
    const body = await request.json() as { force?: boolean; link_wine_id?: string };

    const db = await getDb();
    const sessionWine = await db.getSessionWineById(wineId);
    if (!sessionWine || sessionWine.session_id !== id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // If the caller just wants to link an existing wine (user chose from dedup dialog)
    if (body.link_wine_id) {
      const updated = await db.updateSessionWine(wineId, { wine_id: body.link_wine_id });
      return NextResponse.json({ wine: null, sessionWine: updated, linked: true });
    }

    // Dedup check (unless forced)
    if (!body.force) {
      const candidates = await db.getWines({
        producer: sessionWine.producer,
        vintage_year: sessionWine.vintage_year,
        variety: sessionWine.variety,
      });
      const duplicates = candidates.filter(w =>
        nameSimilarity(w.name, sessionWine.name) > 0.6
      );
      if (duplicates.length > 0) {
        return NextResponse.json({ duplicates }, { status: 409 });
      }
    }

    // Enrich via Gemini
    let enriched: WineLookupResult;
    if (sessionWine.label_image) {
      enriched = await scanLabel(sessionWine.label_image);
    } else {
      enriched = await enrichWineByText({
        name: sessionWine.name,
        producer: sessionWine.producer,
        vintage_year: sessionWine.vintage_year,
        variety: sessionWine.variety,
        wine_type: sessionWine.wine_type,
      });
    }

    // Create wine in catalog (no inventory)
    const now = new Date().toISOString();
    const wine = await db.createWine({
      name: enriched.name ?? sessionWine.name,
      producer: enriched.producer ?? sessionWine.producer,
      variety: enriched.variety ?? sessionWine.variety,
      wine_type: enriched.wine_type,
      region: enriched.region,
      appellation: enriched.appellation,
      country: enriched.country,
      vintage_year: enriched.vintage_year ?? sessionWine.vintage_year,
      description: enriched.description,
      average_price: enriched.average_price,
      alcohol_content: enriched.alcohol_content,
      drink_from_year: enriched.drink_from_year,
      drink_by_year: enriched.drink_by_year,
      barcode: enriched.barcode,
      image_url: enriched.image_url,
      label_image: enriched.label_image,
      acidity: enriched.acidity,
      tannin: enriched.tannin,
      alcohol: enriched.alcohol,
      sweetness: enriched.sweetness,
      body: enriched.body,
      minerality: enriched.minerality,
      oak_influence: enriched.oak_influence,
      fruit_intensity: enriched.fruit_intensity,
      fruit_profile: enriched.fruit_profile,
      pairing_weight: enriched.pairing_weight,
      pairing_rationale: enriched.pairing_rationale,
    });

    // Fire-and-forget: food pairings + cuisine tags
    if (enriched.food_pairings?.length) {
      Promise.all(enriched.food_pairings.map(f => db.addFoodPairing(wine.id, f, 'gemini'))).catch(() => {});
    }
    if (enriched.cuisine_tags?.length) {
      Promise.all(
        enriched.cuisine_tags.map(t => db.addCuisineTag(wine.id, t as import('@/types').CuisineTag, 'gemini'))
      ).catch(() => {});
    }

    // Link session wine to catalog wine
    const updatedSessionWine = await db.updateSessionWine(wineId, { wine_id: wine.id });

    return NextResponse.json({ wine, sessionWine: updatedSessionWine });
  } catch (err) {
    console.error('[POST /api/discovery-sessions/.../enrich]', err);
    const msg = String(err);
    if (msg.includes('GEMINI_API_KEY')) return NextResponse.json({ error: msg }, { status: 503 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
