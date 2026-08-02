import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentUserId } from '@/lib/auth';
import type { Wine } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json() as {
      keep_id?: string;
      merge_ids?: string[];
      merged_fields?: Partial<Omit<Wine, 'id' | 'created_at' | 'updated_at'>>;
    };

    if (!body.keep_id) return NextResponse.json({ error: 'keep_id required' }, { status: 400 });
    if (!Array.isArray(body.merge_ids) || body.merge_ids.length === 0) {
      return NextResponse.json({ error: 'merge_ids must be a non-empty array' }, { status: 400 });
    }
    if (body.merge_ids.includes(body.keep_id)) {
      return NextResponse.json({ error: 'keep_id must not appear in merge_ids' }, { status: 400 });
    }

    const db = await getDb();
    const wine = await db.mergeWines(body.keep_id, body.merge_ids, body.merged_fields);

    return NextResponse.json({ wine });
  } catch (err) {
    console.error('[POST /api/admin/wines-merge]', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Merge failed' }, { status: 500 });
  }
}
