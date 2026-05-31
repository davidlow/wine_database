import type { WineType } from '@/types';

export interface WineLookupResult {
  found: boolean;
  barcode?: string;
  name?: string;
  producer?: string;
  variety?: string;
  wine_type?: WineType;
  region?: string;
  appellation?: string;
  country?: string;
  vintage_year?: number;
  description?: string;
  average_price?: number;
  alcohol_content?: number;
  drink_from_year?: number;
  drink_by_year?: number;
  image_url?: string;
  label_image?: string;      // base64 WebP from label capture
  acidity?: number;          // 0–5 structural score
  tannin?: number;
  alcohol?: number;          // 0–5 structural score (not ABV %)
  sweetness?: number;
  body?: number;
  fruit_profile?: string;
  food_pairings?: string[];  // suggested food pairings from Gemini
  source?: 'database' | 'openfoodfacts' | 'label-scan' | 'manual';
  confidence?: number;
}
