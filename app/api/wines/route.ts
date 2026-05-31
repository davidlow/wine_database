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
      regions: searchParams.get('regions') ?? undefined,
      appellation: searchParams.get('appellation') ?? undefined,
      vintage_year: searchParams.get('vintage_year') ? Number(searchParams.get('vintage_year')) : undefined,
      producer: searchParams.get('producer') ?? undefined,
      profile_ids: searchParams.get('profile_ids') ?? undefined,
      drink_status: (searchParams.get('drink_status') as DrinkStatusFilter) ?? undefined,
      price_min: searchParams.get('price_min') ? Number(searchParams.get('price_min')) : undefined,
      price_max: searchParams.get('price_max') ? Number(searchParams.get('price_max')) : undefined,
      sort: searchParams.get('sort') ?? undefined,
      acidity_min: searchParams.get('acidity_min') ? Number(searchParams.get('acidity_min')) : undefined,
      acidity_max: searchParams.get('acidity_max') ? Number(searchParams.get('acidity_max')) : undefined,
      tannin_min: searchParams.get('tannin_min') ? Number(searchParams.get('tannin_min')) : undefined,
      tannin_max: searchParams.get('tannin_max') ? Number(searchParams.get('tannin_max')) : undefined,
      sweetness_min: searchParams.get('sweetness_min') ? Number(searchParams.get('sweetness_min')) : undefined,
      sweetness_max: searchParams.get('sweetness_max') ? Number(searchParams.get('sweetness_max')) : undefined,
      body_min: searchParams.get('body_min') ? Number(searchParams.get('body_min')) : undefined,
      body_max: searchParams.get('body_max') ? Number(searchParams.get('body_max')) : undefined,
      alcohol_str_min: searchParams.get('alcohol_str_min') ? Number(searchParams.get('alcohol_str_min')) : undefined,
      alcohol_str_max: searchParams.get('alcohol_str_max') ? Number(searchParams.get('alcohol_str_max')) : undefined,
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
