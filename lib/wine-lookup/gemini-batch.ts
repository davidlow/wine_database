interface GeminiBatchItem {
  barcode: string;
  found: boolean;
  name?: string;
  producer?: string;
  vintage_year?: number;
  variety?: string;
  wine_type?: string;
  region?: string;
  appellation?: string;
  country?: string;
  average_price?: number;
  drink_from_year?: number;
  drink_by_year?: number;
  confidence?: number;
}

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  error?: { message: string };
}

function extractJsonArray(text: string): GeminiBatchItem[] {
  const clean = text.trim().replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '').trim();
  try {
    const parsed = JSON.parse(clean);
    return Array.isArray(parsed) ? (parsed as GeminiBatchItem[]) : [];
  } catch {
    const match = clean.match(/\[[\s\S]*\]/);
    if (match) return JSON.parse(match[0]) as GeminiBatchItem[];
    return [];
  }
}

export async function lookupBarcodesBatch(barcodes: string[]): Promise<GeminiBatchItem[]> {
  if (!barcodes.length) return [];

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

  const model = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';
  const useGrounding = process.env.GEMINI_GROUNDING !== 'false';
  const n = barcodes.length;
  const currentYear = new Date().getFullYear();

  const prompt = `Look up the following ${n} wine barcodes using Google Search and return the wine details for each.

Barcodes:
${barcodes.map((b, i) => `${i + 1}. ${b}`).join('\n')}

Return ONLY a JSON array with exactly ${n} objects, in the same order as the barcodes above:
[
  {
    "barcode": "the exact barcode string",
    "found": true,
    "name": "wine product name (required if found)",
    "producer": "winery / producer name",
    "vintage_year": 2019,
    "variety": "grape variety e.g. Cabernet Sauvignon",
    "wine_type": "red|white|rosé|sparkling|dessert|fortified|other",
    "region": "growing region",
    "appellation": "specific appellation",
    "country": "country of origin",
    "average_price": 24.99,
    "drink_from_year": ${currentYear},
    "drink_by_year": ${currentYear + 10},
    "confidence": 0.9
  },
  { "barcode": "...", "found": false }
]

Rules:
- Return ALL ${n} barcodes even if not found — set found=false for unknowns
- "average_price" is the typical retail price in USD — search for it; omit if truly unknown
- "drink_from_year" is the earliest year this wine should be drunk (when ready)
- "drink_by_year" is the last year this wine should be drunk — default to vintage_year + 10, or ${currentYear + 10} if no vintage
- Omit optional fields you cannot determine rather than guessing
- Return only JSON, no markdown`;

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    ...(useGrounding ? { tools: [{ google_search: {} }] } : {}),
  };

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
  );

  const json: GeminiResponse = await res.json();
  if (!res.ok || json.error) throw new Error(json.error?.message ?? `Gemini API error ${res.status}`);

  const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  if (!text) return barcodes.map(b => ({ barcode: b, found: false }));

  const results = extractJsonArray(text);
  const resultMap = new Map(results.map(r => [r.barcode, r]));
  return barcodes.map(b => resultMap.get(b) ?? { barcode: b, found: false });
}

export type { GeminiBatchItem };
