'use client';

import { Search, X, ChevronDown, ChevronUp, SlidersHorizontal } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import type { WineSearchParams, WineType, DrinkStatusFilter } from '@/types';
import { cn } from '@/lib/utils';
import SearchSuggest from '@/components/SearchSuggest';

const WINE_TYPES: WineType[] = ['red', 'white', 'rosé', 'sparkling', 'dessert', 'fortified', 'other'];

const TYPE_LABELS: Record<WineType, string> = {
  red: 'Red', white: 'White', 'rosé': 'Rosé', sparkling: 'Sparkling',
  dessert: 'Dessert', fortified: 'Fortified', other: 'Other',
};

const DRINK_STATUS_OPTIONS: { value: DrinkStatusFilter; label: string; cls: string; activeClass: string }[] = [
  { value: 'past_peak', label: 'Past Peak', cls: 'border-red-200 text-red-700 hover:bg-red-50', activeClass: 'bg-red-100 border-red-400 text-red-800' },
  { value: 'too_young', label: 'Too Young', cls: 'border-blue-200 text-blue-700 hover:bg-blue-50', activeClass: 'bg-blue-100 border-blue-400 text-blue-800' },
  { value: 'in_window', label: 'In Window', cls: 'border-green-200 text-green-700 hover:bg-green-50', activeClass: 'bg-green-100 border-green-400 text-green-800' },
];

interface Props {
  params: WineSearchParams;
  onChange: <K extends keyof WineSearchParams>(key: K, value: WineSearchParams[K]) => void;
  onClear: () => void;
}

const filterInputCls = 'w-full px-2 py-1 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring';

