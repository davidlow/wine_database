import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentUserId } from '@/lib/auth';
import { checkProfileAccess } from '@/lib/permissions';

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const body = await request.json();

    if (!body.new_location?.trim()) return NextResponse.json({ error: 'new_location required' }, { status: 400 });

    const db = await getDb();

    const profileId = await db.getInventoryProfileId(id);
    if (!profileId) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const denied = await checkProfileAccess(profileId, userId, 'write');
    if (denied) return denied;

    await db.moveBottle({
      cellar_inventory_id: id,
      new_location: body.new_location.trim(),
      quantity: body.quantity ?? 1,
      notes: body.notes,
    }, userId);

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to move bottles';
    console.error('[POST /api/cellar/[id]/move]', err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
