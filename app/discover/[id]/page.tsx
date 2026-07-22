'use client';

import { useEffect, useState, useCallback, use } from 'react';
import Link from 'next/link';
import { useProfile } from '@/hooks/useProfile';
import {
  ScanSearch, Wine, UtensilsCrossed, Store, ShoppingBag, MapPin,
  ArrowLeft, Loader2, Sparkles, Trash2, ChevronDown, ChevronRight,
  CheckCircle2, AlertCircle, Image, Plus, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WineDiscoverySession, DiscoverySessionWine, VenueType, Wine as WineType, SimilarWineResult, WineSimilarityResponse } from '@/types';

// ---------------------------------------------------------------------------
// Venue helpers
// ---------------------------------------------------------------------------

const VENUE_ICONS: Record<VenueType, React.ComponentType<{ className?: string }>> = {
  restaurant: UtensilsCrossed, winery: Wine, wine_bar: Store, retail: ShoppingBag, other: MapPin,
};

const VENUE_LABELS: Record<VenueType, string> = {
  restaurant: 'Restaurant', winery: 'Winery', wine_bar: 'Wine Bar', retail: 'Retail', other: 'Other',
};

const VENUE_COLORS: Record<VenueType, string> = {
  restaurant: 'text-orange-600 bg-orange-50 dark:text-orange-400 dark:bg-orange-900/20',
  winery: 'text-purple-600 bg-purple-50 dark:text-purple-400 dark:bg-purple-900/20',
  wine_bar: 'text-rose-600 bg-rose-50 dark:text-rose-400 dark:bg-rose-900/20',
  retail: 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/20',
  other: 'text-gray-600 bg-gray-50 dark:text-gray-400 dark:bg-gray-900/20',
};

type Tab = 'wines' | 'cellar' | 'pairing';

type SessionWithWines = WineDiscoverySession & { wines: DiscoverySessionWine[] };

// ---------------------------------------------------------------------------
// Markup badge
// ---------------------------------------------------------------------------

function MarkupBadge({ venue, market }: { venue?: number | null; market?: number | null }) {
  if (!venue || !market || market === 0) return <span className="text-muted-foreground">—</span>;
  const ratio = venue / market;
  const color = ratio < 2 ? 'text-green-600 dark:text-green-400' : ratio < 3 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400';
  return <span className={cn('font-medium tabular-nums', color)}>{ratio.toFixed(1)}×</span>;
}

function fmt(n?: number | null) {
  if (n == null) return '—';
  return `$${n.toFixed(0)}`;
}

// ---------------------------------------------------------------------------
// Enrich button + dedup dialog
// ---------------------------------------------------------------------------

type EnrichState = 'idle' | 'loading' | 'done' | 'error';

