import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentUserId } from '@/lib/auth';

export async function GET() {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const db = await getDb();
    const profiles = await db.getProfiles(userId);
    return NextResponse.json(profiles);
  } catch (err) {
    console.error('[GET /api/profiles]', err);
    return NextResponse.json({ error: 'Failed to fetch profiles' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    if (!body.name?.trim()) {
      return NextResponse.json({ error: 'Profile name is required' }, { status: 400 });
    }

    const db = await getDb();
    const profile = await db.createProfile({ user_id: userId, name: body.name.trim(), description: body.description, group_name: body.group_name || undefined });
    return NextResponse.json(profile, { status: 201 });
  } catch (err) {
    console.error('[POST /api/profiles]', err);
    return NextResponse.json({ error: 'Failed to create profile' }, { status: 500 });
  }
}
