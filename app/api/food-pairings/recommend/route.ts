import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import { getDb } from '@/lib/db';

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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { foods, profile_ids, settings } = body as {
      foods: string[];
      profile_ids?: string[];
      settings?: Record<string, unknown>;
    };

    if (!Array.isArray(foods) || foods.length === 0) {
      return NextResponse.json({ error: 'foods array is required' }, { status: 400 });
    }

    const db = await getDb();

    const seedWines = await db.getWinesWithPairings(foods);
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
