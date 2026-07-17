import { NextRequest, NextResponse } from 'next/server';

const CURRENT_YEAR = new Date().getFullYear();

function extractJsonArray(text: string): unknown[] {
  const clean = text.trim().replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '').trim();
  try {
    const parsed = JSON.parse(clean) as unknown;
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    const match = clean.match(/\[[\s\S]*\]/);
    if (match) return JSON.parse(match[0]) as unknown[];
    throw new Error('No valid JSON array in Gemini response');
  }
}

function clampScore(val: unknown): number | null {
  if (typeof val !== 'number' || isNaN(val)) return null;
  return Math.max(0, Math.min(5, Math.round(val)));
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'Gemini not configured' }, { status: 503 });

  let wines: unknown[];
  try {
    const body = await request.json() as { wines?: unknown };
    if (!Array.isArray(body.wines) || body.wines.length === 0) throw new Error();
    wines = body.wines;
  } catch {
    return NextResponse.json({ error: 'wines array required' }, { status: 400 });
  }

  const model = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';
  const useGrounding = process.env.GEMINI_GROUNDING !== 'false';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const prompt = `You are a wine expert database. Enrich the following ${wines.length} wine entr${wines.length === 1 ? 'y' : 'ies'} by filling in any missing or blank fields using your knowledge and web research. Return ONLY a JSON array with exactly ${wines.length} objects in the same input order — no markdown, no code fences, no extra text.

Each object must include ALL of these fields (use null for any you cannot determine):
- name: string (keep exactly as provided)
- producer: string or null
- vintage_year: integer or null
- variety: string (grape variety or blend description) or null
- wine_type: "red"|"white"|"rosé"|"sparkling"|"dessert"|"fortified"|"other" or null
- region: string (growing region) or null
- appellation: string (specific appellation) or null
- country: string or null
- alcohol_content: number (ABV %, e.g. 14.5) or null
- average_price: number (USD retail) or null
- drink_from_year: integer or null
- drink_by_year: integer or null
- description: string (1-2 sentences about wine style) or null
- acidity: integer 0-5 (0=flat/low, 5=very tart/high) or null
- tannin: integer 0-5 (0=silky, 5=grippy) or null
- sweetness: integer 0-5 (0=bone-dry, 5=very sweet) or null
- body: integer 0-5 (0=very light, 5=very full) or null
- alcohol_str: integer 0-5 structural alcohol score (0=low-ABV feel, 5=very high-alcohol feel) or null
- fruit_profile: string (brief free-text of aromas/flavors) or null
- confidence: number 0-1 (how well you know this specific wine)

Rules:
- Preserve any non-null/non-empty values the user already provided
- Only fill in fields that are null or empty string in the input
- Default drink window: vintage+2 to vintage+15 for reds; vintage to vintage+5 for most whites; adjust per wine/region
- If vintage_year is unknown, default to ${CURRENT_YEAR} and ${CURRENT_YEAR + 8}
- Do not fabricate — use null if genuinely uncertain
- "confidence" 0=completely unknown wine, 1=very well-known wine

Wines to enrich:
${JSON.stringify(wines, null, 2)}`;

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    ...(useGrounding ? { tools: [{ google_search: {} }] } : {}),
    generation_config: { temperature: 0.1 },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const json = await res.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    error?: { message: string };
  };

  if (!res.ok || json.error) {
    return NextResponse.json(
      { error: json.error?.message ?? `Gemini error ${res.status}` },
      { status: 502 }
    );
  }

  const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  if (!text) return NextResponse.json({ error: 'Empty response from Gemini' }, { status: 502 });

  let enriched: unknown[];
  try {
    enriched = extractJsonArray(text);
  } catch {
    return NextResponse.json(
      { error: 'Failed to parse Gemini response', raw: text.slice(0, 500) },
      { status: 502 }
    );
  }

  const normalized = enriched.map((w) => {
    if (!w || typeof w !== 'object') return w;
    const wine = w as Record<string, unknown>;
    return {
      ...wine,
      acidity: clampScore(wine.acidity),
      tannin: clampScore(wine.tannin),
      sweetness: clampScore(wine.sweetness),
      body: clampScore(wine.body),
      alcohol_str: clampScore(wine.alcohol_str),
    };
  });

  return NextResponse.json({ enriched: normalized });
}
