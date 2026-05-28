'use client';

import { Suspense, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { useWineSearch } from '@/hooks/useWineSearch';
import { useProfile } from '@/hooks/useProfile';
import WineCard from '@/components/WineCard';
import WineSearch from '@/components/WineSearch';
import { cn } from '@/lib/utils';

function WinesContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { profiles } = useProfile();

  const profileIds = searchParams.get('profile_ids') ?? undefined;
  const { wines, loading, error, params, updateParam, clearParams } = useWineSearch({ profile_ids: profileIds });

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

      {/* Cellar filter chips — always visible when profiles exist */}
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
            <WineCard key={wine.id} wine={wine} href={`/wines/${wine.id}`} />
          ))}
        </div>
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
