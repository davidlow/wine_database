import { NextRequest, NextResponse } from 'next/server';
import { lookupByBarcode } from '@/lib/wine-lookup';

type Params = { params: Promise<{ code: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { code } = await params;
    if (!code || !/^\d{8,14}$/.test(code)) {
      return NextResponse.json({ error: 'Invalid barcode format' }, { status: 400 });
    }
    const result = await lookupByBarcode(code);
    return NextResponse.json(result);
  } catch (err) {
    console.error('[GET /api/barcode/[code]]', err);
    return NextResponse.json({ error: 'Lookup failed' }, { status: 500 });
  }
}
