'use client';

import { Search, X } from 'lucide-react';
import { useCallback } from 'react';
import type { WineSearchParams, WineType } from '@/types';
import { cn } from '@/lib/utils';

const WINE_TYPES: WineType[] = ['red', 'white', 'rosé', 'sparkling', 'dessert', 'fortified', 'other'];

const TYPE_LABELS: Record<WineType, string> = {
  red: 'Red', white: 'White', 'rosé': 'Rosé', sparkling: 'Sparkling',
  dessert: 'Dessert', fortified: 'Fortified', other: 'Other',
};

interface Props {
  params: WineSearchParams;
  onChange: <K extends keyof WineSearchParams>(key: K, value: WineSearchParams[K]) => void;
  onClear: () => void;
}

export default function WineSearch({ params, onChange, onClear }: Props) {
  const hasFilters = Object.values(params).some((v) => v !== undefined && v !== '');

  const handleType = useCallback((type: WineType) => {
    onChange('wine_type', params.wine_type === type ? undefined : type);
  }, [params.wine_type, onChange]);

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

      {/* Additional filters row */}
      <div className="flex flex-wrap gap-2">
        <input
          type="number"
          placeholder="Vintage year"
          value={params.vintage_year ?? ''}
          onChange={(e) => onChange('vintage_year', e.target.value ? Number(e.target.value) : undefined)}
          className="w-28 px-2 py-1 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <input
          type="text"
          placeholder="Country"
          value={params.country ?? ''}
          onChange={(e) => onChange('country', e.target.value || undefined)}
          className="w-32 px-2 py-1 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <input
          type="text"
          placeholder="Region"
          value={params.region ?? ''}
          onChange={(e) => onChange('region', e.target.value || undefined)}
          className="w-32 px-2 py-1 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <input
          type="text"
          placeholder="Variety"
          value={params.variety ?? ''}
          onChange={(e) => onChange('variety', e.target.value || undefined)}
          className="w-32 px-2 py-1 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
    </div>
  );
}
