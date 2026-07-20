import type { Wine, Location, LocationGroup, CellarInventory, CuisineTag } from '@/types';

export type CellarInventoryWithWine = CellarInventory & { wine: Wine };

export interface LocationWithBottles {
  location: Location;
  bottles: CellarInventoryWithWine[];
}

// ---------------------------------------------------------------------------
// Variety families (theme detection + daily-location scoring)
// ---------------------------------------------------------------------------

export const VARIETY_FAMILIES: Record<string, string[]> = {
  'light-red':       ['Pinot Noir', 'Gamay', 'Grenache', 'Dolcetto', 'Barbera', 'Zweigelt', 'Frappato', 'Schiava'],
  'full-red':        ['Cabernet Sauvignon', 'Merlot', 'Zinfandel', 'Malbec', 'Syrah', 'Shiraz',
                      'Cabernet Franc', 'Nebbiolo', 'Sangiovese', 'Tempranillo', 'Mourvèdre',
                      'Petite Sirah', 'Montepulciano', 'Aglianico', "Nero d'Avola"],
  'aromatic-white':  ['Riesling', 'Gewürztraminer', 'Viognier', 'Muscat', 'Torrontés', 'Moscato'],
  'neutral-white':   ['Chardonnay', 'Pinot Gris', 'Pinot Blanc', 'Roussanne', 'Marsanne'],
  'crisp-white':     ['Sauvignon Blanc', 'Albariño', 'Pinot Grigio', 'Grüner Veltliner',
                      'Vermentino', 'Verdejo', 'Assyrtiko', 'Fiano', 'Verdicchio'],
  'rosé':            ['Rosé', 'Provence Rosé'],
  'sparkling':       ['Champagne', 'Prosecco', 'Cava', 'Crémant', 'Pétillant Naturel', 'Franciacorta', 'Sekt'],
  'dessert':         ['Sauternes', 'Ice Wine', 'Late Harvest', 'Port', 'Sherry', 'Madeira',
                      'Passito', 'Vin Santo', 'Tokaji'],
};

export const REGION_GROUPS: Record<string, string[]> = {
  'finger-lakes':  ['Finger Lakes', 'New York', 'NY', 'Hudson Valley', 'Long Island'],
  'california':    ['Napa', 'Napa Valley', 'Sonoma', 'California', 'Paso Robles',
                    'Santa Barbara', 'Santa Cruz Mountains', 'Mendocino', 'Carneros',
                    'Russian River Valley', 'Alexander Valley', 'Dry Creek Valley',
                    'Santa Rita Hills', 'Anderson Valley'],
  'france':        ['Burgundy', 'Bordeaux', 'Champagne', 'Loire', 'Rhône', 'Alsace',
                    'Provence', 'Languedoc', 'France', "Côte d'Or", 'Beaujolais',
                    "Côte de Beaune", "Côte de Nuits", "Châteauneuf-du-Pape", 'Sancerre', "Pouilly-Fumé"],
  'italy':         ['Tuscany', 'Piedmont', 'Veneto', 'Sicily', 'Friuli', 'Italy',
                    'Barolo', 'Chianti', 'Brunello', 'Amarone', 'Prosecco', 'Soave'],
  'other-europe':  ['Spain', 'Germany', 'Austria', 'Portugal', 'Greece', 'Hungary',
                    'Rioja', 'Priorat', 'Douro', 'Mosel', 'Rheingau', 'Wachau'],
  'new-world':     ['Australia', 'New Zealand', 'Argentina', 'Chile', 'South Africa',
                    'Marlborough', 'Barossa', 'Mendoza'],
};

// ---------------------------------------------------------------------------
// Style clusters — finer-grained, region-aware placement scoring
// ---------------------------------------------------------------------------

// Varieties that always map to the same cluster regardless of region
const VARIETY_CLUSTER: Record<string, string> = {
  'Cabernet Sauvignon': 'full-bodied-red',
  'Merlot':             'full-bodied-red',
  'Malbec':             'full-bodied-red',
  'Nebbiolo':           'full-bodied-red',
  'Petite Sirah':       'full-bodied-red',
  'Tannat':             'full-bodied-red',
  'Petit Verdot':       'full-bodied-red',
  'Aglianico':          'full-bodied-red',
  "Nero d'Avola":       'full-bodied-red',
  'Mourvèdre':          'full-bodied-red',
  'Monastrell':         'full-bodied-red',
  'Sangiovese':         'medium-bodied-red',
  'Tempranillo':        'medium-bodied-red',
  'Barbera':            'medium-bodied-red',
  'Dolcetto':           'medium-bodied-red',
  'Montepulciano':      'medium-bodied-red',
  'Nerello Mascalese':  'medium-bodied-red',
  'Gamay':              'cool-climate-red',
  'Zweigelt':           'cool-climate-red',
  'Trollinger':         'cool-climate-red',
  'Poulsard':           'cool-climate-red',
  'Trousseau':          'cool-climate-red',
  'Frappato':           'cool-climate-red',
  'Schiava':            'cool-climate-red',
  'Riesling':           'aromatic-white',
  'Gewürztraminer':     'aromatic-white',
  'Muscat':             'aromatic-white',
  'Torrontés':          'aromatic-white',
  'Moscato':            'aromatic-white',
  'Albariño':           'crisp-white',
  'Sauvignon Blanc':    'crisp-white',
  'Pinot Grigio':       'crisp-white',
  'Vermentino':         'crisp-white',
  'Verdejo':            'crisp-white',
  'Assyrtiko':          'crisp-white',
  'Fiano':              'crisp-white',
  'Verdicchio':         'crisp-white',
};

