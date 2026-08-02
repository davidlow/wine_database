import type { WineLookupResult } from './types';
import type { WineType, PairingWeight } from '@/types';

const CURRENT_YEAR = new Date().getFullYear();

const CUISINE_TAGS = ['aperitif', 'party', 'weeknight', 'celebration', 'french-bistro', 'italian-comfort', 'grilling', 'seafood', 'oysters', 'mediterranean', 'asian-fusion', 'game-meat', 'cheese-board', 'vegetarian', 'fine-dining'] as const;

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
  "minerality": 2,
  "oak_influence": 1,
  "fruit_intensity": 3,
  "fruit_profile": "dark cherry, blackcurrant, plum with hints of cedar",
  "food_pairings": ["grilled ribeye", "rack of lamb", "duck confit", "aged gouda", "mushroom risotto", "braised short ribs", "lamb shoulder"],
  "pairing_weight": "full",
  "cuisine_tags": ["french-bistro", "game-meat"],
  "pairing_rationale": "Firm tannins and dark fruit cut through rich meats while the earthy minerality complements mushroom-based dishes.",
  "confidence": 0.95
}

Rules:
- "name" is required; omit any other field you genuinely cannot determine
- "average_price" is the typical retail price in USD — search for it if not on the label; omit if truly unknown
- "drink_from_year" / "drink_by_year": default to vintage_year + 10 if unknown, or ${CURRENT_YEAR + 10} if no vintage
- Structural scores 0–5: 0 = least/lightest, 5 = most/fullest (e.g. acidity 0=flat, 5=very tart; tannin 0=silky, 5=grippy; alcohol 0=low-ABV, 5=very high-alcohol; sweetness 0=bone-dry, 5=very sweet; body 0=light, 5=full-bodied)
- "minerality" (0–5): 0=earthy/fruit-forward; 5=stony/chalky/saline. Loire Muscadet/Chablis/Pouilly-Fumé/Assyrtiko → 4-5; White Burgundy/Mosel → 2-3; Napa Chard/Viognier → 0-1
- "oak_influence" (0–5): 0=stainless/unoaked; 1-2=old-oak/neutral; 3=mixed/partial; 4-5=new-oak/heavily oaked. Pouilly-Fumé/Sancerre → 0; Barossa Shiraz/new-oak Napa Chard → 4-5
- "fruit_intensity" (0–5): 0=restrained/Old World; 5=fruit-forward/jammy/New World. Barolo/Mosel/Chablis → 1-2; Bordeaux → 2-3; Napa Cab/Barossa Shiraz/Marlborough SB → 4-5
- "fruit_profile": brief free-text description of fruit aromas and flavors
- "food_pairings": 6–10 specific dishes (NOT generic categories). Use precise dishes: "rack of lamb" not "lamb"; "grilled ribeye" not "red meat"; "pan-seared salmon" not "fish". Ensure diversity across occasions.
- "pairing_weight": one of "delicate"|"light"|"medium"|"full"|"robust" reflecting the wine's drinking weight.
  delicate = very light (Poulsard, Schiava, Muscadet); light = cool-climate Pinot Noir (Finger Lakes, Côte de Beaune), Gamay;
  medium = Côte de Nuits / Oregon / Sonoma Pinot, Sangiovese, Grenache (Rhône), structured whites (white Burgundy, Grüner Veltliner);
  full = Nebbiolo, Syrah, Malbec, Zinfandel, Napa Pinot, Cabernet-based blends, rich oaked whites (Chardonnay, Viognier);
  robust = Cabernet Sauvignon, Petit Verdot, Tannat, Amarone, Pomerol-style Merlot.
  Use the grape variety AND region together: a Napa Pinot is "full"; a Finger Lakes Pinot is "light".
