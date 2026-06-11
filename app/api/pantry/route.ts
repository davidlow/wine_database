import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentUserId } from '@/lib/auth';
import { checkProfileAccess } from '@/lib/permissions';

export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const profileId = request.nextUrl.searchParams.get('profile_id');
    if (!profileId) return NextResponse.json({ error: 'profile_id required' }, { status: 400 });

    const denied = await checkProfileAccess(profileId, userId, 'read');
    if (denied) return denied;

    const db = await getDb();
    return NextResponse.json(await db.getPantryItems(profileId));
  } catch (err) {
    console.error('[GET /api/pantry]', err);
    return NextResponse.json({ error: 'Failed to fetch pantry' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    if (!body.profile_id) return NextResponse.json({ error: 'profile_id required' }, { status: 400 });
    if (!body.name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 });
    if (!body.stored_date) return NextResponse.json({ error: 'stored_date required' }, { status: 400 });

    const denied = await checkProfileAccess(body.profile_id, userId, 'write');
    if (denied) return denied;

    const db = await getDb();
    const item = await db.addPantryItem({
      profile_id: body.profile_id,
      name: body.name,
      brand: body.brand,
      category: body.category,
      quantity: Number(body.quantity) || 1,
      unit: body.unit,
      location: body.location,
      stored_date: body.stored_date,
      best_by_date: body.best_by_date,
      best_by_days: body.best_by_days != null ? Number(body.best_by_days) : undefined,
      notes: body.notes,
    }, userId);
    return NextResponse.json(item, { status: 201 });
  } catch (err) {
    console.error('[POST /api/pantry]', err);
    return NextResponse.json({ error: 'Failed to add pantry item' }, { status: 500 });
  }
}
