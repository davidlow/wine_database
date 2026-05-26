import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentUserId } from '@/lib/auth';

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const body = await request.json();
    const db = await getDb();
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
    const body = await request.json().catch(() => ({}));
    const quantity = body.quantity ?? 1;

    const db = await getDb();
    await db.removeBottle({ cellar_inventory_id: id, quantity, notes: body.notes }, userId);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to remove bottles';
    console.error('[DELETE /api/cellar/[id]]', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
