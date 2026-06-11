import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentUserId } from '@/lib/auth';
import { checkProfileAccess } from '@/lib/permissions';

export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const profileId = request.nextUrl.searchParams.get('profile_id');
    if (!profileId) return NextResponse.json({ error: 'profile_id required' }, { status: 400 });

    const denied = await checkProfileAccess(profileId, userId, 'read');
    if (denied) return denied;

    const db = await getDb();
    return NextResponse.json(await db.getFreezerLocations(profileId));
  } catch (err) {
    console.error('[GET /api/freezer/locations]', err);
    return NextResponse.json({ error: 'Failed to fetch freezer locations' }, { status: 500 });
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
    const loc = await db.addFreezerLocation(body.profile_id, body.name);
    return NextResponse.json(loc, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create location';
    console.error('[POST /api/freezer/locations]', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
