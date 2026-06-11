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

    const profileId = await db.getLocationProfileId(id);
    if (!profileId) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const denied = await checkProfileAccess(profileId, userId, 'write');
    if (denied) return denied;

    const body = await request.json();
    const location = await db.updateLocation(id, {
      name: body.name,
      group_name: body.group_name?.trim() || undefined,
      max_capacity: body.max_capacity,
      notes: body.notes,
    });
    return NextResponse.json(location);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update location';
    console.error('[PUT /api/locations/[id]]', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const db = await getDb();

    const profileId = await db.getLocationProfileId(id);
    if (!profileId) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const denied = await checkProfileAccess(profileId, userId, 'write');
    if (denied) return denied;

    await db.deleteLocation(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[DELETE /api/locations/[id]]', err);
    return NextResponse.json({ error: 'Failed to delete location' }, { status: 500 });
  }
}