// Varieties whose cluster depends on the region's climate
const CLIMATE_SENSITIVE: Record<string, Record<'cool' | 'moderate' | 'warm', string>> = {
  'Pinot Noir':      { cool: 'cool-climate-red',  moderate: 'medium-bodied-red', warm: 'full-bodied-red' },
  'Grenache':        { cool: 'medium-bodied-red',  moderate: 'medium-bodied-red', warm: 'full-bodied-red' },
  'Syrah':           { cool: 'medium-bodied-red',  moderate: 'full-bodied-red',   warm: 'full-bodied-red' },
  'Shiraz':          { cool: 'medium-bodied-red',  moderate: 'full-bodied-red',   warm: 'full-bodied-red' },
  'Cabernet Franc':  { cool: 'medium-bodied-red',  moderate: 'full-bodied-red',   warm: 'full-bodied-red' },
  'Zinfandel':       { cool: 'medium-bodied-red',  moderate: 'full-bodied-red',   warm: 'full-bodied-red' },
  'Chardonnay':      { cool: 'crisp-white',         moderate: 'neutral-white',     warm: 'aromatic-white'  },
  'Pinot Gris':      { cool: 'crisp-white',         moderate: 'neutral-white',     warm: 'aromatic-white'  },
  'Pinot Blanc':     { cool: 'crisp-white',         moderate: 'neutral-white',     warm: 'neutral-white'   },
  'Grüner Veltliner':{ cool: 'crisp-white',         moderate: 'neutral-white',     warm: 'neutral-white'   },
  'Roussanne':       { cool: 'neutral-white',       moderate: 'neutral-white',     warm: 'aromatic-white'  },
  'Viognier':        { cool: 'neutral-white',       moderate: 'aromatic-white',    warm: 'aromatic-white'  },
};

// Region → climate classification
export const REGION_CLIMATE: Record<string, 'cool' | 'moderate' | 'warm'> = {
  'Finger Lakes': 'cool', 'New York': 'cool', 'Hudson Valley': 'cool',
  'Chablis': 'cool', 'Loire': 'cool', 'Alsace': 'cool', 'Champagne': 'cool',
  'Mosel': 'cool', 'Rheingau': 'cool', 'Wachau': 'cool',
  'Anderson Valley': 'cool', 'Marlborough': 'cool', 'New Zealand': 'cool',
  "Côte de Beaune": 'cool', 'Sonoma Coast': 'cool',
  'Burgundy': 'moderate', "Côte d'Or": 'moderate', "Côte de Nuits": 'moderate',
  'Willamette Valley': 'moderate', 'Oregon': 'moderate',
  'Sonoma': 'moderate', 'Santa Rita Hills': 'moderate', 'Santa Barbara': 'moderate',
  'Russian River Valley': 'moderate',
  'Rhône': 'moderate', 'Beaujolais': 'moderate',
  'Rioja': 'moderate', 'Douro': 'moderate',
  'Napa': 'warm', 'Napa Valley': 'warm',
  'Paso Robles': 'warm', 'Lodi': 'warm',
  "Châteauneuf-du-Pape": 'warm', 'Priorat': 'warm', 'Ribera del Duero': 'warm',
  'Barossa': 'warm', 'McLaren Vale': 'warm',
  'Mendoza': 'warm', 'Maipo': 'warm',
  'Sicily': 'warm', 'Puglia': 'warm',
};

// Pairwise affinity (0–1) between style clusters
export const CLUSTER_AFFINITY: Record<string, Partial<Record<string, number>>> = {
  'cool-climate-red':  { 'cool-climate-red': 1.0, 'medium-bodied-red': 0.35, 'full-bodied-red': 0.05 },
  'medium-bodied-red': { 'cool-climate-red': 0.35, 'medium-bodied-red': 1.0,  'full-bodied-red': 0.55 },
  'full-bodied-red':   { 'cool-climate-red': 0.05, 'medium-bodied-red': 0.55, 'full-bodied-red': 1.0  },
  'aromatic-white':    { 'aromatic-white': 1.0, 'neutral-white': 0.3,  'crisp-white': 0.15 },
  'neutral-white':     { 'aromatic-white': 0.3, 'neutral-white': 1.0,  'crisp-white': 0.45 },
  'crisp-white':       { 'aromatic-white': 0.15,'neutral-white': 0.45, 'crisp-white': 1.0  },
  'rosé':              { 'rosé': 1.0, 'crisp-white': 0.3, 'cool-climate-red': 0.2 },
  'sparkling':         { 'sparkling': 1.0, 'crisp-white': 0.2 },
  'dessert':           { 'dessert': 1.0 },
};

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

export function getVarietyFamily(variety?: string): string | null {
  if (!variety) return null;
  const v = variety.toLowerCase();
  for (const [family, members] of Object.entries(VARIETY_FAMILIES)) {
    if (members.some(m => v.includes(m.toLowerCase()) || m.toLowerCase().includes(v))) {
      return family;
    }
  }
  return null;
}

export function getRegionGroup(region?: string, country?: string): string | null {
  const haystack = [region, country].filter(Boolean).join(' ').toLowerCase();
  if (!haystack) return null;
  for (const [group, members] of Object.entries(REGION_GROUPS)) {
    if (members.some(m => haystack.includes(m.toLowerCase()))) {
      return group;
    }
  }
  return null;
}

function getRegionClimate(region?: string, appellation?: string, country?: string): 'cool' | 'moderate' | 'warm' | null {
  for (const candidate of [appellation, region, country].filter(Boolean)) {
    if (!candidate) continue;
    const c = candidate.toLowerCase();
    for (const [key, climate] of Object.entries(REGION_CLIMATE)) {
      if (c.includes(key.toLowerCase())) return climate;
    }
  }
  return null;
}

