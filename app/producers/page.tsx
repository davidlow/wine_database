'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { Search, ArrowUpDown } from 'lucide-react';
import type { ProducerStats } from '@/types';

export type ProducerSortKey =
  | 'transactions_desc'
  | 'transactions_asc'
  | 'bottles_desc'
  | 'bottles_asc'
  | 'wines_desc'
  | 'wines_asc'
  | 'name_asc'
  | 'name_desc';

export const PRODUCER_SORT_OPTIONS: { value: ProducerSortKey; label: string }[] = [
  { value: 'transactions_desc', label: 'Most Transactions' },
  { value: 'transactions_asc', label: 'Fewest Transactions' },
  { value: 'bottles_desc', label: 'Most Bottles in Cellar' },
  { value: 'bottles_asc', label: 'Fewest Bottles in Cellar' },
  { value: 'wines_desc', label: 'Most Distinct Wines' },
  { value: 'wines_asc', label: 'Fewest Distinct Wines' },
  { value: 'name_asc', label: 'Name A → Z' },
  { value: 'name_desc', label: 'Name Z → A' },
];

export function sortProducers(producers: ProducerStats[], sortBy: ProducerSortKey): ProducerStats[] {
  return [...producers].sort((a, b) => {
    switch (sortBy) {
      case 'transactions_desc': return b.transaction_count - a.transaction_count;
      case 'transactions_asc':  return a.transaction_count - b.transaction_count;
      case 'bottles_desc':      return b.bottle_count - a.bottle_count;
      case 'bottles_asc':       return a.bottle_count - b.bottle_count;
      case 'wines_desc':        return b.wine_count - a.wine_count;
      case 'wines_asc':         return a.wine_count - b.wine_count;
      case 'name_asc':          return a.producer.localeCompare(b.producer);
      case 'name_desc':         return b.producer.localeCompare(a.producer);
    }
  });
}

function ProducersContent() {
  const [producers, setProducers] = useState<ProducerStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState<ProducerSortKey>('transactions_desc');

  useEffect(() => {
    fetch('/api/producers')
      .then(r => r.ok ? r.json() : [])
      .then(setProducers)
      .finally(() => setLoading(false));
  }, []);

  const filtered = producers.filter(p =>
    !query || p.producer.toLowerCase().includes(query.toLowerCase())
  );
  const sorted = sortProducers(filtered, sortBy);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      <h2 className="text-xl font-bold">Producers</h2>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            type="search"
            placeholder="Search producers…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="relative">
          <ArrowUpDown className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as ProducerSortKey)}
            className="pl-8 pr-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring appearance-none cursor-pointer"
          >
            {PRODUCER_SORT_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <div key={i} className="h-16 rounded-lg border bg-muted animate-pulse" />)}
        </div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-10 text-sm text-muted-foreground">
          {query ? 'No producers match your search.' : 'No producers found.'}
        </div>
      ) : (
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground">{sorted.length} producer{sorted.length !== 1 ? 's' : ''}</p>
          {sorted.map(p => (
            <Link
              key={p.producer}
              href={`/producers/${encodeURIComponent(p.producer)}`}
              className="flex items-center justify-between rounded-lg border bg-card px-4 py-3 hover:shadow-sm hover:border-primary/30 transition-all"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{p.producer}</p>
                <p className="text-xs text-muted-foreground">
                  {p.wine_count} {p.wine_count === 1 ? 'wine' : 'wines'}
                  {p.bottle_count > 0 ? ` · ${p.bottle_count} in cellar` : ''}
                </p>
              </div>
              <div className="text-right ml-4 shrink-0">
                <p className="text-sm font-semibold">{p.transaction_count}</p>
                <p className="text-xs text-muted-foreground">transactions</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ProducersPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64 text-sm text-muted-foreground">Loading…</div>}>
      <ProducersContent />
    </Suspense>
  );
}
