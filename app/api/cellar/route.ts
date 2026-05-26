import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentUserId } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = request.nextUrl;
    const profileId = searchParams.get('profile_id');
    const wineId = searchParams.get('wine_id');

    if (!profileId) return NextResponse.json({ error: 'profile_id required' }, { status: 400 });

    const db = await getDb();

    if (wineId) {
      const inventory = await db.getCellarInventoryByWine(wineId, profileId);
      return NextResponse.json(inventory);
    }

    const inventory = await db.getCellarInventory(profileId, userId);
    return NextResponse.json(inventory);
  } catch (err) {
    console.error('[GET /api/cellar]', err);
    return NextResponse.json({ error: 'Failed to fetch inventory' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    if (!body.wine_id) return NextResponse.json({ error: 'wine_id required' }, { status: 400 });
    if (!body.profile_id) return NextResponse.json({ error: 'profile_id required' }, { status: 400 });
    if (!body.location?.trim()) return NextResponse.json({ error: 'location required' }, { status: 400 });

    const db = await getDb();
    const item = await db.addBottle({
      wine_id: body.wine_id,
      profile_id: body.profile_id,
      location: body.location.trim(),
      quantity: body.quantity ?? 1,
      purchase_price: body.purchase_price,
      purchase_date: body.purchase_date,
      notes: body.notes,
    }, userId);

    return NextResponse.json(item, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to add bottles';
    console.error('[POST /api/cellar]', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
