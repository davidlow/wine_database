import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserId } from '@/lib/auth';
import { scanReceipt } from '@/lib/receipt-scan';

export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { imageBase64, mimeType = 'image/jpeg', docType = 'receipt' } = body;

    if (!imageBase64) return NextResponse.json({ error: 'imageBase64 required' }, { status: 400 });
    if (!['receipt', 'packing_slip'].includes(docType)) {
      return NextResponse.json({ error: 'docType must be receipt or packing_slip' }, { status: 400 });
    }

    const wines = await scanReceipt(imageBase64, mimeType, docType);
    return NextResponse.json({ wines });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Receipt scan failed';
    console.error('[POST /api/scan-receipt]', err);

    if (message.includes('GEMINI_API_KEY')) {
      return NextResponse.json({ error: 'Gemini API key not configured — set GEMINI_API_KEY in .env.local' }, { status: 503 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
