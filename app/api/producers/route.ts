import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentUserId } from '@/lib/auth';

export async function GET() {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const db = await getDb();
    const producers = await db.getProducers();
    return NextResponse.json(producers);
  } catch (err) {
    console.error('[GET /api/producers]', err);
    return NextResponse.json({ error: 'Failed to fetch producers' }, { status: 500 });
  }
}
