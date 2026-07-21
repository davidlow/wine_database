import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentUserId } from '@/lib/auth';
import { checkProfileAccess } from '@/lib/permissions';

export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = request.nextUrl;
    const profileId = searchParams.get('profile_id');
    if (!profileId) return NextResponse.json({ error: 'profile_id required' }, { status: 400 });

    const denied = await checkProfileAccess(profileId, userId, 'read');
    if (denied) return denied;

    const db = await getDb();
    const groups = await db.getLocationGroups(profileId);
    return NextResponse.json(groups);
  } catch (err) {
    const msg = err instanceof Error ? err.message : (err as Record<string, string>)?.message ?? JSON.stringify(err);
    console.error('[GET /api/location-groups]', err);
    return NextResponse.json({ error: msg || 'Failed to fetch location groups' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { profile_id, name, parent_id, sort_order } = body;

    if (!profile_id || !name?.trim()) {
      return NextResponse.json({ error: 'profile_id and name are required' }, { status: 400 });
    }

    const denied = await checkProfileAccess(profile_id, userId, 'write');
    if (denied) return denied;

    const db = await getDb();
    const group = await db.createLocationGroup({
      profile_id,
      name: name.trim(),
      parent_id: parent_id ?? null,
      sort_order: sort_order ?? 0,
    });
    return NextResponse.json(group, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : (err as Record<string, string>)?.message ?? JSON.stringify(err);
    console.error('[POST /api/location-groups]', err);
    return NextResponse.json({ error: msg || 'Failed to create location group' }, { status: 500 });
  }
}