- "cuisine_tags": return 1–4 from EXACTLY this list: aperitif, party, weeknight, celebration, french-bistro, italian-comfort, grilling, seafood, oysters, mediterranean, asian-fusion, game-meat, cheese-board, vegetarian, fine-dining. Never invent new tags.
- "pairing_rationale": one sentence naming specific wine characteristics (not the wine name) and why they suit the main pairing occasions.
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
  minerality?: number;
  oak_influence?: number;
  fruit_intensity?: number;
  fruit_profile?: string;
  food_pairings?: string[];
  pairing_weight?: string;
  cuisine_tags?: unknown[];
  pairing_rationale?: string;
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

function extractJsonArray(text: string): Array<WineData & { id?: string }> {
  const clean = text.trim().replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '').trim();
  try {
    const parsed = JSON.parse(clean);
    if (Array.isArray(parsed)) return parsed as Array<WineData & { id?: string }>;
    // Gemini sometimes returns object with array inside
    const firstArray = Object.values(parsed as object).find(v => Array.isArray(v));
    if (firstArray) return firstArray as Array<WineData & { id?: string }>;
  } catch { /* fall through to regex */ }
  const match = clean.match(/\[[\s\S]*\]/);
  if (match) return JSON.parse(match[0]) as Array<WineData & { id?: string }>;
  throw new Error('No valid JSON array in Gemini batch response');
}

function batchPrompt(n: number): string {
  return `You are a wine expert. I have shown you ${n} wine bottle label images above, each labeled with a Wine number and id.

Analyze each label and extract structured wine information using Google Search to fill in missing details.

Return ONLY a JSON array with exactly ${n} objects — no markdown, no code fences, no extra text.
Each object must include the "id" exactly as provided, plus any fields you can determine:

[
  {
    "id": "the exact id string I gave you for Wine 1",
    "name": "wine product name (required if identifiable)",
    "producer": "winery or producer name",
    "vintage_year": 2019,
    "variety": "grape variety",
    "wine_type": "one of: red, white, rosé, sparkling, dessert, fortified, other",
    "region": "growing region",
    "appellation": "specific appellation",
    "country": "country of origin",
    "alcohol_content": 14.5,
    "average_price": 24.99,
    "drink_from_year": ${CURRENT_YEAR},
    "drink_by_year": ${CURRENT_YEAR + 10},
    "description": "one short sentence",
    "acidity": 3,
    "tannin": 4,
    "alcohol": 3,
    "sweetness": 1,
    "body": 4,
    "minerality": 2,
    "oak_influence": 1,
    "fruit_intensity": 3,
    "fruit_profile": "dark cherry, blackcurrant",
    "food_pairings": ["grilled ribeye", "rack of lamb", "duck confit", "aged gouda", "mushroom risotto", "lamb shoulder"],
    "pairing_weight": "full",
    "cuisine_tags": ["french-bistro", "game-meat"],
    "pairing_rationale": "Firm tannins and dark fruit complement rich meats while the earthy notes work well with mushrooms.",
    "confidence": 0.9
  },
  ...one object per wine, in order...
]

Rules:
- Include "id" in every object (copy exactly from my label)
- "name" is required when identifiable; if you truly cannot read the label set "name": null
- Structural scores 0–5 (0=least, 5=most)
- "minerality" (0–5): Loire/Chablis/Muscadet/Assyrtiko → 4-5; Burgundy white → 2-3; Napa Chard → 0-1
- "oak_influence" (0–5): stainless=0; old-oak=1-2; new-oak=4-5
- "fruit_intensity" (0–5): Barolo/Mosel/Chablis → 1-2; Napa/Barossa/Marlborough → 4-5
- "food_pairings": 6–10 specific dishes (NOT generic categories) — "rack of lamb" not "lamb"
- "cuisine_tags": 1–4 from exactly: aperitif, party, weeknight, celebration, french-bistro, italian-comfort, grilling, seafood, oysters, mediterranean, asian-fusion, game-meat, cheese-board, vegetarian, fine-dining
- "pairing_rationale": one sentence on wine characteristics and why they match the pairings
- Do not fabricate uncertain fields — omit them
- "pairing_weight": one of "delicate"|"light"|"medium"|"full"|"robust" (use variety + region: Napa Pinot → "full", Finger Lakes Pinot → "light")
- Return exactly ${n} array elements, one per wine image`;
}