// Tier 1: pairing_weight → cluster
function clusterFromPairingWeight(weight: string, wineType?: string): string {
  if (wineType === 'rosé') return 'rosé';
  if (wineType === 'sparkling') return 'sparkling';
  if (wineType === 'dessert' || wineType === 'fortified') return 'dessert';

  if (wineType === 'white' || wineType === 'other') {
    if (weight === 'delicate' || weight === 'light') return 'crisp-white';
    if (weight === 'medium') return 'neutral-white';
    return 'aromatic-white';
  }

  // red (default)
  if (weight === 'delicate' || weight === 'light') return 'cool-climate-red';
  if (weight === 'medium') return 'medium-bodied-red';
  return 'full-bodied-red';
}

// Tier 2: structural vector → cluster (uses minerality and oak_influence when available)
function clusterFromStructure(wine: Partial<Wine>): string | null {
  if (wine.body == null) return null;
  const wt = wine.wine_type;

  if (wt === 'rosé') return 'rosé';
  if (wt === 'sparkling') return 'sparkling';
  if (wt === 'dessert' || wt === 'fortified') return 'dessert';

  if (wt === 'white') {
    // High minerality → crisp-white regardless of body (Chablis vs oaked Chard)
    if (wine.minerality != null && wine.minerality >= 3.5) return 'crisp-white';
    // High oak with medium-to-full body → aromatic-white (new-oak Napa Chard, Viognier)
    if (wine.oak_influence != null && wine.oak_influence >= 3.5 && wine.body >= 2.5) return 'aromatic-white';
    if (wine.body < 2) return 'crisp-white';
    if (wine.body < 3.5) return 'neutral-white';
    return 'aromatic-white';
  }

  // red — oak pushes medium-tannin reds toward full-bodied (aged Rioja, oaked Bordeaux blends)
  const tannin = wine.tannin ?? 2.5;
  const oak = wine.oak_influence ?? 0;
  const composite = wine.body * 0.5 + tannin * 0.35 + oak * 0.15;
  if (composite < 1.8) return 'cool-climate-red';
  if (composite < 3.2) return 'medium-bodied-red';
  return 'full-bodied-red';
}

function wineTypeFromVariety(v: string): string | null {
  if (['rosé', 'provence rosé'].some(x => v.includes(x))) return 'rosé';
  if (['champagne', 'prosecco', 'cava', 'crémant', 'pétillant', 'franciacorta', 'sekt'].some(x => v.includes(x))) return 'sparkling';
  if (['sauternes', 'ice wine', 'late harvest', 'port', 'sherry', 'madeira', 'passito', 'vin santo', 'tokaji'].some(x => v.includes(x))) return 'dessert';
  return null;
}

// Tier 3: variety + region climate → cluster
function clusterFromVarietyAndRegion(variety?: string, region?: string, appellation?: string, country?: string): string | null {
  if (!variety) return null;
  const v = variety.toLowerCase();
  const wt = wineTypeFromVariety(v);

  if (wt === 'rosé') return 'rosé';
  if (wt === 'sparkling') return 'sparkling';
  if (wt === 'dessert') return 'dessert';

  for (const [varName, climateMap] of Object.entries(CLIMATE_SENSITIVE)) {
    if (v.includes(varName.toLowerCase()) || varName.toLowerCase().includes(v)) {
      const climate = getRegionClimate(region, appellation, country);
      return climateMap[climate ?? 'moderate'];
    }
  }

  for (const [varName, cluster] of Object.entries(VARIETY_CLUSTER)) {
    if (v.includes(varName.toLowerCase()) || varName.toLowerCase().includes(v)) {
      return cluster;
    }
  }

  return null;
}

// 3-tier style cluster resolver
export function getStyleCluster(wine: Partial<Wine>): string | null {
  if (wine.pairing_weight) {
    return clusterFromPairingWeight(wine.pairing_weight, wine.wine_type);
  }
  const fromStructure = clusterFromStructure(wine);
  if (fromStructure) return fromStructure;
  return clusterFromVarietyAndRegion(wine.variety, wine.region, wine.appellation, wine.country);
}

export function styleClusterAffinity(clusterA: string, clusterB: string): number {
  return CLUSTER_AFFINITY[clusterA]?.[clusterB] ?? 0;
}

function getMajorityStyleCluster(bottles: CellarInventoryWithWine[]): string | null {
  const total = bottles.reduce((s, b) => s + b.quantity, 0);
  if (total === 0) return null;
  const counts = new Map<string, number>();
  for (const b of bottles) {
    const c = getStyleCluster(b.wine);
    if (c) counts.set(c, (counts.get(c) ?? 0) + b.quantity);
  }
  let best: [string, number] | null = null;
  for (const [c, n] of counts.entries()) {
    if (!best || n > best[1]) best = [c, n];
  }
  if (!best || best[1] / total < 0.4) return null;
  return best[0];
}

// ---------------------------------------------------------------------------
// Cuisine tag affinity — semantic bridge between food pairing and cellar organization
// ---------------------------------------------------------------------------

