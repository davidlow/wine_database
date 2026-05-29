'use client';

import { ArrowUpDown, ArrowUp, ArrowDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SortField {
  key: string;
  label: string;
  ascLabel: string;
  descLabel: string;
}

export const WINE_SORT_FIELDS: SortField[] = [
  { key: 'name',        label: 'Name',          ascLabel: 'A→Z',       descLabel: 'Z→A'       },
  { key: 'producer',    label: 'Producer',       ascLabel: 'A→Z',       descLabel: 'Z→A'       },
  { key: 'price',       label: 'Price',          ascLabel: 'Low→High',  descLabel: 'High→Low'  },
  { key: 'vintage',     label: 'Vintage',        ascLabel: 'Old→New',   descLabel: 'New→Old'   },
  { key: 'drink_from',  label: 'Drink From',     ascLabel: 'Soonest',   descLabel: 'Latest'    },
  { key: 'drink_until', label: 'Drink Until',    ascLabel: 'Soonest',   descLabel: 'Latest'    },
  { key: 'bottles',     label: 'Bottles',        ascLabel: 'Fewest',    descLabel: 'Most'      },
];

export interface SortKey {
  field: string;
  dir: 'asc' | 'desc';
}

export function parseSortString(sort?: string): SortKey[] {
  if (!sort) return [];
  return sort.split(',').map(s => {
    const [field, dir] = s.split(':');
    return { field, dir: dir === 'desc' ? 'desc' : 'asc' } as SortKey;
  }).filter(s => s.field);
}

export function serializeSortKeys(keys: SortKey[]): string | undefined {
  if (keys.length === 0) return undefined;
  return keys.map(k => `${k.field}:${k.dir}`).join(',');
}

interface Props {
  sort?: string;
  onChange: (sort: string | undefined) => void;
}

export default function WineSort({ sort, onChange }: Props) {
  const active = parseSortString(sort);
  const hasSort = active.length > 0;

  function handleFieldClick(key: string) {
    const idx = active.findIndex(s => s.field === key);
    let next: SortKey[];
    if (idx === -1) {
      next = [...active, { field: key, dir: 'asc' }];
    } else if (active[idx].dir === 'asc') {
      next = active.map((s, i) => i === idx ? { ...s, dir: 'desc' as const } : s);
    } else {
      next = active.filter((_, i) => i !== idx);
    }
    onChange(serializeSortKeys(next));
  }

  function handleRemove(key: string, e: React.MouseEvent) {
    e.stopPropagation();
    onChange(serializeSortKeys(active.filter(s => s.field !== key)));
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
          <ArrowUpDown className="h-3.5 w-3.5" />
          Sort:
        </span>

        {WINE_SORT_FIELDS.map(({ key, label, ascLabel, descLabel }) => {
          const sortEntry = active.find(s => s.field === key);
          const priority = sortEntry ? active.indexOf(sortEntry) + 1 : null;
          const isAsc = sortEntry?.dir === 'asc';

          return (
            <button
              key={key}
              onClick={() => handleFieldClick(key)}
              className={cn(
                'flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border transition-colors',
                sortEntry
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background hover:bg-accent border-input text-muted-foreground'
              )}
            >
              {priority !== null && (
                <span className="font-bold text-[10px] opacity-80">{priority}</span>
              )}
              {label}
              {sortEntry ? (
                <>
                  <span className="opacity-70 text-[10px]">{isAsc ? ascLabel : descLabel}</span>
                  {isAsc ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                  <span
                    role="button"
                    aria-label={`Remove ${label} sort`}
                    onClick={e => handleRemove(key, e)}
                    className="ml-0.5 opacity-70 hover:opacity-100"
                  >
                    <X className="h-3 w-3" />
                  </span>
                </>
              ) : null}
            </button>
          );
        })}

        {hasSort && (
          <button
            onClick={() => onChange(undefined)}
            className="text-xs text-muted-foreground hover:text-foreground underline ml-1"
          >
            Reset
          </button>
        )}
      </div>
    </div>
  );
}
