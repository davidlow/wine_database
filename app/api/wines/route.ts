import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentUserId } from '@/lib/auth';
import type { WineSearchParams, WineType, DrinkStatusFilter } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const params: WineSearchParams = {
      query: searchParams.get('query') ?? undefined,
      variety: searchParams.get('variety') ?? undefined,
      wine_type: (searchParams.get('wine_type') as WineType) ?? undefined,
      country: searchParams.get('country') ?? undefined,
      region: searchParams.get('region') ?? undefined,
      vintage_year: searchParams.get('vintage_year') ? Number(searchParams.get('vintage_year')) : undefined,
      producer: searchParams.get('producer') ?? undefined,
      profile_ids: searchParams.get('profile_ids') ?? undefined,
      drink_status: (searchParams.get('drink_status') as DrinkStatusFilter) ?? undefined,
    };

    const db = await getDb();
    const wines = await db.getWines(params);
    return NextResponse.json(wines);
  } catch (err) {
    console.error('[GET /api/wines]', err);
    return NextResponse.json({ error: 'Failed to fetch wines' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    if (!body.name?.trim()) {
      return NextResponse.json({ error: 'Wine name is required' }, { status: 400 });
    }

    const db = await getDb();
    const wine = await db.createWine(body);
    return NextResponse.json(wine, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create wine';
    console.error('[POST /api/wines]', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
