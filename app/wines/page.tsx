'use client';

import { Suspense, useEffect, useCallback, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Plus, Loader2, MapPin, X } from 'lucide-react';
import Link from 'next/link';
import { useWineSearch } from '@/hooks/useWineSearch';
import { useProfile } from '@/hooks/useProfile';
import WineCard from '@/components/WineCard';
import WineSearch from '@/components/WineSearch';
import LocationPicker from '@/components/LocationPicker';
import { cn } from '@/lib/utils';
import type { Wine, Profile } from '@/types';

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
        body: JSON.stringify({
          wine_id: wine.id,
          profile_id: profileId,
          location: location.trim(),
          quantity,
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Failed');
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add bottles');
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
            {wine.producer && <p className="text-xs text-muted-foreground truncate">{wine.producer}</p>}
          </div>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {profiles.length > 1 && (
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Cellar</label>
              <select
                className={inputCls}
                value={profileId}
                onChange={e => { setProfileId(e.target.value); setLocation(''); }}
                required
              >
                {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              Location (optional)
            </label>
            {profileId ? (
              <LocationPicker
                key={profileId}
                profileId={profileId}
                value={location}
                onChange={setLocation}
                placeholder="Select or type a location…"
                allowUnlocated
              />
            ) : (
              <input className={inputCls} disabled placeholder="Select a cellar first" />
            )}
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Quantity</label>
            <input
              type="number"
              className={inputCls}
              value={quantity}
              onChange={e => setQuantity(Math.max(1, Number(e.target.value)))}
              min={1}
              required
            />
          </div>

          {error && (
            <p className="text-xs text-destructive bg-destructive/10 rounded px-2 py-1">{error}</p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={loading || !profileId}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Add {quantity} {quantity === 1 ? 'Bottle' : 'Bottles'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-md border text-sm hover:bg-accent transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main content ───────────────────────────────────────────────────────────────
function WinesContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { profiles, activeProfile } = useProfile();
  const [quickAddWine, setQuickAddWine] = useState<Wine | null>(null);

  const profileIds = searchParams.get('profile_ids') ?? undefined;
  const { wines, loading, error, params, updateParam, clearParams, refresh } = useWineSearch({ profile_ids: profileIds });

  // Keep profile_ids in sync when it changes via URL
  useEffect(() => {
    updateParam('profile_ids', profileIds);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileIds]);

  const toggleProfile = useCallback((profileId: string) => {
    const current = new Set((profileIds ?? '').split(',').filter(Boolean));
    if (current.has(profileId)) {
      current.delete(profileId);
    } else {
      current.add(profileId);
    }
    const next = [...current].join(',');
    router.push(next ? `/wines?profile_ids=${next}` : '/wines');
  }, [profileIds, router]);

  const activeSet = new Set((profileIds ?? '').split(',').filter(Boolean));

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Wine Catalog</h2>
        <Link
          href="/wines/new"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Wine
        </Link>
      </div>

      {/* Cellar filter chips */}
      {profiles.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground shrink-0">Cellar:</span>
          <button
            onClick={() => router.push('/wines')}
            className={cn(
              'text-xs px-3 py-1 rounded-full border transition-colors',
              activeSet.size === 0
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background hover:bg-accent border-input text-muted-foreground'
            )}
          >
            All
          </button>
          {profiles.map(p => (
            <button
              key={p.id}
              onClick={() => toggleProfile(p.id)}
              className={cn(
                'text-xs px-3 py-1 rounded-full border transition-colors',
                activeSet.has(p.id)
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background hover:bg-accent border-input text-muted-foreground'
              )}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}

      <WineSearch params={params} onChange={updateParam} onClear={clearParams} />

      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 rounded-lg border bg-muted animate-pulse" />
          ))}
        </div>
      ) : wines.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-sm">
            {activeSet.size > 0
              ? 'No wines found in the selected cellar(s).'
              : 'No wines found.'}
          </p>
          {activeSet.size > 0 ? (
            <button onClick={() => router.push('/wines')} className="text-primary text-sm underline mt-2">
              Browse full catalog
            </button>
          ) : (
            <Link href="/wines/new" className="text-primary text-sm underline mt-2 inline-block">
              Add your first wine
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">{wines.length} {wines.length === 1 ? 'wine' : 'wines'}</p>
          {wines.map((wine) => (
            <WineCard
              key={wine.id}
              wine={wine}
              href={`/wines/${wine.id}`}
              onAdd={profiles.length > 0 ? () => setQuickAddWine(wine) : undefined}
            />
          ))}
        </div>
      )}

      {quickAddWine && profiles.length > 0 && (
        <QuickAddModal
          wine={quickAddWine}
          profiles={profiles}
          activeProfile={activeProfile}
          onClose={() => setQuickAddWine(null)}
          onSuccess={refresh}
        />
      )}
    </div>
  );
}

export default function WinesPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64 text-sm text-muted-foreground">Loading…</div>}>
      <WinesContent />
    </Suspense>
  );
}
