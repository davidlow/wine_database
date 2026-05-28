import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentUserId } from '@/lib/auth';

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; noteId: string }> }) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { noteId } = await params;
    const db = await getDb();
    await db.deleteWineNote(noteId);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error('[DELETE /api/wines/[id]/notes/[noteId]]', err);
    return NextResponse.json({ error: 'Failed to delete note' }, { status: 500 });
  }
}
