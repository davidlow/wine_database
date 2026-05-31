import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentUserId } from '@/lib/auth';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = await getDb();
  const pairings = await db.getFoodPairings(id);
  return NextResponse.json(pairings);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;
    const { food } = await request.json();
    if (!food?.trim()) return NextResponse.json({ error: 'food required' }, { status: 400 });
    const db = await getDb();
    const pairing = await db.addFoodPairing(id, food, 'manual');
    return NextResponse.json(pairing, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params: _params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { pairingId } = await request.json();
    if (!pairingId) return NextResponse.json({ error: 'pairingId required' }, { status: 400 });
    const db = await getDb();
    await db.deleteFoodPairing(pairingId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