export const CUISINE_TAG_AFFINITY: Partial<Record<CuisineTag, Partial<Record<CuisineTag, number>>>> = {
  'grilling':       { 'game-meat': 0.7, 'weeknight': 0.4, 'party': 0.3 },
  'game-meat':      { 'grilling': 0.7, 'french-bistro': 0.5, 'fine-dining': 0.4 },
  'seafood':        { 'oysters': 0.8, 'mediterranean': 0.6, 'weeknight': 0.3 },
  'oysters':        { 'seafood': 0.8, 'aperitif': 0.4, 'fine-dining': 0.4 },
  'mediterranean':  { 'seafood': 0.6, 'vegetarian': 0.5, 'italian-comfort': 0.4 },
  'french-bistro':  { 'fine-dining': 0.6, 'game-meat': 0.5, 'cheese-board': 0.4 },
  'fine-dining':    { 'french-bistro': 0.6, 'celebration': 0.5, 'game-meat': 0.4 },
  'aperitif':       { 'cheese-board': 0.5, 'party': 0.5, 'oysters': 0.4 },
  'cheese-board':   { 'aperitif': 0.5, 'french-bistro': 0.4, 'celebration': 0.3 },
  'italian-comfort':{ 'vegetarian': 0.5, 'mediterranean': 0.4, 'weeknight': 0.4 },
  'vegetarian':     { 'italian-comfort': 0.5, 'mediterranean': 0.5, 'weeknight': 0.3 },
  'party':          { 'weeknight': 0.6, 'aperitif': 0.5, 'celebration': 0.4 },
  'weeknight':      { 'party': 0.6, 'italian-comfort': 0.4, 'grilling': 0.4 },
  'celebration':    { 'fine-dining': 0.5, 'party': 0.4, 'cheese-board': 0.3 },
  'asian-fusion':   { 'weeknight': 0.4, 'seafood': 0.3 },
};

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

function totalBottles(bottles: CellarInventoryWithWine[]): number {
  return bottles.reduce((s, b) => s + b.quantity, 0);
}

export function scoreStandardLocation(
  wine: Partial<Wine>,
  location: Location,
  locationBottles: CellarInventoryWithWine[],
  context?: { wineTags?: CuisineTag[]; locationTagCounts?: Map<CuisineTag, number> },
): number {
  if (location.location_type === 'aging' || location.location_type === 'daily') return -Infinity;

  const cap = location.max_capacity;
  const occupied = totalBottles(locationBottles);
  if (cap != null && occupied >= cap) return -Infinity;

  let score = 0;
  if (occupied > 0) score += 5;

  const wineFamily = getVarietyFamily(wine.variety);
  const wineRegionGroup = getRegionGroup(wine.region, wine.country);

  for (const entry of locationBottles) {
    const w = entry.wine;
    if (wine.producer && w.producer && wine.producer.toLowerCase() === w.producer.toLowerCase()) {
      score += 100;
      break;
    }
  }

  let exactVarietyMatch = false;
  let familyMatch = false;
  let regionMatch = false;

  for (const entry of locationBottles) {
    const w = entry.wine;
    if (!exactVarietyMatch && wine.variety && w.variety &&
        wine.variety.toLowerCase() === w.variety.toLowerCase()) {
      exactVarietyMatch = true;
    }
    if (!familyMatch && wineFamily && getVarietyFamily(w.variety) === wineFamily) {
      familyMatch = true;
    }
    if (!regionMatch && wineRegionGroup && getRegionGroup(w.region, w.country) === wineRegionGroup) {
      regionMatch = true;
    }
  }

  if (exactVarietyMatch) score += 60;
  else if (familyMatch) score += 30;

  // Style cluster affinity — fires only when both variety checks miss
  if (!exactVarietyMatch && !familyMatch) {
    const wineCluster = getStyleCluster(wine);
    const locCluster = getMajorityStyleCluster(locationBottles);
    if (wineCluster && locCluster) {
      const affinity = styleClusterAffinity(wineCluster, locCluster);
      if (affinity >= 0.8)      score += 35;
      else if (affinity >= 0.4) score += 15;
    }
  }

  if (regionMatch) score += 20;

  // Cuisine tag affinity bonus — tiebreaker between stylistically similar wines (max +15)
  if (context?.wineTags?.length && context.locationTagCounts && context.locationTagCounts.size > 0) {
    const locTotal = [...context.locationTagCounts.values()].reduce((s, n) => s + n, 0);
    let tagBonus = 0;
    for (const wTag of context.wineTags) {
      const tagAffinity = CUISINE_TAG_AFFINITY[wTag] ?? {};
      for (const [locTag, locCount] of context.locationTagCounts.entries()) {
        const aff = locTag === wTag ? 1.0 : (tagAffinity[locTag] ?? 0);
        if (aff > 0) {
          tagBonus = Math.max(tagBonus, aff * (locCount / locTotal));
        }
      }
    }
    score += Math.round(tagBonus * 15);
  }

  return score;
}

export function scoreDailyLocation(
  wine: Partial<Wine>,
  location: Location,
  locationBottles: CellarInventoryWithWine[],
  currentYear: number,
): number {
  if (location.location_type !== 'daily') return -Infinity;

  const cap = location.max_capacity;
  const occupied = totalBottles(locationBottles);
  if (cap != null && occupied >= cap) return -Infinity;

  let score = 50;

  if (wine.drink_by_year != null) {
    const yearsLeft = wine.drink_by_year - currentYear;
    if (yearsLeft < 0) score += 50;
    else if (yearsLeft <= 3) score += 20;
    else if (wine.drink_from_year != null && wine.drink_from_year > currentYear) {
      score -= 30;
    }
  }

  const wineFamily = getVarietyFamily(wine.variety);
  if (wineFamily && occupied > 0) {
    const sameFamily = locationBottles.filter(b => getVarietyFamily(b.wine.variety) === wineFamily);
    const sameFamilyQty = totalBottles(sameFamily);
    const fraction = sameFamilyQty / occupied;
    if (fraction > 0.5) score -= 40;
    else if (fraction === 0) score += 20;
  }

  return score;
}

// ---------------------------------------------------------------------------
// Placement recommendations
// ---------------------------------------------------------------------------

export interface PlacementRecommendation {
  location: Location;
  score: number;
  reason: string;
}

