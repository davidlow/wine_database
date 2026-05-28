'use client';

import { Suspense, use, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Edit2, MapPin, Wine } from 'lucide-react';
import type { CellarInventory, Location } from '@/types';
import { cn, drinkWindowStatus, drinkWindowBadge } from '@/lib/utils';

function CapacityBar({ used, max }: { used: number; max: number }) {
  const pct = Math.min(100, Math.round((used / max) * 100));
  const avail = max - used;
  const color = avail === 0 ? 'bg-red-400' : avail <= 2 ? 'bg-amber-400' : 'bg-green-400';
  const textColor = avail === 0 ? 'text-red-600' : avail <= 2 ? 'text-amber-600' : 'text-green-700';
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className={cn('text-sm font-medium tabular-nums shrink-0', textColor)}>
        {used}/{max} ({avail} free)
      </span>
    </div>
  );
}

function LocationPageContent({ profileId }: { profileId: string }) {
  const searchParams = useSearchParams();
  const locationName = searchParams.get('name') ?? '';

  const [allInventory, setAllInventory] = useState<CellarInventory[]>([]);
  const [location, setLocation] = useState<Location | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!locationName) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/cellar?profile_id=${profileId}`).then(r => r.ok ? r.json() : []),
      fetch(`/api/locations?profile_id=${profileId}`).then(r => r.ok ? r.json() : []),
    ]).then(([inv, locs]: [CellarInventory[], Location[]]) => {
      setAllInventory(inv);
      setLocation(locs.find(l => l.name === locationName) ?? null);
    }).finally(() => setLoading(false));
  }, [profileId, locationName]);

  if (!locationName) {
    return <p className="px-4 py-6 text-sm text-muted-foreground">No location specified.</p>;
  }

  // Filter inventory to this location
  const items = allInventory.filter(i => i.location === locationName);
  const totalBottles = items.reduce((s, i) => s + i.quantity, 0);

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-sm text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href={`/profiles/${profileId}`} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary shrink-0" />
            <h2 className="text-xl font-bold truncate">{locationName}</h2>
          </div>
          {location?.group_name && (
            <p className="text-sm text-muted-foreground">in {location.group_name}</p>
          )}
        </div>
        <Link
          href={`/profiles/${profileId}?tab=locations`}
          className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          title="Manage location"
        >
          <Edit2 className="h-4 w-4" />
        </Link>
      </div>

      {/* Capacity info (only if location is registered) */}
      {location?.max_capacity != null && (
        <div className="rounded-lg border bg-card px-4 py-4 space-y-3">
          <p className="text-sm font-medium text-muted-foreground">Capacity</p>
          <CapacityBar used={totalBottles} max={location.max_capacity} />
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border bg-card px-4 py-3 text-center">
          <p className="text-2xl font-bold">{totalBottles}</p>
          <p className="text-xs text-muted-foreground">Bottles Here</p>
        </div>
        <div className="rounded-lg border bg-card px-4 py-3 text-center">
          <p className="text-2xl font-bold">{new Set(items.map(i => i.wine_id)).size}</p>
          <p className="text-xs text-muted-foreground">Unique Wines</p>
        </div>
      </div>

      {/* Wine list */}
      {items.length === 0 ? (
        <div className="text-center py-12 space-y-2">
          <Wine className="h-10 w-10 mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No bottles at this location.</p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Wines stored here</p>
          {items.map(item => {
            const wine = item.wine;
            const status = drinkWindowStatus(wine?.drink_from_year, wine?.drink_by_year);
            const badge = drinkWindowBadge(status);
            return (
              <Link
                key={item.id}
                href={`/wines/${item.wine_id}`}
                className="flex items-center justify-between rounded-lg border bg-card px-4 py-3 hover:bg-accent/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-sm truncate">{wine?.name ?? 'Unknown Wine'}</p>
                    {badge && (
                      <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0', badge.cls)}>
                        {badge.label}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-3 mt-0.5 text-xs text-muted-foreground flex-wrap">
                    {wine?.producer && <span>{wine.producer}</span>}
                    {wine?.vintage_year && <span>{wine.vintage_year}</span>}
                    {wine?.wine_type && <span className="capitalize">{wine.wine_type}</span>}
                    {wine?.variety && <span>🍇 {wine.variety}</span>}
                  </div>
                </div>
                <span className="text-sm font-semibold ml-3 shrink-0">{item.quantity} btl</span>
              </Link>
            );
          })}
        </div>
      )}

      {/* Not registered notice */}
      {!location && items.length > 0 && (
        <div className="rounded-md bg-muted/60 border px-4 py-3 text-sm text-muted-foreground">
          This location is not yet registered in your cellar. Go to the{' '}
          <Link href={`/profiles/${profileId}`} className="text-primary hover:underline">
            Locations tab
          </Link>
          {' '}to add capacity tracking and grouping.
        </div>
      )}
    </div>
  );
}

export default function LocationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64 text-sm text-muted-foreground">Loading…</div>}>
      <LocationPageContent profileId={id} />
    </Suspense>
  );
}
