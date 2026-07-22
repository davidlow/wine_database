import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

function formatSessionCode(date: Date): string {
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${mo}-${d}_${h}${mi}`;
}

export async function GET(request: NextRequest) {
  const profileId = request.nextUrl.searchParams.get('profile_id');
  if (!profileId) return NextResponse.json({ error: 'profile_id required' }, { status: 400 });
  try {
    const db = await getDb();
    const sessions = await db.getDiscoverySessions(profileId);
    return NextResponse.json(sessions);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      profile_id: string;
      venue_name?: string;
      venue_type?: string;
      gps_lat?: number;
      gps_lng?: number;
      notes?: string;
    };
    if (!body.profile_id) return NextResponse.json({ error: 'profile_id required' }, { status: 400 });
    const db = await getDb();
    const session = await db.createDiscoverySession({
      profile_id: body.profile_id,
      session_code: formatSessionCode(new Date()),
      venue_name: body.venue_name,
      venue_type: body.venue_type as import('@/types').VenueType | undefined,
      gps_lat: body.gps_lat,
      gps_lng: body.gps_lng,
      notes: body.notes,
    });
    return NextResponse.json(session, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
