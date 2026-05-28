'use client';

import { Search, X } from 'lucide-react';
import { useCallback } from 'react';
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
  const hasFilters = Object.values(params).some((v) => v !== undefined && v !== '');

  const handleType = useCallback((type: WineType) => {
    onChange('wine_type', params.wine_type === type ? undefined : type);
  }, [params.wine_type, onChange]);

  const handleDrinkStatus = useCallback((status: DrinkStatusFilter) => {
    onChange('drink_status', params.drink_status === status ? undefined : status);
  }, [params.drink_status, onChange]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <input
          type="search"
          placeholder="Search wines by name, producer, region…"
          value={params.query ?? ''}
          onChange={(e) => onChange('query', e.target.value || undefined)}
          className="w-full pl-9 pr-4 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
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

      {/* Additional filters row */}
      <div className="flex flex-wrap gap-2">
        <input
          type="number"
          placeholder="Vintage year"
          value={params.vintage_year ?? ''}
          onChange={(e) => onChange('vintage_year', e.target.value ? Number(e.target.value) : undefined)}
          className="w-28 px-2 py-1 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <SearchSuggest
          field="country"
          value={params.country ?? ''}
          onChange={(v) => onChange('country', v || undefined)}
          placeholder="Country"
          className="w-32"
          inputClassName={filterInputCls}
        />
        <SearchSuggest
          field="region"
          value={params.region ?? ''}
          onChange={(v) => onChange('region', v || undefined)}
          placeholder="Region"
          className="w-32"
          inputClassName={filterInputCls}
        />
        <SearchSuggest
          field="variety"
          value={params.variety ?? ''}
          onChange={(v) => onChange('variety', v || undefined)}
          placeholder="Variety"
          className="w-32"
          inputClassName={filterInputCls}
        />
      </div>
    </div>
  );
}
