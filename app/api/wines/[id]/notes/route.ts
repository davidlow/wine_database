import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentUserId } from '@/lib/auth';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const db = await getDb();
    const notes = await db.getWineNotes(id);
    return NextResponse.json(notes);
  } catch (err) {
    console.error('[GET /api/wines/[id]/notes]', err);
    return NextResponse.json({ error: 'Failed to fetch notes' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const body = await request.json();
    if (!body.note?.trim()) {
      return NextResponse.json({ error: 'note is required' }, { status: 400 });
    }

    const db = await getDb();
    const note = await db.addWineNote(id, body.note.trim(), body.tasted_at ?? undefined);
    return NextResponse.json(note, { status: 201 });
  } catch (err) {
    console.error('[POST /api/wines/[id]/notes]', err);
    return NextResponse.json({ error: 'Failed to add note' }, { status: 500 });
  }
}
