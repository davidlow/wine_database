import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const profileId = request.nextUrl.searchParams.get('profile_id');
    const venueName = request.nextUrl.searchParams.get('venue_name') ?? undefined;
    if (!profileId) return NextResponse.json({ error: 'profile_id required' }, { status: 400 });
    const db = await getDb();
    const history = await db.getWinePriceHistory(id, profileId, venueName);
    return NextResponse.json(history);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
