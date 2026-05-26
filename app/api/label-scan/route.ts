import { NextResponse } from 'next/server';

// Stub endpoint — vision LLM label scanning not yet implemented.
// See lib/wine-lookup/label-scan.ts for the implementation guide.
export async function POST() {
  return NextResponse.json(
    { error: 'Label scanning is not yet implemented. See lib/wine-lookup/label-scan.ts.' },
    { status: 501 }
  );
}
