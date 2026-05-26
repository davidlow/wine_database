'use client';

import { Plus } from 'lucide-react';
import Link from 'next/link';
import { useWineSearch } from '@/hooks/useWineSearch';
import WineCard from '@/components/WineCard';
import WineSearch from '@/components/WineSearch';

export default function WinesPage() {
  const { wines, loading, error, params, updateParam, clearParams } = useWineSearch();

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
          <p className="text-sm">No wines found.</p>
          <Link href="/wines/new" className="text-primary text-sm underline mt-2 inline-block">
            Add your first wine
          </Link>
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
