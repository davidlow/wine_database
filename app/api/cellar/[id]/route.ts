import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentUserId } from '@/lib/auth';
import { checkProfileAccess } from '@/lib/permissions';

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const db = await getDb();

    const profileId = await db.getInventoryProfileId(id);
    if (!profileId) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const denied = await checkProfileAccess(profileId, userId, 'write');
    if (denied) return denied;

    const body = await request.json();
    const item = await db.updateBottleInventory(id, body);
    return NextResponse.json(item);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update inventory';
    console.error('[PUT /api/cellar/[id]]', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const db = await getDb();

    const profileId = await db.getInventoryProfileId(id);
    if (!profileId) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const denied = await checkProfileAccess(profileId, userId, 'write');
    if (denied) return denied;

    const body = await request.json().catch(() => ({}));
    const quantity = body.quantity ?? 1;
    await db.removeBottle({ cellar_inventory_id: id, quantity, notes: body.notes }, userId);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to remove bottles';
    console.error('[DELETE /api/cellar/[id]]', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