export function getPlacementRecommendations(
  wine: Partial<Wine>,
  allLocations: LocationWithBottles[],
  currentYear: number,
  opts: { includeAging?: boolean; topN?: number } = {},
): PlacementRecommendation[] {
  const { includeAging = false, topN = 5 } = opts;
  const results: PlacementRecommendation[] = [];

  for (const { location, bottles } of allLocations) {
    if (location.location_type === 'aging' && !includeAging) continue;

    let score: number;
    let reason: string;

    if (location.location_type === 'daily') {
      score = scoreDailyLocation(wine, location, bottles, currentYear);
      if (score === -Infinity) continue;
      reason = wine.drink_by_year != null && wine.drink_by_year - currentYear <= 3
        ? 'Daily drinkers — drink soon'
        : 'Daily drinkers — adds variety';
    } else {
      score = scoreStandardLocation(wine, location, bottles);
      if (score === -Infinity) continue;
      reason = buildReason(wine, location, bottles);
    }

    results.push({ location, score, reason });
  }

  return results.sort((a, b) => b.score - a.score).slice(0, topN);
}

function buildReason(wine: Partial<Wine>, _location: Location, bottles: CellarInventoryWithWine[]): string {
  const wineFamily = getVarietyFamily(wine.variety);
  const wineRegionGroup = getRegionGroup(wine.region, wine.country);

  for (const entry of bottles) {
    const w = entry.wine;
    if (wine.producer && w.producer && wine.producer.toLowerCase() === w.producer.toLowerCase()) {
      return `Same producer (${wine.producer})`;
    }
  }
  for (const entry of bottles) {
    const w = entry.wine;
    if (wine.variety && w.variety && wine.variety.toLowerCase() === w.variety.toLowerCase()) {
      return `Same variety (${wine.variety})`;
    }
  }
  const familyLabel: Record<string, string> = {
    'light-red': 'Light Reds', 'full-red': 'Full Reds',
    'aromatic-white': 'Aromatic Whites', 'neutral-white': 'Neutral Whites',
    'crisp-white': 'Crisp Whites', 'rosé': 'Rosé', 'sparkling': 'Sparkling', 'dessert': 'Dessert',
  };
  if (wineFamily) {
    const hasFamily = bottles.some(b => getVarietyFamily(b.wine.variety) === wineFamily);
    if (hasFamily) return `Same family (${familyLabel[wineFamily] ?? wineFamily})`;
  }
  const wineCluster = getStyleCluster(wine);
  const locCluster = getMajorityStyleCluster(bottles);
  if (wineCluster && locCluster && wineCluster !== locCluster) {
    const affinity = styleClusterAffinity(wineCluster, locCluster);
    const clusterLabel: Record<string, string> = {
      'cool-climate-red': 'Cool-climate reds', 'medium-bodied-red': 'Medium reds', 'full-bodied-red': 'Full-bodied reds',
      'crisp-white': 'Crisp whites', 'neutral-white': 'Structured whites', 'aromatic-white': 'Rich whites',
    };
    if (affinity >= 0.8) return `Similar style (${clusterLabel[locCluster] ?? locCluster})`;
    if (affinity >= 0.4) return `Adjacent style (${clusterLabel[locCluster] ?? locCluster})`;
  }
  if (wineRegionGroup) {
    const hasRegion = bottles.some(b => getRegionGroup(b.wine.region, b.wine.country) === wineRegionGroup);
    if (hasRegion) return 'Same region group';
  }
  if (bottles.length === 0) return 'Empty location';
  return 'Available space';
}

// ---------------------------------------------------------------------------
// Theme detection
// ---------------------------------------------------------------------------

export type LocationTheme =
  | { type: 'producer' | 'variety' | 'variety-family' | 'region'; value: string; fraction: number }
  | { type: 'cuisine'; value: CuisineTag; fraction: number }
  | null;

export function detectLocationTheme(
  bottles: CellarInventoryWithWine[],
  cuisineTagCounts?: Map<CuisineTag, number>,
): LocationTheme {
  if (bottles.length === 0) return null;
  const total = totalBottles(bottles);
  if (total === 0) return null;

  const byProducer = new Map<string, number>();
  const byVariety = new Map<string, number>();
  const byFamily = new Map<string, number>();
  const byRegion = new Map<string, number>();

  for (const entry of bottles) {
    const w = entry.wine;
    const qty = entry.quantity;
    if (w.producer) byProducer.set(w.producer, (byProducer.get(w.producer) ?? 0) + qty);
    if (w.variety) byVariety.set(w.variety, (byVariety.get(w.variety) ?? 0) + qty);
    const family = getVarietyFamily(w.variety);
    if (family) byFamily.set(family, (byFamily.get(family) ?? 0) + qty);
    const region = getRegionGroup(w.region, w.country);
    if (region) byRegion.set(region, (byRegion.get(region) ?? 0) + qty);
  }

  const dominantProducer = dominantEntry(byProducer, total, 0.5);
  if (dominantProducer) return { type: 'producer', value: dominantProducer.key, fraction: dominantProducer.fraction };

  const dominantVariety = dominantEntry(byVariety, total, 0.5);
  if (dominantVariety) return { type: 'variety', value: dominantVariety.key, fraction: dominantVariety.fraction };

  const dominantFamily = dominantEntry(byFamily, total, 0.6);
  if (dominantFamily) return { type: 'variety-family', value: dominantFamily.key, fraction: dominantFamily.fraction };

  const dominantRegion = dominantEntry(byRegion, total, 0.6);
  if (dominantRegion) return { type: 'region', value: dominantRegion.key, fraction: dominantRegion.fraction };

  // Cuisine theme — only checked when tag data is available
  if (cuisineTagCounts && cuisineTagCounts.size > 0) {
    const tagTotal = [...cuisineTagCounts.values()].reduce((s, n) => s + n, 0);
    const dominantTag = dominantEntry(cuisineTagCounts as Map<string, number>, tagTotal, 0.5);
    if (dominantTag) return { type: 'cuisine', value: dominantTag.key as CuisineTag, fraction: dominantTag.fraction };
  }

  return null;
}

