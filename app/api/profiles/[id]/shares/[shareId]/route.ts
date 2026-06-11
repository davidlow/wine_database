import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentUserId } from '@/lib/auth';

type Params = { params: Promise<{ id: string; shareId: string }> };

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id, shareId } = await params;
    const db = await getDb();

    const perm = await db.getProfilePermission(id, userId);
    if (perm !== 'owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    await db.deleteShare(shareId, userId);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[DELETE /api/profiles/[id]/shares/[shareId]]', err);
    return NextResponse.json({ error: 'Failed to revoke share' }, { status: 500 });
  }
}
