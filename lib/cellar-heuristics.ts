import type { Wine, Location, CellarInventory, LocationType } from '@/types';

export type CellarInventoryWithWine = CellarInventory & { wine: Wine };

export interface LocationWithBottles {
  location: Location;
  bottles: CellarInventoryWithWine[];
}

export const VARIETY_FAMILIES: Record<string, string[]> = {
  'light-red':       ['Pinot Noir', 'Gamay', 'Grenache', 'Dolcetto', 'Barbera', 'Zweigelt', 'Frappato', 'Schiava'],
  'full-red':        ['Cabernet Sauvignon', 'Merlot', 'Zinfandel', 'Malbec', 'Syrah', 'Shiraz',
                      'Cabernet Franc', 'Nebbiolo', 'Sangiovese', 'Tempranillo', 'Mourvèdre',
                      'Petite Sirah', 'Montepulciano', 'Aglianico', 'Nero d\'Avola'],
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
                    'Russian River Valley', 'Alexander Valley', 'Dry Creek Valley'],
  'france':        ['Burgundy', 'Bordeaux', 'Champagne', 'Loire', 'Rhône', 'Alsace',
                    'Provence', 'Languedoc', 'France', 'Côte d\'Or', 'Beaujolais',
                    'Châteauneuf-du-Pape', 'Sancerre', 'Pouilly-Fumé'],
  'italy':         ['Tuscany', 'Piedmont', 'Veneto', 'Sicily', 'Friuli', 'Italy',
                    'Barolo', 'Chianti', 'Brunello', 'Amarone', 'Prosecco', 'Soave'],
  'other-europe':  ['Spain', 'Germany', 'Austria', 'Portugal', 'Greece', 'Hungary',
                    'Rioja', 'Priorat', 'Douro', 'Mosel', 'Rheingau', 'Wachau'],
  'new-world':     ['Australia', 'New Zealand', 'Argentina', 'Chile', 'South Africa',
                    'Marlborough', 'Barossa', 'Mendoza'],
};

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

function totalBottles(bottles: CellarInventoryWithWine[]): number {
  return bottles.reduce((s, b) => s + b.quantity, 0);
}

export function scoreStandardLocation(
  wine: Partial<Wine>,
  location: Location,
  locationBottles: CellarInventoryWithWine[],
): number {
  if (location.location_type === 'aging' || location.location_type === 'daily') return -Infinity;

  const cap = location.max_capacity;
  const occupied = totalBottles(locationBottles);
  if (cap != null && occupied >= cap) return -Infinity;

  let score = 0;

  // Non-empty location bonus: prefer established clusters over empty ones
  if (occupied > 0) score += 5;

  const wineFamily = getVarietyFamily(wine.variety);
  const wineRegionGroup = getRegionGroup(wine.region, wine.country);

  for (const entry of locationBottles) {
    const w = entry.wine;
    // Producer match: highest weight (same producer = likely fits together)
    if (wine.producer && w.producer && wine.producer.toLowerCase() === w.producer.toLowerCase()) {
      score += 100;
      break; // only count once per location
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
  if (regionMatch) score += 20;

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

  let score = 50; // base for daily locations

  // Drink-window scoring
  if (wine.drink_by_year != null) {
    const yearsLeft = wine.drink_by_year - currentYear;
    if (yearsLeft < 0) score += 50;      // overdue — drink immediately
    else if (yearsLeft <= 3) score += 20; // drink soon
    else if (wine.drink_from_year != null && wine.drink_from_year > currentYear) {
      score -= 30; // not ready yet
    }
  }

  // Diversity: penalise if this variety already dominates the location
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
      if (wine.drink_by_year != null && wine.drink_by_year - currentYear <= 3) {
        reason = 'Daily drinkers — drink soon';
      } else {
        reason = 'Daily drinkers — adds variety';
      }
    } else {
      score = scoreStandardLocation(wine, location, bottles);
      if (score === -Infinity) continue;
      reason = buildReason(wine, location, bottles);
    }

    results.push({ location, score, reason });
  }

  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);
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
  if (wineRegionGroup) {
    const hasRegion = bottles.some(b => getRegionGroup(b.wine.region, b.wine.country) === wineRegionGroup);
    if (hasRegion) return `Same region group`;
  }
  if (bottles.length === 0) return 'Empty location';
  return 'Available space';
}

// --- Theme detection ---

export type LocationTheme =
  | { type: 'producer' | 'variety' | 'variety-family' | 'region'; value: string; fraction: number }
  | null;

