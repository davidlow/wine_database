import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const db = await getDb();
    // Lightweight query — no results expected, just proves Supabase is awake
    await db.getWines({ vintage_year: 9999 });
    const ts = new Date().toISOString();
    console.log(`[keepalive] DB ping OK at ${ts}`);
    return NextResponse.json({ ok: true, ts });
  } catch (err) {
    console.error('[keepalive] DB ping failed:', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'unknown' },
      { status: 500 }
    );
  }
}
