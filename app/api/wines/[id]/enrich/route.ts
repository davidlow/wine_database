import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentUserId } from '@/lib/auth';
import { scanLabel, enrichWineByText } from '@/lib/wine-lookup/label-scan';
import type { CuisineTag } from '@/types';

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const db = await getDb();
    const wine = await db.getWineById(id);
    if (!wine) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Record which fields were missing before enrichment
    const SCORE_FIELDS = ['acidity', 'tannin', 'alcohol', 'sweetness', 'body', 'minerality', 'oak_influence', 'fruit_intensity'] as const;
    const missingBefore = SCORE_FIELDS.filter(f => wine[f] == null);

    // Enrich via Gemini — same functions used by all scanner flows
    const enriched = wine.label_image
      ? await scanLabel(wine.label_image)
      : await enrichWineByText({
          name: wine.name,
          producer: wine.producer,
          vintage_year: wine.vintage_year,
          variety: wine.variety,
          wine_type: wine.wine_type,
          region: wine.region,
          country: wine.country,
        });

    const updated = await db.updateWine(id, {
      producer: enriched.producer ?? wine.producer,
      variety: enriched.variety ?? wine.variety,
      wine_type: enriched.wine_type ?? wine.wine_type,
      region: enriched.region ?? wine.region,
      appellation: enriched.appellation ?? wine.appellation,
      country: enriched.country ?? wine.country,
      vintage_year: enriched.vintage_year ?? wine.vintage_year,
      description: enriched.description ?? wine.description,
      average_price: enriched.average_price ?? wine.average_price,
      alcohol_content: enriched.alcohol_content ?? wine.alcohol_content,
      drink_from_year: enriched.drink_from_year ?? wine.drink_from_year,
      drink_by_year: enriched.drink_by_year ?? wine.drink_by_year,
      acidity: enriched.acidity ?? wine.acidity,
      tannin: enriched.tannin ?? wine.tannin,
      alcohol: enriched.alcohol ?? wine.alcohol,
      sweetness: enriched.sweetness ?? wine.sweetness,
      body: enriched.body ?? wine.body,
      minerality: enriched.minerality ?? wine.minerality,
      oak_influence: enriched.oak_influence ?? wine.oak_influence,
      fruit_intensity: enriched.fruit_intensity ?? wine.fruit_intensity,
      fruit_profile: enriched.fruit_profile ?? wine.fruit_profile,
      pairing_weight: enriched.pairing_weight ?? wine.pairing_weight,
      pairing_rationale: enriched.pairing_rationale ?? wine.pairing_rationale,
    });

    if (enriched.food_pairings?.length) {
      await Promise.all(
        enriched.food_pairings.map(f => db.addFoodPairing(id, f, 'gemini'))
      ).catch(() => {});
    }
    if (enriched.cuisine_tags?.length) {
      await Promise.all(
        enriched.cuisine_tags.map(t => db.addCuisineTag(id, t as CuisineTag, 'gemini'))
      ).catch(() => {});
    }

    const missingAfter = SCORE_FIELDS.filter(f => updated[f] == null);
    const filled = missingBefore.filter(f => !missingAfter.includes(f));

    return NextResponse.json({ wine: updated, filled, confidence: enriched.confidence });
  } catch (err) {
    console.error('[POST /api/wines/[id]/enrich]', err);
    const msg = String(err);
    if (msg.includes('GEMINI_API_KEY')) return NextResponse.json({ error: msg }, { status: 503 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
