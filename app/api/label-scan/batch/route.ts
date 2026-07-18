import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserId } from '@/lib/auth';
import { scanLabelBatch } from '@/lib/wine-lookup/label-scan';

export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { items } = body;

    if (!Array.isArray(items) || items.length === 0)
      return NextResponse.json({ error: 'items array required' }, { status: 400 });
    if (items.length > 12)
      return NextResponse.json({ error: 'Maximum 12 items per batch' }, { status: 400 });
    if (items.some((it: unknown) => typeof (it as Record<string, unknown>)?.imageBase64 !== 'string'))
      return NextResponse.json({ error: 'Each item must have imageBase64' }, { status: 400 });

    const results = await scanLabelBatch(items);
    return NextResponse.json({ results });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Batch label scan failed';
    console.error('[POST /api/label-scan/batch]', err);

    if (message.includes('GEMINI_API_KEY')) {
      return NextResponse.json({ error: 'Gemini API key not configured — set GEMINI_API_KEY in .env.local' }, { status: 503 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
