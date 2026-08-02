import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentUserId } from '@/lib/auth';

const SCORE_FIELDS = ['acidity', 'tannin', 'alcohol', 'sweetness', 'body'] as const;

export async function GET() {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const db = await getDb();
    const all = await db.getWines({});

    const missing = all
      .filter(w => SCORE_FIELDS.some(f => w[f] == null))
      .map(w => ({
        id: w.id,
        name: w.name,
        producer: w.producer,
        vintage_year: w.vintage_year,
        wine_type: w.wine_type,
        variety: w.variety,
        has_label_image: !!w.label_image,
        missing_fields: SCORE_FIELDS.filter(f => w[f] == null) as string[],
        // Include existing scores for display
        acidity: w.acidity,
        tannin: w.tannin,
        alcohol: w.alcohol,
        sweetness: w.sweetness,
        body: w.body,
        minerality: w.minerality,
        oak_influence: w.oak_influence,
        fruit_intensity: w.fruit_intensity,
        fruit_profile: w.fruit_profile,
        pairing_weight: w.pairing_weight,
      }));

    return NextResponse.json({ wines: missing, total: missing.length });
  } catch (err) {
    console.error('[GET /api/admin/wines-missing-features]', err);
    return NextResponse.json({ error: 'Failed to query wines' }, { status: 500 });
  }
}
