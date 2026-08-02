import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentUserId } from '@/lib/auth';
import { findDuplicateGroups } from '@/lib/wine-duplicates';
import type { Wine } from '@/types';

export async function GET() {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const db = await getDb();
    const all = await db.getWines({});

    const groups = findDuplicateGroups(all);

    // Strip large blobs from list results
    const strip = (w: Wine) => {
      const { label_image: _li, back_image: _bi, ...rest } = w;
      return rest;
    };

    return NextResponse.json({
      groups: groups.map(g => ({ wines: g.wines.map(strip), score: g.score })),
      total_groups: groups.length,
    });
  } catch (err) {
    console.error('[GET /api/admin/wines-duplicates]', err);
    return NextResponse.json({ error: 'Failed to find duplicates' }, { status: 500 });
  }
}
