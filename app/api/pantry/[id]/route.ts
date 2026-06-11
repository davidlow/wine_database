import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentUserId } from '@/lib/auth';
import { checkProfileAccess } from '@/lib/permissions';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const db = await getDb();

    const profileId = await db.getPantryItemProfileId(id);
    if (!profileId) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const denied = await checkProfileAccess(profileId, userId, 'write');
    if (denied) return denied;

    const body = await request.json();
    const item = await db.updatePantryItem(id, {
      name: body.name,
      brand: body.brand,
      category: body.category,
      quantity: body.quantity != null ? Number(body.quantity) : undefined,
      unit: body.unit,
      location: body.location,
      stored_date: body.stored_date,
      best_by_date: body.best_by_date,
      best_by_days: body.best_by_days != null ? Number(body.best_by_days) : undefined,
      notes: body.notes,
    });
    return NextResponse.json(item);
  } catch (err) {
    console.error('[PUT /api/pantry/[id]]', err);
    return NextResponse.json({ error: 'Failed to update pantry item' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const db = await getDb();

    const profileId = await db.getPantryItemProfileId(id);
    if (!profileId) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const denied = await checkProfileAccess(profileId, userId, 'write');
    if (denied) return denied;

    const body = await request.json().catch(() => ({}));
    const quantity = Number(body.quantity) || 1;
    const item = await db.removePantryItem(id, quantity, userId);
    return NextResponse.json(item);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to remove item';
    console.error('[DELETE /api/pantry/[id]]', err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
