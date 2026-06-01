import { describe, it, expect } from 'vitest';
import { kmeans, weightedDistance, DEFAULT_WEIGHTS } from '@/lib/kmeans';
import type { WineStructureVector } from '@/types';

describe('weightedDistance', () => {
  it('returns 0 for identical vectors', () => {
    const v: WineStructureVector = [1, 2, 3, 4, 5];
    expect(weightedDistance(v, v, DEFAULT_WEIGHTS)).toBe(0);
  });

  it('computes Euclidean distance for unit weights', () => {
    const a: WineStructureVector = [0, 0, 0, 0, 0];
    const b: WineStructureVector = [1, 0, 0, 0, 0];
    expect(weightedDistance(a, b, DEFAULT_WEIGHTS)).toBeCloseTo(1);
  });

  it('applies weights — heavier dimension dominates distance', () => {
    const a: WineStructureVector = [0, 0, 0, 0, 0];
    const b: WineStructureVector = [1, 0, 0, 0, 0]; // 1 unit in dim-0
    const c: WineStructureVector = [0, 1, 0, 0, 0]; // 1 unit in dim-1
    const w: [number, number, number, number, number] = [4, 1, 1, 1, 1];
    expect(weightedDistance(a, b, w)).toBeGreaterThan(weightedDistance(a, c, w));
  });
});

describe('kmeans', () => {
  it('returns empty result for empty input', () => {
    const r = kmeans([], 3);
    expect(r.centroids).toHaveLength(0);
    expect(r.assignments).toHaveLength(0);
  });

  it('returns k=1 centroid as mean of all points', () => {
    const points: WineStructureVector[] = [
      [0, 0, 0, 0, 0],
      [4, 4, 4, 4, 4],
    ];
    const r = kmeans(points, 1);
    expect(r.centroids).toHaveLength(1);
    expect(r.assignments.every(a => a === 0)).toBe(true);
    // Centroid should be approximately the mean
    r.centroids[0].forEach(v => expect(v).toBeCloseTo(2));
  });

  it('assigns points to nearest centroid', () => {
    // Two clearly separated clusters
    const cluster1: WineStructureVector[] = [
      [0, 0, 0, 0, 0],
      [0.5, 0, 0, 0, 0],
      [0, 0.5, 0, 0, 0],
    ];
    const cluster2: WineStructureVector[] = [
      [5, 5, 5, 5, 5],
      [4.5, 5, 5, 5, 5],
      [5, 4.5, 5, 5, 5],
    ];
    const points = [...cluster1, ...cluster2];
    const r = kmeans(points, 2);
    expect(r.centroids).toHaveLength(2);
    // All cluster1 points should share a centroid index, cluster2 the other
    const c1 = r.assignments[0];
    expect(r.assignments.slice(0, 3).every(a => a === c1)).toBe(true);
    const c2 = r.assignments[3];
    expect(c1).not.toBe(c2);
    expect(r.assignments.slice(3).every(a => a === c2)).toBe(true);
  });

  it('handles k > n by capping at n clusters', () => {
    const points: WineStructureVector[] = [[1, 2, 3, 4, 5]];
    const r = kmeans(points, 10);
    expect(r.centroids).toHaveLength(1);
  });

  it('is deterministic with the same seed', () => {
    const points: WineStructureVector[] = Array.from({ length: 20 }, (_, i) => [
      i % 5, (i * 2) % 5, (i + 1) % 5, i % 3, (i * 3) % 5,
    ] as WineStructureVector);
    const r1 = kmeans(points, 3, DEFAULT_WEIGHTS, 100, 42);
    const r2 = kmeans(points, 3, DEFAULT_WEIGHTS, 100, 42);
    expect(r1.assignments).toEqual(r2.assignments);
  });
});
