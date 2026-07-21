import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentUserId } from '@/lib/auth';
import { checkProfileAccess } from '@/lib/permissions';
import type { LocationType } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const profileId = request.nextUrl.searchParams.get('profile_id');
    if (!profileId) return NextResponse.json({ error: 'profile_id required' }, { status: 400 });

    const denied = await checkProfileAccess(profileId, userId, 'read');
    if (denied) return denied;

    const db = await getDb();
    const locations = await db.getLocations(profileId);
    return NextResponse.json(locations);
  } catch (err) {
    console.error('[GET /api/locations]', err);
    return NextResponse.json({ error: 'Failed to fetch locations' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    if (!body.profile_id) return NextResponse.json({ error: 'profile_id required' }, { status: 400 });
    if (!body.name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 });

    const denied = await checkProfileAccess(body.profile_id, userId, 'write');
    if (denied) return denied;

    const db = await getDb();
    const location = await db.createLocation({
      profile_id: body.profile_id,
      name: body.name.trim(),
      group_name: body.group_name?.trim() || undefined,
      max_capacity: body.max_capacity ?? undefined,
      notes: body.notes ?? undefined,
      location_type: (body.location_type as LocationType) || undefined,
    });
    return NextResponse.json(location, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create location';
    console.error('[POST /api/locations]', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
