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

    const profileId = await db.getFreezerItemProfileId(id);
    if (!profileId) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const denied = await checkProfileAccess(profileId, userId, 'write');
    if (denied) return denied;

    const body = await request.json();
    const updates: Parameters<typeof db.updateFreezerItem>[1] = {};
    if (body.meat_cut !== undefined) updates.meat_cut = String(body.meat_cut).trim();
    if (body.primal !== undefined) updates.primal = body.primal ? String(body.primal).trim() : undefined;
    if (body.quantity !== undefined) updates.quantity = Number(body.quantity);
    if (body.weight_lbs !== undefined) updates.weight_lbs = body.weight_lbs ? Number(body.weight_lbs) : undefined;
    if (body.location !== undefined) updates.location = String(body.location).trim();
    if (body.stored_date !== undefined) updates.stored_date = String(body.stored_date);
    if (body.price_per_lb !== undefined) updates.price_per_lb = body.price_per_lb ? Number(body.price_per_lb) : undefined;
    if (body.notes !== undefined) updates.notes = body.notes ? String(body.notes).trim() : undefined;

    if (updates.quantity !== undefined && updates.quantity < 1) {
      return NextResponse.json({ error: 'quantity must be at least 1' }, { status: 400 });
    }

    const item = await db.updateFreezerItem(id, updates);
    return NextResponse.json(item);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update item';
    console.error('[PUT /api/freezer/[id]]', err);
    return NextResponse.json({ error: message }, { status: 500 });
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

    const profileId = await db.getFreezerItemProfileId(id);
    if (!profileId) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const denied = await checkProfileAccess(profileId, userId, 'write');
    if (denied) return denied;

    const body = await request.json().catch(() => ({}));
    const quantity = Number(body.quantity ?? 1);
    if (quantity < 1) return NextResponse.json({ error: 'quantity must be at least 1' }, { status: 400 });

    const item = await db.removeFreezerItem(id, quantity, userId);
    return NextResponse.json(item);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to remove item';
    console.error('[DELETE /api/freezer/[id]]', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
