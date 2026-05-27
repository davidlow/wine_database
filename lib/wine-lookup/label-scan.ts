import type { WineLookupResult } from './types';
import type { WineType } from '@/types';

const PROMPT = `You are a wine expert. Analyze this wine bottle label image and extract structured information.
Use Google Search to look up the wine and fill in any details not visible on the label (grape variety, region, appellation, vintage if not shown, typical price range).

Return ONLY a JSON object — no markdown, no code fences, no extra text:
{
  "name": "wine product name (required — the wine name, not the winery name)",
  "producer": "winery or producer name",
  "vintage_year": 2019,
  "variety": "grape variety e.g. Cabernet Sauvignon, Chardonnay",
  "wine_type": "one of: red, white, rosé, sparkling, dessert, fortified, other",
  "region": "growing region e.g. Napa Valley, Burgundy",
  "appellation": "specific appellation e.g. Oakville AVA, Pommard Premier Cru",
  "country": "country of origin e.g. USA, France, Italy",
  "alcohol_content": 14.5,
  "description": "one short sentence describing the wine style",
  "confidence": 0.95
}

Rules:
- "name" is required; omit any other field you genuinely cannot determine
- Do not guess randomly — omit uncertain fields rather than fabricate them
- "confidence" (0.0–1.0) reflects certainty in the overall extraction`;

type GeminiPart =
  | { text: string }
  | { inline_data: { mime_type: string; data: string } };

interface GeminiRequest {
  contents: Array<{ parts: GeminiPart[] }>;
  tools?: Array<{ google_search: Record<string, never> }>;
  generation_config?: Record<string, unknown>;
}

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  error?: { message: string; code: number };
}

type WineData = {
  name?: string;
  producer?: string;
  vintage_year?: number;
  variety?: string;
  wine_type?: string;
  region?: string;
  appellation?: string;
  country?: string;
  alcohol_content?: number;
  description?: string;
  confidence?: number;
};

function extractJson(text: string): WineData {
  const clean = text.trim().replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '').trim();
  try {
    return JSON.parse(clean) as WineData;
  } catch {
    const match = clean.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]) as WineData;
    throw new Error('No valid JSON in Gemini response');
  }
}

export async function scanLabel(imageBase64: string, barcode?: string): Promise<WineLookupResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY environment variable is not set');

  const model = process.env.GEMINI_MODEL ?? 'gemini-2.0-flash';
  const useGrounding = process.env.GEMINI_GROUNDING !== 'false';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const promptText = barcode
    ? `${PROMPT}\n\nNote: the barcode on this bottle is ${barcode} — use it as a search anchor to identify the exact wine.`
    : PROMPT;

  const body: GeminiRequest = {
    contents: [{
      parts: [
        { inline_data: { mime_type: 'image/jpeg', data: imageBase64 } },
        { text: promptText },
      ],
    }],
  };

  if (useGrounding) {
    body.tools = [{ google_search: {} }];
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const json: GeminiResponse = await res.json();

  if (!res.ok || json.error) {
    const msg = json.error?.message ?? `Gemini API error ${res.status}`;
    // If grounding isn't available on this API key tier, retry without it
    if (useGrounding && (res.status === 400 || res.status === 429) && msg.toLowerCase().includes('grounding')) {
      return scanLabel(imageBase64, barcode); // will use GEMINI_GROUNDING=false path on next env check
    }
    throw new Error(msg);
  }

  const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  if (!text) throw new Error('Empty response from Gemini');

  const data = extractJson(text);
  if (!data.name) throw new Error('Could not identify wine name from label');

  return {
    found: true,
    barcode,
    name: data.name,
    producer: data.producer,
    vintage_year: data.vintage_year,
    variety: data.variety,
    wine_type: data.wine_type as WineType | undefined,
    region: data.region,
    appellation: data.appellation,
    country: data.country,
    alcohol_content: data.alcohol_content,
    description: data.description,
    source: 'label-scan',
    confidence: data.confidence,
  };
}
