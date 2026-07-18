'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useProfile } from '@/hooks/useProfile';
import {
  Search, MoveRight, Archive, CheckSquare, Square, AlertTriangle,
  SortAsc, ChevronRight, Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CellarInventory, Location } from '@/types';
import BottleMover from '@/components/BottleMover';

type SortMode = 'name' | 'date' | 'drink';
type WineTypeFilter = 'all' | 'red' | 'white' | 'rosé' | 'sparkling' | 'other';

interface MiscWarning {
  location: Location;
  theme: { type: string; value: string; fraction: number };
  miscategorizedIds: Set<string>;
}

// Virtual "Unlocated" location sentinel
const UNLOCATED: Location = {
  id: '__unlocated__',
  profile_id: '',
  name: '',
  created_at: '',
  updated_at: '',
  current_quantity: 0,
  location_type: 'standard',
};

const TYPE_LABELS: Record<string, string> = {
  all: 'All', red: 'Red', white: 'White', rosé: 'Rosé', sparkling: 'Sparkling', other: 'Other',
};

const LOC_TYPE_BADGE: Record<string, { label: string; cls: string }> = {
  aging: { label: 'Aging', cls: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' },
  daily: { label: 'Daily', cls: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
};

export default function CellarPage() {
  const { activeProfile } = useProfile();
  const profileId = activeProfile?.id;

  const [locations, setLocations] = useState<Location[]>([]);
  const [unlocatedCount, setUnlocatedCount] = useState(0);
  const [selectedLoc, setSelectedLoc] = useState<Location | null>(UNLOCATED);
  const [bottles, setBottles] = useState<CellarInventory[]>([]);
  const [loadingLoc, setLoadingLoc] = useState(false);
  const [loadingList, setLoadingList] = useState(false);

  const [q, setQ] = useState('');
  const [sort, setSort] = useState<SortMode>('date');
  const [typeFilter, setTypeFilter] = useState<WineTypeFilter>('all');

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [batchTarget, setBatchTarget] = useState('');
  const [batchMoving, setBatchMoving] = useState(false);
  const [batchError, setBatchError] = useState<string | null>(null);

  const [moverWine, setMoverWine] = useState<{ wineId: string; wineName: string } | null>(null);
  const [miscWarning, setMiscWarning] = useState<MiscWarning | null>(null);

  const loadLocations = useCallback(async () => {
    if (!profileId) return;
    setLoadingLoc(true);
    try {
      const [locRes, invRes] = await Promise.all([
        fetch(`/api/locations?profile_id=${profileId}`),
        fetch(`/api/cellar?profile_id=${profileId}&location=`),
      ]);
      if (locRes.ok) setLocations(await locRes.json());
      if (invRes.ok) {
        const inv: CellarInventory[] = await invRes.json();
        const total = inv.reduce((s, i) => s + i.quantity, 0);
        setUnlocatedCount(total);
      }
    } finally {
      setLoadingLoc(false);
    }
  }, [profileId]);

  const loadBottles = useCallback(async (loc: Location) => {
    if (!profileId) return;
    setLoadingList(true);
    setSelected(new Set());
    setBatchError(null);
    try {
      const locParam = loc.id === '__unlocated__' ? '' : loc.name;
      const res = await fetch(`/api/cellar?profile_id=${profileId}&location=${encodeURIComponent(locParam)}&sort=${sort}`);
      if (res.ok) {
        setBottles(await res.json());
      }

      // Load mis-categorization warning for named locations
      if (loc.id !== '__unlocated__') {
        const miscRes = await fetch(`/api/cellar/miscategorized?profile_id=${profileId}`);
        if (miscRes.ok) {
          const miscData: Array<{ location: Location; theme: { type: string; value: string; fraction: number }; miscategorized: CellarInventory[] }> = await miscRes.json();
          const forThis = miscData.find(d => d.location.id === loc.id);
          if (forThis && forThis.miscategorized.length > 0) {
            setMiscWarning({
              location: forThis.location,
              theme: forThis.theme,
              miscategorizedIds: new Set(forThis.miscategorized.map(m => m.id)),
            });
          } else {
            setMiscWarning(null);
          }
        }
      } else {
        setMiscWarning(null);
      }
    } finally {
      setLoadingList(false);
    }
  }, [profileId, sort]);

  useEffect(() => { loadLocations(); }, [loadLocations]);

  useEffect(() => {
    if (selectedLoc) loadBottles(selectedLoc);
  }, [selectedLoc, loadBottles]);

  const filteredBottles = useMemo(() => {
    let items = bottles;
    if (q.trim()) {
      const lq = q.toLowerCase();
      items = items.filter(i =>
        i.wine?.name?.toLowerCase().includes(lq) ||
        i.wine?.producer?.toLowerCase().includes(lq)
      );
    }
    if (typeFilter !== 'all') {
      items = items.filter(i => {
        const wt = i.wine?.wine_type ?? 'other';
        if (typeFilter === 'other') return !['red', 'white', 'rosé', 'sparkling'].includes(wt);
        return wt === typeFilter;
      });
    }
    return items;
  }, [bottles, q, typeFilter]);

  const handleSelectLoc = (loc: Location) => {
    setSelectedLoc(loc);
    setQ('');
    setTypeFilter('all');
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const allSelected = filteredBottles.length > 0 && filteredBottles.every(b => selected.has(b.id));
  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(filteredBottles.map(b => b.id)));
  };

  const handleBatchMove = async () => {
    if (!batchTarget || selected.size === 0 || !profileId) return;
    setBatchMoving(true);
    setBatchError(null);
    try {
      const fromLocName = selectedLoc?.id === '__unlocated__' ? '' : (selectedLoc?.name ?? '');
      const moves = filteredBottles
        .filter(b => selected.has(b.id))
        .map(b => ({
          wine_id: b.wine_id,
          profile_id: profileId,
          from_location: fromLocName,
          to_location: batchTarget,
          quantity: b.quantity,
        }));

      const results = await Promise.allSettled(
        moves.map(m => fetch('/api/cellar/move', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(m),
        }).then(r => r.json()))
      );

      const failed = results.filter(r => r.status === 'rejected').length;
      if (failed > 0) setBatchError(`${failed} move(s) failed`);

      setSelected(new Set());
      setBatchTarget('');
      await Promise.all([loadLocations(), selectedLoc ? loadBottles(selectedLoc) : Promise.resolve()]);
    } finally {
      setBatchMoving(false);
    }
  };

  const handleMoveDialogClose = () => {
    setMoverWine(null);
    loadLocations();
    if (selectedLoc) loadBottles(selectedLoc);
  };

  const sidebarItems: Array<{ loc: Location; count: number; isVirtual?: boolean }> = [
    { loc: UNLOCATED, count: unlocatedCount, isVirtual: true },
    ...locations.map(l => ({ loc: l, count: l.current_quantity ?? 0 })),
  ];

  if (!profileId) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Select a cellar profile to view inventory.
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0">
      {/* Sidebar */}
      <aside className="w-48 shrink-0 border-r bg-card overflow-y-auto hidden sm:flex flex-col">
        <div className="px-3 py-3 border-b">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Archive className="h-4 w-4 text-primary" />
            Locations
          </h2>
        </div>
        {loadingLoc ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <nav className="px-2 py-2 space-y-0.5">
            {sidebarItems.map(({ loc, count, isVirtual }) => {
              const active = selectedLoc?.id === loc.id;
              const badge = loc.location_type ? LOC_TYPE_BADGE[loc.location_type] : undefined;
              return (
                <button
                  key={loc.id}
                  onClick={() => handleSelectLoc(loc)}
                  className={cn(
                    'w-full text-left px-2.5 py-2 rounded-md text-sm transition-colors flex items-center justify-between gap-1',
                    active
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  )}
                >
                  <span className="truncate flex-1">
                    {isVirtual ? 'Unlocated' : loc.name}
                  </span>
                  <span className={cn('text-xs shrink-0', active ? 'opacity-80' : 'opacity-60')}>
                    {count}
                  </span>
                </button>
              );
              void badge; // badge shown only in main panel for now
            })}
          </nav>
        )}
      </aside>

      {/* Main panel */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Location header + filters */}
        <div className="px-4 py-3 border-b space-y-2 bg-card">
          {/* Mobile: location dropdown */}
          <div className="sm:hidden">
            <select
              value={selectedLoc?.id ?? ''}
              onChange={e => {
                const item = sidebarItems.find(s => s.loc.id === e.target.value);
                if (item) handleSelectLoc(item.loc);
              }}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              {sidebarItems.map(({ loc, count, isVirtual }) => (
                <option key={loc.id} value={loc.id}>
                  {isVirtual ? 'Unlocated' : loc.name} ({count})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold flex-1 truncate">
              {selectedLoc?.id === '__unlocated__'
                ? `Unlocated (${unlocatedCount})`
                : selectedLoc
                  ? `${selectedLoc.name}${selectedLoc.current_quantity != null ? ` (${selectedLoc.current_quantity})` : ''}`
                  : 'Select a location'}
            </h1>
            {selectedLoc && selectedLoc.location_type && selectedLoc.location_type !== 'standard' && (
              <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium',
                LOC_TYPE_BADGE[selectedLoc.location_type]?.cls ?? '')}>
                {LOC_TYPE_BADGE[selectedLoc.location_type]?.label}
              </span>
            )}
            <button
              onClick={() => { if (selectedLoc) setSort(s => s === 'name' ? 'date' : s === 'date' ? 'drink' : 'name'); }}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-md border text-xs hover:bg-accent transition-colors"
              title={`Sort: ${sort}`}
            >
              <SortAsc className="h-3.5 w-3.5" />
              {sort === 'name' ? 'Name' : sort === 'date' ? 'Date' : 'Drink'}
            </button>
          </div>

          {/* Search + type filter */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[160px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search wines…"
                value={q}
                onChange={e => setQ(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-md border bg-background text-sm"
              />
            </div>
            <div className="flex gap-1">
              {(Object.keys(TYPE_LABELS) as WineTypeFilter[]).map(t => (
                <button
                  key={t}
                  onClick={() => setTypeFilter(t)}
                  className={cn(
                    'px-2 py-1 rounded-md text-xs font-medium transition-colors',
                    typeFilter === t
                      ? 'bg-primary text-primary-foreground'
                      : 'border hover:bg-accent text-muted-foreground'
                  )}
                >
                  {TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          {/* Mis-categorization warning */}
          {miscWarning && (
            <div className="flex items-start gap-2 text-xs bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 rounded-md px-3 py-2">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>
                This location trends toward <strong>{miscWarning.theme.value}</strong>{' '}
                ({Math.round(miscWarning.theme.fraction * 100)}%).{' '}
                {miscWarning.miscategorizedIds.size} bottle{miscWarning.miscategorizedIds.size > 1 ? 's' : ''} may not belong here.
              </span>
            </div>
          )}
        </div>

        {/* Bottle list */}
        <div className="flex-1 overflow-y-auto">
          {loadingList ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredBottles.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              {q || typeFilter !== 'all' ? 'No matching bottles.' : 'No bottles in this location.'}
            </div>
          ) : (
            <>
              {/* Select-all row */}
              <div className="px-4 py-2 border-b flex items-center gap-3 text-xs text-muted-foreground bg-muted/30">
                <button onClick={toggleAll} className="flex items-center gap-1.5 hover:text-foreground transition-colors">
                  {allSelected
                    ? <CheckSquare className="h-4 w-4 text-primary" />
                    : <Square className="h-4 w-4" />}
                  {selected.size > 0 ? `${selected.size} selected` : 'Select all'}
                </button>
              </div>

              <ul className="divide-y">
                {filteredBottles.map(entry => {
                  const wine = entry.wine;
                  const isMisc = miscWarning?.miscategorizedIds.has(entry.id);
                  const isSelected = selected.has(entry.id);
                  return (
                    <li
                      key={entry.id}
                      className={cn(
                        'flex items-center gap-3 px-4 py-3 hover:bg-accent/50 transition-colors',
                        isMisc && 'border-l-2 border-amber-400',
                        isSelected && 'bg-primary/5'
                      )}
                    >
                      {/* Checkbox */}
                      <button
                        onClick={() => toggleSelect(entry.id)}
                        className="shrink-0 text-muted-foreground hover:text-primary transition-colors"
                      >
                        {isSelected
                          ? <CheckSquare className="h-4 w-4 text-primary" />
                          : <Square className="h-4 w-4" />}
                      </button>

                      {/* Thumbnail */}
                      {wine?.image_url ? (
                        <img
                          src={wine.image_url}
                          alt=""
                          className="w-9 h-12 object-cover rounded shrink-0 border"
                        />
                      ) : (
                        <div className="w-9 h-12 rounded border bg-muted flex items-center justify-center shrink-0 text-muted-foreground text-xs">
                          {(wine?.wine_type ?? '?')[0]?.toUpperCase()}
                        </div>
                      )}

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{wine?.name ?? 'Unknown'}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {[wine?.producer, wine?.vintage_year].filter(Boolean).join(' · ')}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {[wine?.variety, wine?.region].filter(Boolean).join(' · ')}
                        </p>
                      </div>

                      {/* Qty badge */}
                      <div className="shrink-0 text-center">
                        <span className="text-sm font-semibold">{entry.quantity}</span>
                        <p className="text-xs text-muted-foreground">btl</p>
                      </div>

                      {/* Move button */}
                      <button
                        onClick={() => setMoverWine({ wineId: entry.wine_id, wineName: wine?.name ?? 'Wine' })}
                        className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-md border text-xs hover:bg-accent transition-colors"
                      >
                        <MoveRight className="h-3.5 w-3.5" />
                        Move
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>

        {/* Batch move bar */}
        {selected.size > 0 && (
          <div className="border-t bg-card px-4 py-3 space-y-2">
            {batchError && (
              <p className="text-xs text-destructive">{batchError}</p>
            )}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium">{selected.size} selected</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
              <select
                value={batchTarget}
                onChange={e => setBatchTarget(e.target.value)}
                className="flex-1 min-w-[140px] rounded-md border bg-background px-2.5 py-1.5 text-sm"
              >
                <option value="">Move to…</option>
                {locations
                  .filter(l => l.name !== selectedLoc?.name)
                  .map(l => (
                    <option key={l.id} value={l.name}>{l.name}</option>
                  ))}
              </select>
              <button
                onClick={handleBatchMove}
                disabled={!batchTarget || batchMoving}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {batchMoving ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoveRight className="h-4 w-4" />}
                Move all
              </button>
              <button
                onClick={() => { setSelected(new Set()); setBatchError(null); }}
                className="px-3 py-1.5 rounded-md border text-sm hover:bg-accent transition-colors"
              >
                Clear
              </button>
            </div>
          </div>
        )}
      </div>

      {/* BottleMover dialog */}
      {moverWine && (
        <BottleMover
          profileId={profileId}
          wineId={moverWine.wineId}
          wineName={moverWine.wineName}
          defaultFromLocation={selectedLoc?.id === '__unlocated__' ? '' : selectedLoc?.name}
          onMoveDone={() => {}}
          onClose={handleMoveDialogClose}
        />
      )}
    </div>
  );
}
