'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, ArrowRight, Loader2, Sparkles, CheckCircle } from 'lucide-react';
import type { CellarInventory, Location } from '@/types';

interface PlacementRecommendation {
  location_id: string;
  location_name: string;
  location_type?: string;
  score: number;
  reason: string;
  available_capacity?: number;
}

interface BottleMoverProps {
  profileId: string;
  wineId: string;
  wineName: string;
  defaultFromLocation?: string;
  defaultToLocation?: string;
  defaultQuantity?: number;
  onMoveDone?: (from: string, to: string, qty: number) => void;
  onClose: () => void;
}

export default function BottleMover({
  profileId,
  wineId,
  wineName,
  defaultFromLocation,
  defaultToLocation,
  defaultQuantity,
  onMoveDone,
  onClose,
}: BottleMoverProps) {
  const [inventoryByLocation, setInventoryByLocation] = useState<CellarInventory[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [recommendations, setRecommendations] = useState<PlacementRecommendation[]>([]);
  const [fromLocation, setFromLocation] = useState(defaultFromLocation ?? '');
  const [toLocation, setToLocation] = useState(defaultToLocation ?? '');
  const [quantity, setQuantity] = useState(defaultQuantity ?? 1);
  const [loading, setLoading] = useState(true);
  const [moving, setMoving] = useState(false);
  const [lastMoveMsg, setLastMoveMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [invRes, locRes, recRes] = await Promise.all([
        fetch(`/api/cellar?profile_id=${profileId}&wine_id=${wineId}`),
        fetch(`/api/locations?profile_id=${profileId}`),
        fetch(`/api/cellar/placement-recommendations?profile_id=${profileId}&wine_id=${wineId}`),
      ]);

      if (invRes.ok) {
        const inv: CellarInventory[] = await invRes.json();
        setInventoryByLocation(inv.filter(i => i.quantity > 0));
        // Auto-select from: prefer defaultFromLocation, else first with qty
        if (!defaultFromLocation) {
          const firstLoc = inv.find(i => i.quantity > 0)?.location ?? '';
          setFromLocation(firstLoc);
          setQuantity(inv.find(i => i.location === firstLoc)?.quantity ?? 1);
        }
      }
      if (locRes.ok) {
        const locs: Location[] = await locRes.json();
        setLocations(locs);
      }
      if (recRes.ok) {
        const recs: PlacementRecommendation[] = await recRes.json();
        setRecommendations(recs);
      }
    } catch {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [profileId, wineId, defaultFromLocation]);

  useEffect(() => { loadData(); }, [loadData]);

  const fromEntry = inventoryByLocation.find(i => i.location === fromLocation);
  const maxQty = fromEntry?.quantity ?? 0;

  const handleMove = async () => {
    if (!toLocation || !fromEntry) return;
    setMoving(true);
    setError(null);
    try {
      const res = await fetch('/api/cellar/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wine_id: wineId,
          profile_id: profileId,
          from_location: fromLocation,
          to_location: toLocation,
          quantity,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Move failed');

      const fromLabel = fromLocation || 'Unlocated';
      setLastMoveMsg(`Moved ${quantity} bottle${quantity > 1 ? 's' : ''} from ${fromLabel} → ${toLocation}`);
      onMoveDone?.(fromLocation, toLocation, quantity);

      // Refresh inventory (don't reload recommendations — they're stable)
      const invRes = await fetch(`/api/cellar?profile_id=${profileId}&wine_id=${wineId}`);
      if (invRes.ok) {
        const inv: CellarInventory[] = await invRes.json();
        const updated = inv.filter(i => i.quantity > 0);
        setInventoryByLocation(updated);
        // Reset from/qty to remaining inventory
        const remaining = updated.find(i => i.location === fromLocation);
        if (remaining) {
          setQuantity(Math.min(quantity, remaining.quantity));
        } else {
          const first = updated[0];
          setFromLocation(first?.location ?? '');
          setQuantity(first?.quantity ?? 1);
        }
        setToLocation('');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Move failed');
    } finally {
      setMoving(false);
    }
  };

  const allLocations = locations;
  const recommendedIds = new Set(recommendations.map(r => r.location_id));

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-card border rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-md mx-auto p-5 space-y-4 max-h-[85vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold">Move Bottles</h2>
            <p className="text-sm text-muted-foreground truncate max-w-[260px]">{wineName}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-accent transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {lastMoveMsg && (
          <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 dark:bg-green-900/20 dark:text-green-400 rounded-md px-3 py-2">
            <CheckCircle className="h-4 w-4 shrink-0" />
            {lastMoveMsg}
          </div>
        )}
        {error && (
          <div className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{error}</div>
        )}

        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : inventoryByLocation.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No bottles in cellar for this wine.</p>
        ) : (
          <>
            {/* From */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">From</label>
              <select
                value={fromLocation}
                onChange={e => {
                  setFromLocation(e.target.value);
                  const entry = inventoryByLocation.find(i => i.location === e.target.value);
                  setQuantity(entry?.quantity ?? 1);
                }}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              >
                {inventoryByLocation.map(entry => (
                  <option key={entry.id} value={entry.location}>
                    {entry.location || 'Unlocated'} — {entry.quantity} bottle{entry.quantity !== 1 ? 's' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Quantity */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Quantity (max {maxQty})
              </label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setQuantity(q => Math.max(1, q - 1))}
                  disabled={quantity <= 1}
                  className="w-9 h-9 rounded-md border text-lg font-medium hover:bg-accent disabled:opacity-40 transition-colors"
                >
                  −
                </button>
                <input
                  type="number"
                  min={1}
                  max={maxQty}
                  value={quantity}
                  onChange={e => setQuantity(Math.max(1, Math.min(maxQty, parseInt(e.target.value, 10) || 1)))}
                  className="flex-1 rounded-md border bg-background px-3 py-2 text-sm text-center"
                />
                <button
                  onClick={() => setQuantity(q => Math.min(maxQty, q + 1))}
                  disabled={quantity >= maxQty}
                  className="w-9 h-9 rounded-md border text-lg font-medium hover:bg-accent disabled:opacity-40 transition-colors"
                >
                  +
                </button>
              </div>
            </div>

            {/* To */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                To
                {recommendations.length > 0 && (
                  <span className="flex items-center gap-0.5 text-purple-600 dark:text-purple-400">
                    <Sparkles className="h-3 w-3" />
                    <span className="normal-case font-normal">Recommended first</span>
                  </span>
                )}
              </label>
              <select
                value={toLocation}
                onChange={e => setToLocation(e.target.value)}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              >
                <option value="">— Select destination —</option>
                {recommendations.length > 0 && (
                  <optgroup label="Recommended">
                    {recommendations.map(r => (
                      <option key={r.location_id} value={r.location_name}>
                        {r.location_name}{r.reason ? ` (${r.reason})` : ''}
                        {r.available_capacity != null ? ` [${r.available_capacity} open]` : ''}
                      </option>
                    ))}
                  </optgroup>
                )}
                <optgroup label={recommendations.length > 0 ? 'Other locations' : 'Locations'}>
                  {allLocations
                    .filter(l => l.name !== fromLocation && !recommendedIds.has(l.id))
                    .map(l => (
                      <option key={l.id} value={l.name}>
                        {l.name}
                        {l.available_capacity != null ? ` [${l.available_capacity} open]` : ''}
                      </option>
                    ))}
                </optgroup>
              </select>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={handleMove}
                disabled={!toLocation || moving || quantity < 1}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {moving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="h-4 w-4" />
                )}
                {moving ? 'Moving…' : `Move ${quantity} bottle${quantity !== 1 ? 's' : ''}`}
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2.5 rounded-md border text-sm hover:bg-accent transition-colors"
              >
                Done
              </button>
            </div>

            {inventoryByLocation.length === 0 && (
              <p className="text-xs text-muted-foreground text-center pt-1">All bottles moved.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