export async function scanLabel(
  frontImageBase64: string,
  backImageBase64?: string | null,
  barcode?: string,
  _forceNoGrounding = false,
): Promise<WineLookupResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY environment variable is not set');

  const model = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';
  const useGrounding = !_forceNoGrounding && process.env.GEMINI_GROUNDING !== 'false';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  let promptText = PROMPT;
  if (backImageBase64) {
    promptText += '\n\nNote: two images are provided — the FIRST is the front label, the SECOND is the back label. Use both to extract maximum information, especially description, alcohol content, and food pairings from the back.';
  }
  if (barcode) {
    promptText += `\n\nNote: the barcode on this bottle is ${barcode} — use it as a search anchor to identify the exact wine.`;
  }

  const imageParts: GeminiPart[] = [
    { inline_data: { mime_type: 'image/webp', data: frontImageBase64 } },
    ...(backImageBase64 ? [{ inline_data: { mime_type: 'image/webp', data: backImageBase64 } } as GeminiPart] : []),
  ];

  const body: GeminiRequest = {
    contents: [{
      parts: [...imageParts, { text: promptText }],
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
    if (useGrounding && (res.status === 400 || res.status === 429) && msg.toLowerCase().includes('grounding')) {
      return scanLabel(frontImageBase64, backImageBase64, barcode, true);
    }
    throw new Error(msg);
  }

  const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  if (!text) throw new Error('Empty response from Gemini');

  const data = extractJson(text);
  if (!data.name) throw new Error('Could not identify wine name from label');

  const validTags = new Set(CUISINE_TAGS as readonly string[]);
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
    minerality: clampScore(data.minerality),
    oak_influence: clampScore(data.oak_influence),
    fruit_intensity: clampScore(data.fruit_intensity),
    fruit_profile: data.fruit_profile,
    food_pairings: Array.isArray(data.food_pairings)
      ? data.food_pairings.filter((f): f is string => typeof f === 'string' && f.trim().length > 0)
      : undefined,
    pairing_weight: (['delicate', 'light', 'medium', 'full', 'robust'] as const).includes(data.pairing_weight as PairingWeight)
      ? data.pairing_weight as PairingWeight
      : undefined,
    cuisine_tags: Array.isArray(data.cuisine_tags)
      ? data.cuisine_tags.filter((t): t is string => typeof t === 'string' && validTags.has(t))
      : undefined,
    pairing_rationale: typeof data.pairing_rationale === 'string' && data.pairing_rationale.trim() ? data.pairing_rationale.trim() : undefined,
    source: 'label-scan',
    confidence: data.confidence,
  };
}

