import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentUserId } from '@/lib/auth';
import { checkProfileAccess } from '@/lib/permissions';

export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { wine_id, profile_id, from_location, to_location, quantity } = body as {
      wine_id: string;
      profile_id: string;
      from_location: string;
      to_location: string;
      quantity: number;
    };

    if (!wine_id) return NextResponse.json({ error: 'wine_id required' }, { status: 400 });
    if (!profile_id) return NextResponse.json({ error: 'profile_id required' }, { status: 400 });
    if (from_location === undefined || from_location === null) {
      return NextResponse.json({ error: 'from_location required' }, { status: 400 });
    }
    if (!to_location) return NextResponse.json({ error: 'to_location required' }, { status: 400 });
    if (!quantity || quantity < 1) return NextResponse.json({ error: 'quantity must be ≥ 1' }, { status: 400 });
    if (from_location === to_location) {
      return NextResponse.json({ error: 'from_location and to_location must differ' }, { status: 400 });
    }

    const denied = await checkProfileAccess(profile_id, userId, 'write');
    if (denied) return denied;

    const db = await getDb();

    // Look up the inventory entry for this wine at from_location
    const inventory = await db.getCellarInventoryByWine(wine_id, profile_id);
    const entry = inventory.find(i => i.location === from_location);
    if (!entry) {
      return NextResponse.json(
        { error: `No inventory for this wine at location "${from_location || 'Unlocated'}"` },
        { status: 404 }
      );
    }
    if (quantity > entry.quantity) {
      return NextResponse.json(
        { error: `Cannot move ${quantity} bottles; only ${entry.quantity} available` },
        { status: 400 }
      );
    }

    await db.moveBottle({ cellar_inventory_id: entry.id, new_location: to_location, quantity }, userId);

    return NextResponse.json({ success: true, moved: quantity, from: from_location, to: to_location });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Move failed';
    console.error('[POST /api/cellar/move]', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