function dominantEntry(map: Map<string, number>, total: number, threshold: number): { key: string; fraction: number } | null {
  let best: { key: string; count: number } | null = null;
  for (const [key, count] of map.entries()) {
    if (!best || count > best.count) best = { key, count };
  }
  if (!best) return null;
  const fraction = best.count / total;
  if (fraction >= threshold) return { key: best.key, fraction };
  return null;
}

export function getMiscategorizedBottles(
  bottles: CellarInventoryWithWine[],
  theme: LocationTheme,
  cuisineTagsByWine?: Map<string, CuisineTag[]>,
): CellarInventoryWithWine[] {
  if (!theme) return [];
  return bottles.filter(entry => {
    const w = entry.wine;
    switch (theme.type) {
      case 'producer':       return !w.producer || w.producer.toLowerCase() !== theme.value.toLowerCase();
      case 'variety':        return !w.variety || w.variety.toLowerCase() !== theme.value.toLowerCase();
      case 'variety-family': return getVarietyFamily(w.variety) !== theme.value;
      case 'region':         return getRegionGroup(w.region, w.country) !== theme.value;
      case 'cuisine': {
        const tags = cuisineTagsByWine?.get(w.id) ?? [];
        return !tags.includes(theme.value);
      }
    }
  });
}

// ---------------------------------------------------------------------------
// Defragment plan
// ---------------------------------------------------------------------------

export interface PlannedMove {
  id: string;
  inventoryEntryId: string;
  wineId: string;
  wineName: string;
  wineVariety?: string;
  wineRegionGroup?: string;
  fromLocation: string;
  toLocation: string;
  quantity: number;
  improvementScore: number;
}

export interface Trip {
  tripNumber: number;
  fromLocation: string;
  toLocation: string;
  moves: PlannedMove[];
  totalBottles: number;
  distFromPrev: number;
}

export interface DefragmentPlan {
  trips: Trip[];
  totalMoves: number;
  totalBottlesMoved: number;
  skippedNoCapacity: number;
  skippedTooLarge: number;
  relatedWinesNotes: string[];
}

const IMPROVEMENT_THRESHOLD = 20;

// Tree-distance between two locations via lowest common ancestor of their groups.
// Falls back to alphabetical index when groups are not set.
function hierarchyDistance(
  locA: Location,
  locB: Location,
  groupMap: Map<string, LocationGroup>,
  alphabetIndex: Map<string, number>,
): number {
  if (locA.id === locB.id) return 0;

  if (!locA.hierarchy_group_id && !locB.hierarchy_group_id) {
    return Math.abs((alphabetIndex.get(locA.name) ?? 0) - (alphabetIndex.get(locB.name) ?? 0));
  }
  if (!locA.hierarchy_group_id || !locB.hierarchy_group_id) return 50;

  function ancestorPath(groupId: string): string[] {
    const path: string[] = [];
    let cur: string | null = groupId;
    while (cur && path.length < 20) {
      path.push(cur);
      cur = groupMap.get(cur)?.parent_id ?? null;
    }
    return path;
  }

  const pathA = ancestorPath(locA.hierarchy_group_id);
  const pathB = ancestorPath(locB.hierarchy_group_id);
  const setB = new Set(pathB);
  const lcaIdxInA = pathA.findIndex(id => setB.has(id));

  if (lcaIdxInA < 0) return 100;

  const depthA = lcaIdxInA;
  const depthB = pathB.indexOf(pathA[lcaIdxInA]);
  return depthA + depthB + 2;
}

