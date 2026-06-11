import type { PantryTransaction } from '@/types';

/**
 * Computes a usage prediction for a pantry item based on its removal history.
 * Requires at least 2 removal events with meaningful time between them.
 */
export function computeUsagePrediction(
  txns: PantryTransaction[],
  name: string,
  resetDate?: string | null
): { daysPerUnit: number; eventCount: number } | null {
  let removes = txns.filter(
    t => t.action === 'remove' && t.item_name?.toLowerCase() === name.toLowerCase()
  );
  if (resetDate) removes = removes.filter(t => t.created_at >= resetDate);
  if (removes.length < 2) return null;
  const sorted = [...removes].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const totalDays =
    (new Date(sorted[sorted.length - 1].created_at).getTime() -
      new Date(sorted[0].created_at).getTime()) /
    86_400_000;
  if (totalDays < 0.1) return null;
  const totalQty = removes.reduce((s, t) => s + t.quantity, 0);
  return { daysPerUnit: totalDays / totalQty, eventCount: removes.length };
}

/** Formats a number of days into a human-readable string. */
export function formatDays(days: number): string {
  if (days < 2) return '1 day';
  if (days < 14) return `${Math.round(days)} days`;
  if (days < 56) return `${Math.round(days / 7)} weeks`;
  if (days < 365) return `${Math.round(days / 30)} months`;
  return `${(days / 365).toFixed(1)} years`;
}
