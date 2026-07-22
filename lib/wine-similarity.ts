import type { Wine } from '@/types';
import { toVector } from './wine-pairing';
import { weightedDistance, DEFAULT_WEIGHTS } from './kmeans';

export function findSimilarWines(
  targetVector: number[],
  candidates: Wine[],
  limit = 6,
): Array<{ wine: Wine; distance: number }> {
  const results: Array<{ wine: Wine; distance: number }> = [];
  for (const wine of candidates) {
    const vec = toVector(wine);
    if (!vec) continue;
    const dist = weightedDistance(targetVector as [number, number, number, number, number, number, number, number], vec, DEFAULT_WEIGHTS);
    results.push({ wine, distance: dist });
  }
  results.sort((a, b) => a.distance - b.distance);
  return results.slice(0, limit);
}

export function computePriceStats(
  wines: Wine[],
): { mean: number; std: number; min: number; max: number; count: number } | null {
  const prices = wines.map(w => w.average_price).filter((p): p is number => p != null);
  if (prices.length === 0) return null;
  const mean = prices.reduce((s, p) => s + p, 0) / prices.length;
  const variance = prices.reduce((s, p) => s + (p - mean) ** 2, 0) / prices.length;
  return {
    mean: Math.round(mean * 100) / 100,
    std: Math.round(Math.sqrt(variance) * 100) / 100,
    min: Math.min(...prices),
    max: Math.max(...prices),
    count: prices.length,
  };
}
