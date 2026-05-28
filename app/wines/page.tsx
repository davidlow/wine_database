'use client';

import { Suspense, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Plus, X } from 'lucide-react';
import Link from 'next/link';
import { useWineSearch } from '@/hooks/useWineSearch';
import { useProfile } from '@/hooks/useProfile';
import WineCard from '@/components/WineCard';
import WineSearch from '@/components/WineSearch';

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

  const activeProfileNames = profileIds
    ? profileIds.split(',').map(id => profiles.find(p => p.id === id)?.name ?? id)
    : [];

  const clearProfileFilter = () => {
    router.push('/wines');
  };

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

      {/* Active cellar filter */}
      {activeProfileNames.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">Showing inventory from:</span>
          {activeProfileNames.map(name => (
            <span key={name} className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-1 rounded-full font-medium">
              {name}
            </span>
          ))}
          <button
            onClick={clearProfileFilter}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-3 w-3" />
            Clear filter
          </button>
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
            {activeProfileNames.length > 0
              ? 'No wines found in the selected cellar(s).'
              : 'No wines found.'}
          </p>
          {activeProfileNames.length > 0 ? (
            <button onClick={clearProfileFilter} className="text-primary text-sm underline mt-2">
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
