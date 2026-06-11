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

    const profileId = await db.getFreezerLocationProfileId(id);
    if (!profileId) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const denied = await checkProfileAccess(profileId, userId, 'write');
    if (denied) return denied;

    const body = await request.json();
    if (!body.name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 });

    const loc = await db.renameFreezerLocation(id, body.name);
    return NextResponse.json(loc);
  } catch (err) {
    console.error('[PUT /api/freezer/locations/[id]]', err);
    return NextResponse.json({ error: 'Failed to rename location' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const db = await getDb();

    const profileId = await db.getFreezerLocationProfileId(id);
    if (!profileId) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const denied = await checkProfileAccess(profileId, userId, 'write');
    if (denied) return denied;

    await db.deleteFreezerLocation(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /api/freezer/locations/[id]]', err);
    return NextResponse.json({ error: 'Failed to delete location' }, { status: 500 });
  }
}