// Text-only enrichment — no image. Used when a wine was identified from a menu scan
// (no label photo available). Gemini uses search grounding to fill structural scores.
export async function enrichWineByText(identity: {
  name: string;
  producer?: string;
  vintage_year?: number;
  variety?: string;
  wine_type?: string;
  region?: string;
  country?: string;
}): Promise<WineLookupResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY environment variable is not set');

  const model = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';
  const useGrounding = process.env.GEMINI_GROUNDING !== 'false';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const desc = [
    identity.name,
    identity.producer && `by ${identity.producer}`,
    identity.vintage_year && `(${identity.vintage_year})`,
    identity.variety,
    identity.region ?? identity.country,
  ].filter(Boolean).join(' ');

  const text = `${PROMPT}\n\nWine to look up (no image — use Google Search to find this wine):\n${desc}`;

  const body = {
    contents: [{ parts: [{ text }] }],
    ...(useGrounding ? { tools: [{ google_search: {} }] } : {}),
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const json = await res.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>; error?: { message: string } };
  if (!res.ok || json.error) throw new Error(json.error?.message ?? `Gemini API error ${res.status}`);

  const responseText = json.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  if (!responseText) throw new Error('Empty response from Gemini');

  const data = extractJson(responseText);
  if (!data.name) throw new Error('Could not identify wine from text description');

  const validTags = new Set(CUISINE_TAGS as readonly string[]);
  return {
    found: true,
    name: data.name ?? identity.name,
    producer: data.producer ?? identity.producer,
    vintage_year: data.vintage_year ?? identity.vintage_year,
    variety: data.variety ?? identity.variety,
    wine_type: (data.wine_type ?? identity.wine_type) as import('@/types').WineType | undefined,
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
    minerality: clampScore(data.minerality),
    oak_influence: clampScore(data.oak_influence),
    fruit_intensity: clampScore(data.fruit_intensity),
    fruit_profile: data.fruit_profile,
    food_pairings: Array.isArray(data.food_pairings)
      ? data.food_pairings.filter((f): f is string => typeof f === 'string' && f.trim().length > 0)
      : undefined,
    pairing_weight: (['delicate', 'light', 'medium', 'full', 'robust'] as const).includes(data.pairing_weight as import('@/types').PairingWeight)
      ? data.pairing_weight as import('@/types').PairingWeight
      : undefined,
    cuisine_tags: Array.isArray(data.cuisine_tags)
      ? data.cuisine_tags.filter((t): t is string => typeof t === 'string' && validTags.has(t))
      : undefined,
    pairing_rationale: typeof data.pairing_rationale === 'string' && data.pairing_rationale.trim() ? data.pairing_rationale.trim() : undefined,
    source: 'label-scan',
    confidence: data.confidence,
  };
}

export interface BatchLabelResult extends Partial<WineLookupResult> {
  id: string;
  found: boolean;
}

export async function scanLabelBatch(
  items: Array<{ id: string; imageBase64: string; backImageBase64?: string; barcode?: string }>
): Promise<BatchLabelResult[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY environment variable is not set');

  const model = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';
  const useGrounding = process.env.GEMINI_GROUNDING !== 'false';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  // Interleave: image, label text, image, label text, ..., final prompt
  const parts: GeminiPart[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    parts.push({ inline_data: { mime_type: 'image/webp', data: item.imageBase64 } });
    if (item.backImageBase64) {
      parts.push({ inline_data: { mime_type: 'image/webp', data: item.backImageBase64 } });
    }
    const barcodeNote = item.barcode ? `, barcode: ${item.barcode}` : '';
    const labelNote = item.backImageBase64 ? ' (front+back labels)' : '';
    parts.push({ text: `Wine ${i + 1} (id: "${item.id}"${barcodeNote}${labelNote})` });
  }
  parts.push({ text: batchPrompt(items.length) });

  const body: GeminiRequest = { contents: [{ parts }] };
  if (useGrounding) body.tools = [{ google_search: {} }];

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const json: GeminiResponse = await res.json();

  if (!res.ok || json.error) {
    throw new Error(json.error?.message ?? `Gemini API error ${res.status}`);
  }

  const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  if (!text) throw new Error('Empty batch response from Gemini');

  const parsed = extractJsonArray(text);

  const validTags = new Set(CUISINE_TAGS as readonly string[]);
  return parsed.map(data => ({
    id: (data as { id?: string }).id ?? '',
    found: !!(data.name),
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
    minerality: clampScore(data.minerality),
    oak_influence: clampScore(data.oak_influence),
    fruit_intensity: clampScore(data.fruit_intensity),
    fruit_profile: data.fruit_profile,
    food_pairings: Array.isArray(data.food_pairings)
      ? data.food_pairings.filter((f): f is string => typeof f === 'string' && f.trim().length > 0)
      : undefined,
    pairing_weight: (['delicate', 'light', 'medium', 'full', 'robust'] as const).includes(data.pairing_weight as PairingWeight)
      ? data.pairing_weight as PairingWeight
      : undefined,
    cuisine_tags: Array.isArray(data.cuisine_tags)
      ? data.cuisine_tags.filter((t): t is string => typeof t === 'string' && validTags.has(t))
      : undefined,
    pairing_rationale: typeof data.pairing_rationale === 'string' && data.pairing_rationale.trim() ? data.pairing_rationale.trim() : undefined,
    confidence: data.confidence,
    source: 'label-scan' as const,
  }));
}

