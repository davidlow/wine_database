import type { Wine } from '@/types';

// Jaccard token-overlap similarity for two strings, normalised to lowercase alphanum.
// Returns 0–1; 1 = identical token sets.
export function nameSimilarity(a: string, b: string): number {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return 1;
  const tokensA = new Set(na.split(/\s+/).filter(t => t.length > 2));
  const tokensB = new Set(nb.split(/\s+/).filter(t => t.length > 2));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;
  let shared = 0;
  tokensA.forEach(t => { if (tokensB.has(t)) shared++; });
  return shared / Math.max(tokensA.size, tokensB.size);
}

// Weighted composite similarity between two wines (0–1).
// Weights: vintage_year exact=0.30, producer similarity=0.25, variety similarity=0.20,
//          name similarity=0.15, wine_type exact=0.10.
export function overallSimilarity(w1: Wine, w2: Wine): number {
  let score = 0;

  // vintage_year: exact match required (or both missing)
  if (w1.vintage_year && w2.vintage_year) {
    if (w1.vintage_year === w2.vintage_year) score += 0.30;
    // If vintages differ by > 1 year they're almost certainly different wines — hard penalise
    else if (Math.abs(w1.vintage_year - w2.vintage_year) > 1) return 0;
    // ±1 year: no score but also no hard fail
  } else if (!w1.vintage_year && !w2.vintage_year) {
    score += 0.15; // partial credit — both unknown
  }

  // wine_type: exact match
  if (w1.wine_type && w2.wine_type) {
    if (w1.wine_type === w2.wine_type) score += 0.10;
    else return 0; // Different wine types → definitely not duplicates
  }

  // producer: Jaccard similarity
  if (w1.producer && w2.producer) {
    const sim = nameSimilarity(w1.producer, w2.producer);
    score += sim * 0.25;
    if (sim < 0.3) return 0; // Different producers → almost certainly different wines
  } else if (!w1.producer && !w2.producer) {
    score += 0.10; // both unknown
  }

  // variety: Jaccard similarity
  if (w1.variety && w2.variety) {
    score += nameSimilarity(w1.variety, w2.variety) * 0.20;
  } else if (!w1.variety && !w2.variety) {
    score += 0.10;
  }

  // name: Jaccard similarity
  score += nameSimilarity(w1.name, w2.name) * 0.15;

  return score;
}

interface DuplicateGroup {
  wines: Wine[];
  score: number;
}

// Find groups of wines that are likely duplicates using union-find over pairwise similarity.
// Threshold: overallSimilarity > 0.65.
// O(n²) — acceptable for personal cellar sizes.
export function findDuplicateGroups(wines: Wine[]): DuplicateGroup[] {
  const THRESHOLD = 0.65;
  const n = wines.length;

  // Union-Find
  const parent = Array.from({ length: n }, (_, i) => i);
  const pairScores = new Map<string, number>();

  function find(i: number): number {
    while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; }
    return i;
  }
  function union(i: number, j: number) {
    parent[find(i)] = find(j);
  }

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const score = overallSimilarity(wines[i], wines[j]);
      if (score >= THRESHOLD) {
        pairScores.set(`${i}-${j}`, score);
        union(i, j);
      }
    }
  }

  // Group by root
  const groups = new Map<number, { indices: number[]; maxScore: number }>();
  for (let i = 0; i < n; i++) {
    const root = find(i);
    if (!groups.has(root)) groups.set(root, { indices: [], maxScore: 0 });
    groups.get(root)!.indices.push(i);
  }

  const result: DuplicateGroup[] = [];
  for (const { indices, maxScore } of groups.values()) {
    if (indices.length < 2) continue;
    // Find highest pairwise score in the group for display
    let best = maxScore;
    for (let a = 0; a < indices.length; a++) {
      for (let b = a + 1; b < indices.length; b++) {
        const s = pairScores.get(`${indices[a]}-${indices[b]}`) ?? 0;
        if (s > best) best = s;
      }
    }
    result.push({ wines: indices.map(i => wines[i]), score: best });
  }

  // Sort by score descending
  result.sort((a, b) => b.score - a.score);
  return result;
}
