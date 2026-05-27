import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserId } from '@/lib/auth';
import { scanLabel } from '@/lib/wine-lookup/label-scan';

export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    if (!body.imageBase64) return NextResponse.json({ error: 'imageBase64 required' }, { status: 400 });

    const result = await scanLabel(body.imageBase64, body.barcode ?? undefined);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Label scan failed';
    console.error('[POST /api/label-scan]', err);

    if (message.includes('GEMINI_API_KEY')) {
      return NextResponse.json({ error: 'Gemini API key not configured — set GEMINI_API_KEY in .env.local' }, { status: 503 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
