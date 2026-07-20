import type { WineType, PairingWeight } from '@/types';

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
  pairing_weight?: PairingWeight; // Gemini-assigned drinking-weight classification
  minerality?: number;         // 0–5: 0=earthy, 5=stony/chalky/saline
  oak_influence?: number;      // 0–5: 0=unoaked, 5=heavily new-oaked
  fruit_intensity?: number;    // 0–5: 0=restrained/Old-World, 5=fruit-forward/jammy
  pairing_rationale?: string;  // Gemini one-sentence explanation of food pairing logic
  cuisine_tags?: string[];     // 1–4 tags from the 15-item controlled vocabulary
  source?: 'database' | 'openfoodfacts' | 'label-scan' | 'manual';
  confidence?: number;
}
