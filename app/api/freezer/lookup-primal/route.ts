import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserId } from '@/lib/auth';

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  error?: { message: string };
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { cut } = await request.json();
    if (!cut?.trim()) return NextResponse.json({ error: 'cut required' }, { status: 400 });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 });

    const model = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `What is the primal cut and location on the animal for the meat cut: "${cut.trim()}"? Respond with ONLY a JSON object like: {"primal": "Rib"} — no markdown, no extra text.`,
          }],
        }],
      }),
    });

    const json: GeminiResponse = await res.json();
    if (!res.ok || json.error) {
      throw new Error(json.error?.message ?? `Gemini error ${res.status}`);
    }

    const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    const clean = text.trim().replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '').trim();
    const data = JSON.parse(clean) as { primal?: string };

    return NextResponse.json({ primal: data.primal ?? '' });
  } catch (err) {
    console.error('[POST /api/freezer/lookup-primal]', err);
    return NextResponse.json({ error: 'Lookup failed' }, { status: 500 });
  }
}
