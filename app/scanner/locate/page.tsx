'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle, Loader2, Undo2 } from 'lucide-react';
import WineFinder from '@/components/WineFinder';
import LocationPicker from '@/components/LocationPicker';
import { useProfile } from '@/hooks/useProfile';
import type { Wine } from '@/types';

// ── Types ──────────────────────────────────────────────────────────────────────

type Phase = 'setup' | 'identifying' | 'assigning' | 'saving' | 'done';

interface PendingAssignment {
  id: string;
  wineName: string;
  wineProducer?: string;
  wineVintage?: number;
  cellarInventoryId: string;
  quantity: number;
}

interface CellarEntry {
  id: string;
  wine_id: string;
  location: string | null;
  quantity: number;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function LocateScannerPage() {
  const { activeProfile } = useProfile();

  const [phase, setPhase] = useState<Phase>('setup');
  const [location, setLocation] = useState('');
  const [pending, setPending] = useState<PendingAssignment[]>([]);

  // assigning state
  const [foundWine, setFoundWine] = useState<Partial<Wine> | null>(null);
  const [unlocatedEntries, setUnlocatedEntries] = useState<CellarEntry[]>([]);
  const [assignQty, setAssignQty] = useState(1);
  const [selectedEntryId, setSelectedEntryId] = useState('');
  const [loadingEntries, setLoadingEntries] = useState(false);

  // done state
  const [movedCount, setMovedCount] = useState(0);
  const [saveErrors, setSaveErrors] = useState<string[]>([]);

  // ── Load unlocated entries for a wine ─────────────────────────────────────

  const loadUnlocatedEntries = async (wine: Partial<Wine>) => {
    if (!activeProfile || !wine.id) return;
    setLoadingEntries(true);
    try {
      const res = await fetch(
        `/api/cellar?profile_id=${encodeURIComponent(activeProfile.id)}&wine_id=${encodeURIComponent(wine.id)}`
      );
      const data: CellarEntry[] = await res.json();
      const unlocated = Array.isArray(data) ? data.filter(e => !e.location || e.location === '') : [];
      setUnlocatedEntries(unlocated);
      const total = unlocated.reduce((s, e) => s + e.quantity, 0);
      setAssignQty(total > 0 ? total : 1);
      setSelectedEntryId(unlocated[0]?.id ?? '');
    } catch {
      setUnlocatedEntries([]);
      setAssignQty(1);
    } finally {
      setLoadingEntries(false);
    }
  };

  // ── WineFinder callbacks ──────────────────────────────────────────────────

  const handleWineSelected = async (wine: Partial<Wine>) => {
    setFoundWine(wine);
    setUnlocatedEntries([]);
    setPhase('assigning');
    await loadUnlocatedEntries(wine);
  };

  const handleManualEntry = () => {
    // Can't locate a bottle that isn't in the cellar — go back
    setPhase('identifying');
  };

  // ── Assign ────────────────────────────────────────────────────────────────

  const handleAssign = () => {
    if (!foundWine || !selectedEntryId || assignQty < 1) return;
    const id = Math.random().toString(36).slice(2, 10);
    setPending(prev => [...prev, {
      id,
      wineName: foundWine.name ?? 'Unknown wine',
      wineProducer: foundWine.producer,
      wineVintage: foundWine.vintage_year,
      cellarInventoryId: selectedEntryId,
      quantity: assignQty,
    }]);
    setFoundWine(null);
    setUnlocatedEntries([]);
    setPhase('identifying');
  };

  // ── Save all ──────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!activeProfile || !pending.length) return;
    setPhase('saving');
    try {
      const res = await fetch('/api/cellar/bulk-locate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile_id: activeProfile.id,
          assignments: pending.map(p => ({
            cellar_inventory_id: p.cellarInventoryId,
            new_location: location,
            quantity: p.quantity,
          })),
        }),
      });
      const data = await res.json();
      setMovedCount(data.moved ?? 0);
      setSaveErrors(data.errors ?? []);
      setPhase('done');
    } catch (err) {
      setSaveErrors([err instanceof Error ? err.message : 'Save failed']);
      setPhase('identifying');
    }
  };

  const handleReset = () => {
    setPending([]);
    setFoundWine(null);
    setUnlocatedEntries([]);
    setMovedCount(0);
    setSaveErrors([]);
    setPhase('identifying');
  };

  const totalBottles = pending.reduce((s, p) => s + p.quantity, 0);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b shrink-0">
        {phase === 'identifying' || phase === 'assigning' ? (
          <button onClick={() => setPhase('setup')} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </button>
        ) : (
          <Link href="/scanner" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        )}
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-bold leading-tight">Locate Scanner</h2>
          {(phase === 'identifying' || phase === 'assigning') && location && (
            <p className="text-xs text-muted-foreground truncate">📍 {location}</p>
          )}
        </div>
        {(phase === 'identifying' || phase === 'assigning') && pending.length > 0 && (
          <button
            onClick={handleSave}
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
          >
            Save ({totalBottles})
          </button>
        )}
      </div>

      {/* ── Setup ── */}
      {phase === 'setup' && (
        <div className="flex-1 p-4 max-w-md mx-auto w-full space-y-6 pt-8">
          <div>
            <h3 className="font-semibold text-lg">Assign a location</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Choose where you are placing bottles. Scan each bottle to locate it here.
            </p>
          </div>

          {activeProfile && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Location</label>
              <LocationPicker
                profileId={activeProfile.id}
                value={location}
                onChange={setLocation}
                placeholder="e.g. Rack 1, Wine Fridge…"
                allowUnlocated={false}
              />
            </div>
          )}

          <button
            onClick={() => setPhase('identifying')}
            disabled={!location || !activeProfile}
            className="w-full py-3 rounded-md bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-40"
          >
            Start Scanning
          </button>

          <div className="rounded-lg bg-muted/40 p-3 space-y-1 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">How it works</p>
            <p>• Scan or search for each bottle already in your cellar</p>
            <p>• Assign its unlocated stock to the chosen location</p>
            <p>• Save all at once when you're done</p>
          </div>
        </div>
      )}

      {/* ── Identifying ── */}
      {phase === 'identifying' && activeProfile && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-md mx-auto px-4 py-4">
              <WineFinder
                profileId={activeProfile.id}
                requireLabelIfNotFound={false}
                onSelect={handleWineSelected}
                onManualEntry={handleManualEntry}
              />
            </div>
          </div>

          {/* Pending list */}
          {pending.length > 0 && (
            <div className="border-t bg-card shrink-0 max-h-48 overflow-y-auto">
              <p className="px-4 pt-2 pb-1 text-xs font-medium text-muted-foreground">
                Pending ({pending.length} wine{pending.length !== 1 ? 's' : ''} · {totalBottles} bottle{totalBottles !== 1 ? 's' : ''})
              </p>
              <div className="divide-y">
                {[...pending].reverse().map(p => (
                  <div key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{p.wineName}</p>
                      <p className="text-xs text-muted-foreground">
                        {[p.wineProducer, p.wineVintage].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <span className="text-sm font-bold text-muted-foreground shrink-0">×{p.quantity}</span>
                    <button
                      onClick={() => setPending(prev => prev.filter(x => x.id !== p.id))}
                      className="text-muted-foreground hover:text-destructive shrink-0"
                      title="Remove"
                    >
                      <Undo2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Assigning ── */}
      {phase === 'assigning' && foundWine && (
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-md mx-auto px-4 py-4 space-y-4">
            <div className="rounded-lg border bg-muted/20 px-4 py-3">
              <p className="font-semibold">{foundWine.name ?? 'Unknown wine'}</p>
              {foundWine.producer && <p className="text-sm text-muted-foreground">{foundWine.producer}</p>}
              <p className="text-xs text-muted-foreground mt-0.5">
                {[foundWine.wine_type, foundWine.variety, foundWine.vintage_year].filter(Boolean).join(' · ')}
              </p>
            </div>

            {loadingEntries ? (
              <div className="flex items-center justify-center gap-2 py-6 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Checking cellar stock…</span>
              </div>
            ) : unlocatedEntries.length === 0 ? (
              <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-3 py-3 text-sm text-amber-700 dark:text-amber-400 space-y-2">
                <p>No unlocated stock found for this wine in your cellar.</p>
                <button
                  onClick={() => { setFoundWine(null); setPhase('identifying'); }}
                  className="text-xs underline"
                >
                  Scan another bottle
                </button>
              </div>
            ) : (
              <>
                {unlocatedEntries.length > 1 && (
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Select stock to locate</label>
                    <select
                      value={selectedEntryId}
                      onChange={e => setSelectedEntryId(e.target.value)}
                      className="w-full px-2 py-1.5 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      {unlocatedEntries.map(e => (
                        <option key={e.id} value={e.id}>
                          Unlocated — {e.quantity} bottle{e.quantity !== 1 ? 's' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="space-y-2">
                  <p className="text-sm font-medium">
                    How many bottles to assign to <span className="text-primary">{location}</span>?
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {unlocatedEntries.reduce((s, e) => s + e.quantity, 0)} unlocated bottle{unlocatedEntries.reduce((s, e) => s + e.quantity, 0) !== 1 ? 's' : ''} available
                  </p>
                  <div className="flex items-center border rounded-md overflow-hidden w-fit">
                    <button
                      onClick={() => setAssignQty(q => Math.max(1, q - 1))}
                      className="px-4 py-2.5 text-lg hover:bg-muted"
                    >
                      −
                    </button>
                    <span className="px-6 py-2.5 text-lg font-bold border-x">{assignQty}</span>
                    <button
                      onClick={() => {
                        const max = unlocatedEntries.reduce((s, e) => s + e.quantity, 0);
                        setAssignQty(q => Math.min(max, q + 1));
                      }}
                      className="px-4 py-2.5 text-lg hover:bg-muted"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleAssign}
                    className="flex-1 py-3 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
                  >
                    Assign to {location} →
                  </button>
                  <button
                    onClick={() => { setFoundWine(null); setPhase('identifying'); }}
                    className="px-4 py-3 rounded-md border text-sm hover:bg-accent"
                  >
                    Skip
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Saving ── */}
      {phase === 'saving' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Saving locations…</p>
        </div>
      )}

      {/* ── Done ── */}
      {phase === 'done' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 py-12 px-4 text-center">
          <CheckCircle className="h-12 w-12 text-green-500" />
          <div>
            <p className="text-lg font-semibold">Done!</p>
            <p className="text-sm text-muted-foreground mt-1">
              Located {movedCount} bottle{movedCount !== 1 ? 's' : ''} to {location}.
            </p>
          </div>
          {saveErrors.length > 0 && (
            <div className="w-full max-w-sm rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-left">
              <p className="text-xs font-medium text-destructive mb-1">{saveErrors.length} error{saveErrors.length !== 1 ? 's' : ''}</p>
              {saveErrors.map((e, i) => <p key={i} className="text-xs text-destructive/80">{e}</p>)}
            </div>
          )}
          <div className="flex gap-3">
            <Link href="/cellar" className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">
              View Cellar
            </Link>
            <button onClick={handleReset} className="px-4 py-2 rounded-md border text-sm hover:bg-accent">
              Scan Another Location
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
