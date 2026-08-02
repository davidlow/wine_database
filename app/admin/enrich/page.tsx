'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle, Loader2, RefreshCw, Sparkles, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WineType } from '@/types';

interface WineRow {
  id: string;
  name: string;
  producer?: string;
  vintage_year?: number;
  wine_type?: WineType;
  variety?: string;
  has_label_image: boolean;
  missing_fields: string[];
  acidity?: number;
  tannin?: number;
  alcohol?: number;
  sweetness?: number;
  body?: number;
  // enrichment result
  status?: 'pending' | 'enriching' | 'done' | 'error';
  filled?: string[];
  errorMsg?: string;
  confidence?: number;
}

const FIELD_LABELS: Record<string, string> = {
  acidity: 'Acidity', tannin: 'Tannin', alcohol: 'Alcohol',
  sweetness: 'Sweetness', body: 'Body',
};

export default function EnrichPage() {
  const [wines, setWines] = useState<WineRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [enriching, setEnriching] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/wines-missing-features');
      const data = await res.json();
      setWines((data.wines ?? []).map((w: WineRow) => ({ ...w, status: 'pending' })));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected(prev =>
      prev.size === wines.length ? new Set() : new Set(wines.map(w => w.id))
    );
  };

  const handleEnrich = async () => {
    const ids = [...selected];
    if (!ids.length) return;
    setEnriching(true);
    setProgress({ done: 0, total: ids.length });

    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      setWines(prev => prev.map(w => w.id === id ? { ...w, status: 'enriching' } : w));
      try {
        const res = await fetch(`/api/wines/${id}/enrich`, { method: 'POST' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Enrichment failed');
        setWines(prev => prev.map(w =>
          w.id === id
            ? { ...w, status: 'done', filled: data.filled ?? [], confidence: data.confidence, missing_fields: [] }
            : w
        ));
      } catch (err) {
        setWines(prev => prev.map(w =>
          w.id === id ? { ...w, status: 'error', errorMsg: err instanceof Error ? err.message : 'Failed' } : w
        ));
      }
      setProgress({ done: i + 1, total: ids.length });
    }

    setEnriching(false);
    setProgress(null);
    setSelected(new Set());
  };

  const pendingCount = wines.filter(w => selected.has(w.id) && w.status === 'pending').length;
  const doneCount = wines.filter(w => w.status === 'done').length;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/wines" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-600" />
            Enrich Wines with Gemini
          </h2>
          <p className="text-sm text-muted-foreground">
            Fill missing structural characteristics (acidity, tannin, body, etc.) using Gemini.
            Uses the same pipeline as the scanner.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Loading wines…</span>
        </div>
      ) : wines.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-center space-y-2">
          <CheckCircle className="h-10 w-10 mx-auto text-green-500" />
          <p className="font-semibold">All caught up!</p>
          <p className="text-sm text-muted-foreground">Every wine in the database has structural characteristics.</p>
          <Link href="/wines" className="mt-2 inline-block text-sm text-primary hover:underline">← Back to wines</Link>
        </div>
      ) : (
        <>
          {/* Toolbar */}
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={toggleAll}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              {selected.size === wines.length ? 'Deselect all' : `Select all (${wines.length})`}
            </button>
            <span className="text-muted-foreground">|</span>
            <span className="text-sm text-muted-foreground">{selected.size} selected</span>
            {doneCount > 0 && (
              <>
                <span className="text-muted-foreground">|</span>
                <span className="text-sm text-green-600">{doneCount} enriched this session</span>
              </>
            )}
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={load}
                disabled={enriching}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm hover:bg-accent disabled:opacity-40"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Refresh
              </button>
              <button
                onClick={handleEnrich}
                disabled={enriching || pendingCount === 0}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-md bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 disabled:opacity-40"
              >
                {enriching ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    {progress ? `${progress.done}/${progress.total}` : 'Enriching…'}
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5" />
                    Enrich {pendingCount > 0 ? `${pendingCount} selected` : 'selected'}
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Wine list */}
          <div className="rounded-lg border bg-card divide-y overflow-hidden">
            {wines.map(wine => (
              <div
                key={wine.id}
                className={cn(
                  'flex items-start gap-3 px-4 py-3',
                  wine.status === 'done' && 'bg-green-50 dark:bg-green-900/10',
                  wine.status === 'error' && 'bg-red-50 dark:bg-red-900/10',
                  wine.status === 'enriching' && 'bg-purple-50 dark:bg-purple-900/10',
                )}
              >
                {/* Checkbox */}
                <input
                  type="checkbox"
                  checked={selected.has(wine.id)}
                  onChange={() => toggleSelect(wine.id)}
                  disabled={enriching || wine.status === 'done'}
                  className="mt-1 h-4 w-4 shrink-0 rounded border-input accent-purple-600"
                />

                {/* Wine info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link href={`/wines/${wine.id}`} className="text-sm font-medium hover:underline truncate">
                      {wine.name}
                    </Link>
                    {wine.has_label_image && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 shrink-0">
                        has photo
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {[wine.producer, wine.vintage_year, wine.variety, wine.wine_type].filter(Boolean).join(' · ')}
                  </p>

                  {/* Missing fields chips */}
                  {wine.status === 'pending' && wine.missing_fields.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {wine.missing_fields.map(f => (
                        <span key={f} className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                          {FIELD_LABELS[f] ?? f}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Enriching indicator */}
                  {wine.status === 'enriching' && (
                    <div className="flex items-center gap-1.5 mt-1.5 text-xs text-purple-600">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Analyzing with Gemini…
                    </div>
                  )}

                  {/* Done result */}
                  {wine.status === 'done' && (
                    <div className="flex items-center gap-1.5 mt-1.5 text-xs text-green-600">
                      <CheckCircle className="h-3 w-3" />
                      {wine.filled && wine.filled.length > 0
                        ? `Filled: ${wine.filled.map(f => FIELD_LABELS[f] ?? f).join(', ')}`
                        : 'Already complete'}
                      {wine.confidence != null && (
                        <span className="text-muted-foreground">({Math.round(wine.confidence * 100)}% confidence)</span>
                      )}
                    </div>
                  )}

                  {/* Error */}
                  {wine.status === 'error' && (
                    <div className="flex items-center gap-1.5 mt-1.5 text-xs text-destructive">
                      <XCircle className="h-3 w-3" />
                      {wine.errorMsg}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Wines are enriched sequentially (one at a time) to avoid rate limits.
            Wines with a label photo use image analysis; others use text search with Gemini grounding.
          </p>
        </>
      )}
    </div>
  );
}
