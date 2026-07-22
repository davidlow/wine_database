import type { DiscoveredWineExtracted } from '@/types';

const CURRENT_YEAR = new Date().getFullYear();

const MENU_PROMPT = (n: number) => `You are a wine expert analyzing ${n === 1 ? 'a restaurant or winery wine list image' : `${n} pages of a restaurant or winery wine list`}.

Extract EVERY wine entry listed. For each wine provide:
- name: The wine product name (required)
- producer: Winery or producer name
- vintage_year: 4-digit vintage year if shown (integer)
- variety: Grape variety (e.g., "Cabernet Sauvignon", "Chardonnay")
- wine_type: One of exactly: red, white, rosé, sparkling, dessert, fortified, other
- bin_number: Bin or list number if shown (string)
- venue_price: Price on the menu in USD (number). Extract the per-bottle price. If only bottle price shown, use it. If only glass price shown, skip venue_price.
- market_price: Typical retail price in USD — use Google Search to look up the current market retail price for this specific wine. If you cannot find a reliable price, omit this field.
- notes: Any tasting notes, descriptions, or awards mentioned on the list

Rules:
- Extract ALL wines, not just a selection
- "name" is always required — omit the entire entry if you cannot determine the wine name
- For multi-vintage entries (e.g., "2018/2019"), use the most recent year
- Do NOT include non-wine items: beer, spirits, cocktails, food
- venue_price should be the bottle price, not glass price
- Return ONLY a valid JSON array — no markdown, no code fences:
[{"name":"Opus One","producer":"Opus One Winery","vintage_year":2019,"variety":"Cabernet Sauvignon Blend","wine_type":"red","bin_number":"101","venue_price":425,"market_price":280,"notes":""},...]

If no wines are found, return exactly: []

Today's year: ${CURRENT_YEAR}`;

type GeminiPart =
  | { text: string }
  | { inline_data: { mime_type: string; data: string } };

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
  error?: { message: string; code: number };
}

type RawWine = {
  name?: string;
  producer?: string;
  vintage_year?: number;
  variety?: string;
  wine_type?: string;
  bin_number?: string | number;
  venue_price?: number;
  market_price?: number;
  notes?: string;
};

function extractJsonArray(text: string): RawWine[] {
  const clean = text.trim().replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '').trim();
  try {
    const parsed = JSON.parse(clean);
    if (Array.isArray(parsed)) return parsed as RawWine[];
    const firstArray = Object.values(parsed as object).find(v => Array.isArray(v));
    if (firstArray) return firstArray as RawWine[];
  } catch { /* fall through */ }
  const match = clean.match(/\[[\s\S]*\]/);
  if (match) return JSON.parse(match[0]) as RawWine[];
  return [];
}

function sanitize(raw: RawWine): DiscoveredWineExtracted | null {
  if (!raw.name || typeof raw.name !== 'string' || !raw.name.trim()) return null;
  return {
    name: raw.name.trim(),
    producer: typeof raw.producer === 'string' && raw.producer.trim() ? raw.producer.trim() : undefined,
    vintage_year: typeof raw.vintage_year === 'number' && raw.vintage_year >= 1900 && raw.vintage_year <= CURRENT_YEAR + 2
      ? raw.vintage_year : undefined,
    variety: typeof raw.variety === 'string' && raw.variety.trim() ? raw.variety.trim() : undefined,
    wine_type: ['red', 'white', 'rosé', 'sparkling', 'dessert', 'fortified', 'other'].includes(raw.wine_type ?? '')
      ? raw.wine_type : undefined,
    bin_number: raw.bin_number != null ? String(raw.bin_number).trim() : undefined,
    venue_price: typeof raw.venue_price === 'number' && raw.venue_price > 0 ? Math.round(raw.venue_price * 100) / 100 : undefined,
    market_price: typeof raw.market_price === 'number' && raw.market_price > 0 ? Math.round(raw.market_price * 100) / 100 : undefined,
    notes: typeof raw.notes === 'string' && raw.notes.trim() ? raw.notes.trim() : undefined,
  };
}

export async function scanWineMenu(images: string[]): Promise<DiscoveredWineExtracted[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY environment variable is not set');

  const model = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';
  const useGrounding = process.env.GEMINI_GROUNDING !== 'false';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const parts: GeminiPart[] = [];
  images.forEach((img, i) => {
    parts.push({ inline_data: { mime_type: 'image/jpeg', data: img } });
    if (images.length > 1) parts.push({ text: `Page ${i + 1}` });
  });
  parts.push({ text: MENU_PROMPT(images.length) });

  const body = {
    contents: [{ parts }],
    ...(useGrounding ? { tools: [{ google_search: {} }] } : {}),
  };

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
  if (!text) throw new Error('Empty response from Gemini');

  const raw = extractJsonArray(text);
  return raw.map(sanitize).filter((w): w is DiscoveredWineExtracted => w !== null);
}
