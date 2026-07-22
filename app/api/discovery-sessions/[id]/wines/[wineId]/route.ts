import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string; wineId: string }> }) {
  try {
    const { wineId } = await params;
    const body = await request.json() as Partial<import('@/types').DiscoverySessionWine>;
    const db = await getDb();
    const updated = await db.updateSessionWine(wineId, body);
    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; wineId: string }> }) {
  try {
    const { wineId } = await params;
    const db = await getDb();
    await db.deleteSessionWine(wineId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