export default function WineSearch({ params, onChange, onClear }: Props) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [regionSuggestions, setRegionSuggestions] = useState<string[]>([]);

  const hasFilters = Object.values(params).some((v) => v !== undefined && v !== '');
  const hasAdvancedFilters = !!(
    params.price_min != null || params.price_max != null ||
    params.regions || params.appellation || params.vintage_year ||
    params.country || params.variety ||
    params.acidity_min != null || params.acidity_max != null ||
    params.tannin_min != null || params.tannin_max != null ||
    params.sweetness_min != null || params.sweetness_max != null ||
    params.body_min != null || params.body_max != null ||
    params.alcohol_str_min != null || params.alcohol_str_max != null
  );

  useEffect(() => {
    if (!showAdvanced) return;
    fetch('/api/wines/facets?field=region&q=')
      .then(r => r.ok ? r.json() : [])
      .then(setRegionSuggestions)
      .catch(() => {});
  }, [showAdvanced]);

  const handleType = useCallback((type: WineType) => {
    onChange('wine_type', params.wine_type === type ? undefined : type);
  }, [params.wine_type, onChange]);

  const handleDrinkStatus = useCallback((status: DrinkStatusFilter) => {
    onChange('drink_status', params.drink_status === status ? undefined : status);
  }, [params.drink_status, onChange]);

  const toggleRegion = useCallback((region: string) => {
    const current = new Set((params.regions ?? '').split(',').filter(Boolean));
    if (current.has(region)) { current.delete(region); } else { current.add(region); }
    const next = [...current].join(',');
    onChange('regions', next || undefined);
  }, [params.regions, onChange]);

  const activeRegions = new Set((params.regions ?? '').split(',').filter(Boolean));

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <input
          type="search"
          placeholder="Search name, producer, region, barcode…"
          value={params.query ?? ''}
          onChange={(e) => onChange('query', e.target.value || undefined)}
          className="w-full pl-9 pr-10 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        />
        {hasFilters && (
          <button
            onClick={onClear}
            aria-label="Clear filters"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Type filter chips */}
      <div className="flex flex-wrap gap-2">
        {WINE_TYPES.map((type) => (
          <button
            key={type}
            onClick={() => handleType(type)}
            className={cn(
              'text-xs px-3 py-1 rounded-full border transition-colors',
              params.wine_type === type
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background hover:bg-accent border-input'
            )}
          >
            {TYPE_LABELS[type]}
          </button>
        ))}
      </div>

      {/* Drink status filter chips */}
      <div className="flex flex-wrap gap-2">
        {DRINK_STATUS_OPTIONS.map(({ value, label, cls, activeClass }) => (
          <button
            key={value}
            onClick={() => handleDrinkStatus(value)}
            className={cn(
              'text-xs px-3 py-1 rounded-full border transition-colors',
              params.drink_status === value ? activeClass : cls
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Advanced filters toggle */}
      <button
        onClick={() => setShowAdvanced(v => !v)}
        className={cn(
          'flex items-center gap-1.5 text-xs transition-colors',
          (showAdvanced || hasAdvancedFilters)
            ? 'text-primary font-medium'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        <SlidersHorizontal className="h-3.5 w-3.5" />
        Advanced Filters
        {hasAdvancedFilters && !showAdvanced && (
          <span className="ml-1 text-[10px] bg-primary text-primary-foreground rounded-full px-1.5 py-0.5">active</span>
        )}
        {showAdvanced ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>

      {showAdvanced && (
        <div className="rounded-lg border bg-muted/30 p-3 space-y-4">
          {/* Price range */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Price Range ($)</p>
            <div className="flex items-center gap-2">
              <input
                type="number"
                placeholder="Min"
                value={params.price_min ?? ''}
                onChange={(e) => onChange('price_min', e.target.value ? Number(e.target.value) : undefined)}
                className="w-24 px-2 py-1 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                min={0}
              />
              <span className="text-xs text-muted-foreground">–</span>
              <input
                type="number"
                placeholder="Max"
                value={params.price_max ?? ''}
                onChange={(e) => onChange('price_max', e.target.value ? Number(e.target.value) : undefined)}
                className="w-24 px-2 py-1 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                min={0}
              />
            </div>
          </div>

          {/* Vintage year */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Vintage Year</p>
            <input
              type="number"
              placeholder="e.g. 2019"
              value={params.vintage_year ?? ''}
              onChange={(e) => onChange('vintage_year', e.target.value ? Number(e.target.value) : undefined)}
              className="w-28 px-2 py-1 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Variety — partial match */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">
              Variety <span className="font-normal">(partial: &ldquo;cab&rdquo; finds all Cabernets)</span>
            </p>
            <SearchSuggest
              field="variety"
              value={params.variety ?? ''}
              onChange={(v) => onChange('variety', v || undefined)}
              placeholder="e.g. Cab, Chardonnay…"
              className="w-full"
              inputClassName={filterInputCls}
            />
          </div>

          {/* Country */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Country</p>
            <SearchSuggest
              field="country"
              value={params.country ?? ''}
              onChange={(v) => onChange('country', v || undefined)}
              placeholder="Country"
              className="w-full"
              inputClassName={filterInputCls}
            />
          </div>

          {/* Region multi-select chips */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">
              Regions
              {activeRegions.size > 0 && (
                <button
                  onClick={() => onChange('regions', undefined)}
                  className="ml-2 text-destructive hover:underline font-normal"
                >
                  Clear
                </button>
              )}
            </p>
            {regionSuggestions.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {regionSuggestions.slice(0, 20).map(r => (
                  <button
                    key={r}
                    onClick={() => toggleRegion(r)}
                    className={cn(
                      'text-xs px-2.5 py-0.5 rounded-full border transition-colors',
                      activeRegions.has(r)
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background hover:bg-accent border-input text-muted-foreground'
                    )}
                  >
                    {r}
                  </button>
                ))}
              </div>
            )}
            <SearchSuggest
              field="region"
              value={params.region ?? ''}
              onChange={(v) => onChange('region', v || undefined)}
              placeholder="Or type exact region…"
              className="w-full"
              inputClassName={filterInputCls}
            />
          </div>

          {/* Appellation */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Appellation</p>
            <SearchSuggest
              field="appellation"
              value={params.appellation ?? ''}
              onChange={(v) => onChange('appellation', v || undefined)}
              placeholder="e.g. Napa Valley, Bordeaux…"
              className="w-full"
              inputClassName={filterInputCls}
            />
          </div>

          {/* Structural score ranges */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Structural Profile <span className="font-normal">(0–5 range)</span></p>
            <div className="grid grid-cols-1 gap-2">
              {([
                { label: 'Acidity', minKey: 'acidity_min', maxKey: 'acidity_max' },
                { label: 'Tannin', minKey: 'tannin_min', maxKey: 'tannin_max' },
                { label: 'Sweetness', minKey: 'sweetness_min', maxKey: 'sweetness_max' },
                { label: 'Body', minKey: 'body_min', maxKey: 'body_max' },
                { label: 'Alcohol', minKey: 'alcohol_str_min', maxKey: 'alcohol_str_max' },
              ] as const).map(({ label, minKey, maxKey }) => (
                <div key={label} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-16 shrink-0">{label}</span>
                  <input
                    type="number" min={0} max={5} step={1}
                    placeholder="min"
                    value={params[minKey] ?? ''}
                    onChange={(e) => onChange(minKey, e.target.value ? Math.max(0, Math.min(5, Number(e.target.value))) : undefined)}
                    className="w-14 px-2 py-1 text-xs border rounded bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <span className="text-xs text-muted-foreground">–</span>
                  <input
                    type="number" min={0} max={5} step={1}
                    placeholder="max"
                    value={params[maxKey] ?? ''}
                    onChange={(e) => onChange(maxKey, e.target.value ? Math.max(0, Math.min(5, Number(e.target.value))) : undefined)}
                    className="w-14 px-2 py-1 text-xs border rounded bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
