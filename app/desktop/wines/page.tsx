'use client';

import { Suspense, useEffect, useCallback, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Plus, Loader2, MapPin, X, ChevronUp, ChevronDown, Wine as WineIcon, Rows3, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { useWineSearch } from '@/hooks/useWineSearch';
import { useProfile } from '@/hooks/useProfile';
import LocationPicker from '@/components/LocationPicker';
import WineBulkAdd from '@/components/bulk-add/WineBulkAdd';
import { cn } from '@/lib/utils';
import type { Wine, Profile, Location, WineType } from '@/types';

const WINE_TYPES: WineType[] = ['red', 'white', 'rosé', 'sparkling', 'dessert', 'fortified', 'other'];

const TYPE_COLORS: Record<string, string> = {
  red:       'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  white:     'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  rosé:      'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
  sparkling: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  dessert:   'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  fortified: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  other:     'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
};

function drinkStatus(wine: Wine): { label: string; cls: string } | null {
  const year = new Date().getFullYear();
  if (!wine.drink_from_year && !wine.drink_by_year) return null;
  if (wine.drink_by_year && year > wine.drink_by_year) return { label: 'Past peak', cls: 'text-destructive' };
  if (wine.drink_from_year && year < wine.drink_from_year) return { label: 'Too young', cls: 'text-amber-600 dark:text-amber-400' };
  return { label: 'In window', cls: 'text-green-600 dark:text-green-400' };
}

// ── Quick-add modal ────────────────────────────────────────────────────────────
function QuickAddModal({
  wine, profiles, activeProfile, onClose, onSuccess,
}: {
  wine: Wine; profiles: Profile[]; activeProfile: Profile | null;
  onClose: () => void; onSuccess: () => void;
}) {
  const [profileId, setProfileId] = useState(activeProfile?.id ?? profiles[0]?.id ?? '');
  const [location, setLocation] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileId) return;
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/cellar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wine_id: wine.id, profile_id: profileId, location: location.trim(), quantity }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Failed');
      onSuccess(); onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally { setLoading(false); }
  };

  const inp = 'w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring';
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-card rounded-xl border shadow-lg w-full max-w-sm space-y-4 p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">{wine.name}</p>
            {wine.producer && <p className="text-xs text-muted-foreground truncate">{wine.producer}</p>}
          </div>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground shrink-0"><X className="h-4 w-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          {profiles.length > 1 && (
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Cellar</label>
              <select className={inp} value={profileId} onChange={e => { setProfileId(e.target.value); setLocation(''); }} required>
                {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><MapPin className="h-3 w-3" /> Location (optional)</label>
            {profileId ? <LocationPicker key={profileId} profileId={profileId} value={location} onChange={setLocation} placeholder="Select or type a location…" allowUnlocated /> : <input className={inp} disabled placeholder="Select a cellar first" />}
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Quantity</label>
            <input type="number" className={inp} value={quantity} onChange={e => setQuantity(Math.max(1, Number(e.target.value)))} min={1} required />
          </div>
          {error && <p className="text-xs text-destructive bg-destructive/10 rounded px-2 py-1">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={loading || !profileId} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Add {quantity} {quantity === 1 ? 'Bottle' : 'Bottles'}
            </button>
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-md border text-sm hover:bg-accent transition-colors">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Sort helper ────────────────────────────────────────────────────────────────
type SortField = 'name' | 'producer' | 'wine_type' | 'vintage_year' | 'variety' | 'region' | 'average_price';
function parseSortParam(sort: string | undefined): { field: SortField; dir: 'asc' | 'desc' } {
  if (!sort) return { field: 'name', dir: 'asc' };
  const [f, d] = sort.split(':');
  return { field: (f as SortField) || 'name', dir: d === 'desc' ? 'desc' : 'asc' };
}

function SortHeader({ field, label, current, onChange, align = 'left' }: {
  field: SortField; label: string; current: { field: SortField; dir: 'asc' | 'desc' };
  onChange: (f: SortField, d: 'asc' | 'desc') => void; align?: 'left' | 'right';
}) {
  const active = current.field === field;
  const nextDir = active && current.dir === 'asc' ? 'desc' : 'asc';
  return (
    <th className={cn('px-3 py-2 font-medium text-muted-foreground text-xs uppercase tracking-wide cursor-pointer select-none hover:text-foreground transition-colors whitespace-nowrap', align === 'right' ? 'text-right' : 'text-left')} onClick={() => onChange(field, nextDir)}>
      <span className="flex items-center gap-1" style={align === 'right' ? { justifyContent: 'flex-end' } : {}}>
        {label}
        {active ? (current.dir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />) : <ChevronUp className="h-3 w-3 opacity-0 group-hover:opacity-30" />}
      </span>
    </th>
  );
}

// ── Main content ───────────────────────────────────────────────────────────────
function DesktopWinesContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { profiles, activeProfile } = useProfile();
  const [quickAddWine, setQuickAddWine] = useState<Wine | null>(null);
  const [showBulkAdd, setShowBulkAdd] = useState(false);
  const [bulkLocations, setBulkLocations] = useState<Location[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    if (showBulkAdd && activeProfile) {
      fetch(`/api/locations?profile_id=${activeProfile.id}`)
        .then(r => r.ok ? r.json() : [])
        .then((data: Location[]) => setBulkLocations(data))
        .catch(() => setBulkLocations([]));
    }
  }, [showBulkAdd, activeProfile]);

  const profileIds = searchParams.get('profile_ids') ?? undefined;
  const { wines, loading, error, params, updateParam, clearParams, refresh } = useWineSearch({ profile_ids: profileIds });

  useEffect(() => { updateParam('profile_ids', profileIds); }, [profileIds]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleProfile = useCallback((profileId: string) => {
    const current = new Set((profileIds ?? '').split(',').filter(Boolean));
    if (current.has(profileId)) current.delete(profileId); else current.add(profileId);
    const next = [...current].join(',');
    router.push(next ? `/desktop/wines?profile_ids=${next}` : '/desktop/wines');
  }, [profileIds, router]);

  const activeSet = new Set((profileIds ?? '').split(',').filter(Boolean));

  const sortState = parseSortParam(params.sort);
  const handleSort = (field: SortField, dir: 'asc' | 'desc') => {
    updateParam('sort', `${field}:${dir}`);
  };

  const inp = 'h-8 border rounded-md px-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring';

  return (
    <div className="px-6 py-5 space-y-4 max-w-screen-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <WineIcon className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold">Desktop Wines</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(v => !v)}
            className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm font-medium hover:bg-muted transition-colors', showFilters && 'bg-muted')}
          >
            Filters
            {showFilters ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
          {activeProfile && (
            <button onClick={() => setShowBulkAdd(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm font-medium hover:bg-muted transition-colors">
              <Rows3 className="h-4 w-4" /> Bulk Add
            </button>
          )}
          <Link href="/wines/new" className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
            <Plus className="h-4 w-4" /> Add Wine
          </Link>
        </div>
      </div>

      {/* Filter bar */}
      {showFilters && (
        <div className="rounded-lg border p-4 space-y-3 bg-card">
          <div className="flex flex-wrap gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Search</label>
              <input
                type="search" value={params.query ?? ''} onChange={e => updateParam('query', e.target.value)}
                placeholder="Name, producer, variety…" className={`${inp} w-56`}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Type</label>
              <select value={params.wine_type ?? ''} onChange={e => updateParam('wine_type', e.target.value as WineType || undefined)} className={`${inp} w-36`}>
                <option value="">All types</option>
                {WINE_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Drink status</label>
              <select value={params.drink_status ?? ''} onChange={e => updateParam('drink_status', e.target.value as 'in_window' | 'too_young' | 'past_peak' || undefined)} className={`${inp} w-36`}>
                <option value="">Any</option>
                <option value="in_window">In window</option>
                <option value="too_young">Too young</option>
                <option value="past_peak">Past peak</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Country</label>
              <input type="text" value={params.country ?? ''} onChange={e => updateParam('country', e.target.value)} placeholder="e.g. France" className={`${inp} w-32`} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Region</label>
              <input type="text" value={params.region ?? ''} onChange={e => updateParam('region', e.target.value)} placeholder="e.g. Burgundy" className={`${inp} w-36`} />
            </div>
            <div className="flex items-end">
              <button onClick={clearParams} className="h-8 px-3 rounded-md border text-sm hover:bg-accent transition-colors text-muted-foreground">Clear</button>
            </div>
          </div>
          {/* Cellar filter chips */}
          {profiles.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground">Cellar:</span>
              <button onClick={() => router.push('/desktop/wines')} className={cn('text-xs px-3 py-1 rounded-full border transition-colors', activeSet.size === 0 ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-accent border-input text-muted-foreground')}>All</button>
              {profiles.map(p => (
                <button key={p.id} onClick={() => toggleProfile(p.id)} className={cn('text-xs px-3 py-1 rounded-full border transition-colors', activeSet.has(p.id) ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-accent border-input text-muted-foreground')}>{p.name}</button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">{error}</div>}

      {/* Table */}
      <div className="rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b">
              <tr>
                <SortHeader field="name" label="Wine" current={sortState} onChange={handleSort} />
                <SortHeader field="producer" label="Producer" current={sortState} onChange={handleSort} />
                <SortHeader field="wine_type" label="Type" current={sortState} onChange={handleSort} />
                <SortHeader field="vintage_year" label="Vintage" current={sortState} onChange={handleSort} align="right" />
                <SortHeader field="variety" label="Variety" current={sortState} onChange={handleSort} />
                <SortHeader field="region" label="Region" current={sortState} onChange={handleSort} />
                <SortHeader field="average_price" label="Price" current={sortState} onChange={handleSort} align="right" />
                <th className="px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide text-left">Drink window</th>
                <th className="px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                [...Array(8)].map((_, i) => (
                  <tr key={i}><td colSpan={9} className="px-3 py-3"><div className="h-4 rounded bg-muted animate-pulse" /></td></tr>
                ))
              ) : wines.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground text-sm">
                    No wines found.{' '}
                    <Link href="/wines/new" className="text-primary underline">Add your first wine</Link>
                  </td>
                </tr>
              ) : wines.map(wine => {
                const status = drinkStatus(wine);
                return (
                  <tr key={wine.id} className="hover:bg-accent/30 transition-colors">
                    <td className="px-3 py-2.5">
                      <Link href={`/wines/${wine.id}`} className="font-medium hover:text-primary transition-colors line-clamp-1">
                        {wine.name}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground truncate max-w-[140px]">{wine.producer ?? '—'}</td>
                    <td className="px-3 py-2.5">
                      {wine.wine_type ? (
                        <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', TYPE_COLORS[wine.wine_type] ?? TYPE_COLORS.other)}>
                          {wine.wine_type}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{wine.vintage_year ?? '—'}</td>
                    <td className="px-3 py-2.5 text-muted-foreground truncate max-w-[120px]">{wine.variety ?? '—'}</td>
                    <td className="px-3 py-2.5 text-muted-foreground truncate max-w-[140px]">{wine.region ?? wine.appellation ?? '—'}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                      {wine.average_price != null ? `$${wine.average_price}` : '—'}
                    </td>
                    <td className="px-3 py-2.5">
                      {status ? (
                        <span className={cn('text-xs font-medium', status.cls)}>{status.label}</span>
                      ) : wine.drink_from_year ? (
                        <span className="text-xs text-muted-foreground">{wine.drink_from_year}–{wine.drink_by_year ?? '?'}</span>
                      ) : '—'}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        {profiles.length > 0 && (
                          <button onClick={() => setQuickAddWine(wine)} className="px-2 py-1 rounded text-xs border hover:bg-accent transition-colors">+ Bottle</button>
                        )}
                        <Link href={`/wines/${wine.id}`} title="View details" className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!loading && wines.length > 0 && (
          <div className="px-4 py-2 border-t bg-muted/20 text-xs text-muted-foreground">
            {wines.length} {wines.length === 1 ? 'wine' : 'wines'}
          </div>
        )}
      </div>

      {quickAddWine && profiles.length > 0 && (
        <QuickAddModal wine={quickAddWine} profiles={profiles} activeProfile={activeProfile} onClose={() => setQuickAddWine(null)} onSuccess={refresh} />
      )}
      {showBulkAdd && activeProfile && (
        <WineBulkAdd profile={activeProfile} locations={bulkLocations} open={showBulkAdd} onClose={() => setShowBulkAdd(false)} onSuccess={() => { refresh(); setShowBulkAdd(false); }} />
      )}
    </div>
  );
}

export default function DesktopWinesPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64 text-sm text-muted-foreground">Loading…</div>}>
      <DesktopWinesContent />
    </Suspense>
  );
}
