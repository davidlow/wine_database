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
  image_url?: string;
  source?: 'database' | 'openfoodfacts' | 'label-scan' | 'manual';
  confidence?: number;
}
