import type { Wine, WineStructureVector } from '@/types';
import { kmeans, weightedDistance, DEFAULT_WEIGHTS } from './kmeans';
import type { DimWeights } from './kmeans';

export interface PairingSettings {
  k?: number;            // number of clusters (default 5)
  topN?: number;         // candidate wines per centroid (default 10)
  sampleM?: number;      // wines to show per group (default 3)
  weights?: DimWeights;  // per-dimension weights (default all 1)
  samplingMode?: 'closest' | 'diverse'; // default 'closest'
}

export interface RecommendationGroup {
  centroid: WineStructureVector;
  wines: Array<Wine & { distance: number }>;
}

export function toVector(wine: Wine): WineStructureVector | null {
  const { acidity, tannin, alcohol, sweetness, body } = wine;
  if (acidity == null && tannin == null && alcohol == null && sweetness == null && body == null) return null;
  return [acidity ?? 2.5, tannin ?? 2.5, alcohol ?? 2.5, sweetness ?? 2.5, body ?? 2.5];
}

// Shuffle array in place using Fisher-Yates (seeded via simple counter for reproducibility)
function shuffleSeed<T>(arr: T[], seed: number): T[] {
  const a = [...arr];
  let s = seed;
  const rng = () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0x100000000; };
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function recommendWines(
  seedWines: Wine[],          // wines that pair with the requested foods
  candidateWines: Wine[],     // wines to recommend from (cellar or catalog)
  settings: PairingSettings = {},
): RecommendationGroup[] {
  const {
    k = 5,
    topN = 10,
    sampleM = 3,
    weights = DEFAULT_WEIGHTS,
    samplingMode = 'closest',
  } = settings;

  // Build vectors from seed wines (only those with structural scores)
  const seedVectors: WineStructureVector[] = seedWines
    .map(toVector)
    .filter((v): v is WineStructureVector => v !== null);

  if (seedVectors.length === 0) return [];

  const effectiveK = Math.min(k, seedVectors.length);
  const { centroids } = kmeans(seedVectors, effectiveK, weights);

  if (centroids.length === 0) return [];

  // Build candidate pool (only wines with structural scores)
  const candidatesWithVectors = candidateWines
    .map(w => ({ wine: w, vec: toVector(w) }))
    .filter((x): x is { wine: Wine; vec: WineStructureVector } => x.vec !== null);

  return centroids.map((centroid) => {
    // Rank all candidates by distance to this centroid
    const ranked = candidatesWithVectors
      .map(({ wine, vec }) => ({ wine, vec, dist: weightedDistance(vec, centroid, weights) }))
      .sort((a, b) => a.dist - b.dist);

    const pool = ranked.slice(0, topN);

    let picked: typeof pool;
    if (samplingMode === 'diverse') {
      // Greedy diversity: always include the closest, then greedily pick least similar to already picked
      picked = [];
      const remaining = [...pool];
      if (remaining.length > 0) {
        picked.push(remaining.shift()!);
      }
      while (picked.length < sampleM && remaining.length > 0) {
        let bestIdx = 0;
        let bestMinDist = -1;
        for (let i = 0; i < remaining.length; i++) {
          const minDist = Math.min(...picked.map(p => weightedDistance(remaining[i].vec, p.vec, weights)));
          if (minDist > bestMinDist) { bestMinDist = minDist; bestIdx = i; }
        }
        picked.push(...remaining.splice(bestIdx, 1));
      }
    } else {
      // Closest mode: take top sampleM, with a bit of shuffling among ties
      const shuffled = shuffleSeed(pool, centroid.reduce((s, v) => s + Math.round(v * 100), 0));
      picked = shuffled.sort((a, b) => a.dist - b.dist).slice(0, sampleM);
    }

    return {
      centroid,
      wines: picked.map(({ wine, dist }) => ({ ...wine, distance: dist })),
    };
  }).filter(g => g.wines.length > 0);
}