export function detectLocationTheme(bottles: CellarInventoryWithWine[]): LocationTheme {
  if (bottles.length === 0) return null;
  const total = totalBottles(bottles);
  if (total === 0) return null;

  // Count by producer
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

  return null;
}

function dominantEntry(
  map: Map<string, number>,
  total: number,
  threshold: number,
): { key: string; fraction: number } | null {
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
): CellarInventoryWithWine[] {
  if (!theme) return [];
  return bottles.filter(entry => {
    const w = entry.wine;
    switch (theme.type) {
      case 'producer':
        return !w.producer || w.producer.toLowerCase() !== theme.value.toLowerCase();
      case 'variety':
        return !w.variety || w.variety.toLowerCase() !== theme.value.toLowerCase();
      case 'variety-family':
        return getVarietyFamily(w.variety) !== theme.value;
      case 'region':
        return getRegionGroup(w.region, w.country) !== theme.value;
    }
  });
}

// --- Defragment ---

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
}

const IMPROVEMENT_THRESHOLD = 20;

function getLocationPos(
  locName: string,
  locMap: Map<string, Location>,
  alphabetIndex: Map<string, number>,
): { x: number; y: number } {
  const loc = locMap.get(locName);
  if (loc?.position_x != null && loc?.position_y != null) {
    return { x: loc.position_x, y: loc.position_y };
  }
  return { x: alphabetIndex.get(locName) ?? 0, y: 0 };
}