export function computeDefragmentPlan(
  inventory: CellarInventoryWithWine[],
  locations: Location[],
  locationGroups: LocationGroup[],
  opts: { carryLimit?: number; includeAging?: boolean; cuisineTagsByWine?: Map<string, CuisineTag[]> } = {},
): DefragmentPlan {
  const carryLimit = Math.max(1, opts.carryLimit ?? 4);
  const includeAging = opts.includeAging ?? false;
  const cuisineTagsByWine = opts.cuisineTagsByWine;

  function buildLocationTagCounts(locBottles: CellarInventoryWithWine[]): Map<CuisineTag, number> {
    const counts = new Map<CuisineTag, number>();
    if (!cuisineTagsByWine) return counts;
    for (const b of locBottles) {
      for (const tag of cuisineTagsByWine.get(b.wine_id) ?? []) {
        counts.set(tag, (counts.get(tag) ?? 0) + b.quantity);
      }
    }
    return counts;
  }

  function tagContext(wineId: string, locBottles: CellarInventoryWithWine[]) {
    const wineTags = cuisineTagsByWine?.get(wineId);
    if (!wineTags?.length) return undefined;
    return { wineTags, locationTagCounts: buildLocationTagCounts(locBottles) };
  }

  const eligibleLocs = locations.filter(l =>
    l.location_type !== 'daily' && (includeAging || l.location_type !== 'aging')
  );
  const locMap = new Map(eligibleLocs.map(l => [l.name, l]));
  const groupMap = new Map(locationGroups.map(g => [g.id, g]));

  const sortedNames = Array.from(locMap.keys()).sort();
  const alphabetIndex = new Map(sortedNames.map((n, i) => [n, i]));

  // Mutable simulation state
  const simBottles = new Map<string, CellarInventoryWithWine[]>();
  for (const loc of eligibleLocs) simBottles.set(loc.name, []);
  for (const entry of inventory) {
    if (locMap.has(entry.location)) {
      simBottles.get(entry.location)!.push({ ...entry });
    }
  }

  // Group inventory by wine_id — wine units are never split
  type WineUnit = {
    wine: Wine;
    entries: CellarInventoryWithWine[];
    totalQty: number;
    locationNames: Set<string>;
  };
  const wineUnits = new Map<string, WineUnit>();

  for (const entry of inventory) {
    if (!locMap.has(entry.location) || !entry.wine) continue;
    const existing = wineUnits.get(entry.wine_id);
    if (existing) {
      existing.entries.push(entry);
      existing.totalQty += entry.quantity;
      existing.locationNames.add(entry.location);
    } else {
      wineUnits.set(entry.wine_id, {
        wine: entry.wine,
        entries: [entry],
        totalQty: entry.quantity,
        locationNames: new Set([entry.location]),
      });
    }
  }

  const plannedMoves: PlannedMove[] = [];
  let skippedNoCapacity = 0;
  let skippedTooLarge = 0;
  const relatedWinesTargets = new Map<string, Set<string>>();

  for (const [wineId, unit] of wineUnits.entries()) {
    const isSplit = unit.locationNames.size > 1;

    // Current best placement score across all home locations
    let currentBestScore = -Infinity;
    for (const locName of unit.locationNames) {
      const loc = locMap.get(locName);
      if (!loc) continue;
      const locBottles = simBottles.get(locName) ?? [];
      const s = scoreStandardLocation(unit.wine, loc, locBottles, tagContext(wineId, locBottles));
      if (s > currentBestScore) currentBestScore = s;
    }

    // Split wines: any valid consolidation target beats the status quo
    // Single-location wines: must beat current score by the improvement threshold
    const minTargetScore = isSplit ? 0 : currentBestScore + IMPROVEMENT_THRESHOLD;
    let bestTarget: Location | null = null;
    let bestScore = minTargetScore - 1;

    for (const [, targetLoc] of locMap.entries()) {
      const targetBottles = simBottles.get(targetLoc.name) ?? [];
      const targetOccupied = totalBottles(targetBottles);
      const cap = targetLoc.max_capacity;

      const wineAlreadyThere = targetBottles
        .filter(b => b.wine_id === wineId)
        .reduce((s, b) => s + b.quantity, 0);
      const occupiedByOthers = targetOccupied - wineAlreadyThere;

      if (cap != null && occupiedByOthers + unit.totalQty > cap) {
        skippedNoCapacity++;
        continue;
      }

      const othersAtTarget = targetBottles.filter(b => b.wine_id !== wineId);
      const candidateBottles = [...othersAtTarget, ...unit.entries];
      const score = scoreStandardLocation(unit.wine, targetLoc, candidateBottles, tagContext(wineId, candidateBottles));

      if (score > bestScore) {
        bestScore = score;
        bestTarget = targetLoc;
      }
    }

    if (bestTarget) {
      for (const entry of unit.entries) {
        if (entry.location === bestTarget.name) continue;
        plannedMoves.push({
          id: `move-${entry.id}`,
          inventoryEntryId: entry.id,
          wineId,
          wineName: unit.wine.name,
          wineVariety: unit.wine.variety,
          wineRegionGroup: getRegionGroup(unit.wine.region, unit.wine.country) ?? undefined,
          fromLocation: entry.location,
          toLocation: bestTarget.name,
          quantity: entry.quantity,
          improvementScore: Math.max(0, bestScore - currentBestScore),
        });
      }
      // Simulate
      for (const entry of unit.entries) {
        if (entry.location === bestTarget.name) continue;
        const src = simBottles.get(entry.location)!;
        const idx = src.findIndex(b => b.id === entry.id);
        if (idx >= 0) src.splice(idx, 1);
        simBottles.get(bestTarget.name)!.push({ ...entry, location: bestTarget.name });
      }
      if (unit.wine.producer && unit.wine.variety) {
        const key = `${unit.wine.producer.toLowerCase()}|${unit.wine.variety.toLowerCase()}`;
        if (!relatedWinesTargets.has(key)) relatedWinesTargets.set(key, new Set());
        relatedWinesTargets.get(key)!.add(bestTarget.name);
      }
    } else if (isSplit) {
      // No single location fits all — try sibling split within the same hierarchy group
      let siblingBase: Location | null = null;
      let siblingBaseScore = -Infinity;
      for (const [, loc] of locMap.entries()) {
        const others = (simBottles.get(loc.name) ?? []).filter(b => b.wine_id !== wineId);
        const siblingBottles = [...others, ...unit.entries];
        const s = scoreStandardLocation(unit.wine, loc, siblingBottles, tagContext(wineId, siblingBottles));
        if (s > siblingBaseScore) { siblingBaseScore = s; siblingBase = loc; }
      }

      if (!siblingBase?.hierarchy_group_id) {
        skippedTooLarge++;
        continue;
      }

      const siblings = [siblingBase, ...eligibleLocs.filter(l =>
        l.id !== siblingBase!.id &&
        l.hierarchy_group_id === siblingBase!.hierarchy_group_id
      )];

      const siblingAvail = new Map(siblings.map(s => {
        const others = (simBottles.get(s.name) ?? []).filter(b => b.wine_id !== wineId);
        const cap = s.max_capacity;
        return [s.name, cap == null ? Infinity : Math.max(0, cap - totalBottles(others))];
      }));

      // Sort siblings descending by available capacity
      siblings.sort((a, b) => (siblingAvail.get(b.name) ?? 0) - (siblingAvail.get(a.name) ?? 0));

      const siblingMoves: PlannedMove[] = [];
      let allFit = true;
      for (const entry of unit.entries) {
        let placed = false;
        for (const sib of siblings) {
          const avail = siblingAvail.get(sib.name) ?? 0;
          if (avail >= entry.quantity) {
            if (entry.location !== sib.name) {
              siblingMoves.push({
                id: `move-${entry.id}-sib`,
                inventoryEntryId: entry.id,
                wineId,
                wineName: unit.wine.name,
                wineVariety: unit.wine.variety,
                wineRegionGroup: getRegionGroup(unit.wine.region, unit.wine.country) ?? undefined,
                fromLocation: entry.location,
                toLocation: sib.name,
                quantity: entry.quantity,
                improvementScore: Math.max(0, siblingBaseScore - currentBestScore),
              });
            }
            siblingAvail.set(sib.name, avail - entry.quantity);
            placed = true;
            break;
          }
        }
        if (!placed) { allFit = false; break; }
      }

      if (allFit && siblingMoves.length > 0) {
        plannedMoves.push(...siblingMoves);
        for (const m of siblingMoves) {
          const src = simBottles.get(m.fromLocation)!;
          const idx = src.findIndex(b => b.id === m.inventoryEntryId);
          if (idx >= 0) src.splice(idx, 1);
          const origEntry = unit.entries.find(e => e.id === m.inventoryEntryId)!;
          simBottles.get(m.toLocation)!.push({ ...origEntry, location: m.toLocation });
        }
      } else {
        skippedTooLarge++;
      }
    }
    // Single-location wine below threshold: no action
  }

  // Build related-wines notes
  const relatedWinesNotes: string[] = [];
  for (const [key, targets] of relatedWinesTargets.entries()) {
    if (targets.size > 1) {
      const [producer, variety] = key.split('|');
      relatedWinesNotes.push(
        `${producer} ${variety}: bottles split across ${Array.from(targets).join(', ')}`
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Trip batching: group moves by (from→to), split into carryLimit-sized loads
  // ---------------------------------------------------------------------------

  interface RawTrip {
    fromLocation: string;
    toLocation: string;
    moves: PlannedMove[];
    totalBottles: number;
  }

  const tripGroupMap = new Map<string, { fromLocation: string; toLocation: string; items: Array<{ move: PlannedMove; qty: number }> }>();
  for (const move of plannedMoves) {
    const key = `${move.fromLocation}→${move.toLocation}`;
    if (!tripGroupMap.has(key)) tripGroupMap.set(key, { fromLocation: move.fromLocation, toLocation: move.toLocation, items: [] });
    tripGroupMap.get(key)!.items.push({ move, qty: move.quantity });
  }

  const unorderedTrips: RawTrip[] = [];
  for (const group of tripGroupMap.values()) {
    let currentMoves: PlannedMove[] = [];
    let currentTotal = 0;
    for (const item of group.items) {
      if (currentTotal + item.qty > carryLimit && currentMoves.length > 0) {
        unorderedTrips.push({ fromLocation: group.fromLocation, toLocation: group.toLocation, moves: currentMoves, totalBottles: currentTotal });
        currentMoves = [];
        currentTotal = 0;
      }
      currentMoves.push({ ...item.move, quantity: item.qty, id: `${item.move.id}-${currentTotal}` });
      currentTotal += item.qty;
    }
    if (currentMoves.length > 0) {
      unorderedTrips.push({ fromLocation: group.fromLocation, toLocation: group.toLocation, moves: currentMoves, totalBottles: currentTotal });
    }
  }

  if (unorderedTrips.length === 0) {
    return { trips: [], totalMoves: 0, totalBottlesMoved: 0, skippedNoCapacity, skippedTooLarge, relatedWinesNotes };
  }

  // ---------------------------------------------------------------------------
  // Walk-order TSP: nearest-neighbor using hierarchyDistance
  // ---------------------------------------------------------------------------

  const pending = [...unorderedTrips];
  const orderedTrips: RawTrip[] = [];

  const pickupCount = new Map<string, number>();
  for (const t of pending) {
    pickupCount.set(t.fromLocation, (pickupCount.get(t.fromLocation) ?? 0) + t.totalBottles);
  }
  let currentLocName = Array.from(pickupCount.entries()).sort((a, b) => b[1] - a[1])[0][0];

  while (pending.length > 0) {
    const hereIdx = pending.findIndex(t => t.fromLocation === currentLocName);
    let chosen: RawTrip;
    let chosenIdx: number;

    if (hereIdx >= 0) {
      chosen = pending[hereIdx];
      chosenIdx = hereIdx;
    } else {
      const currentLoc = locMap.get(currentLocName);
      let bestDist = Infinity;
      let bestIdx = 0;
      for (let i = 0; i < pending.length; i++) {
        const fromLoc = locMap.get(pending[i].fromLocation);
        if (!fromLoc || !currentLoc) continue;
        const dist = hierarchyDistance(currentLoc, fromLoc, groupMap, alphabetIndex);
        if (dist < bestDist) { bestDist = dist; bestIdx = i; }
      }
      chosen = pending[bestIdx];
      chosenIdx = bestIdx;
    }

    pending.splice(chosenIdx, 1);
    orderedTrips.push(chosen);
    currentLocName = chosen.toLocation;
  }

  let prevLocName = orderedTrips[0].fromLocation;
  const trips: Trip[] = orderedTrips.map((t, i) => {
    const prevLoc = locMap.get(prevLocName);
    const fromLoc = locMap.get(t.fromLocation);
    const distFromPrev = prevLoc && fromLoc
      ? hierarchyDistance(prevLoc, fromLoc, groupMap, alphabetIndex)
      : 0;
    prevLocName = t.toLocation;
    return {
      tripNumber: i + 1,
      fromLocation: t.fromLocation,
      toLocation: t.toLocation,
      moves: t.moves,
      totalBottles: t.totalBottles,
      distFromPrev,
    };
  });

  return {
    trips,
    totalMoves: plannedMoves.length,
    totalBottlesMoved: plannedMoves.reduce((s, m) => s + m.quantity, 0),
    skippedNoCapacity,
    skippedTooLarge,
    relatedWinesNotes,
  };
}
