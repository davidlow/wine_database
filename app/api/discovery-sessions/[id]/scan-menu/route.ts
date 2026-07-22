import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { scanWineMenu } from '@/lib/wine-discovery-scan';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json() as { images: string[] };
    if (!Array.isArray(body.images) || body.images.length === 0) {
      return NextResponse.json({ error: 'images array required' }, { status: 400 });
    }
    if (body.images.length > 12) {
      return NextResponse.json({ error: 'Maximum 12 images per scan' }, { status: 400 });
    }

    const db = await getDb();
    const session = await db.getDiscoverySession(id);
    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

    const extracted = await scanWineMenu(body.images);
    if (extracted.length === 0) {
      return NextResponse.json({ wines: [] });
    }

    const wines = await db.bulkAddSessionWines(id, extracted.map((w, i) => ({
      session_id: id,
      wine_id: undefined,
      name: w.name,
      producer: w.producer,
      vintage_year: w.vintage_year,
      variety: w.variety,
      wine_type: w.wine_type as import('@/types').WineType | undefined,
      bin_number: w.bin_number,
      venue_price: w.venue_price,
      market_price: w.market_price,
      notes: w.notes,
      sort_order: i,
    })));

    return NextResponse.json({ wines });
  } catch (err) {
    console.error('[POST /api/discovery-sessions/[id]/scan-menu]', err);
    const msg = String(err);
    if (msg.includes('GEMINI_API_KEY')) return NextResponse.json({ error: msg }, { status: 503 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
