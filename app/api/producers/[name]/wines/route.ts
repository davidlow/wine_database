import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentUserId } from '@/lib/auth';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { name } = await params;
    const producer = decodeURIComponent(name);
    const db = await getDb();
    const wines = await db.getProducerWines(producer);
    return NextResponse.json(wines);
  } catch (err) {
    console.error('[GET /api/producers/[name]/wines]', err);
    return NextResponse.json({ error: 'Failed to fetch producer wines' }, { status: 500 });
  }
}
