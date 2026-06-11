import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentUserId } from '@/lib/auth';
import { checkProfileAccess } from '@/lib/permissions';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const db = await getDb();
    const profile = await db.getProfileById(id, userId);
    if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(profile);
  } catch (err) {
    console.error('[GET /api/profiles/[id]]', err);
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const denied = await checkProfileAccess(id, userId, 'owner');
    if (denied) return denied;

    const body = await request.json();
    const db = await getDb();
    const profile = await db.updateProfile(id, userId, body);
    return NextResponse.json(profile);
  } catch (err) {
    console.error('[PUT /api/profiles/[id]]', err);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const denied = await checkProfileAccess(id, userId, 'owner');
    if (denied) return denied;

    const db = await getDb();
    await db.deleteProfile(id, userId);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[DELETE /api/profiles/[id]]', err);
    return NextResponse.json({ error: 'Failed to delete profile' }, { status: 500 });
  }
}
