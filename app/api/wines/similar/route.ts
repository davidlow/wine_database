import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { toVector } from '@/lib/wine-pairing';
import { findSimilarWines, computePriceStats } from '@/lib/wine-similarity';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      wine_id?: string;
      vector?: number[];
      profile_id: string;
      limit?: number;
    };

    if (!body.profile_id) return NextResponse.json({ error: 'profile_id required' }, { status: 400 });
    if (!body.wine_id && !body.vector) return NextResponse.json({ error: 'wine_id or vector required' }, { status: 400 });

    const db = await getDb();
    let targetVector: number[] | null = null;

    if (body.wine_id) {
      const wine = await db.getWineById(body.wine_id);
      if (!wine) return NextResponse.json({ error: 'Wine not found' }, { status: 404 });
      targetVector = toVector(wine);
      if (!targetVector) {
        return NextResponse.json({ similar: [], price_stats: null, reason: 'no_structural_data' });
      }
    } else {
      targetVector = body.vector!;
    }

    // Scope candidates to wines actually in the cellar (qty > 0)
    const cellarWines = await db.getWines({ profile_ids: body.profile_id });
    const limit = body.limit ?? 6;
    const ranked = findSimilarWines(targetVector, cellarWines, limit);

    if (ranked.length === 0) {
      return NextResponse.json({ similar: [], price_stats: null });
    }

    // Load cellar counts for results
    const counts = await db.getCellarCounts(body.profile_id, ranked.map(r => r.wine.id));

    const similar = ranked.map(r => ({
      wine: r.wine,
      distance: Math.round(r.distance * 1000) / 1000,
      cellar_count: counts.get(r.wine.id) ?? 0,
    }));

    const price_stats = computePriceStats(ranked.map(r => r.wine));

    return NextResponse.json({ similar, price_stats });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
