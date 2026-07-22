import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import { getDb } from '@/lib/db';
import type { WineType } from '@/types';

async function runPythonRecommender(payload: object): Promise<{ groups: unknown[] }> {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(process.cwd(), 'lib', 'recommender.py');
    const py = spawn('python3', [scriptPath]);
    let stdout = '';
    let stderr = '';
    py.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
    py.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
    py.on('close', (code) => {
      if (code !== 0) { reject(new Error(`recommender.py exited ${code}: ${stderr.trim()}`)); return; }
      try { resolve(JSON.parse(stdout) as { groups: unknown[] }); }
      catch { reject(new Error(`recommender.py returned invalid JSON: ${stdout.slice(0, 200)}`)); }
    });
    py.on('error', (err) => reject(new Error(`Failed to spawn python3: ${err.message}`)));
    py.stdin.write(JSON.stringify(payload));
    py.stdin.end();
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json() as {
      foods: string[];
      preferences?: { wine_type?: WineType; max_price?: number };
    };
    if (!Array.isArray(body.foods) || body.foods.length === 0) {
      return NextResponse.json({ error: 'foods array required' }, { status: 400 });
    }

    const db = await getDb();
    const session = await db.getDiscoverySession(id);
    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

    const sessionWines = await db.getSessionWines(id);

    // Only use enriched session wines (those linked to a catalog wine with structural data)
    const enrichedIds = sessionWines.filter(sw => sw.wine_id).map(sw => sw.wine_id!);
    const candidateWines = (await Promise.all(enrichedIds.map(wid => db.getWineById(wid))))
      .filter((w): w is NonNullable<typeof w> => w !== null);

    let filtered = candidateWines;
    if (body.preferences?.wine_type) {
      filtered = filtered.filter(w => w.wine_type === body.preferences!.wine_type);
    }

    // Build a price lookup by wine_id for annotation
    const priceByWineId = new Map<string, { venue_price?: number; market_price?: number }>();
    for (const sw of sessionWines) {
      if (sw.wine_id) priceByWineId.set(sw.wine_id, { venue_price: sw.venue_price, market_price: sw.market_price });
    }

    // Apply max_price filter using venue_price
    if (body.preferences?.max_price != null) {
      const max = body.preferences.max_price;
      filtered = filtered.filter(w => {
        const vp = priceByWineId.get(w.id)?.venue_price;
        if (vp == null) return true; // include wines without a price
        return vp <= max;
      });
    }

    if (filtered.length === 0) {
      return NextResponse.json({ groups: [], unenriched: sessionWines.filter(sw => !sw.wine_id) });
    }

    // Use global food pairing seeds from the DB
    const foodSeeds = await db.getWinesWithPairings(body.foods, true);
    const seedWines = [...new Map(foodSeeds.map(w => [w.id, w])).values()];

    const result = await runPythonRecommender({
      seed_wines: seedWines,
      candidate_wines: filtered,
      settings: {},
    });

    return NextResponse.json({
      groups: result.groups,
      venue_prices: Object.fromEntries(priceByWineId),
      unenriched: sessionWines.filter(sw => !sw.wine_id),
    });
  } catch (err) {
    console.error('[POST /api/discovery-sessions/.../pairings]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
