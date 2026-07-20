import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentUserId } from '@/lib/auth';
import type { CuisineTag } from '@/types';

const VALID_TAGS = new Set<CuisineTag>([
  'aperitif', 'party', 'weeknight', 'celebration',
  'french-bistro', 'italian-comfort', 'grilling', 'seafood',
  'oysters', 'mediterranean', 'asian-fusion', 'game-meat',
  'cheese-board', 'vegetarian', 'fine-dining',
]);

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = await getDb();
  const tags = await db.getCuisineTags(id);
  return NextResponse.json(tags);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;
    const { tag } = await request.json();
    if (!tag || !VALID_TAGS.has(tag as CuisineTag)) {
      return NextResponse.json({ error: 'Invalid or missing tag' }, { status: 400 });
    }
    const db = await getDb();
    const result = await db.addCuisineTag(id, tag as CuisineTag, 'manual');
    return NextResponse.json(result, { status: 201 });
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
    const { tagId } = await request.json();
    if (!tagId) return NextResponse.json({ error: 'tagId required' }, { status: 400 });
    const db = await getDb();
    await db.deleteCuisineTag(tagId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
