import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentUserId } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = request.nextUrl;
    const profileId = searchParams.get('profile_id');
    const limit = searchParams.get('limit') ? Number(searchParams.get('limit')) : 50;

    if (!profileId) return NextResponse.json({ error: 'profile_id required' }, { status: 400 });

    const db = await getDb();
    const transactions = await db.getTransactions(profileId, userId, limit);
    return NextResponse.json(transactions);
  } catch (err) {
    console.error('[GET /api/transactions]', err);
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
  }
}
