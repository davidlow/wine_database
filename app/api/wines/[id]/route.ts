import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentUserId } from '@/lib/auth';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const db = await getDb();
    const wine = await db.getWineById(id);
    if (!wine) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(wine);
  } catch (err) {
    console.error('[GET /api/wines/[id]]', err);
    return NextResponse.json({ error: 'Failed to fetch wine' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const body = await request.json();
    const db = await getDb();
    const wine = await db.updateWine(id, body);
    return NextResponse.json(wine);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update wine';
    console.error('[PUT /api/wines/[id]]', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const db = await getDb();
    await db.deleteWine(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[DELETE /api/wines/[id]]', err);
    return NextResponse.json({ error: 'Failed to delete wine' }, { status: 500 });
  }
}