function EnrichButton({
  wine,
  profileId,
  sessionId,
  onDone,
}: {
  wine: DiscoverySessionWine;
  profileId: string;
  sessionId: string;
  onDone: (updated: DiscoverySessionWine) => void;
}) {
  const [state, setState] = useState<EnrichState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [duplicates, setDuplicates] = useState<WineType[]>([]);

  if (wine.wine_id) {
    return <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" />Enriched</span>;
  }

  const run = async (linkWineId?: string) => {
    setState('loading');
    setError(null);
    setDuplicates([]);
    try {
      const res = await fetch(`/api/discovery-sessions/${sessionId}/wines/${wine.id}/enrich`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile_id: profileId, link_wine_id: linkWineId }),
      });
      const data = await res.json() as { sessionWine?: DiscoverySessionWine; duplicates?: WineType[]; error?: string };
      if (res.status === 409 && data.duplicates?.length) {
        setDuplicates(data.duplicates);
        setState('idle');
        return;
      }
      if (!res.ok) throw new Error(data.error ?? 'Enrichment failed');
      setState('done');
      if (data.sessionWine) onDone(data.sessionWine);
    } catch (err) {
      setState('error');
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="flex flex-col gap-1">
      {duplicates.length > 0 && (
        <div className="rounded border bg-amber-50 dark:bg-amber-900/20 p-2 text-xs space-y-1">
          <p className="font-medium text-amber-700 dark:text-amber-400">Possible duplicates found:</p>
          {duplicates.map(d => (
            <button
              key={d.id}
              onClick={() => run(d.id)}
              className="w-full text-left px-2 py-1 rounded hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
            >
              {d.name} {d.vintage_year ? `(${d.vintage_year})` : ''}
              <span className="block text-muted-foreground">{d.producer}</span>
            </button>
          ))}
          <button
            onClick={() => run()}
            className="text-xs text-primary underline mt-1"
          >
            Create new anyway
          </button>
        </div>
      )}
      {state === 'error' && (
        <p className="text-xs text-destructive">{error}</p>
      )}
      <button
        onClick={() => run()}
        disabled={state === 'loading'}
        className="flex items-center gap-1 text-xs px-2 py-1 rounded border text-muted-foreground hover:bg-accent disabled:opacity-50 transition-colors"
      >
        {state === 'loading' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
        {state === 'loading' ? 'Enriching…' : 'Enrich'}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Wines Tab
// ---------------------------------------------------------------------------

function WinesTab({
  session,
  wines,
  profileId,
  onWinesChange,
}: {
  session: WineDiscoverySession;
  wines: DiscoverySessionWine[];
  profileId: string;
  onWinesChange: (wines: DiscoverySessionWine[]) => void;
}) {
  const [deleting, setDeleting] = useState<string | null>(null);

  const handleDelete = async (wineId: string) => {
    if (!confirm('Remove this wine from the session?')) return;
    setDeleting(wineId);
    await fetch(`/api/discovery-sessions/${session.id}/wines/${wineId}`, { method: 'DELETE' });
    onWinesChange(wines.filter(w => w.id !== wineId));
    setDeleting(null);
  };

  const handleEnrichDone = (updated: DiscoverySessionWine) => {
    onWinesChange(wines.map(w => w.id === updated.id ? updated : w));
  };

  if (wines.length === 0) {
    return (
      <div className="text-center py-16 space-y-2">
        <Wine className="h-10 w-10 mx-auto text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">No wines in this session yet.</p>
        <p className="text-xs text-muted-foreground">Use the scanner to add individual bottles or scan a menu photo.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-xs text-muted-foreground">
            <th className="text-left py-2 pr-3 font-medium">Bin</th>
            <th className="text-left py-2 pr-3 font-medium">Wine</th>
            <th className="text-left py-2 pr-3 font-medium">Vintage</th>
            <th className="text-left py-2 pr-3 font-medium">Type</th>
            <th className="text-right py-2 pr-3 font-medium">Venue</th>
            <th className="text-right py-2 pr-3 font-medium">Market</th>
            <th className="text-right py-2 pr-3 font-medium">Markup</th>
            <th className="py-2 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {wines.map(w => (
            <tr key={w.id} className="border-b last:border-0 hover:bg-accent/30">
              <td className="py-2 pr-3 text-xs text-muted-foreground tabular-nums">{w.bin_number ?? '—'}</td>
              <td className="py-2 pr-3 max-w-[180px]">
                <div className="font-medium truncate">{w.name}</div>
                {w.producer && <div className="text-xs text-muted-foreground truncate">{w.producer}</div>}
                {w.wine_id && (
                  <Link href={`/wines/${w.wine_id}`} className="text-xs text-primary hover:underline">
                    View →
                  </Link>
                )}
              </td>
              <td className="py-2 pr-3 tabular-nums">{w.vintage_year ?? '—'}</td>
              <td className="py-2 pr-3">
                {w.wine_type ? (
                  <span className="text-xs capitalize">{w.wine_type}</span>
                ) : '—'}
              </td>
              <td className="py-2 pr-3 text-right tabular-nums">{fmt(w.venue_price)}</td>
              <td className="py-2 pr-3 text-right tabular-nums">{fmt(w.market_price)}</td>
              <td className="py-2 pr-3 text-right">
                <MarkupBadge venue={w.venue_price} market={w.market_price} />
              </td>
              <td className="py-2">
                <div className="flex items-center gap-1">
                  <EnrichButton
                    wine={w}
                    profileId={profileId}
                    sessionId={session.id}
                    onDone={handleEnrichDone}
                  />
                  <button
                    onClick={() => handleDelete(w.id)}
                    disabled={deleting === w.id}
                    className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-accent transition-colors"
                    aria-label="Delete"
                  >
                    {deleting === w.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cellar Check Tab
// ---------------------------------------------------------------------------

function SimilarWinesSection({ wine, profileId }: { wine: DiscoverySessionWine; profileId: string }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<WineSimilarityResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (data || loading) return;
    setLoading(true);
    try {
      const res = await fetch('/api/wines/similar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wine_id: wine.wine_id, profile_id: profileId }),
      });
      const json = await res.json() as WineSimilarityResponse & { error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Failed');
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const toggle = () => {
    if (!open) load();
    setOpen(v => !v);
  };

  return (
    <div className="rounded-lg border">
      <button
        onClick={toggle}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-accent/40 transition-colors"
      >
        <span className="flex items-center gap-2">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <span>{wine.name}{wine.vintage_year ? ` ${wine.vintage_year}` : ''}</span>
          {wine.producer && <span className="text-xs text-muted-foreground font-normal">· {wine.producer}</span>}
        </span>
        {wine.venue_price && <span className="text-xs text-muted-foreground tabular-nums">{fmt(wine.venue_price)}</span>}
      </button>

      {open && (
        <div className="px-4 pb-4 border-t">
          {loading && (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
          {error && <p className="text-sm text-destructive py-2">{error}</p>}
          {data && (
            <>
              {data.price_stats && (
                <div className="flex gap-4 py-2 text-xs text-muted-foreground border-b mb-3">
                  <span>Mean: <strong className="text-foreground">{fmt(data.price_stats.mean)}</strong></span>
                  <span>Range: <strong className="text-foreground">{fmt(data.price_stats.min)}–{fmt(data.price_stats.max)}</strong></span>
                  <span>σ: <strong className="text-foreground">{fmt(data.price_stats.std)}</strong></span>
                  <span>In cellar: <strong className="text-foreground">{data.price_stats.count}</strong> wines</span>
                </div>
              )}
              {data.similar.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">No similar wines in your cellar.</p>
              ) : (
                <div className="space-y-2">
                  {(data.similar as Array<SimilarWineResult & { cellar_count: number }>).map(r => (
                    <div key={r.wine.id} className="flex items-center justify-between text-sm">
                      <div>
                        <Link href={`/wines/${r.wine.id}`} className="font-medium hover:underline">
                          {r.wine.name}
                        </Link>
                        {r.wine.vintage_year && <span className="text-muted-foreground ml-1">{r.wine.vintage_year}</span>}
                        <span className="text-xs text-muted-foreground ml-2">dist {r.distance.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        {r.wine.average_price && <span className="tabular-nums">{fmt(r.wine.average_price)}</span>}
                        <span className="px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                          {r.cellar_count} btl
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function CellarCheckTab({ wines, profileId }: { wines: DiscoverySessionWine[]; profileId: string }) {
  const enriched = wines.filter(w => w.wine_id);

  if (enriched.length === 0) {
    return (
      <div className="text-center py-16 space-y-2">
        <AlertCircle className="h-8 w-8 mx-auto text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">No enriched wines yet.</p>
        <p className="text-xs text-muted-foreground">Enrich wines in the Wines tab first to run similarity checks.</p>
      </div>
    );
  }

  const unenriched = wines.filter(w => !w.wine_id);
  const owned = 0; // Will be computed per-wine via SimilarWinesSection

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {enriched.length} of {wines.length} wines enriched. Click a wine to see similar bottles in your cellar.
      </p>
      {enriched.map(w => (
        <SimilarWinesSection key={w.id} wine={w} profileId={profileId} />
      ))}
      {unenriched.length > 0 && (
        <div className="rounded-lg border border-dashed p-4">
          <p className="text-xs font-medium text-muted-foreground mb-2">Not yet enriched ({unenriched.length})</p>
          <ul className="space-y-1">
            {unenriched.map(w => (
              <li key={w.id} className="text-sm text-muted-foreground">{w.name}{w.vintage_year ? ` ${w.vintage_year}` : ''}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Food Pairing Tab
// ---------------------------------------------------------------------------

type PairingGroup = {
  wine_id: string;
  wine_name: string;
  score: number;
  rationale?: string;
  foods: string[];
};

function FoodPairingTab({ session, wines }: { session: WineDiscoverySession; wines: DiscoverySessionWine[] }) {
  const [foodInput, setFoodInput] = useState('');
  const [foods, setFoods] = useState<string[]>([]);
  const [wineType, setWineType] = useState<'any' | 'red' | 'white' | 'rosé' | 'sparkling'>('any');
  const [maxPrice, setMaxPrice] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ groups: PairingGroup[]; unenriched: DiscoverySessionWine[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const addFood = () => {
    const f = foodInput.trim();
    if (f && !foods.includes(f)) setFoods(prev => [...prev, f]);
    setFoodInput('');
  };

  const removeFood = (f: string) => setFoods(prev => prev.filter(x => x !== f));

  const run = async () => {
    if (foods.length === 0) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const preferences: Record<string, unknown> = {};
      if (wineType !== 'any') preferences.wine_type = wineType;
      if (maxPrice) preferences.max_price = parseFloat(maxPrice);
      const res = await fetch(`/api/discovery-sessions/${session.id}/pairings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ foods, preferences }),
      });
      const data = await res.json() as { groups: PairingGroup[]; unenriched: DiscoverySessionWine[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Failed');
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Food input */}
      <div>
        <label className="block text-sm font-medium mb-2">What are you eating?</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={foodInput}
            onChange={e => setFoodInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addFood(); } }}
            placeholder="e.g. duck confit, truffle pasta"
            className="flex-1 border rounded-md px-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            onClick={addFood}
            className="px-3 py-1.5 rounded-md border text-sm hover:bg-accent transition-colors"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        {foods.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {foods.map(f => (
              <span key={f} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs">
                {f}
                <button onClick={() => removeFood(f)} className="hover:text-destructive"><X className="h-3 w-3" /></button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Preferences */}
      <div className="flex flex-wrap gap-3 items-center">
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Wine type</label>
          <select
            value={wineType}
            onChange={e => setWineType(e.target.value as typeof wineType)}
            className="border rounded px-2 py-1 text-sm bg-background"
          >
            {(['any', 'red', 'white', 'rosé', 'sparkling'] as const).map(t => (
              <option key={t} value={t}>{t === 'any' ? 'Any' : t.charAt(0).toUpperCase() + t.slice(1)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Max price</label>
          <input
            type="number"
            value={maxPrice}
            onChange={e => setMaxPrice(e.target.value)}
            placeholder="No limit"
            min={0}
            className="border rounded px-2 py-1 text-sm bg-background w-28"
          />
        </div>
        <div className="flex-1" />
        <button
          onClick={run}
          disabled={foods.length === 0 || loading}
          className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {loading ? 'Finding…' : 'Find Best Match'}
        </button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {result && (
        <div className="space-y-3">
          {result.groups.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recommendations found. Try enriching more wines first.</p>
          ) : (
            result.groups.map((g, i) => (
              <div key={g.wine_id ?? i} className="rounded-lg border p-3 space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-sm">{g.wine_name}</p>
                    {g.rationale && <p className="text-xs text-muted-foreground mt-0.5">{g.rationale}</p>}
                    {g.foods?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {g.foods.map(f => (
                          <span key={f} className="text-xs px-1.5 py-0.5 rounded-full bg-accent text-muted-foreground">{f}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="shrink-0 text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                    #{i + 1}
                  </span>
                </div>
              </div>
            ))
          )}

          {result.unenriched.length > 0 && (
            <div className="rounded-lg border border-dashed p-3">
              <p className="text-xs text-muted-foreground font-medium mb-1">
                {result.unenriched.length} wine{result.unenriched.length > 1 ? 's' : ''} excluded (not yet enriched):
              </p>
              <ul className="text-xs text-muted-foreground space-y-0.5">
                {result.unenriched.map(w => (
                  <li key={w.id}>{w.name}{w.vintage_year ? ` ${w.vintage_year}` : ''}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function SessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { activeProfile } = useProfile();
  const [session, setSession] = useState<WineDiscoverySession | null>(null);
  const [wines, setWines] = useState<DiscoverySessionWine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('wines');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/discovery-sessions/${id}`);
      const data = await res.json() as SessionWithWines & { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Not found');
      const { wines: w, ...s } = data;
      setSession(s);
      setWines(w ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <p className="text-destructive">{error ?? 'Session not found'}</p>
        <Link href="/discover" className="text-sm text-primary hover:underline mt-2 block">← Back</Link>
      </div>
    );
  }

  const venueType = (session.venue_type as VenueType | undefined) ?? 'other';
  const VenueIcon = VENUE_ICONS[venueType];
  const profileId = activeProfile?.id ?? session.profile_id;

  const tabs: Array<{ key: Tab; label: string }> = [
    { key: 'wines', label: `Wines (${wines.length})` },
    { key: 'cellar', label: 'Cellar Check' },
    { key: 'pairing', label: 'Food Pairing' },
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-5">
        <Link
          href="/discover"
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-3 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Discover
        </Link>
        <div className="flex items-start gap-3">
          <span className={cn('flex items-center justify-center w-9 h-9 rounded-full shrink-0', VENUE_COLORS[venueType])}>
            <VenueIcon className="h-4.5 w-4.5" />
          </span>
          <div>
            <h1 className="text-xl font-semibold leading-tight">
              {session.venue_name ?? session.session_code}
            </h1>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className={cn('text-xs px-1.5 py-0.5 rounded-full font-medium', VENUE_COLORS[venueType])}>
                {VENUE_LABELS[venueType]}
              </span>
              <span className="text-xs text-muted-foreground font-mono">{session.session_code}</span>
              {session.venue_name && session.notes && (
                <span className="text-xs text-muted-foreground">{session.notes}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b mb-5">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              tab === t.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'wines' && (
        <WinesTab
          session={session}
          wines={wines}
          profileId={profileId}
          onWinesChange={setWines}
        />
      )}
      {tab === 'cellar' && (
        <CellarCheckTab wines={wines} profileId={profileId} />
      )}
      {tab === 'pairing' && (
        <FoodPairingTab session={session} wines={wines} />
      )}
    </div>
  );
}
