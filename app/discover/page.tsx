'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useProfile } from '@/hooks/useProfile';
import { ScanSearch, Plus, Wine, UtensilsCrossed, Store, ShoppingBag, MapPin, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WineDiscoverySession, VenueType } from '@/types';

const VENUE_ICONS: Record<VenueType, React.ComponentType<{ className?: string }>> = {
  restaurant: UtensilsCrossed,
  winery: Wine,
  wine_bar: Store,
  retail: ShoppingBag,
  other: MapPin,
};

const VENUE_LABELS: Record<VenueType, string> = {
  restaurant: 'Restaurant',
  winery: 'Winery',
  wine_bar: 'Wine Bar',
  retail: 'Retail',
  other: 'Other',
};

const VENUE_COLORS: Record<VenueType, string> = {
  restaurant: 'text-orange-600 bg-orange-50 dark:text-orange-400 dark:bg-orange-900/20',
  winery: 'text-purple-600 bg-purple-50 dark:text-purple-400 dark:bg-purple-900/20',
  wine_bar: 'text-rose-600 bg-rose-50 dark:text-rose-400 dark:bg-rose-900/20',
  retail: 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/20',
  other: 'text-gray-600 bg-gray-50 dark:text-gray-400 dark:bg-gray-900/20',
};

type SessionWithCount = WineDiscoverySession & { wine_count?: number };

export default function DiscoverPage() {
  const { activeProfile } = useProfile();
  const [sessions, setSessions] = useState<SessionWithCount[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeProfile) return;
    setLoading(true);
    setError(null);
    fetch(`/api/discovery-sessions?profile_id=${activeProfile.id}`)
      .then(r => r.ok ? r.json() as Promise<SessionWithCount[]> : Promise.reject(r.statusText))
      .then(setSessions)
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, [activeProfile]);

  const formatDate = (session: WineDiscoverySession) => {
    const code = session.session_code;
    // YYYY-MM-DD_HHmm
    const [datePart, timePart] = code.split('_');
    if (!datePart) return code;
    const date = new Date(datePart + 'T00:00:00');
    const dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    if (!timePart) return dateStr;
    const h = parseInt(timePart.slice(0, 2), 10);
    const m = timePart.slice(2, 4);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${dateStr} · ${h12}:${m} ${ampm}`;
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <ScanSearch className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-semibold">Wine Discovery</h1>
        </div>
        <Link
          href="/discover/new"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Session
        </Link>
      </div>

      {!activeProfile && (
        <p className="text-sm text-muted-foreground text-center py-12">
          Select a cellar profile to see your discovery sessions.
        </p>
      )}

      {activeProfile && loading && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {activeProfile && error && (
        <p className="text-sm text-destructive text-center py-8">{error}</p>
      )}

      {activeProfile && !loading && sessions.length === 0 && !error && (
        <div className="text-center py-16 space-y-3">
          <ScanSearch className="h-10 w-10 mx-auto text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No discovery sessions yet.</p>
          <p className="text-xs text-muted-foreground">
            Start a session at a restaurant or winery to scan wines and check your cellar.
          </p>
          <Link
            href="/discover/new"
            className="inline-flex items-center gap-1.5 mt-2 px-4 py-2 rounded-md border text-sm hover:bg-accent transition-colors"
          >
            <Plus className="h-4 w-4" />
            New Session
          </Link>
        </div>
      )}

      {sessions.length > 0 && (
        <div className="space-y-3">
          {sessions.map(session => {
            const venueType = (session.venue_type as VenueType | undefined) ?? 'other';
            const Icon = VENUE_ICONS[venueType];
            return (
              <Link
                key={session.id}
                href={`/discover/${session.id}`}
                className="block rounded-lg border bg-card hover:bg-accent/40 transition-colors p-4"
              >
                <div className="flex items-start gap-3">
                  <span className={cn('flex items-center justify-center w-8 h-8 rounded-full shrink-0', VENUE_COLORS[venueType])}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm truncate">
                        {session.venue_name ?? session.session_code}
                      </span>
                      {session.venue_type && (
                        <span className={cn('text-xs px-1.5 py-0.5 rounded-full font-medium', VENUE_COLORS[venueType])}>
                          {VENUE_LABELS[venueType]}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-muted-foreground">{formatDate(session)}</span>
                      {session.venue_name && (
                        <span className="text-xs text-muted-foreground font-mono">{session.session_code}</span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
