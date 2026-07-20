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

    const group = await db.getLocationGroupById(id);
    if (!group) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const denied = await checkProfileAccess(group.profile_id, userId, 'write');
    if (denied) return denied;

    const body = await request.json();
    const updated = await db.updateLocationGroup(id, {
      name: body.name?.trim(),
      parent_id: body.parent_id,
      sort_order: body.sort_order,
    });
    return NextResponse.json(updated);
  } catch (err) {
    console.error('[PUT /api/location-groups/[id]]', err);
    return NextResponse.json({ error: 'Failed to update location group' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const db = await getDb();

    const group = await db.getLocationGroupById(id);
    if (!group) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const denied = await checkProfileAccess(group.profile_id, userId, 'write');
    if (denied) return denied;

    await db.deleteLocationGroup(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[DELETE /api/location-groups/[id]]', err);
    return NextResponse.json({ error: 'Failed to delete location group' }, { status: 500 });
  }
}
