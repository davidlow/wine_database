import { describe, it, expect } from 'vitest';
import { recommendWines, toVector } from '@/lib/wine-pairing';
import type { Wine } from '@/types';

function makeWine(partial: Partial<Wine> & { id: string; name: string }): Wine {
  return {
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
    ...partial,
  };
}

const SEED_WINES: Wine[] = [
  makeWine({ id: 's1', name: 'Seed Tannic', acidity: 3, tannin: 5, alcohol: 4, sweetness: 0, body: 5 }),
  makeWine({ id: 's2', name: 'Seed Crisp', acidity: 5, tannin: 1, alcohol: 2, sweetness: 0, body: 2 }),
];

const CANDIDATE_WINES: Wine[] = [
  makeWine({ id: 'c1', name: 'Cab Sauv', acidity: 3, tannin: 5, alcohol: 4, sweetness: 0, body: 5 }),
  makeWine({ id: 'c2', name: 'Riesling', acidity: 5, tannin: 0, alcohol: 2, sweetness: 1, body: 2 }),
  makeWine({ id: 'c3', name: 'Chardonnay', acidity: 4, tannin: 1, alcohol: 3, sweetness: 1, body: 3 }),
  makeWine({ id: 'c4', name: 'Pinot Noir', acidity: 4, tannin: 3, alcohol: 3, sweetness: 0, body: 3 }),
  makeWine({ id: 'c5', name: 'No Scores' }), // no structural scores — excluded
];

describe('toVector', () => {
  it('returns null for wine with no structural scores', () => {
    expect(toVector(makeWine({ id: 'x', name: 'X' }))).toBeNull();
  });

  it('returns an 8-element vector when scores are present', () => {
    const v = toVector(SEED_WINES[0]);
    expect(v).toHaveLength(8);
    expect(v![0]).toBe(3); // acidity
    expect(v![1]).toBe(5); // tannin
  });

  it('uses 2.5 as default for missing dimensions', () => {
    const w = makeWine({ id: 'x', name: 'X', acidity: 4 }); // only acidity set
    const v = toVector(w);
    expect(v).not.toBeNull();
    expect(v![0]).toBe(4);      // acidity
    expect(v![1]).toBe(2.5);    // tannin defaulted
  });
});

describe('recommendWines', () => {
  it('returns empty for empty seed wines', () => {
    const groups = recommendWines([], CANDIDATE_WINES);
    expect(groups).toHaveLength(0);
  });

  it('returns empty for seed wines with no structural scores', () => {
    const groups = recommendWines([makeWine({ id: 'x', name: 'X' })], CANDIDATE_WINES);
    expect(groups).toHaveLength(0);
  });

  it('excludes candidates without structural scores', () => {
    const groups = recommendWines(SEED_WINES, CANDIDATE_WINES, { k: 2, sampleM: 3 });
    const recommendedIds = groups.flatMap(g => g.wines.map(w => w.id));
    expect(recommendedIds).not.toContain('c5');
  });

  it('returns at most sampleM wines per group', () => {
    const groups = recommendWines(SEED_WINES, CANDIDATE_WINES, { k: 2, sampleM: 2 });
    groups.forEach(g => expect(g.wines.length).toBeLessThanOrEqual(2));
  });

  it('nearest candidate to tannic centroid is Cab Sauv', () => {
    // One cluster of one — centroid equals the seed wine
    const groups = recommendWines([SEED_WINES[0]], CANDIDATE_WINES, { k: 1, sampleM: 1 });
    expect(groups).toHaveLength(1);
    expect(groups[0].wines[0].id).toBe('c1'); // Cab Sauv matches tannic profile
  });

  it('each group has a valid centroid vector', () => {
    const groups = recommendWines(SEED_WINES, CANDIDATE_WINES, { k: 2, sampleM: 2 });
    groups.forEach(g => {
      expect(g.centroid).toHaveLength(8);
      g.centroid.forEach(v => {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(5);
      });
    });
  });

  it('distance is attached to each recommended wine', () => {
    const groups = recommendWines(SEED_WINES, CANDIDATE_WINES, { k: 2, sampleM: 2 });
    groups.forEach(g => {
      g.wines.forEach(w => {
        expect(typeof w.distance).toBe('number');
        expect(w.distance).toBeGreaterThanOrEqual(0);
      });
    });
  });
});
