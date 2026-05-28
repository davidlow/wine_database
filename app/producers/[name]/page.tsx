'use client';

import { use, useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft, Copy, Plus, Search, X, Loader2, MapPin, Calendar } from 'lucide-react';
import type { Wine, Profile } from '@/types';
import { useProfile } from '@/hooks/useProfile';
import LocationPicker from '@/components/LocationPicker';
import { cn, wineTypeLabel, wineTypeColor, formatPrice } from '@/lib/utils';

type ProducerWine = Wine & { transaction_count: number; bottle_count: number };

// ── Quick-add modal ────────────────────────────────────────────────────────────
function QuickAddModal({
  wine,
  profiles,
  activeProfile,
  onClose,
  onSuccess,
}: {
  wine: Wine;
  profiles: Profile[];
  activeProfile: Profile | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [profileId, setProfileId] = useState(activeProfile?.id ?? profiles[0]?.id ?? '');
  const [location, setLocation] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/cellar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wine_id: wine.id, profile_id: profileId, location: location.trim(), quantity }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Failed');
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setLoading(false);
    }
  };

  const inputCls = 'w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring';

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-card rounded-xl border shadow-lg w-full max-w-sm space-y-4 p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">{wine.name}</p>
            {wine.vintage_year && <p className="text-xs text-muted-foreground">{wine.vintage_year}</p>}
          </div>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          {profiles.length > 1 && (
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Cellar</label>
              <select className={inputCls} value={profileId} onChange={e => { setProfileId(e.target.value); setLocation(''); }} required>
                {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Location (optional)</label>
            {profileId ? (
              <LocationPicker key={profileId} profileId={profileId} value={location} onChange={setLocation} placeholder="Select or type…" allowUnlocated />
            ) : (
              <input className={inputCls} disabled placeholder="Select a cellar first" />
            )}
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Quantity</label>
            <input type="number" className={inputCls} value={quantity} onChange={e => setQuantity(Math.max(1, Number(e.target.value)))} min={1} required />
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

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ProducerDetailPage({ params }: { params: Promise<{ name: string }> }) {
  const { name: encodedName } = use(params);
  const producerName = decodeURIComponent(encodedName);
  const { profiles, activeProfile } = useProfile();

  const [wines, setWines] = useState<ProducerWine[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [wineType, setWineType] = useState('');
  const [quickAddWine, setQuickAddWine] = useState<Wine | null>(null);

  const loadWines = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/producers/${encodeURIComponent(producerName)}/wines`);
      if (res.ok) setWines(await res.json());
    } finally {
      setLoading(false);
    }
  }, [producerName]);

  useEffect(() => { loadWines(); }, [loadWines]);

  const filtered = wines.filter(w => {
    const q = query.toLowerCase();
    const matchesQuery = !q || w.name.toLowerCase().includes(q) ||
      (w.variety ?? '').toLowerCase().includes(q) ||
      (w.vintage_year ? String(w.vintage_year).includes(q) : false);
    const matchesType = !wineType || w.wine_type === wineType;
    return matchesQuery && matchesType;
  });

  const wineTypes = [...new Set(wines.map(w => w.wine_type).filter(Boolean))] as string[];

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/wines?view=producers" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-bold truncate">{producerName}</h2>
          <p className="text-sm text-muted-foreground">{wines.length} {wines.length === 1 ? 'wine' : 'wines'}</p>
        </div>
      </div>

      {/* Search + type filter */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="search"
            placeholder="Search wines, variety, vintage…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        {wineTypes.map(t => (
          <button
            key={t}
            onClick={() => setWineType(wineType === t ? '' : t)}
            className={cn(
              'text-xs px-3 py-1.5 rounded-full border transition-colors',
              wineType === t ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-accent border-input text-muted-foreground'
            )}
          >
            {wineTypeLabel(t as Parameters<typeof wineTypeLabel>[0])}
          </button>
        ))}
      </div>

      {/* Wine list */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => <div key={i} className="h-20 rounded-lg border bg-muted animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-10 text-sm text-muted-foreground">
          {query || wineType ? 'No wines match the filter.' : 'No wines for this producer.'}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(wine => (
            <div key={wine.id} className="rounded-lg border bg-card p-3 flex gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-2">
                  <Link href={`/wines/${wine.id}`} className="flex-1 min-w-0">
                    <p className="font-semibold text-sm leading-snug hover:text-primary transition-colors">{wine.name}</p>
                  </Link>
                  {wine.wine_type && (
                    <span className={cn('shrink-0 text-xs px-1.5 py-0.5 rounded-full font-medium', wineTypeColor(wine.wine_type))}>
                      {wineTypeLabel(wine.wine_type)}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                  {wine.vintage_year && (
                    <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{wine.vintage_year}</span>
                  )}
                  {(wine.region || wine.country) && (
                    <span className="flex items-center gap-1"><MapPin className="h-3 w-3 shrink-0" />{[wine.region, wine.country].filter(Boolean).join(', ')}</span>
                  )}
                  {wine.variety && <span>🍇 {wine.variety}</span>}
                  {wine.average_price != null && <span>{formatPrice(wine.average_price)}</span>}
                </div>
                <div className="flex items-center gap-3 mt-1.5 text-xs">
                  {wine.bottle_count > 0 && (
                    <span className="bg-green-100 text-green-800 px-1.5 py-0.5 rounded font-medium">
                      {wine.bottle_count} in cellar
                    </span>
                  )}
                  {wine.transaction_count > 0 && (
                    <span className="text-muted-foreground">{wine.transaction_count} transaction{wine.transaction_count !== 1 ? 's' : ''}</span>
                  )}
                </div>
              </div>
              {/* Actions */}
              <div className="flex flex-col gap-2 items-end justify-start shrink-0">
                <button
                  onClick={() => setQuickAddWine(wine)}
                  title="Add bottles"
                  className="h-7 w-7 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 flex items-center justify-center shadow-sm transition-colors"
                >
                  <Plus className="h-4 w-4" />
                </button>
                <Link
                  href={`/wines/new?copy_from=${wine.id}`}
                  title="Duplicate wine (new vintage / appellation)"
                  className="h-7 w-7 rounded-full border bg-card hover:bg-accent flex items-center justify-center transition-colors text-muted-foreground hover:text-foreground"
                >
                  <Copy className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {quickAddWine && profiles.length > 0 && (
        <QuickAddModal
          wine={quickAddWine}
          profiles={profiles}
          activeProfile={activeProfile}
          onClose={() => setQuickAddWine(null)}
          onSuccess={loadWines}
        />
      )}
    </div>
  );
}