// ── Duplicate verification ────────────────────────────────────────────────────

export interface VerifyDuplicatesResult {
  same: boolean;
  confidence: number;
  reasoning: string;
}

type WineSummary = {
  name: string;
  producer?: string;
  vintage_year?: number;
  variety?: string;
  wine_type?: string;
  region?: string;
  country?: string;
};

export async function verifyDuplicates(wines: WineSummary[]): Promise<VerifyDuplicatesResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY environment variable is not set');

  const model = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const descriptions = wines.map((w, i) =>
    `Wine ${i + 1}: "${w.name}"${w.producer ? ` by ${w.producer}` : ''}${w.vintage_year ? ` (${w.vintage_year})` : ''}${w.variety ? `, ${w.variety}` : ''}${w.region ? `, ${w.region}` : ''}${w.country ? `, ${w.country}` : ''}`
  ).join('\n');

  const prompt = `You are a wine expert. Determine whether the following wine records all refer to the same wine.

${descriptions}

Return ONLY a JSON object — no markdown, no code fences:
{
  "same": true or false,
  "confidence": 0.0–1.0,
  "reasoning": "one or two sentences explaining your conclusion"
}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
  });
  const json = await res.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>; error?: { message: string } };
  if (!res.ok || json.error) throw new Error(json.error?.message ?? `Gemini API error ${res.status}`);

  const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  try {
    const parsed = extractJson(text) as unknown as VerifyDuplicatesResult;
    return {
      same: !!parsed.same,
      confidence: typeof parsed.confidence === 'number' ? Math.max(0, Math.min(1, parsed.confidence)) : 0.5,
      reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : '',
    };
  } catch {
    return { same: false, confidence: 0, reasoning: 'Could not parse Gemini response' };
  }
}

// ── Merge suggestions ─────────────────────────────────────────────────────────

export async function mergeWineSuggestion(wines: WineSummary[]): Promise<Partial<WineSummary & { description?: string; acidity?: number; tannin?: number; alcohol?: number; sweetness?: number; body?: number; appellation?: string; average_price?: number; drink_from_year?: number; drink_by_year?: number }>> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY environment variable is not set');

  const model = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const descriptions = wines.map((w, i) =>
    `Record ${i + 1}: ${JSON.stringify(w)}`
  ).join('\n');

  const prompt = `You are a wine expert. These records likely refer to the same wine. Suggest the best merged values.

${descriptions}

Return ONLY a JSON object with the best single value for each field — no markdown, no code fences:
{
  "name": "best wine name",
  "producer": "best producer name",
  "vintage_year": 2019,
  "variety": "best grape variety",
  "wine_type": "one of: red, white, rosé, sparkling, dessert, fortified, other",
  "region": "best region",
  "appellation": "best appellation if known",
  "country": "best country",
  "description": "one short sentence about the wine style",
  "average_price": 24.99,
  "drink_from_year": 2023,
  "drink_by_year": 2030,
  "acidity": 3,
  "tannin": 4,
  "alcohol": 3,
  "sweetness": 1,
  "body": 4
}
Omit any field you are genuinely uncertain about. Structural scores 0–5.`;

  const useGrounding = process.env.GEMINI_GROUNDING !== 'false';
  const body: Record<string, unknown> = { contents: [{ parts: [{ text: prompt }] }] };
  if (useGrounding) body.tools = [{ google_search: {} }];

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>; error?: { message: string } };
  if (!res.ok || json.error) throw new Error(json.error?.message ?? `Gemini API error ${res.status}`);

  const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  try {
    return extractJson(text) as ReturnType<typeof mergeWineSuggestion> extends Promise<infer T> ? T : never;
  } catch {
    return {};
  }
}
