import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentUserId } from '@/lib/auth';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const quantity = Number(body.quantity ?? 1);
    if (quantity < 1) return NextResponse.json({ error: 'quantity must be at least 1' }, { status: 400 });

    const db = await getDb();
    const item = await db.removeFreezerItem(id, quantity, userId);
    return NextResponse.json(item);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to remove item';
    console.error('[DELETE /api/freezer/[id]]', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
