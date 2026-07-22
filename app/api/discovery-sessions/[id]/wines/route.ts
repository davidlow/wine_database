import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json() as import('@/types').DiscoveredWineExtracted & { label_image?: string };
    if (!body.name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 });
    const db = await getDb();
    const session = await db.getDiscoverySession(id);
    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    const existing = await db.getSessionWines(id);
    const wine = await db.addSessionWine({
      session_id: id,
      wine_id: undefined,
      name: body.name.trim(),
      producer: body.producer,
      vintage_year: body.vintage_year,
      variety: body.variety,
      wine_type: body.wine_type as import('@/types').WineType | undefined,
      bin_number: body.bin_number,
      venue_price: body.venue_price,
      market_price: body.market_price,
      label_image: body.label_image,
      notes: body.notes,
      sort_order: existing.length,
    });
    return NextResponse.json(wine, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
