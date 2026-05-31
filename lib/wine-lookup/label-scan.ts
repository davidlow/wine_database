import type { WineLookupResult } from './types';
import type { WineType } from '@/types';

const CURRENT_YEAR = new Date().getFullYear();

const PROMPT = `You are a wine expert. Analyze this wine bottle label image and extract structured information.
Use Google Search to look up the wine and fill in any details not visible on the label (grape variety, region, appellation, vintage if not shown, typical retail price, drink window, structural characteristics, food pairings).

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
  "average_price": 24.99,
  "drink_from_year": ${CURRENT_YEAR},
  "drink_by_year": ${CURRENT_YEAR + 10},
  "description": "one short sentence describing the wine style",
  "acidity": 3,
  "tannin": 4,
  "alcohol": 3,
  "sweetness": 1,
  "body": 4,
  "fruit_profile": "dark cherry, blackcurrant, plum with hints of cedar",
  "food_pairings": ["grilled steak", "lamb chops", "aged cheddar", "mushroom risotto", "dark chocolate"],
  "confidence": 0.95
}

Rules:
- "name" is required; omit any other field you genuinely cannot determine
- "average_price" is the typical retail price in USD — search for it if not on the label; omit if truly unknown
- "drink_from_year" / "drink_by_year": default to vintage_year + 10 if unknown, or ${CURRENT_YEAR + 10} if no vintage
- Structural scores 0–5: 0 = least/lightest, 5 = most/fullest (e.g. acidity 0=flat, 5=very tart; tannin 0=silky, 5=grippy; alcohol 0=low-ABV, 5=very high-alcohol; sweetness 0=bone-dry, 5=very sweet; body 0=light, 5=full-bodied)
- "fruit_profile": brief free-text description of fruit aromas and flavors
- "food_pairings": 4–8 specific dishes or food categories that pair well with this wine
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
  average_price?: number;
  drink_from_year?: number;
  drink_by_year?: number;
  description?: string;
  acidity?: number;
  tannin?: number;
  alcohol?: number;
  sweetness?: number;
  body?: number;
  fruit_profile?: string;
  food_pairings?: string[];
  confidence?: number;
};

function clampScore(val: number | undefined): number | undefined {
  if (val == null || typeof val !== 'number' || isNaN(val)) return undefined;
  return Math.max(0, Math.min(5, Math.round(val)));
}

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

  const model = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';
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
    average_price: data.average_price,
    drink_from_year: data.drink_from_year,
    drink_by_year: data.drink_by_year,
    description: data.description,
    acidity: clampScore(data.acidity),
    tannin: clampScore(data.tannin),
    alcohol: clampScore(data.alcohol),
    sweetness: clampScore(data.sweetness),
    body: clampScore(data.body),
    fruit_profile: data.fruit_profile,
    food_pairings: Array.isArray(data.food_pairings)
      ? data.food_pairings.filter((f): f is string => typeof f === 'string' && f.trim().length > 0)
      : undefined,
    source: 'label-scan',
    confidence: data.confidence,
  };
}
