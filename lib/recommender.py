#!/usr/bin/env python3
"""
Wine recommendation engine.

Called by the Next.js API route as a subprocess:
  echo '<json>' | python3 lib/recommender.py

Input  (stdin):  JSON with keys: seed_wines, candidate_wines, settings
Output (stdout): JSON with key:  groups

──────────────────────────────────────────────────────────────────────────────
STRUCTURAL VECTOR
Each wine is mapped to a 5-element vector:
  [acidity, tannin, alcohol, sweetness, body]
Values are 0–5.  Missing scores default to 2.5 (midpoint).

ALGORITHM
1. Collect vectors for all seed wines (wines known to pair with the foods).
2. Run K-means++ on those vectors to find k cluster centres.
3. For each centre, rank all candidate wines by weighted Euclidean distance.
4. Sample m wines from the top-N nearest to each centre.

SETTINGS (all optional, shown with defaults)
  k            = 5      number of clusters / style groups to return
  top_n        = 10     candidate pool size per cluster before sampling
  sample_m     = 3      wines to include per group in the final output
  weights      = [1,1,1,1,1]  per-dimension multipliers for distance
  sampling_mode = "closest"   "closest" | "diverse"
  seed         = 42     RNG seed (controls k-means++ init)
  max_iter     = 100    k-means iteration cap
──────────────────────────────────────────────────────────────────────────────
"""

import json
import math
import random
import sys
from typing import Optional


# ── Structural vector ─────────────────────────────────────────────────────────

DIMS = ["acidity", "tannin", "alcohol", "sweetness", "body"]
DEFAULT_MISSING = 2.5   # used when a dimension is absent on a wine


def to_vector(wine: dict) -> Optional[list[float]]:
    """Return a 5-element float list for the wine, or None if all dims are null."""
    if all(wine.get(d) is None for d in DIMS):
        return None
    return [float(wine.get(d) or DEFAULT_MISSING) for d in DIMS]


# ── Distance ──────────────────────────────────────────────────────────────────

def weighted_distance(a: list[float], b: list[float], w: list[float]) -> float:
    """Weighted Euclidean distance between two 5-vectors."""
    return math.sqrt(sum(w[i] * (a[i] - b[i]) ** 2 for i in range(len(a))))


# ── K-means++ initialisation ─────────────────────────────────────────────────

def kmeans_plus_plus_init(
    points: list[list[float]],
    k: int,
    weights: list[float],
    rng: random.Random,
) -> list[list[float]]:
    """
    Choose k initial centroids using the k-means++ strategy.

    The first centroid is chosen uniformly at random.  Each subsequent
    centroid is chosen with probability proportional to the squared distance
    from the nearest already-chosen centroid.  This spreads the initial
    centroids out and usually leads to faster convergence and better results
    than random initialisation.
    """
    n = len(points)
    chosen = [points[rng.randrange(n)]]

    while len(chosen) < k:
        # Squared distance from each point to its nearest chosen centroid
        sq_dists = [
            min(weighted_distance(p, c, weights) ** 2 for c in chosen)
            for p in points
        ]
        total = sum(sq_dists)
        if total == 0:
            chosen.append(points[rng.randrange(n)])
            continue

        # Weighted random pick
        threshold = rng.random() * total
        cumulative = 0.0
        picked = points[-1]
        for i, d in enumerate(sq_dists):
            cumulative += d
            if cumulative >= threshold:
                picked = points[i]
                break
        chosen.append(picked)

    return chosen


# ── K-means ───────────────────────────────────────────────────────────────────

def kmeans(
    points: list[list[float]],
    k: int,
    weights: list[float],
    max_iter: int = 100,
    seed: int = 42,
) -> tuple[list[list[float]], list[int]]:
    """
    Standard k-means with k-means++ initialisation.

    Returns:
        centroids  – list of k centroid vectors
        assignments – for each point, the index of its nearest centroid
    """
    n = len(points)
    if n == 0 or k <= 0:
        return [], []

    effective_k = min(k, n)
    rng = random.Random(seed)
    centroids = kmeans_plus_plus_init(points, effective_k, weights, rng)

    def assign_all(cents):
        return [
            min(range(len(cents)), key=lambda ci: weighted_distance(p, cents[ci], weights))
            for p in points
        ]

    def centroid_of(cluster_points):
        if not cluster_points:
            return None
        dims = len(cluster_points[0])
        return [sum(p[d] for p in cluster_points) / len(cluster_points) for d in range(dims)]

    assignments = assign_all(centroids)

    for _ in range(max_iter):
        new_centroids = []
        for ci in range(effective_k):
            cluster = [points[i] for i, a in enumerate(assignments) if a == ci]
            new_centroids.append(centroid_of(cluster) or centroids[ci])

        new_assignments = assign_all(new_centroids)

        # Converged when nothing moved
        if new_assignments == assignments and all(
            weighted_distance(new_centroids[ci], centroids[ci], weights) < 1e-8
            for ci in range(effective_k)
        ):
            centroids = new_centroids
            assignments = new_assignments
            break

        centroids = new_centroids
        assignments = new_assignments

    return centroids, assignments


