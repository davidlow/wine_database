import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import { getDb } from '@/lib/db';
import type { CuisineTag } from '@/types';

// Calls lib/recommender.py with the wine data and settings as JSON on stdin.
// Returns the parsed JSON output, or throws on non-zero exit / bad JSON.
async function runPythonRecommender(payload: object): Promise<{ groups: unknown[] }> {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(process.cwd(), 'lib', 'recommender.py');
    const py = spawn('python3', [scriptPath]);

    let stdout = '';
    let stderr = '';

    py.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
    py.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

    py.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`recommender.py exited ${code}: ${stderr.trim() || '(no stderr)'}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout) as { groups: unknown[] });
      } catch {
        reject(new Error(`recommender.py returned invalid JSON: ${stdout.slice(0, 200)}`));
      }
    });

    py.on('error', (err) => {
      reject(new Error(`Failed to spawn python3: ${err.message}. Is python3 installed?`));
    });

    py.stdin.write(JSON.stringify(payload));
    py.stdin.end();
  });
}

// Infer pairing_weight hints from food keywords for broader seed coverage
const FOOD_WEIGHT_HINTS: Array<{ keywords: string[]; weights: string[] }> = [
  { keywords: ['steak', 'ribeye', 'brisket', 'lamb', 'venison', 'game', 'boar', 'elk', 'osso buco'], weights: ['full', 'robust'] },
  { keywords: ['salmon', 'tuna', 'swordfish', 'seafood', 'lobster', 'crab', 'shrimp'], weights: ['delicate', 'light', 'medium'] },
  { keywords: ['oyster', 'clam', 'mussel', 'scallop'], weights: ['delicate', 'light'] },
  { keywords: ['chicken', 'pork', 'veal', 'duck', 'turkey'], weights: ['light', 'medium', 'full'] },
  { keywords: ['pasta', 'pizza', 'risotto', 'lasagna'], weights: ['medium', 'full'] },
  { keywords: ['salad', 'vegetable', 'tofu', 'mushroom'], weights: ['delicate', 'light', 'medium'] },
  { keywords: ['cheese', 'charcuterie', 'charcuteri'], weights: ['medium', 'full'] },
  { keywords: ['dessert', 'chocolate', 'cake', 'tart'], weights: ['dessert'] },
];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { foods, cuisine_tags, profile_ids, settings } = body as {
      foods: string[];
      cuisine_tags?: CuisineTag[];
      profile_ids?: string[];
      settings?: Record<string, unknown>;
    };

    if (!Array.isArray(foods) || foods.length === 0) {
      return NextResponse.json({ error: 'foods array is required' }, { status: 400 });
    }

    const db = await getDb();

    // Multi-source seed pool — run in parallel
    const lowerFoods = foods.map(f => f.toLowerCase());

    // Source 1: fuzzy food string match
    const foodSeedPromise = db.getWinesWithPairings(foods, true);

    // Source 2: cuisine tag match (if provided)
    const tagSeedPromise = cuisine_tags?.length
      ? db.getWinesWithCuisineTags(cuisine_tags)
      : Promise.resolve([]);

    // Source 3: pairing_weight keyword inference
    const inferredWeights = new Set<string>();
    for (const hint of FOOD_WEIGHT_HINTS) {
      if (hint.keywords.some(kw => lowerFoods.some(f => f.includes(kw)))) {
        hint.weights.forEach(w => inferredWeights.add(w));
      }
    }

    const [foodSeeds, tagSeeds] = await Promise.all([foodSeedPromise, tagSeedPromise]);

    // Merge unique seeds
    const seedMap = new Map<string, import('@/types').Wine>();
    for (const w of [...foodSeeds, ...tagSeeds]) {
      if (!seedMap.has(w.id)) seedMap.set(w.id, w);
    }
    const seedWines = [...seedMap.values()];

    const candidateParams = profile_ids?.length ? { profile_ids: profile_ids.join(',') } : {};
    const candidateWines = await db.getWines(candidateParams);

    const result = await runPythonRecommender({
      seed_wines: seedWines,
      candidate_wines: candidateWines,
      settings: settings ?? {},
    });

    return NextResponse.json({
      groups: result.groups,
      seed_count: seedWines.length,
      candidate_count: candidateWines.length,
    });
  } catch (err) {
    console.error('[POST /api/food-pairings/recommend]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