function manhattan(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function computeDefragmentPlan(
  inventory: CellarInventoryWithWine[],
  locations: Location[],
  opts: { carryLimit?: number; includeAging?: boolean } = {},
): DefragmentPlan {
  const carryLimit = Math.max(1, opts.carryLimit ?? 4);
  const includeAging = opts.includeAging ?? false;

  // Filter eligible locations (daily excluded from defrag — they have their own algorithm)
  const eligibleLocs = locations.filter(l =>
    l.location_type !== 'daily' && (includeAging || l.location_type !== 'aging')
  );
  const locMap = new Map(eligibleLocs.map(l => [l.name, l]));

  // Alphabetical index for position fallback
  const sortedNames = Array.from(locMap.keys()).sort();
  const alphabetIndex = new Map(sortedNames.map((n, i) => [n, i]));

  // Build mutable bottle lists per location
  const simBottles = new Map<string, CellarInventoryWithWine[]>();
  for (const loc of eligibleLocs) simBottles.set(loc.name, []);
  for (const entry of inventory) {
    if (locMap.has(entry.location)) {
      simBottles.get(entry.location)!.push({ ...entry });
    }
  }

  const plannedMoves: PlannedMove[] = [];
  let skippedNoCapacity = 0;

  for (const [locName, bottles] of simBottles.entries()) {
    const loc = locMap.get(locName)!;
    // Take a snapshot so we can iterate while modifying simBottles
    const snapshot = [...bottles];

    for (const entry of snapshot) {
      if (entry.quantity <= 0) continue;

      const currentScore = scoreStandardLocation(entry.wine, loc, simBottles.get(locName) ?? []);

      let bestTarget: Location | null = null;
      let bestScore = currentScore + IMPROVEMENT_THRESHOLD;

      for (const [targetName, targetLoc] of locMap.entries()) {
        if (targetName === locName) continue;

        const targetBottles = simBottles.get(targetName) ?? [];
        const targetOccupied = totalBottles(targetBottles);
        const cap = targetLoc.max_capacity;

        if (cap != null && targetOccupied + 1 > cap) {
          skippedNoCapacity++;
          continue;
        }

        const score = scoreStandardLocation(entry.wine, targetLoc, [...targetBottles, entry]);
        if (score > bestScore) {
          bestScore = score;
          bestTarget = targetLoc;
        }
      }

      if (bestTarget) {
        plannedMoves.push({
          id: `move-${entry.id}`,
          inventoryEntryId: entry.id,
          wineId: entry.wine_id,
          wineName: entry.wine.name,
          wineVariety: entry.wine.variety,
          wineRegionGroup: getRegionGroup(entry.wine.region, entry.wine.country) ?? undefined,
          fromLocation: locName,
          toLocation: bestTarget.name,
          quantity: entry.quantity,
          improvementScore: bestScore - currentScore,
        });

        // Simulate the move in place
        const src = simBottles.get(locName)!;
        const srcIdx = src.findIndex(b => b.id === entry.id);
        if (srcIdx >= 0) src.splice(srcIdx, 1);

        const tgt = simBottles.get(bestTarget.name)!;
        tgt.push({ ...entry, location: bestTarget.name });
      }
    }
  }

  // Split each planned move into trips of ≤ carryLimit
  interface RawTrip {
    fromLocation: string;
    toLocation: string;
    move: PlannedMove;
    quantity: number;
  }
  const rawTrips: RawTrip[] = [];

  for (const move of plannedMoves) {
    let remaining = move.quantity;
    while (remaining > 0) {
      const batchQty = Math.min(remaining, carryLimit);
      rawTrips.push({ fromLocation: move.fromLocation, toLocation: move.toLocation, move, quantity: batchQty });
      remaining -= batchQty;
    }
  }

  // Group by from→to key, then re-split into trips respecting carryLimit across different wines
  type TripGroup = { fromLocation: string; toLocation: string; items: Array<{ move: PlannedMove; quantity: number }> };
  const groupMap = new Map<string, TripGroup>();
  for (const rt of rawTrips) {
    const key = `${rt.fromLocation}→${rt.toLocation}`;
    if (!groupMap.has(key)) {
      groupMap.set(key, { fromLocation: rt.fromLocation, toLocation: rt.toLocation, items: [] });
    }
    groupMap.get(key)!.items.push({ move: rt.move, quantity: rt.quantity });
  }

  // Convert groups to batched trips
  const unorderedTrips: Array<{ fromLocation: string; toLocation: string; moves: PlannedMove[]; totalBottles: number }> = [];
  for (const group of groupMap.values()) {
    let currentMoves: PlannedMove[] = [];
    let currentTotal = 0;

    for (const item of group.items) {
      if (currentTotal + item.quantity > carryLimit && currentMoves.length > 0) {
        unorderedTrips.push({ fromLocation: group.fromLocation, toLocation: group.toLocation, moves: currentMoves, totalBottles: currentTotal });
        currentMoves = [];
        currentTotal = 0;
      }
      // Create a copy of the move with this batch's quantity
      currentMoves.push({ ...item.move, quantity: item.quantity, id: `${item.move.id}-${currentTotal}` });
      currentTotal += item.quantity;
    }
    if (currentMoves.length > 0) {
      unorderedTrips.push({ fromLocation: group.fromLocation, toLocation: group.toLocation, moves: currentMoves, totalBottles: currentTotal });
    }
  }

  if (unorderedTrips.length === 0) {
    return { trips: [], totalMoves: 0, totalBottlesMoved: 0, skippedNoCapacity };
  }

  // Walk-order optimization: nearest-neighbor TSP
  const pending = [...unorderedTrips];
  const orderedTrips: typeof unorderedTrips = [];

  // Start at the location with the most outgoing moves
  const pickupCount = new Map<string, number>();
  for (const t of pending) {
    pickupCount.set(t.fromLocation, (pickupCount.get(t.fromLocation) ?? 0) + t.totalBottles);
  }
  let currentLocName = Array.from(pickupCount.entries()).sort((a, b) => b[1] - a[1])[0][0];
  let currentPos = getLocationPos(currentLocName, locMap, alphabetIndex);

  while (pending.length > 0) {
    // First: check if current location has outgoing trips
    const hereIdx = pending.findIndex(t => t.fromLocation === currentLocName);
    let chosen: typeof pending[0];
    let chosenIdx: number;

    if (hereIdx >= 0) {
      chosen = pending[hereIdx];
      chosenIdx = hereIdx;
    } else {
      // Find nearest by fromLocation
      let bestDist = Infinity;
      let bestIdx = 0;
      for (let i = 0; i < pending.length; i++) {
        const pos = getLocationPos(pending[i].fromLocation, locMap, alphabetIndex);
        const dist = manhattan(currentPos, pos);
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = i;
        }
      }
      chosen = pending[bestIdx];
      chosenIdx = bestIdx;
    }

    pending.splice(chosenIdx, 1);
    orderedTrips.push(chosen);
    currentLocName = chosen.toLocation;
    currentPos = getLocationPos(currentLocName, locMap, alphabetIndex);
  }

  // Assign trip numbers and compute distance from previous
  let prevPos = getLocationPos(orderedTrips[0].fromLocation, locMap, alphabetIndex);
  const trips: Trip[] = orderedTrips.map((t, i) => {
    const fromPos = getLocationPos(t.fromLocation, locMap, alphabetIndex);
    const distFromPrev = manhattan(prevPos, fromPos);
    prevPos = getLocationPos(t.toLocation, locMap, alphabetIndex);
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
  };
}
