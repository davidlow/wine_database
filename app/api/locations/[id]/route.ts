import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentUserId } from '@/lib/auth';
import { checkProfileAccess } from '@/lib/permissions';
import type { LocationType } from '@/types';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const db = await getDb();
    const profileId = await db.getLocationProfileId(id);
    if (!profileId) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const denied = await checkProfileAccess(profileId, userId, 'read');
    if (denied) return denied;

    const locations = await db.getLocations(profileId);
    const location = locations.find(l => l.id === id);
    if (!location) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(location);
  } catch (err) {
    console.error('[GET /api/locations/[id]]', err);
    return NextResponse.json({ error: 'Failed to fetch location' }, { status: 500 });
  }
}

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
      location_type: body.location_type as LocationType | undefined,
      position_x: body.position_x != null ? Number(body.position_x) : undefined,
      position_y: body.position_y != null ? Number(body.position_y) : undefined,
    });
    return NextResponse.json(location);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update location';
    console.error('[PUT /api/locations/[id]]', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PATCH: partial update (e.g. just position_x/y or location_type from defragment)
export async function PATCH(request: NextRequest, { params }: Params) {
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
    const patch: Parameters<typeof db.updateLocation>[1] = {};
    if (body.name !== undefined) patch.name = body.name;
    if (body.group_name !== undefined) patch.group_name = body.group_name?.trim() || undefined;
    if (body.max_capacity !== undefined) patch.max_capacity = body.max_capacity;
    if (body.notes !== undefined) patch.notes = body.notes;
    if (body.location_type !== undefined) patch.location_type = body.location_type as LocationType;
    if (body.position_x !== undefined) patch.position_x = body.position_x != null ? Number(body.position_x) : null;
    if (body.position_y !== undefined) patch.position_y = body.position_y != null ? Number(body.position_y) : null;

    const location = await db.updateLocation(id, patch);
    return NextResponse.json(location);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update location';
    console.error('[PATCH /api/locations/[id]]', err);
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
