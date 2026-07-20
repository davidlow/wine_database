'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { UtensilsCrossed, Search, X, Loader2, Settings2, Wine as WineIcon, AlertCircle } from 'lucide-react';
import { useProfile } from '@/hooks/useProfile';
import type { Wine } from '@/types';
import { cn, wineTypeLabel, wineTypeColor, wineTypeBorderColor, formatPrice } from '@/lib/utils';
import type { PairingSettings } from '@/lib/wine-pairing';
import type { RecommendationGroup } from '@/lib/wine-pairing';

const LS_SETTINGS_KEY = 'wine_pairing_settings';

function loadSettings(): PairingSettings {
  if (typeof window === 'undefined') return {};
  try {
    const s = localStorage.getItem(LS_SETTINGS_KEY);
    return s ? (JSON.parse(s) as PairingSettings) : {};
  } catch { return {}; }
}

export default function FoodPairingsPage() {
  const { activeProfile, profiles } = useProfile();
  const [allFoods, setAllFoods] = useState<string[]>([]);
  const [foodQuery, setFoodQuery] = useState('');
  const [selectedFoods, setSelectedFoods] = useState<string[]>([]);
  const [groups, setGroups] = useState<(RecommendationGroup & { wines: Array<Wine & { distance: number }> })[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seedCount, setSeedCount] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/foods')
      .then(r => r.ok ? r.json() : [])
      .then(setAllFoods)
      .catch(() => {});
  }, []);

  const filteredFoods = foodQuery.trim()
    ? allFoods.filter(f => f.toLowerCase().includes(foodQuery.toLowerCase()) && !selectedFoods.includes(f))
    : allFoods.filter(f => !selectedFoods.includes(f)).slice(0, 30);

  const toggleFood = (food: string) => {
    setSelectedFoods(prev =>
      prev.includes(food) ? prev.filter(f => f !== food) : [...prev, food]
    );
  };

  const recommend = useCallback(async () => {
    if (selectedFoods.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const profileIds = activeProfile
        ? [activeProfile.id]
        : profiles.map(p => p.id);

      const settings = loadSettings();

      const res = await fetch('/api/food-pairings/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ foods: selectedFoods, profile_ids: profileIds, settings }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Recommendation failed');
      setGroups(data.groups ?? []);
      setSeedCount(data.seed_count ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get recommendations');
    } finally {
      setLoading(false);
    }
  }, [selectedFoods, activeProfile, profiles]);

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <UtensilsCrossed className="h-5 w-5 text-primary" />
            Food Pairings
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Select dishes to find wines from your cellar that pair well.
          </p>
        </div>
        <Link href="/food-pairings/settings" className="p-2 rounded-md hover:bg-accent transition-colors text-muted-foreground hover:text-foreground" title="Settings">
          <Settings2 className="h-4 w-4" />
        </Link>
      </div>

      {/* Food search and selection */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            type="search"
            placeholder="Search foods…"
            value={foodQuery}
            onChange={e => setFoodQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Selected foods */}
        {selectedFoods.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selectedFoods.map(food => (
              <button
                key={food}
                onClick={() => toggleFood(food)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                {food}
                <X className="h-3 w-3" />
              </button>
            ))}
            <button
              onClick={() => setSelectedFoods([])}
              className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-accent transition-colors"
            >
              Clear all
            </button>
          </div>
        )}

        {/* Food chips */}
        {allFoods.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No food pairings saved yet. Add pairings on wine detail pages to get recommendations here.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {filteredFoods.map(food => (
              <button
                key={food}
                onClick={() => toggleFood(food)}
                className="text-xs px-2.5 py-1 rounded-full border bg-background hover:bg-accent transition-colors text-muted-foreground border-input"
              >
                {food}
              </button>
            ))}
            {filteredFoods.length === 0 && foodQuery && (
              <button
                onClick={() => { toggleFood(foodQuery.trim()); setFoodQuery(''); }}
                className="text-xs px-2.5 py-1 rounded-full border border-dashed hover:bg-accent transition-colors text-muted-foreground"
              >
                + Add &ldquo;{foodQuery.trim()}&rdquo;
              </button>
            )}
          </div>
        )}
      </div>

      {/* Recommend button */}
      <button
        onClick={recommend}
        disabled={selectedFoods.length === 0 || loading}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <WineIcon className="h-4 w-4" />}
        {loading ? 'Finding wines…' : 'Find Matching Wines'}
      </button>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-destructive/10 border border-destructive/20 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* No structural data warning */}
      {!loading && seedCount === 0 && selectedFoods.length > 0 && !error && (
        <div className="rounded-md border bg-amber-50 px-3 py-2 text-sm text-amber-800">
          No wines found that pair with the selected foods. Make sure wines in your cellar have food pairings assigned on their detail pages.
        </div>
      )}

      {/* Recommendation groups */}
      {groups.length > 0 && (
        <div className="space-y-6">
          <p className="text-xs text-muted-foreground">
            Found {groups.reduce((s, g) => s + g.wines.length, 0)} suggestions across {groups.length} style group{groups.length !== 1 ? 's' : ''},
            based on {seedCount} wine{seedCount !== 1 ? 's' : ''} matching your food selection.
          </p>
          {groups.map((group, gi) => (
            <div key={gi} className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-2">
                  Style {gi + 1}
                </span>
                <div className="h-px flex-1 bg-border" />
              </div>
              {/* Centroid scores mini-bar */}
              <div className="flex gap-2 text-[10px] text-muted-foreground flex-wrap">
                {(['Acid', 'Tannin', 'Alc', 'Sweet', 'Body', 'Mineral', 'Oak', 'Fruit'] as const).map((label, i) => (
                  <div key={label} className="flex flex-col items-center gap-0.5 min-w-0">
                    <span>{label}</span>
                    <div className="w-7 h-1 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary/60 rounded-full" style={{ width: `${(group.centroid[i] / 5) * 100}%` }} />
                    </div>
                    <span className="font-medium">{group.centroid[i].toFixed(1)}</span>
                  </div>
                ))}
              </div>
              {/* Wine cards */}
              <div className="space-y-2">
                {group.wines.map((wine) => (
                  <Link key={wine.id} href={`/wines/${wine.id}`} className="block">
                    <div className="flex gap-3 rounded-lg border bg-card p-3 hover:shadow-md transition-shadow">
                      {wine.label_image ? (
                        <div className={cn('h-14 w-10 shrink-0 overflow-hidden rounded ring-2', wineTypeBorderColor(wine.wine_type))}>
                          <img src={`data:image/webp;base64,${wine.label_image}`} alt={wine.name} className="h-full w-full object-cover" />
                        </div>
                      ) : (
                        <div className={cn('h-14 w-10 shrink-0 rounded flex items-center justify-center bg-muted ring-2', wineTypeBorderColor(wine.wine_type))}>
                          <WineIcon className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm leading-snug line-clamp-1">{wine.name}</p>
                        {wine.producer && <p className="text-xs text-muted-foreground truncate">{wine.producer}</p>}
                        <div className="flex items-center gap-2 mt-1">
                          {wine.wine_type && (
                            <span className={cn('text-xs px-1.5 py-0.5 rounded-full font-medium', wineTypeColor(wine.wine_type))}>
                              {wineTypeLabel(wine.wine_type)}
                            </span>
                          )}
                          {wine.vintage_year && <span className="text-xs text-muted-foreground">{wine.vintage_year}</span>}
                          {wine.average_price != null && <span className="text-xs text-muted-foreground">{formatPrice(wine.average_price)}</span>}
                        </div>
                      </div>
                      <div className="shrink-0 text-right text-xs text-muted-foreground">
                        <span className="text-[10px]">match</span>
                        <p className="font-semibold text-sm">{(Math.max(0, 1 - wine.distance / 14.14) * 100).toFixed(0)}%</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