# ── Diverse sampling ──────────────────────────────────────────────────────────

def diverse_sample(
    pool: list[dict],   # dicts with "vec" and "dist" keys
    m: int,
    weights: list[float],
) -> list[dict]:
    """
    Greedy maximum-dispersion sampling.

    Always include the closest wine, then repeatedly add the wine
    from the remaining pool that is furthest from all already-picked wines.
    This gives variety within a style group rather than near-duplicates.
    """
    if not pool:
        return []
    picked = [pool[0]]
    remaining = pool[1:]

    while len(picked) < m and remaining:
        # Score each remaining wine by its minimum distance to already-picked wines
        def min_dist_to_picked(candidate):
            return min(weighted_distance(candidate["vec"], p["vec"], weights) for p in picked)

        best = max(remaining, key=min_dist_to_picked)
        picked.append(best)
        remaining.remove(best)

    return picked


# ── Recommendation engine ─────────────────────────────────────────────────────

def recommend(
    seed_wines: list[dict],
    candidate_wines: list[dict],
    settings: dict,
) -> list[dict]:
    """
    Main recommendation function.

    seed_wines      – wines already known to pair with the requested foods
    candidate_wines – wines to recommend from (user's cellar)
    settings        – algorithm parameters (see module docstring)

    Returns a list of groups, each with:
        centroid  – 5-element style centre vector
        wines     – list of recommended wine dicts, each with an added "distance" field
    """
    k            = int(settings.get("k", 5))
    top_n        = int(settings.get("topN", settings.get("top_n", 10)))
    sample_m     = int(settings.get("sampleM", settings.get("sample_m", 3)))
    weights      = settings.get("weights", [1, 1, 1, 1, 1])
    sampling_mode = settings.get("samplingMode", settings.get("sampling_mode", "closest"))
    seed         = int(settings.get("seed", 42))
    max_iter     = int(settings.get("maxIter", settings.get("max_iter", 100)))

    # Build seed vectors (skip wines with no structural scores)
    seed_vecs = [v for w in seed_wines if (v := to_vector(w)) is not None]
    if not seed_vecs:
        return []

    # Cluster the seed vectors
    centroids, _ = kmeans(seed_vecs, k, weights, max_iter, seed)
    if not centroids:
        return []

    # Build candidate pool (wines with at least one structural score)
    candidates = [
        {"wine": w, "vec": v}
        for w in candidate_wines
        if (v := to_vector(w)) is not None
    ]

    groups = []
    for centroid in centroids:
        # Rank candidates by distance to this centroid
        ranked = sorted(
            candidates,
            key=lambda c: weighted_distance(c["vec"], centroid, weights),
        )
        pool = [
            {**c, "dist": weighted_distance(c["vec"], centroid, weights)}
            for c in ranked[:top_n]
        ]

        if sampling_mode == "diverse":
            picked = diverse_sample(pool, sample_m, weights)
        else:
            # Closest: just take the top-m
            picked = pool[:sample_m]

        if not picked:
            continue

        groups.append({
            "centroid": centroid,
            "wines": [
                {**item["wine"], "distance": item["dist"]}
                for item in picked
            ],
        })

    return groups


# ── stdin / stdout interface ───────────────────────────────────────────────────

def main():
    try:
        payload = json.loads(sys.stdin.read())
    except json.JSONDecodeError as e:
        print(json.dumps({"error": f"Invalid JSON input: {e}"}), file=sys.stdout)
        sys.exit(1)

    seed_wines      = payload.get("seed_wines", [])
    candidate_wines = payload.get("candidate_wines", [])
    settings        = payload.get("settings", {})

    groups = recommend(seed_wines, candidate_wines, settings)
    print(json.dumps({"groups": groups}))


if __name__ == "__main__":
    main()
