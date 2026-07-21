'use client';

import { useState, useEffect, useCallback } from 'react';
import { useProfile } from '@/hooks/useProfile';
import {
  Shuffle, Loader2, MapPin, Play, CheckCircle, ArrowRight,
  SkipForward, Settings2, FolderTree, Wrench,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Location } from '@/types';
import type { DefragmentPlan, Trip, PlannedMove } from '@/lib/cellar-heuristics';
import BottleMover from '@/components/BottleMover';

type PageStep = 'configure' | 'plan' | 'execute';

export default function DesktopDefragmentPage() {
  const { activeProfile } = useProfile();
  const profileId = activeProfile?.id;

  const [locations, setLocations] = useState<Location[]>([]);
  const [groupCount, setGroupCount] = useState(0);
  const [carryLimit, setCarryLimit] = useState(4);
  const [includeAging, setIncludeAging] = useState(false);
  const [step, setStep] = useState<PageStep>('configure');
  const [plan, setPlan] = useState<DefragmentPlan | null>(null);
  const [generating, setGenerating] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const [skippedTrips, setSkippedTrips] = useState<Set<number>>(new Set());
  const [selectedTripIdx, setSelectedTripIdx] = useState(0);

  // Execution state
  const [currentTripIdx, setCurrentTripIdx] = useState(0);
  const [executingTrip, setExecutingTrip] = useState<number | null>(null);
  const [completedTrips, setCompletedTrips] = useState<Set<number>>(new Set());
  const [execError, setExecError] = useState<string | null>(null);
  const [moverTrip, setMoverTrip] = useState<Trip | null>(null);

  useEffect(() => {
    if (!profileId) return;
    Promise.all([
      fetch(`/api/locations?profile_id=${profileId}`).then(r => r.ok ? r.json() : []),
      fetch(`/api/location-groups?profile_id=${profileId}`).then(r => r.ok ? r.json() : []),
    ])
      .then(([locs, groups]: [Location[], unknown[]]) => { setLocations(locs); setGroupCount(groups.length); })
      .catch(() => {});
  }, [profileId]);

  const generatePlan = useCallback(async () => {
    if (!profileId) return;
    setGenerating(true); setPlanError(null);
    try {
      const params = new URLSearchParams({ profile_id: profileId, carry_limit: String(carryLimit), include_aging: String(includeAging) });
      const res = await fetch(`/api/cellar/defragment-plan?${params}`);
      const data: DefragmentPlan = await res.json();
      if (!res.ok) throw new Error((data as unknown as { error: string }).error ?? 'Failed');
      if (data.trips.length === 0) { setPlanError('No moves needed — your cellar is already well-organized!'); return; }
      setPlan(data);
      setSkippedTrips(new Set());
      setSelectedTripIdx(0);
      setStep('plan');
    } catch (err) {
      setPlanError(err instanceof Error ? err.message : 'Failed to generate plan');
    } finally { setGenerating(false); }
  }, [profileId, carryLimit, includeAging]);

  const activePlan = plan ? { ...plan, trips: plan.trips.filter((_, i) => !skippedTrips.has(i)) } : null;

  const executeTrip = async (trip: Trip, originalIdx: number) => {
    if (!profileId) return;
    setExecutingTrip(originalIdx); setExecError(null);
    try {
      for (const move of trip.moves) {
        const res = await fetch('/api/cellar/move', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ wine_id: move.wineId, profile_id: profileId, from_location: move.fromLocation, to_location: move.toLocation, quantity: move.quantity }),
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? 'Move failed'); }
      }
      setCompletedTrips(prev => new Set([...prev, originalIdx]));
      setCurrentTripIdx(i => i + 1);
    } catch (err) {
      setExecError(err instanceof Error ? err.message : 'Move failed');
    } finally { setExecutingTrip(null); }
  };

  if (!profileId) {
    return <div className="p-8 text-center text-muted-foreground">Select a cellar profile to use the defragment tool.</div>;
  }

  // ── Configure step ────────────────────────────────────────────────────────────
  if (step === 'configure') {
    return (
      <div className="px-6 py-5 max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Shuffle className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-xl font-bold">Desktop Defragment</h1>
            <p className="text-sm text-muted-foreground">Optimize bottle placement and generate a walk plan.</p>
          </div>
        </div>

        <div className="rounded-lg border px-4 py-3 flex items-start gap-3">
          <FolderTree className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Proximity Groups <span className="ml-2 text-xs text-muted-foreground font-normal">improves walk order</span></p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {groupCount > 0 ? `${groupCount} group${groupCount !== 1 ? 's' : ''} configured` : 'No groups set — walk order falls back to alphabetical'}
            </p>
          </div>
          <a href="/cellar/hierarchy" className="text-xs text-primary hover:underline shrink-0 self-center">Configure →</a>
        </div>

        <div className="rounded-lg border p-5 space-y-5">
          <h2 className="font-semibold flex items-center gap-2"><Settings2 className="h-4 w-4 text-muted-foreground" /> Configure Plan</h2>
          <div className="space-y-2">
            <label className="text-sm font-medium">Carry Limit</label>
            <p className="text-xs text-muted-foreground">Maximum bottles to carry per trip</p>
            <div className="flex items-center gap-2">
              <button onClick={() => setCarryLimit(n => Math.max(1, n - 1))} disabled={carryLimit <= 1} className="w-9 h-9 rounded-md border text-lg hover:bg-accent disabled:opacity-40 transition-colors">−</button>
              <span className="w-10 text-center text-sm font-semibold">{carryLimit}</span>
              <button onClick={() => setCarryLimit(n => Math.min(12, n + 1))} disabled={carryLimit >= 12} className="w-9 h-9 rounded-md border text-lg hover:bg-accent disabled:opacity-40 transition-colors">+</button>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setIncludeAging(v => !v)} className={cn('relative w-10 h-5 rounded-full transition-colors', includeAging ? 'bg-primary' : 'bg-muted-foreground/30')}>
              <span className={cn('absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform', includeAging ? 'translate-x-5' : 'translate-x-0')} />
            </button>
            <div>
              <p className="text-sm font-medium">Include Aging locations</p>
              <p className="text-xs text-muted-foreground">Off by default — aging wines shouldn't be moved</p>
            </div>
          </div>
          {planError && <p className="text-sm text-amber-700 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-300 rounded-md px-3 py-2">{planError}</p>}
          <button onClick={generatePlan} disabled={generating || locations.length === 0}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shuffle className="h-4 w-4" />}
            {generating ? 'Generating plan…' : 'Generate Walk Plan'}
          </button>
        </div>
      </div>
    );
  }

  // ── Plan review — two-panel layout ───────────────────────────────────────────
  if (step === 'plan' && plan) {
    const displayedTrips = plan.trips;
    const selectedTrip = displayedTrips[selectedTripIdx] ?? displayedTrips[0];

    return (
      <div className="px-6 py-5 space-y-4 max-w-screen-xl mx-auto">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Shuffle className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-xl font-bold">Walk Plan</h1>
              <p className="text-sm text-muted-foreground">{plan.trips.length} trips · {plan.totalBottlesMoved} bottles</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setStep('execute'); setCurrentTripIdx(0); setCompletedTrips(new Set()); setExecError(null); setSelectedTripIdx(0); }}
              disabled={(activePlan?.trips.length ?? 0) === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
              <Play className="h-4 w-4" /> Start ({activePlan?.trips.length ?? 0} trips)
            </button>
            <button onClick={() => { setStep('configure'); setPlan(null); setPlanError(null); }}
              className="px-4 py-2 rounded-md border text-sm hover:bg-accent transition-colors">Back</button>
          </div>
        </div>

        {/* Notices */}
        {(plan.skippedTooLarge ?? 0) > 0 && (
          <div className="rounded-md bg-muted/60 px-4 py-3 text-xs text-muted-foreground flex items-start gap-2">
            <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>{plan.skippedTooLarge} wine{plan.skippedTooLarge !== 1 ? 's' : ''} skipped — too large to fit in a single location.</span>
          </div>
        )}
        {(plan.relatedWinesNotes?.length ?? 0) > 0 && (
          <div className="rounded-md bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-xs text-amber-800 dark:text-amber-300 space-y-1">
            <p className="font-medium">Related wines in different locations:</p>
            {plan.relatedWinesNotes.map((note, i) => <p key={i} className="opacity-80">↳ {note}</p>)}
          </div>
        )}

        {/* Two-panel */}
        <div className="grid grid-cols-[40%_60%] gap-4 items-start">
          {/* Left: trip list */}
          <div className="rounded-lg border overflow-hidden">
            <div className="bg-muted/40 px-4 py-2.5 border-b">
              <p className="text-sm font-semibold">Trips</p>
            </div>
            <div className="divide-y max-h-[calc(100vh-320px)] overflow-y-auto">
              {displayedTrips.map((trip, idx) => {
                const isSkipped = skippedTrips.has(idx);
                const isSelected = idx === selectedTripIdx;
                return (
                  <button
                    key={idx}
                    onClick={() => setSelectedTripIdx(idx)}
                    className={cn(
                      'w-full text-left px-4 py-3 transition-colors',
                      isSelected ? 'bg-primary/10' : 'hover:bg-accent/50',
                      isSkipped && 'opacity-40'
                    )}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">Trip {trip.tripNumber}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{trip.totalBottles} btl</span>
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            setSkippedTrips(prev => { const next = new Set(prev); if (next.has(idx)) next.delete(idx); else next.add(idx); return next; });
                          }}
                          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5"
                        >
                          <SkipForward className="h-3 w-3" />
                          {isSkipped ? 'Unskip' : 'Skip'}
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-xs">
                      <span className="text-primary font-medium truncate">{trip.fromLocation || 'Unlocated'}</span>
                      <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="font-medium truncate">{trip.toLocation}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: move detail for selected trip */}
          <div className="rounded-lg border overflow-hidden">
            {selectedTrip ? (
              <>
                <div className="bg-muted/40 px-4 py-2.5 border-b flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">Trip {selectedTrip.tripNumber} — Moves</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {selectedTrip.fromLocation || 'Unlocated'} → {selectedTrip.toLocation}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">{selectedTrip.totalBottles} bottles</span>
                </div>
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/20">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Wine</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">From</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">To</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground">Qty</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {selectedTrip.moves.map((move: PlannedMove, mi: number) => (
                      <tr key={mi} className="hover:bg-accent/20">
                        <td className="px-4 py-2.5">
                          <p className="font-medium">{move.wineName}</p>
                          {move.wineVariety && <p className="text-xs text-muted-foreground">{move.wineVariety}</p>}
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground text-xs">{move.fromLocation || 'Unlocated'}</td>
                        <td className="px-4 py-2.5 text-xs">{move.toLocation}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{move.quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            ) : (
              <div className="px-4 py-12 text-center text-muted-foreground text-sm">Select a trip to see moves</div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Execute step — two-panel layout ──────────────────────────────────────────
  if (step === 'execute' && activePlan) {
    const currentActiveTrip = activePlan.trips[currentTripIdx];
    const done = completedTrips.size === activePlan.trips.length;

    return (
      <div className="px-6 py-5 space-y-4 max-w-screen-xl mx-auto">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Shuffle className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-xl font-bold">Executing Plan</h1>
              <p className="text-sm text-muted-foreground">{completedTrips.size} of {activePlan.trips.length} trips done</p>
            </div>
          </div>
          <div className="w-64">
            <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-primary transition-all" style={{ width: `${(completedTrips.size / activePlan.trips.length) * 100}%` }} />
            </div>
          </div>
        </div>

        {done ? (
          <div className="rounded-lg border p-8 text-center space-y-2 max-w-lg mx-auto">
            <CheckCircle className="h-10 w-10 text-green-500 mx-auto" />
            <p className="font-semibold text-lg">Defragmentation complete!</p>
            <p className="text-sm text-muted-foreground">{completedTrips.size} trips · {activePlan.trips.reduce((s, t) => s + t.totalBottles, 0)} bottles moved</p>
            <button onClick={() => { setStep('configure'); setPlan(null); }} className="mt-3 px-4 py-2 rounded-md border text-sm hover:bg-accent transition-colors">Done</button>
          </div>
        ) : (
          <div className="grid grid-cols-[40%_60%] gap-4 items-start">
            {/* Left: trip progress list */}
            <div className="rounded-lg border overflow-hidden">
              <div className="bg-muted/40 px-4 py-2.5 border-b">
                <p className="text-sm font-semibold">All Trips</p>
              </div>
              <div className="divide-y max-h-[calc(100vh-320px)] overflow-y-auto">
                {activePlan.trips.map((trip, idx) => {
                  const isDone = completedTrips.has(idx);
                  const isCurrent = idx === currentTripIdx && !isDone;
                  return (
                    <button key={idx} onClick={() => setSelectedTripIdx(idx)}
                      className={cn('w-full text-left px-4 py-3 transition-colors', isCurrent ? 'bg-primary/10' : isDone ? 'opacity-50' : 'hover:bg-accent/50')}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">Trip {trip.tripNumber}</span>
                        <span className="text-xs">{isDone ? <CheckCircle className="h-3.5 w-3.5 text-green-500" /> : <span className="text-muted-foreground">{trip.totalBottles} btl</span>}</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs">
                        <span className="text-primary font-medium truncate">{trip.fromLocation || 'Unlocated'}</span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span className="font-medium truncate">{trip.toLocation}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right: current trip detail */}
            <div className="rounded-lg border overflow-hidden space-y-0">
              {currentActiveTrip && (
                <>
                  <div className="bg-muted/40 px-4 py-2.5 border-b">
                    <p className="text-sm font-semibold">Trip {currentActiveTrip.tripNumber} — Current</p>
                    <p className="text-xs text-muted-foreground">{currentActiveTrip.fromLocation || 'Unlocated'} → {currentActiveTrip.toLocation}</p>
                  </div>
                  <table className="w-full text-sm">
                    <thead className="border-b bg-muted/20">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Pick up</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground">Qty</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {currentActiveTrip.moves.map((move: PlannedMove, mi: number) => (
                        <tr key={mi}>
                          <td className="px-4 py-2.5">
                            <p className="font-medium">{move.wineName}</p>
                            {move.wineVariety && <p className="text-xs text-muted-foreground">{move.wineVariety}</p>}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums">{move.quantity}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="px-4 py-3 border-t bg-muted/10">
                    <p className="text-xs text-muted-foreground mb-3">Drop off at: <strong>{currentActiveTrip.toLocation}</strong></p>
                    {execError && <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2 mb-3">{execError}</p>}
                    <div className="flex gap-2">
                      <button onClick={() => executeTrip(currentActiveTrip, currentTripIdx)} disabled={executingTrip !== null}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
                        {executingTrip !== null ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                        {executingTrip !== null ? 'Moving…' : 'Mark Done'}
                      </button>
                      <button onClick={() => setMoverTrip(currentActiveTrip)} className="px-3 py-2.5 rounded-md border text-sm hover:bg-accent transition-colors flex items-center gap-1.5">
                        <Wrench className="h-3.5 w-3.5" /> Manual
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      {moverTrip && profileId && (
        <BottleMover
          profileId={profileId}
          wineId={moverTrip.moves[0]?.wineId ?? ''}
          wineName={moverTrip.moves[0]?.wineName ?? ''}
          defaultFromLocation={moverTrip.fromLocation}
          defaultToLocation={moverTrip.toLocation}
          defaultQuantity={moverTrip.moves[0]?.quantity}
          onMoveDone={() => {}}
          onClose={() => setMoverTrip(null)}
        />
      )}
    </>
  );
}
