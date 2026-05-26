import type { WineLookupResult } from './types';
import type { WineType } from '@/types';

interface OFFProduct {
  product_name?: string;
  brands?: string;
  quantity?: string;
  countries_tags?: string[];
  categories_tags?: string[];
  labels_tags?: string[];
  nutriments?: { alcohol?: number };
  image_url?: string;
  product_name_en?: string;
  generic_name?: string;
}

interface OFFResponse {
  status: number;
  product?: OFFProduct;
}

function guessWineType(categories: string[] = []): WineType | undefined {
  const cats = categories.join(' ').toLowerCase();
  if (cats.includes('sparkling') || cats.includes('champagne') || cats.includes('prosecco') || cats.includes('cava')) return 'sparkling';
  if (cats.includes('rosé') || cats.includes('rose')) return 'rosé';
  if (cats.includes('white')) return 'white';
  if (cats.includes('red')) return 'red';
  if (cats.includes('dessert') || cats.includes('sweet')) return 'dessert';
  if (cats.includes('port') || cats.includes('sherry') || cats.includes('fortif')) return 'fortified';
  return undefined;
}

function extractCountry(countryTags: string[] = []): string | undefined {
  if (!countryTags.length) return undefined;
  const tag = countryTags[0].replace('en:', '').replace(/-/g, ' ');
  return tag.charAt(0).toUpperCase() + tag.slice(1);
}

export async function lookupByBarcodeOpenFoodFacts(barcode: string): Promise<WineLookupResult> {
  try {
    const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`, {
      headers: { 'User-Agent': 'WineCellarApp/1.0' },
      next: { revalidate: 3600 },
    });

    if (!res.ok) return { found: false };

    const json: OFFResponse = await res.json();
    if (json.status !== 1 || !json.product) return { found: false };

    const p = json.product;
    const name = p.product_name_en ?? p.product_name ?? p.generic_name;
    if (!name) return { found: false };

    return {
      found: true,
      barcode,
      name,
      producer: p.brands,
      wine_type: guessWineType(p.categories_tags),
      country: extractCountry(p.countries_tags),
      alcohol_content: p.nutriments?.alcohol,
      image_url: p.image_url,
      source: 'openfoodfacts',
    };
  } catch {
    return { found: false };
  }
}
