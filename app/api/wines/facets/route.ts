import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserId } from '@/lib/auth';
import { getDb } from '@/lib/db';

const ALLOWED_FIELDS = ['variety', 'country', 'region', 'producer', 'appellation'] as const;

export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const field = searchParams.get('field') ?? '';
    const q = searchParams.get('q') ?? '';

    if (!(ALLOWED_FIELDS as readonly string[]).includes(field)) {
      return NextResponse.json({ error: 'Invalid field' }, { status: 400 });
    }

    const db = await getDb();
    const suggestions = await db.getWineFacets(field, q);
    return NextResponse.json(suggestions);
  } catch (err) {
    console.error('[GET /api/wines/facets]', err);
    return NextResponse.json({ error: 'Failed to fetch suggestions' }, { status: 500 });
  }
}
