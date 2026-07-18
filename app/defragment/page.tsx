'use client';

import { useState, useEffect, useCallback } from 'react';
import { useProfile } from '@/hooks/useProfile';
import {
  Shuffle, Loader2, ChevronDown, ChevronUp, MapPin, Play,
  CheckCircle, ArrowRight, SkipForward, Settings2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Location } from '@/types';
import type { DefragmentPlan, Trip, PlannedMove } from '@/lib/cellar-heuristics';
import BottleMover from '@/components/BottleMover';

type PageStep = 'configure' | 'plan' | 'execute';
type PlanTab = 'walk' | 'all-moves';

export default function DefragmentPage() {
  const { activeProfile } = useProfile();
  const profileId = activeProfile?.id;

  const [locations, setLocations] = useState<Location[]>([]);
  const [carryLimit, setCarryLimit] = useState(4);
  const [includeAging, setIncludeAging] = useState(false);
  const [step, setStep] = useState<PageStep>('configure');
  const [planTab, setPlanTab] = useState<PlanTab>('walk');
  const [plan, setPlan] = useState<DefragmentPlan | null>(null);
  const [generating, setGenerating] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const [skippedTrips, setSkippedTrips] = useState<Set<number>>(new Set());
  const [mapOpen, setMapOpen] = useState(false);

  // Execution state
  const [currentTripIdx, setCurrentTripIdx] = useState(0);
  const [executingTrip, setExecutingTrip] = useState<number | null>(null);
  const [completedTrips, setCompletedTrips] = useState<Set<number>>(new Set());
  const [execError, setExecError] = useState<string | null>(null);
  const [moverTrip, setMoverTrip] = useState<Trip | null>(null);

  // Position editor state
  const [editPos, setEditPos] = useState<Record<string, { x: string; y: string }>>({});
  const [savingPos, setSavingPos] = useState<string | null>(null);

  useEffect(() => {
    if (!profileId) return;
    fetch(`/api/locations?profile_id=${profileId}`)
      .then(r => r.ok ? r.json() : [])
      .then((locs: Location[]) => {
        setLocations(locs);
        const initial: Record<string, { x: string; y: string }> = {};
        for (const l of locs) {
          initial[l.id] = {
            x: l.position_x != null ? String(l.position_x) : '',
            y: l.position_y != null ? String(l.position_y) : '',
          };
        }
        setEditPos(initial);
      })
      .catch(() => {});
  }, [profileId]);

  const generatePlan = useCallback(async () => {
    if (!profileId) return;
    setGenerating(true);
    setPlanError(null);
    try {
      const params = new URLSearchParams({
        profile_id: profileId,
        carry_limit: String(carryLimit),
        include_aging: String(includeAging),
      });
      const res = await fetch(`/api/cellar/defragment-plan?${params}`);
      const data: DefragmentPlan = await res.json();
      if (!res.ok) throw new Error((data as unknown as { error: string }).error ?? 'Failed');
      if (data.trips.length === 0) {
        setPlanError('No moves needed — your cellar is already well-organized!');
        return;
      }
      setPlan(data);
      setSkippedTrips(new Set());
      setStep('plan');
    } catch (err) {
      setPlanError(err instanceof Error ? err.message : 'Failed to generate plan');
    } finally {
      setGenerating(false);
    }
  }, [profileId, carryLimit, includeAging]);

  const savePosition = async (locId: string) => {
    const pos = editPos[locId];
    if (!pos) return;
    setSavingPos(locId);
    try {
      await fetch(`/api/locations/${locId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          position_x: pos.x ? parseFloat(pos.x) : null,
          position_y: pos.y ? parseFloat(pos.y) : null,
        }),
      });
    } finally {
      setSavingPos(null);
    }
  };

  const activePlan = plan ? {
    ...plan,
    trips: plan.trips.filter((_, i) => !skippedTrips.has(i)),
  } : null;

  const executeTrip = async (trip: Trip, originalIdx: number) => {
    if (!profileId) return;
    setExecutingTrip(originalIdx);
    setExecError(null);
    try {
      for (const move of trip.moves) {
        const res = await fetch('/api/cellar/move', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            wine_id: move.wineId,
            profile_id: profileId,
            from_location: move.fromLocation,
            to_location: move.toLocation,
            quantity: move.quantity,
          }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? 'Move failed');
        }
      }
      setCompletedTrips(prev => new Set([...prev, originalIdx]));
      setCurrentTripIdx(i => i + 1);
    } catch (err) {
      setExecError(err instanceof Error ? err.message : 'Move failed');
    } finally {
      setExecutingTrip(null);
    }
  };

  if (!profileId) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Select a cellar profile to use the defragment tool.
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center gap-3">
        <Shuffle className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-xl font-bold">Cellar Defragment</h1>
          <p className="text-sm text-muted-foreground">
            Optimize bottle placement and generate a walk plan.
          </p>
        </div>
      </div>

      {/* Location Position Map (collapsible) */}
      <div className="rounded-lg border">
        <button
          onClick={() => setMapOpen(o => !o)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-accent/50 transition-colors"
        >
          <span className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            Location Position Map
            <span className="text-xs text-muted-foreground font-normal">(optional — improves walk order)</span>
          </span>
          {mapOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {mapOpen && (
          <div className="border-t px-4 py-4 space-y-3">
            <p className="text-xs text-muted-foreground">
              Assign X/Y coordinates to reflect the physical layout of your cellar.
              Locations with positions set will be walk-ordered optimally.
            </p>
            <div className="space-y-2">
              {locations.map(loc => (
                <div key={loc.id} className="flex items-center gap-2">
                  <span className="text-sm flex-1 truncate">{loc.name}</span>
                  <input
                    type="number"
                    placeholder="X"
                    value={editPos[loc.id]?.x ?? ''}
                    onChange={e => setEditPos(p => ({ ...p, [loc.id]: { ...p[loc.id], x: e.target.value } }))}
                    className="w-16 rounded-md border bg-background px-2 py-1 text-xs text-center"
                  />
                  <input
                    type="number"
                    placeholder="Y"
                    value={editPos[loc.id]?.y ?? ''}
                    onChange={e => setEditPos(p => ({ ...p, [loc.id]: { ...p[loc.id], y: e.target.value } }))}
                    className="w-16 rounded-md border bg-background px-2 py-1 text-xs text-center"
                  />
                  <button
                    onClick={() => savePosition(loc.id)}
                    disabled={savingPos === loc.id}
                    className="px-2.5 py-1 rounded-md border text-xs hover:bg-accent disabled:opacity-50 transition-colors"
                  >
                    {savingPos === loc.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Step 1: Configure */}
      {step === 'configure' && (
        <div className="rounded-lg border p-5 space-y-5">
          <h2 className="font-semibold flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-muted-foreground" />
            Configure Plan
          </h2>

          <div className="space-y-2">
            <label className="text-sm font-medium">Carry Limit</label>
            <p className="text-xs text-muted-foreground">Maximum bottles to carry per trip</p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCarryLimit(n => Math.max(1, n - 1))}
                className="w-9 h-9 rounded-md border text-lg hover:bg-accent disabled:opacity-40 transition-colors"
                disabled={carryLimit <= 1}
              >
                −
              </button>
              <span className="w-10 text-center text-sm font-semibold">{carryLimit}</span>
              <button
                onClick={() => setCarryLimit(n => Math.min(12, n + 1))}
                className="w-9 h-9 rounded-md border text-lg hover:bg-accent disabled:opacity-40 transition-colors"
                disabled={carryLimit >= 12}
              >
                +
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIncludeAging(v => !v)}
              className={cn(
                'relative w-10 h-5 rounded-full transition-colors',
                includeAging ? 'bg-primary' : 'bg-muted-foreground/30'
              )}
            >
              <span className={cn(
                'absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform',
                includeAging ? 'translate-x-5' : 'translate-x-0'
              )} />
            </button>
            <div>
              <p className="text-sm font-medium">Include Aging locations</p>
              <p className="text-xs text-muted-foreground">Off by default — aging wines shouldn't be moved</p>
            </div>
          </div>

          {planError && (
            <p className="text-sm text-amber-700 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-300 rounded-md px-3 py-2">
              {planError}
            </p>
          )}

          <button
            onClick={generatePlan}
            disabled={generating || locations.length === 0}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shuffle className="h-4 w-4" />}
            {generating ? 'Generating plan…' : 'Generate Walk Plan'}
          </button>
        </div>
      )}

      {/* Step 2: Plan Review */}
      {step === 'plan' && plan && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="rounded-lg border p-4 flex flex-wrap gap-4 text-sm">
            <div className="text-center">
              <p className="text-2xl font-bold">{plan.trips.length}</p>
              <p className="text-xs text-muted-foreground">trips</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">{plan.totalBottlesMoved}</p>
              <p className="text-xs text-muted-foreground">bottles moved</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">{plan.totalMoves}</p>
              <p className="text-xs text-muted-foreground">wines relocated</p>
            </div>
            {skippedTrips.size > 0 && (
              <div className="text-center">
                <p className="text-2xl font-bold text-muted-foreground">{skippedTrips.size}</p>
                <p className="text-xs text-muted-foreground">skipped</p>
              </div>
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 border rounded-md p-1 bg-muted/40">
            {(['walk', 'all-moves'] as PlanTab[]).map(t => (
              <button
                key={t}
                onClick={() => setPlanTab(t)}
                className={cn(
                  'flex-1 py-1.5 rounded text-xs font-medium transition-colors',
                  planTab === t ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {t === 'walk' ? 'Walk Order' : 'All Moves'}
              </button>
            ))}
          </div>

          {/* Walk Order tab */}
          {planTab === 'walk' && (
            <div className="space-y-3">
              {plan.trips.map((trip, idx) => {
                const isSkipped = skippedTrips.has(idx);
                return (
                  <div
                    key={idx}
                    className={cn(
                      'rounded-lg border p-4 space-y-2 transition-opacity',
                      isSkipped && 'opacity-40'
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded">
                          Trip {trip.tripNumber}
                        </span>
                        {trip.distFromPrev > 0 && (
                          <span className="text-xs text-muted-foreground">
                            +{trip.distFromPrev.toFixed(0)} units
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => setSkippedTrips(prev => {
                          const next = new Set(prev);
                          if (next.has(idx)) next.delete(idx); else next.add(idx);
                          return next;
                        })}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                      >
                        <SkipForward className="h-3 w-3" />
                        {isSkipped ? 'Unskip' : 'Skip'}
                      </button>
                    </div>

                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium text-primary">
                        {trip.fromLocation || 'Unlocated'}
                      </span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">
                        {trip.toLocation}
                      </span>
                      <span className="text-xs text-muted-foreground ml-auto">
                        {trip.totalBottles} btl
                      </span>
                    </div>

                    <ul className="text-xs text-muted-foreground space-y-0.5">
                      {trip.moves.map((move, mi) => (
                        <li key={mi}>
                          ↳ {move.wineName}
                          {move.wineVariety ? ` (${move.wineVariety})` : ''} ×{move.quantity}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}

          {/* All Moves tab */}
          {planTab === 'all-moves' && (
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Wine</th>
                    <th className="text-left px-3 py-2 font-medium hidden sm:table-cell">From</th>
                    <th className="text-left px-3 py-2 font-medium">To</th>
                    <th className="text-right px-3 py-2 font-medium">Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {plan.trips.flatMap((trip, ti) =>
                    trip.moves.map((move: PlannedMove, mi: number) => (
                      <tr
                        key={`${ti}-${mi}`}
                        className={cn('hover:bg-accent/30', skippedTrips.has(ti) && 'opacity-40')}
                      >
                        <td className="px-3 py-2 truncate max-w-[140px]">{move.wineName}</td>
                        <td className="px-3 py-2 hidden sm:table-cell text-muted-foreground">
                          {move.fromLocation || 'Unlocated'}
                        </td>
                        <td className="px-3 py-2">{move.toLocation}</td>
                        <td className="px-3 py-2 text-right font-mono">{move.quantity}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => { setStep('execute'); setCurrentTripIdx(0); setCompletedTrips(new Set()); setExecError(null); }}
              disabled={(activePlan?.trips.length ?? 0) === 0}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              <Play className="h-4 w-4" />
              Start Defragmentation ({activePlan?.trips.length ?? 0} trips)
            </button>
            <button
              onClick={() => { setStep('configure'); setPlan(null); setPlanError(null); }}
              className="px-4 py-2.5 rounded-md border text-sm hover:bg-accent transition-colors"
            >
              Back
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Execute */}
      {step === 'execute' && activePlan && (
        <div className="space-y-4">
          {/* Progress */}
          <div className="rounded-lg border p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-medium">Trip {currentTripIdx + 1} of {activePlan.trips.length}</span>
              <span className="text-muted-foreground">{completedTrips.size} done</span>
            </div>
            <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${(completedTrips.size / activePlan.trips.length) * 100}%` }}
              />
            </div>
          </div>

          {completedTrips.size === activePlan.trips.length ? (
            <div className="rounded-lg border p-6 text-center space-y-2">
              <CheckCircle className="h-10 w-10 text-green-500 mx-auto" />
              <p className="font-semibold">Defragmentation complete!</p>
              <p className="text-sm text-muted-foreground">
                {completedTrips.size} trips · {activePlan.trips.reduce((s, t) => s + t.totalBottles, 0)} bottles moved
              </p>
              <button
                onClick={() => { setStep('configure'); setPlan(null); }}
                className="mt-3 px-4 py-2 rounded-md border text-sm hover:bg-accent transition-colors"
              >
                Done
              </button>
            </div>
          ) : (
            activePlan.trips.slice(currentTripIdx, currentTripIdx + 1).map((trip, _) => (
              <div key={trip.tripNumber} className="rounded-lg border p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded">
                    Trip {trip.tripNumber}
                  </span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    {trip.fromLocation || 'Unlocated'} → {trip.toLocation}
                  </span>
                </div>

                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground font-medium">Pick up from {trip.fromLocation || 'Unlocated'}:</p>
                  <ul className="space-y-1">
                    {trip.moves.map((move, mi) => (
                      <li key={mi} className="text-sm flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-medium">
                          {move.quantity}
                        </span>
                        {move.wineName}
                        {move.wineVariety && (
                          <span className="text-xs text-muted-foreground">({move.wineVariety})</span>
                        )}
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-muted-foreground mt-2">
                    Drop off at: <strong>{trip.toLocation}</strong>
                  </p>
                </div>

                {execError && (
                  <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{execError}</p>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => executeTrip(trip, currentTripIdx)}
                    disabled={executingTrip !== null}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                  >
                    {executingTrip !== null
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <CheckCircle className="h-4 w-4" />}
                    {executingTrip !== null ? 'Moving…' : 'Mark Done'}
                  </button>
                  <button
                    onClick={() => setMoverTrip(trip)}
                    className="px-3 py-2.5 rounded-md border text-sm hover:bg-accent transition-colors text-xs"
                    title="Open move dialog for fine-grained control"
                  >
                    Manual
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Manual mover dialog for defragment execution */}
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
    </div>
  );
}
