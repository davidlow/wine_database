import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { recommendWines } from '@/lib/wine-pairing';
import type { PairingSettings } from '@/lib/wine-pairing';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { foods, profile_ids, settings } = body as {
      foods: string[];
      profile_ids?: string[];
      settings?: PairingSettings;
    };

    if (!Array.isArray(foods) || foods.length === 0) {
      return NextResponse.json({ error: 'foods array is required' }, { status: 400 });
    }

    const db = await getDb();

    // Seed wines: wines that pair with the requested foods
    const seedWines = await db.getWinesWithPairings(foods);

    // Candidate pool: wines in the selected profiles (or all wines if no profiles)
    const candidateParams = profile_ids?.length
      ? { profile_ids: profile_ids.join(',') }
      : {};
    const candidateWines = await db.getWines(candidateParams);

    const groups = recommendWines(seedWines, candidateWines, settings ?? {});

    return NextResponse.json({
      groups,
      seed_count: seedWines.length,
      candidate_count: candidateWines.length,
    });
  } catch (err) {
    console.error('[POST /api/food-pairings/recommend]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
