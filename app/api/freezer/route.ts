import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentUserId } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const profileId = request.nextUrl.searchParams.get('profile_id');
    if (!profileId) return NextResponse.json({ error: 'profile_id required' }, { status: 400 });

    const db = await getDb();
    const items = await db.getFreezerItems(profileId);
    return NextResponse.json(items);
  } catch (err) {
    console.error('[GET /api/freezer]', err);
    return NextResponse.json({ error: 'Failed to fetch freezer inventory' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    if (!body.profile_id) return NextResponse.json({ error: 'profile_id required' }, { status: 400 });
    if (!body.meat_cut?.trim()) return NextResponse.json({ error: 'meat_cut required' }, { status: 400 });
    if (!body.stored_date) return NextResponse.json({ error: 'stored_date required' }, { status: 400 });
    if (!body.quantity || body.quantity < 1) return NextResponse.json({ error: 'quantity must be at least 1' }, { status: 400 });

    const db = await getDb();
    const item = await db.addFreezerItem({
      profile_id: body.profile_id,
      meat_cut: body.meat_cut.trim(),
      primal: body.primal?.trim() || undefined,
      quantity: Number(body.quantity),
      weight_lbs: body.weight_lbs ? Number(body.weight_lbs) : undefined,
      location: body.location?.trim() || undefined,
      stored_date: body.stored_date,
      price_per_lb: body.price_per_lb ? Number(body.price_per_lb) : undefined,
      notes: body.notes?.trim() || undefined,
    }, userId);

    return NextResponse.json(item, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to add item';
    console.error('[POST /api/freezer]', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
