'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, Loader2, MapPin, Minus, X } from 'lucide-react';
import WineFinder from '@/components/WineFinder';
import LocationPicker from '@/components/LocationPicker';
import { useProfile } from '@/hooks/useProfile';
import type { CellarInventory, Wine } from '@/types';

// ── Types ──────────────────────────────────────────────────────────────────────

type ViewState = 'searching' | 'results' | 'removing' | 'moving';

interface RemoveTarget {
  entry: CellarInventory;
  qty: number;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function FinderPage() {
  const { activeProfile } = useProfile();

  const [view, setView] = useState<ViewState>('searching');
  const [foundWine, setFoundWine] = useState<Partial<Wine> | null>(null);
  const [entries, setEntries] = useState<CellarInventory[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(false);

  // Remove state
  const [removeTarget, setRemoveTarget] = useState<RemoveTarget | null>(null);
  const [removing, setRemoving] = useState(false);
  const [removeNote, setRemoveNote] = useState('');

  // Move state
  const [moveTarget, setMoveTarget] = useState<CellarInventory | null>(null);
  const [moveQty, setMoveQty] = useState(1);
  const [moveLocation, setMoveLocation] = useState('');
  const [moving, setMoving] = useState(false);

  // ── Load cellar entries ───────────────────────────────────────────────────

  const loadEntries = async (wine: Partial<Wine>) => {
    if (!activeProfile || !wine.id) { setEntries([]); return; }
    setLoadingEntries(true);
    try {
      const res = await fetch(
        `/api/cellar?profile_id=${encodeURIComponent(activeProfile.id)}&wine_id=${encodeURIComponent(wine.id)}`
      );
      const data: CellarInventory[] = await res.json();
      setEntries(Array.isArray(data) ? data : []);
    } catch {
      setEntries([]);
    } finally {
      setLoadingEntries(false);
    }
  };

  // ── WineFinder callbacks ──────────────────────────────────────────────────

  const handleWineSelected = async (wine: Partial<Wine>) => {
    setFoundWine(wine);
    setView('results');
    await loadEntries(wine);
  };

  const handleManualEntry = () => {
    // In the finder, "manual entry" means the wine wasn't found — stay searching
    setView('searching');
  };

  // ── Remove ────────────────────────────────────────────────────────────────

  const confirmRemove = async () => {
    if (!removeTarget || removing) return;
    setRemoving(true);
    try {
      await fetch(`/api/cellar/${removeTarget.entry.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: removeTarget.qty, notes: removeNote || undefined }),
      });
      // Refresh entries
      if (foundWine) await loadEntries(foundWine);
      setRemoveTarget(null);
      setRemoveNote('');
      setView('results');
    } catch {
      // ignore — entry might still show
    } finally {
      setRemoving(false);
    }
  };

  // ── Move ──────────────────────────────────────────────────────────────────

  const confirmMove = async () => {
    if (!activeProfile || !moveTarget || moving || !moveLocation) return;
    setMoving(true);
    try {
      await fetch('/api/cellar/bulk-locate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile_id: activeProfile.id,
          assignments: [{
            cellar_inventory_id: moveTarget.id,
            new_location: moveLocation,
            quantity: moveQty,
          }],
        }),
      });
      if (foundWine) await loadEntries(foundWine);
      setMoveTarget(null);
      setMoveLocation('');
      setView('results');
    } catch {
      // ignore
    } finally {
      setMoving(false);
    }
  };

  // ── Derived ───────────────────────────────────────────────────────────────

  const located = entries.filter(e => e.location && e.location !== '');
  const unlocated = entries.filter(e => !e.location || e.location === '');
  const totalBottles = entries.reduce((s, e) => s + e.quantity, 0);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b shrink-0">
        {view !== 'searching' ? (
          <button onClick={() => setView('searching')} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </button>
        ) : (
          <Link href="/" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        )}
        <h2 className="text-base font-bold">Bottle Finder</h2>
      </div>

      {/* ── Searching ── */}
      {view === 'searching' && (
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-md mx-auto px-4 py-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              Find a bottle in your cellar — scan its barcode, search by producer, or photograph the label.
            </p>
            {activeProfile ? (
              <WineFinder
                profileId={activeProfile.id}
                requireLabelIfNotFound={false}
                onSelect={handleWineSelected}
                onManualEntry={handleManualEntry}
              />
            ) : (
              <p className="text-sm text-muted-foreground">No cellar profile selected.</p>
            )}
          </div>
        </div>
      )}

      {/* ── Results ── */}
      {view === 'results' && foundWine && (
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-md mx-auto px-4 py-4 space-y-4">
            {/* Wine details card */}
            <div className="rounded-lg border bg-card px-4 py-3 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-base truncate">{foundWine.name ?? 'Unknown wine'}</p>
                  {foundWine.producer && <p className="text-sm text-muted-foreground">{foundWine.producer}</p>}
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {[foundWine.wine_type, foundWine.variety, foundWine.vintage_year, foundWine.region, foundWine.country].filter(Boolean).join(' · ')}
                  </p>
                </div>
                {foundWine.id && (
                  <Link href={`/wines/${foundWine.id}`} className="shrink-0 p-1.5 rounded hover:bg-muted" title="View wine page">
                    <ExternalLink className="h-4 w-4 text-muted-foreground" />
                  </Link>
                )}
              </div>

              <div className="flex items-center gap-2 text-sm">
                <span className="font-semibold text-primary">{totalBottles}</span>
                <span className="text-muted-foreground">bottle{totalBottles !== 1 ? 's' : ''} in cellar</span>
              </div>
            </div>

            {loadingEntries ? (
              <div className="flex items-center justify-center gap-2 py-6 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Loading cellar entries…</span>
              </div>
            ) : entries.length === 0 ? (
              <div className="rounded-lg border bg-muted/20 px-4 py-6 text-center">
                <p className="text-sm text-muted-foreground">This wine is not in your cellar.</p>
                <Link href="/scanner/rack" className="text-xs text-primary hover:underline mt-1 inline-block">
                  Add via Rack Scanner →
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Located bottles */}
                {located.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Located</p>
                    {located.map(entry => (
                      <EntryRow
                        key={entry.id}
                        entry={entry}
                        profileId={activeProfile?.id ?? ''}
                        onRemove={() => { setRemoveTarget({ entry, qty: 1 }); setView('removing'); }}
                        onMove={() => { setMoveTarget(entry); setMoveQty(1); setMoveLocation(''); setView('moving'); }}
                      />
                    ))}
                  </div>
                )}

                {/* Unlocated bottles */}
                {unlocated.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Unlocated</p>
                    {unlocated.map(entry => (
                      <EntryRow
                        key={entry.id}
                        entry={entry}
                        profileId={activeProfile?.id ?? ''}
                        onRemove={() => { setRemoveTarget({ entry, qty: 1 }); setView('removing'); }}
                        onMove={() => { setMoveTarget(entry); setMoveQty(1); setMoveLocation(''); setView('moving'); }}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            <button
              onClick={() => { setFoundWine(null); setEntries([]); setView('searching'); }}
              className="w-full py-2.5 rounded-md border text-sm hover:bg-accent"
            >
              Search for another bottle
            </button>
          </div>
        </div>
      )}

      {/* ── Remove dialog ── */}
      {view === 'removing' && removeTarget && (
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-md mx-auto px-4 py-4 space-y-4">
            <div>
              <p className="font-semibold">{foundWine?.name}</p>
              <p className="text-sm text-muted-foreground">
                {removeTarget.entry.location ? `📍 ${removeTarget.entry.location}` : 'Unlocated'}
                {' · '}
                {removeTarget.entry.quantity} bottle{removeTarget.entry.quantity !== 1 ? 's' : ''} available
              </p>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">How many to remove?</label>
              <div className="flex items-center border rounded-md overflow-hidden w-fit">
                <button
                  onClick={() => setRemoveTarget(t => t ? { ...t, qty: Math.max(1, t.qty - 1) } : t)}
                  className="px-4 py-2.5 text-lg hover:bg-muted"
                >
                  −
                </button>
                <span className="px-6 py-2.5 text-lg font-bold border-x">{removeTarget.qty}</span>
                <button
                  onClick={() => setRemoveTarget(t => t ? { ...t, qty: Math.min(t.entry.quantity, t.qty + 1) } : t)}
                  className="px-4 py-2.5 text-lg hover:bg-muted"
                >
                  +
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Notes (optional)</label>
              <input
                type="text"
                value={removeNote}
                onChange={e => setRemoveNote(e.target.value)}
                placeholder="Drank, gifted, broken…"
                className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={confirmRemove}
                disabled={removing}
                className="flex-1 py-2.5 rounded-md bg-destructive text-destructive-foreground text-sm font-medium hover:bg-destructive/90 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {removing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Minus className="h-4 w-4" />}
                Remove {removeTarget.qty} bottle{removeTarget.qty !== 1 ? 's' : ''}
              </button>
              <button
                onClick={() => { setRemoveTarget(null); setView('results'); }}
                className="px-4 py-2.5 rounded-md border text-sm hover:bg-accent"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Move dialog ── */}
      {view === 'moving' && moveTarget && activeProfile && (
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-md mx-auto px-4 py-4 space-y-4">
            <div>
              <p className="font-semibold">{foundWine?.name}</p>
              <p className="text-sm text-muted-foreground">
                {moveTarget.location ? `📍 ${moveTarget.location}` : 'Unlocated'}
                {' · '}
                {moveTarget.quantity} bottle{moveTarget.quantity !== 1 ? 's' : ''} available
              </p>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Move to</label>
              <LocationPicker
                profileId={activeProfile.id}
                value={moveLocation}
                onChange={setMoveLocation}
                placeholder="Choose destination…"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">How many bottles?</label>
              <div className="flex items-center border rounded-md overflow-hidden w-fit">
                <button
                  onClick={() => setMoveQty(q => Math.max(1, q - 1))}
                  className="px-4 py-2.5 text-lg hover:bg-muted"
                >
                  −
                </button>
                <span className="px-6 py-2.5 text-lg font-bold border-x">{moveQty}</span>
                <button
                  onClick={() => setMoveQty(q => Math.min(moveTarget.quantity, q + 1))}
                  className="px-4 py-2.5 text-lg hover:bg-muted"
                >
                  +
                </button>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={confirmMove}
                disabled={moving || !moveLocation}
                className="flex-1 py-2.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {moving ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
                Move {moveQty} bottle{moveQty !== 1 ? 's' : ''}
              </button>
              <button
                onClick={() => { setMoveTarget(null); setView('results'); }}
                className="px-4 py-2.5 rounded-md border text-sm hover:bg-accent"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── EntryRow ──────────────────────────────────────────────────────────────────

function EntryRow({
  entry,
  onRemove,
  onMove,
}: {
  entry: CellarInventory;
  profileId: string;
  onRemove: () => void;
  onMove: () => void;
}) {
  return (
    <div className="rounded-lg border bg-card px-3 py-2.5 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-sm font-medium truncate">
            {entry.location || <span className="text-muted-foreground italic">Unlocated</span>}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 ml-5.5">
          {entry.quantity} bottle{entry.quantity !== 1 ? 's' : ''}
          {entry.purchase_price ? ` · $${entry.purchase_price}` : ''}
          {entry.purchase_date ? ` · ${entry.purchase_date.slice(0, 10)}` : ''}
        </p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={onMove}
          className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          title="Move"
        >
          <MapPin className="h-4 w-4" />
        </button>
        <button
          onClick={onRemove}
          className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
          title="Remove"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
