import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentUserId } from '@/lib/auth';
import { checkProfileAccess } from '@/lib/permissions';

export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = request.nextUrl;
    const profileId = searchParams.get('profile_id');
    const wineId = searchParams.get('wine_id');

    if (!profileId) return NextResponse.json({ error: 'profile_id required' }, { status: 400 });

    const denied = await checkProfileAccess(profileId, userId, 'read');
    if (denied) return denied;

    const db = await getDb();

    if (wineId) {
      const inventory = await db.getCellarInventoryByWine(wineId, profileId);
      return NextResponse.json(inventory);
    }

    let inventory = await db.getCellarInventory(profileId, userId);

    // Optional filters applied in-memory (avoids DbAdapter interface change)
    const locationParam = searchParams.get('location');
    if (locationParam !== null) {
      inventory = inventory.filter(item => item.location === locationParam);
    }

    const q = searchParams.get('q')?.trim().toLowerCase();
    if (q) {
      inventory = inventory.filter(item =>
        item.wine?.name?.toLowerCase().includes(q) ||
        item.wine?.producer?.toLowerCase().includes(q)
      );
    }

    const wineType = searchParams.get('wine_type');
    if (wineType) {
      inventory = inventory.filter(item => item.wine?.wine_type === wineType);
    }

    const sortParam = searchParams.get('sort');
    if (sortParam === 'date') {
      inventory = inventory.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    } else if (sortParam === 'drink') {
      inventory = inventory.sort((a, b) =>
        (a.wine?.drink_by_year ?? 9999) - (b.wine?.drink_by_year ?? 9999)
      );
    }

    return NextResponse.json(inventory);
  } catch (err) {
    console.error('[GET /api/cellar]', err);
    return NextResponse.json({ error: 'Failed to fetch inventory' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    if (!body.wine_id) return NextResponse.json({ error: 'wine_id required' }, { status: 400 });
    if (!body.profile_id) return NextResponse.json({ error: 'profile_id required' }, { status: 400 });
    if (!body.location?.trim()) return NextResponse.json({ error: 'location required' }, { status: 400 });

    const denied = await checkProfileAccess(body.profile_id, userId, 'write');
    if (denied) return denied;

    const db = await getDb();
    const item = await db.addBottle({
      wine_id: body.wine_id,
      profile_id: body.profile_id,
      location: body.location.trim(),
      quantity: body.quantity ?? 1,
      purchase_price: body.purchase_price,
      purchase_date: body.purchase_date,
      notes: body.notes,
    }, userId);

    return NextResponse.json(item, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to add bottles';
    console.error('[POST /api/cellar]', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
