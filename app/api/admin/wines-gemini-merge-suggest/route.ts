import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentUserId } from '@/lib/auth';
import { mergeWineSuggestion } from '@/lib/wine-lookup/label-scan';

export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json() as { wine_ids?: string[] };
    if (!Array.isArray(body.wine_ids) || body.wine_ids.length < 2) {
      return NextResponse.json({ error: 'wine_ids must be an array of at least 2 IDs' }, { status: 400 });
    }

    const db = await getDb();
    const wines = await Promise.all(body.wine_ids.map(id => db.getWineById(id)));
    const found = wines.filter(Boolean);
    if (found.length < 2) return NextResponse.json({ error: 'Could not find wines' }, { status: 404 });

    const merged = await mergeWineSuggestion(found.map(w => ({
      name: w!.name,
      producer: w!.producer,
      vintage_year: w!.vintage_year,
      variety: w!.variety,
      wine_type: w!.wine_type,
      region: w!.region,
      country: w!.country,
    })));

    return NextResponse.json({ merged });
  } catch (err) {
    console.error('[POST /api/admin/wines-gemini-merge-suggest]', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Suggestion failed' }, { status: 500 });
  }
}
