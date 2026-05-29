'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import type { ProducerStats } from '@/types';

function ProducersContent() {
  const [producers, setProducers] = useState<ProducerStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    fetch('/api/producers')
      .then(r => r.ok ? r.json() : [])
      .then(setProducers)
      .finally(() => setLoading(false));
  }, []);

  const filtered = producers.filter(p =>
    !query || p.producer.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      <h2 className="text-xl font-bold">Producers</h2>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <input
          type="search"
          placeholder="Search producers…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="w-full pl-9 pr-4 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <div key={i} className="h-16 rounded-lg border bg-muted animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-10 text-sm text-muted-foreground">
          {query ? 'No producers match your search.' : 'No producers found.'}
        </div>
      ) : (
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground">{filtered.length} producer{filtered.length !== 1 ? 's' : ''}</p>
          {filtered.map(p => (
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
