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
    return NextResponse.json(await db.getPantryUsageSettings(profileId));
  } catch (err) {
    console.error('[GET /api/pantry/usage-settings]', err);
    return NextResponse.json({ error: 'Failed to fetch usage settings' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    if (!body.profile_id) return NextResponse.json({ error: 'profile_id required' }, { status: 400 });
    if (!body.item_name?.trim()) return NextResponse.json({ error: 'item_name required' }, { status: 400 });

    const denied = await checkProfileAccess(body.profile_id, userId, 'write');
    if (denied) return denied;

    const db = await getDb();
    const setting = await db.upsertPantryUsageSetting(body.profile_id, body.item_name, {
      days_per_unit: body.days_per_unit != null ? Number(body.days_per_unit) : null,
      reset_date: body.reset_date ?? null,
    });
    return NextResponse.json(setting);
  } catch (err) {
    console.error('[POST /api/pantry/usage-settings]', err);
    return NextResponse.json({ error: 'Failed to save usage setting' }, { status: 500 });
  }
}
