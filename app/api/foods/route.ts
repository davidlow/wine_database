import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  try {
    const db = await getDb();
    const foods = await db.getAllFoods();
    return NextResponse.json(foods);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
