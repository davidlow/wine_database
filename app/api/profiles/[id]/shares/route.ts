import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentUserId } from '@/lib/auth';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const db = await getDb();

    const perm = await db.getProfilePermission(id, userId);
    if (perm !== 'owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const shares = await db.getSharesForProfile(id);
    return NextResponse.json(shares);
  } catch (err) {
    console.error('[GET /api/profiles/[id]/shares]', err);
    return NextResponse.json({ error: 'Failed to fetch shares' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const body = await request.json();

    if (!body.email?.trim()) return NextResponse.json({ error: 'email required' }, { status: 400 });
    if (!['read', 'write'].includes(body.permission)) return NextResponse.json({ error: 'permission must be read or write' }, { status: 400 });

    const db = await getDb();

    const perm = await db.getProfilePermission(id, userId);
    if (perm !== 'owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const targetUser = await db.getUserByEmail(body.email.trim().toLowerCase());
    if (!targetUser) return NextResponse.json({ error: 'No account found for that email address' }, { status: 404 });
    if (targetUser.id === userId) return NextResponse.json({ error: 'Cannot share a cellar with yourself' }, { status: 400 });

    const share = await db.createShare(id, userId, targetUser.id, targetUser.email, body.permission);
    return NextResponse.json(share, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create share';
    const isDuplicate = message.includes('UNIQUE') || message.includes('unique') || message.includes('duplicate');
    if (isDuplicate) return NextResponse.json({ error: 'That user already has access to this cellar' }, { status: 409 });
    console.error('[POST /api/profiles/[id]/shares]', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
