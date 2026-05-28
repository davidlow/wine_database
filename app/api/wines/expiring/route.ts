import { NextResponse } from 'next/server';
import { getCurrentUserId } from '@/lib/auth';
import { getDb } from '@/lib/db';

export interface ExpiringBottle {
  wine_id: string;
  wine_name: string;
  producer?: string;
  wine_type?: string;
  vintage_year?: number;
  drink_from_year?: number;
  drink_by_year?: number;
  profile_id: string;
  profile_name: string;
  location: string;
  quantity: number;
  status: 'expired' | 'expiring_soon' | 'too_young';
}

export async function GET() {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const db = await getDb();
    const profiles = await db.getProfiles(userId);
    const currentYear = new Date().getFullYear();

    const allBottles: ExpiringBottle[] = [];

    for (const profile of profiles) {
      const inventory = await db.getCellarInventory(profile.id, userId);
      for (const item of inventory) {
        const wine = item.wine;
        if (!wine) continue;
        const from = wine.drink_from_year;
        const by = wine.drink_by_year;
        if (from == null && by == null) continue;

        let status: ExpiringBottle['status'] | null = null;
        if (by != null && currentYear > by) {
          status = 'expired';
        } else if (by != null && currentYear >= by - 2) {
          status = 'expiring_soon';
        } else if (from != null && currentYear < from) {
          status = 'too_young';
        }

        if (status) {
          allBottles.push({
            wine_id: item.wine_id,
            wine_name: wine.name,
            producer: wine.producer,
            wine_type: wine.wine_type,
            vintage_year: wine.vintage_year,
            drink_from_year: from ?? undefined,
            drink_by_year: by ?? undefined,
            profile_id: profile.id,
            profile_name: profile.name,
            location: item.location,
            quantity: item.quantity,
            status,
          });
        }
      }
    }

    // Shuffle with wine_type variety: interleave different types
    // Sort by urgency first: expired > expiring_soon > too_young, then shuffle within groups
    const shuffled = shuffleWithVariety(allBottles);
    return NextResponse.json(shuffled);
  } catch (err) {
    console.error('[GET /api/wines/expiring]', err);
    return NextResponse.json({ error: 'Failed to fetch expiring wines' }, { status: 500 });
  }
}

function shuffleWithVariety(bottles: ExpiringBottle[]): ExpiringBottle[] {
  const groups: Record<string, ExpiringBottle[]> = {};
  for (const b of bottles) {
    const key = b.wine_type ?? 'other';
    if (!groups[key]) groups[key] = [];
    groups[key].push(b);
  }
  // Shuffle each group
  for (const group of Object.values(groups)) {
    for (let i = group.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [group[i], group[j]] = [group[j], group[i]];
    }
  }
  // Round-robin interleave groups
  const keys = Object.keys(groups);
  const result: ExpiringBottle[] = [];
  let idx = 0;
  while (result.length < bottles.length) {
    const key = keys[idx % keys.length];
    const g = groups[key];
    if (g.length > 0) result.push(g.shift()!);
    idx++;
    if (keys.every(k => groups[k].length === 0)) break;
  }
  return result;
}
