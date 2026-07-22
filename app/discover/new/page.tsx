'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useProfile } from '@/hooks/useProfile';
import { ScanSearch, Loader2, UtensilsCrossed, Wine, Store, ShoppingBag, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { VenueType } from '@/types';

const VENUE_OPTIONS: Array<{ type: VenueType; label: string; Icon: React.ComponentType<{ className?: string }> }> = [
  { type: 'restaurant', label: 'Restaurant', Icon: UtensilsCrossed },
  { type: 'winery', label: 'Winery', Icon: Wine },
  { type: 'wine_bar', label: 'Wine Bar', Icon: Store },
  { type: 'retail', label: 'Retail', Icon: ShoppingBag },
  { type: 'other', label: 'Other', Icon: MapPin },
];

export default function NewDiscoverSessionPage() {
  const router = useRouter();
  const { activeProfile } = useProfile();
  const [venueType, setVenueType] = useState<VenueType>('restaurant');
  const [venueName, setVenueName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {},
        { timeout: 5000 },
      );
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProfile) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/discovery-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile_id: activeProfile.id,
          venue_type: venueType,
          venue_name: venueName.trim() || undefined,
          gps_lat: gps?.lat,
          gps_lng: gps?.lng,
        }),
      });
      if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error ?? 'Failed');
      const session = (await res.json()) as { id: string };
      router.push(`/discover/${session.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create session');
      setSaving(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-8">
      <div className="flex items-center gap-2 mb-6">
        <ScanSearch className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-semibold">New Discovery Session</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium mb-2">Venue Type</label>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {VENUE_OPTIONS.map(({ type, label, Icon }) => (
              <button
                key={type}
                type="button"
                onClick={() => setVenueType(type)}
                className={cn(
                  'flex flex-col items-center gap-1.5 p-3 rounded-lg border text-xs font-medium transition-colors',
                  venueType === type
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:bg-accent'
                )}
              >
                <Icon className="h-5 w-5" />
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="venue-name" className="block text-sm font-medium mb-1.5">
            Venue Name <span className="text-muted-foreground font-normal">(optional)</span>
          </label>
          <input
            id="venue-name"
            type="text"
            value={venueName}
            onChange={e => setVenueName(e.target.value)}
            placeholder="e.g. Opus One, Le Bernardin"
            className="w-full border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Used to track price history across visits to the same venue.
          </p>
        </div>

        {gps && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            Location captured ({gps.lat.toFixed(4)}, {gps.lng.toFixed(4)})
          </p>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        {!activeProfile && (
          <p className="text-sm text-muted-foreground">Select a cellar profile first.</p>
        )}

        <button
          type="submit"
          disabled={saving || !activeProfile}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-md bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanSearch className="h-4 w-4" />}
          {saving ? 'Creating…' : 'Start Session'}
        </button>
      </form>
    </div>
  );
}
