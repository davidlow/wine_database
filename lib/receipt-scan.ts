import type { ScannedWineItem, WineType } from '@/types';

const PACKING_SLIP_PROMPT = `You are a wine cellar management expert. Analyze this wine packing slip or shipping document image.

Extract EVERY wine item listed. These documents come from wineries, wine clubs, or distributors and contain only wine products.

For each wine item, provide:
- name: The wine product name (e.g., "Cabernet Sauvignon Reserve", "Chardonnay Estate"). Required.
- producer: The winery or producer name
- vintage_year: The vintage year as a 4-digit integer, if shown (e.g., 2021)
- variety: The grape variety if mentioned (e.g., "Cabernet Sauvignon", "Pinot Noir")
- wine_type: One of exactly: red, white, rosé, sparkling, dessert, fortified, other
  - Infer from variety if not explicit: Cab/Merlot/Syrah/Zinfandel/Pinot Noir → red; Chardonnay/Sauvignon Blanc/Riesling/Pinot Gris → white; Prosecco/Champagne/Cava/Crémant → sparkling
- quantity: Number of bottles (look for "Qty:", "x2", "2 bottles", column values, etc. Default: 1)
- unit_price: Price per bottle in USD, if shown — packing slips often omit prices, that is fine
- confidence: Your confidence this extraction is correct (0.0 to 1.0)

Rules:
- "name" is always required — use the wine product name, not the winery name alone
- If the same wine appears in multiple sizes (750ml, 1.5L), create separate entries
- Do NOT include non-wine items: packaging materials, shipping fees, wine accessories
- If a row or line looks like a continuation of the previous item, combine rather than duplicate

Return ONLY a valid JSON array — no markdown, no code fences, no explanation:
[{"name":"...","producer":"...","vintage_year":2021,"variety":"...","wine_type":"red","quantity":2,"unit_price":45.00,"confidence":0.95}]

If no wine items are found, return exactly: []`;

const RECEIPT_PROMPT = `You are a wine cellar management expert. Analyze this receipt or invoice image.

Your task: identify ONLY wine purchases. Skip food, beverages other than wine, services, taxes, tips, and non-wine items.

A wine line item typically contains: winery/producer name + wine name + optional vintage year + optional grape variety + quantity + price.
Examples:
- "Jordan Cabernet Sauvignon 2019  1 btl  $65.00"
- "OPUS ONE 2020  x2  $350ea"
- "Cakebread Chardonnay 750ml  Qty:3  @$42  $126.00"
- "Silver Oak Alexander Valley Cabernet  6 btls  $420"
- "Wine Club Allocation: Pinot Noir 2022  2×$38"

For each wine found, extract:
- name: The wine product name (not the store or restaurant name). Required.
- producer: The winery or producer
- vintage_year: 4-digit vintage year if shown
- variety: Grape variety if explicitly stated
- wine_type: One of exactly: red, white, rosé, sparkling, dessert, fortified, other
  - Infer from variety if not stated: Cab/Merlot/Syrah/Pinot Noir/Zin → red; Chardonnay/Sauvignon Blanc/Riesling → white; Champagne/Prosecco/Cava → sparkling; Port/Sherry/Madeira → fortified
- quantity: Number of bottles (default 1 if not shown)
- unit_price: Price per bottle in USD. If a line total is shown with quantity > 1, divide total ÷ quantity and round to 2 decimals.
- confidence: 0.0–1.0. Set lower if you are unsure whether an item is a wine (e.g., "Reserve" with no other context).

Return ONLY a valid JSON array — no markdown, no code fences:
[{"name":"...","producer":"...","vintage_year":2019,"variety":"...","wine_type":"red","quantity":1,"unit_price":65.00,"confidence":0.98}]

If no wines are found on this receipt, return exactly: []`;

type GeminiPart =
  | { text: string }
  | { inline_data: { mime_type: string; data: string } };

interface GeminiRequest {
  contents: Array<{ parts: GeminiPart[] }>;
  generation_config?: Record<string, unknown>;
}

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
  error?: { message: string; code: number };
}

export function extractScannedWines(text: string): ScannedWineItem[] {
  const clean = text.trim()
    .replace(/^```(?:json)?\s*\n?/, '')
    .replace(/\n?```\s*$/, '')
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(clean);
  } catch {
    const match = clean.match(/\[[\s\S]*\]/);
    if (!match) return [];
    try { parsed = JSON.parse(match[0]); } catch { return []; }
  }

  if (!Array.isArray(parsed)) return [];

  return (parsed as Record<string, unknown>[])
    .filter(item => typeof item.name === 'string' && item.name.trim())
    .map(item => ({
      name: String(item.name).trim(),
      producer: typeof item.producer === 'string' ? item.producer.trim() || undefined : undefined,
      vintage_year: typeof item.vintage_year === 'number' && item.vintage_year > 1900 && item.vintage_year < 2100
        ? item.vintage_year
        : undefined,
      variety: typeof item.variety === 'string' ? item.variety.trim() || undefined : undefined,
      wine_type: typeof item.wine_type === 'string' ? item.wine_type as WineType : undefined,
      quantity: typeof item.quantity === 'number' && item.quantity > 0 ? Math.round(item.quantity) : 1,
      unit_price: typeof item.unit_price === 'number' && item.unit_price >= 0 ? item.unit_price : undefined,
      confidence: typeof item.confidence === 'number' ? Math.min(1, Math.max(0, item.confidence)) : undefined,
    }));
}

export async function scanReceipt(
  imageBase64: string,
  mimeType: string,
  docType: 'receipt' | 'packing_slip'
): Promise<ScannedWineItem[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY environment variable is not set');

  const model = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const prompt = docType === 'packing_slip' ? PACKING_SLIP_PROMPT : RECEIPT_PROMPT;

  const body: GeminiRequest = {
    contents: [{
      parts: [
        { inline_data: { mime_type: mimeType, data: imageBase64 } },
        { text: prompt },
      ],
    }],
    generation_config: { temperature: 0.1 },
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

  return extractScannedWines(text);
}
