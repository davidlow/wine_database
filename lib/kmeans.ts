import type { WineStructureVector } from '@/types';

export type DimWeights = [number, number, number, number, number, number, number, number];
export const DEFAULT_WEIGHTS: DimWeights = [1, 1, 1, 1, 1, 1, 1, 1];

export function weightedDistance(a: WineStructureVector, b: WineStructureVector, w: DimWeights): number {
  let sum = 0;
  for (let i = 0; i < 8; i++) {
    const diff = a[i] - b[i];
    sum += w[i] * diff * diff;
  }
  return Math.sqrt(sum);
}

function centroid(points: WineStructureVector[]): WineStructureVector {
  if (points.length === 0) return [0, 0, 0, 0, 0, 0, 0, 0];
  const sums: WineStructureVector = [0, 0, 0, 0, 0, 0, 0, 0];
  for (const p of points) {
    for (let i = 0; i < 8; i++) sums[i] += p[i];
  }
  return sums.map(s => s / points.length) as WineStructureVector;
}

function assign(points: WineStructureVector[], centroids: WineStructureVector[], w: DimWeights): number[] {
  return points.map(p => {
    let best = 0;
    let bestDist = Infinity;
    for (let c = 0; c < centroids.length; c++) {
      const d = weightedDistance(p, centroids[c], w);
      if (d < bestDist) { bestDist = d; best = c; }
    }
    return best;
  });
}

// K-means++ initialization: choose first centroid randomly, then pick subsequent
// centroids with probability proportional to squared distance to nearest existing centroid.
function initKMeansPlusPlus(
  points: WineStructureVector[],
  k: number,
  w: DimWeights,
  rng: () => number,
): WineStructureVector[] {
  const n = points.length;
  if (n === 0 || k <= 0) return [];
  const chosen: WineStructureVector[] = [points[Math.floor(rng() * n)]];
  while (chosen.length < k && chosen.length < n) {
    const dists = points.map(p => {
      let minD = Infinity;
      for (const c of chosen) { const d = weightedDistance(p, c, w); if (d < minD) minD = d; }
      return minD * minD;
    });
    const total = dists.reduce((s, d) => s + d, 0);
    if (total === 0) {
      chosen.push(points[Math.floor(rng() * n)]);
      continue;
    }
    let r = rng() * total;
    let added = false;
    for (let i = 0; i < n; i++) {
      r -= dists[i];
      if (r <= 0) { chosen.push(points[i]); added = true; break; }
    }
    if (!added) chosen.push(points[n - 1]);
  }
  return chosen;
}

export interface KMeansResult {
  centroids: WineStructureVector[];
  assignments: number[];
  iterations: number;
}

export function kmeans(
  points: WineStructureVector[],
  k: number,
  weights: DimWeights = DEFAULT_WEIGHTS,
  maxIter = 100,
  seed = 42,
): KMeansResult {
  const n = points.length;
  if (n === 0 || k <= 0) return { centroids: [], assignments: [], iterations: 0 };
  const effectiveK = Math.min(k, n);

  // Simple seeded LCG for reproducibility
  let s = seed;
  const rng = () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0x100000000; };

  let centroids = initKMeansPlusPlus(points, effectiveK, weights, rng);
  let assignments = assign(points, centroids, weights);
  let iters = 0;

  for (; iters < maxIter; iters++) {
    const newCentroids = centroids.map((_, ci) => {
      const cluster = points.filter((_, i) => assignments[i] === ci);
      return cluster.length > 0 ? centroid(cluster) : centroids[ci];
    });

    // Check convergence: all centroid movements < epsilon
    const converged = newCentroids.every((nc, ci) => weightedDistance(nc, centroids[ci], weights) < 1e-6);
    centroids = newCentroids;
    const newAssignments = assign(points, centroids, weights);

    if (converged && newAssignments.every((a, i) => a === assignments[i])) break;
    assignments = newAssignments;
  }

  return { centroids, assignments, iterations: iters };
}
