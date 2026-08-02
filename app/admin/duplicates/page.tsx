'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle, ChevronDown, ChevronUp, GitMerge, Loader2, RefreshCw, Sparkles, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Wine, WineType } from '@/types';

type WineRow = Omit<Wine, 'label_image' | 'back_image'> & { cellar_count?: number };

interface DuplicateGroup {
  wines: WineRow[];
  score: number;
}

interface VerifyResult {
  same: boolean;
  confidence: number;
  reasoning: string;
}

type GroupStatus = 'idle' | 'verifying' | 'suggesting' | 'merging';

interface GroupState {
  group: DuplicateGroup;
  keepId: string;
  status: GroupStatus;
  verifyResult?: VerifyResult;
  suggestion?: Partial<Wine>;
  editedFields?: Partial<Wine>;
  showSuggestion: boolean;
  error?: string;
  merged: boolean;
}

const WINE_TYPE_LABELS: Partial<Record<WineType, string>> = {
  red: 'Red', white: 'White', rosé: 'Rosé', sparkling: 'Sparkling',
  dessert: 'Dessert', fortified: 'Fortified', other: 'Other',
};

function WineCard({ wine, isKeep, onSelectKeep }: { wine: WineRow; isKeep: boolean; onSelectKeep: () => void }) {
  return (
    <div className={cn(
      'rounded-lg border p-3 cursor-pointer transition-colors',
      isKeep ? 'border-primary bg-primary/5' : 'hover:bg-accent',
    )} onClick={onSelectKeep}>
      <div className="flex items-start gap-2">
        <input type="radio" checked={isKeep} onChange={onSelectKeep} className="mt-0.5 accent-primary" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{wine.name}</p>
          <p className="text-xs text-muted-foreground">
            {[wine.producer, wine.vintage_year, wine.variety, wine.wine_type ? WINE_TYPE_LABELS[wine.wine_type] : undefined].filter(Boolean).join(' · ')}
          </p>
          {wine.region && <p className="text-xs text-muted-foreground">{wine.region}{wine.country ? `, ${wine.country}` : ''}</p>}
          <p className="text-xs text-muted-foreground mt-0.5">ID: {wine.id.slice(0, 8)}…</p>
        </div>
        {isKeep && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary text-primary-foreground shrink-0">Keep</span>
        )}
      </div>
    </div>
  );
}

function GroupCard({ state, onChange, onRemove }: {
  state: GroupState;
  onChange: (patch: Partial<GroupState>) => void;
  onRemove: () => void;
}) {
  const { group, keepId, status, verifyResult, suggestion, editedFields, showSuggestion, error, merged } = state;

  const handleVerify = async () => {
    onChange({ status: 'verifying', error: undefined, verifyResult: undefined });
    try {
      const res = await fetch('/api/admin/wines-gemini-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wine_ids: group.wines.map(w => w.id) }),
      });
      const data = await res.json() as VerifyResult;
      if (!res.ok) throw new Error((data as unknown as { error?: string }).error ?? 'Verification failed');
      onChange({ status: 'idle', verifyResult: data });
    } catch (err) {
      onChange({ status: 'idle', error: err instanceof Error ? err.message : 'Failed' });
    }
  };

  const handleSuggest = async () => {
    onChange({ status: 'suggesting', error: undefined });
    try {
      const res = await fetch('/api/admin/wines-gemini-merge-suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wine_ids: group.wines.map(w => w.id) }),
      });
      const data = await res.json() as { merged: Partial<Wine> };
      if (!res.ok) throw new Error((data as unknown as { error?: string }).error ?? 'Suggestion failed');
      onChange({ status: 'idle', suggestion: data.merged, editedFields: { ...data.merged }, showSuggestion: true });
    } catch (err) {
      onChange({ status: 'idle', error: err instanceof Error ? err.message : 'Failed' });
    }
  };

  const handleMerge = async () => {
    if (!keepId) return;
    const mergeIds = group.wines.map(w => w.id).filter(id => id !== keepId);
    onChange({ status: 'merging', error: undefined });
    try {
      const res = await fetch('/api/admin/wines-merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keep_id: keepId, merge_ids: mergeIds, merged_fields: editedFields }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Merge failed');
      onChange({ status: 'idle', merged: true });
    } catch (err) {
      onChange({ status: 'idle', error: err instanceof Error ? err.message : 'Merge failed' });
    }
  };

  if (merged) {
    return (
      <div className="rounded-lg border bg-green-50 dark:bg-green-900/10 p-4 flex items-center gap-3">
        <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />
        <p className="text-sm font-medium text-green-700 dark:text-green-400">
          Merged {group.wines.length} records into one.
        </p>
        <button onClick={onRemove} className="ml-auto text-xs text-muted-foreground hover:text-foreground">Dismiss</button>
      </div>
    );
  }

  const busy = status !== 'idle';

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b flex items-center gap-3 bg-muted/30">
        <span className="text-xs font-medium text-muted-foreground">
          {group.wines.length} potential duplicates · similarity {Math.round(group.score * 100)}%
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={handleVerify}
            disabled={busy}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs border hover:bg-accent disabled:opacity-40"
          >
            {status === 'verifying' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3 text-purple-600" />}
            Verify with Gemini
          </button>
        </div>
      </div>

      {/* Wine cards */}
      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {group.wines.map(w => (
          <WineCard
            key={w.id}
            wine={w}
            isKeep={w.id === keepId}
            onSelectKeep={() => onChange({ keepId: w.id })}
          />
        ))}
      </div>

      {/* Verify result */}
      {verifyResult && (
        <div className={cn(
          'mx-4 mb-3 rounded-md px-3 py-2 text-xs flex gap-2',
          verifyResult.same ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400' : 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400',
        )}>
          {verifyResult.same ? <CheckCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" /> : <XCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />}
          <span><strong>{verifyResult.same ? 'Same wine' : 'Likely different'}</strong> ({Math.round(verifyResult.confidence * 100)}% confidence) — {verifyResult.reasoning}</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="mx-4 mb-3 text-xs text-destructive bg-destructive/10 rounded px-2 py-1">{error}</p>
      )}

      {/* Actions */}
      <div className="px-4 pb-4 flex items-center gap-2 flex-wrap">
        <button
          onClick={handleSuggest}
          disabled={busy}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm hover:bg-accent disabled:opacity-40"
        >
          {status === 'suggesting' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 text-purple-600" />}
          Gemini merge suggestions
        </button>

        <button
          onClick={handleMerge}
          disabled={busy || !keepId}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-40 ml-auto"
        >
          {status === 'merging' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <GitMerge className="h-3.5 w-3.5" />}
          Merge into selected
        </button>
      </div>

      {/* Gemini suggestion editor */}
      {showSuggestion && suggestion && (
        <div className="border-t">
          <button
            onClick={() => onChange({ showSuggestion: !showSuggestion })}
            className="w-full flex items-center gap-2 px-4 py-2 text-sm font-medium hover:bg-accent text-left"
          >
            {showSuggestion ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            Gemini field suggestions (edit before merging)
          </button>
          {showSuggestion && (
            <div className="px-4 pb-4 grid grid-cols-2 gap-3">
              {(['name', 'producer', 'variety', 'region', 'country', 'description'] as const).map(field => (
                <div key={field} className={field === 'description' ? 'col-span-2' : ''}>
                  <label className="text-xs text-muted-foreground capitalize">{field}</label>
                  <input
                    className="mt-0.5 w-full px-2 py-1 text-xs border rounded bg-background"
                    value={(editedFields?.[field] as string | undefined) ?? ''}
                    onChange={e => onChange({ editedFields: { ...editedFields, [field]: e.target.value || undefined } })}
                  />
                </div>
              ))}
              <div>
                <label className="text-xs text-muted-foreground">Vintage year</label>
                <input
                  type="number"
                  className="mt-0.5 w-full px-2 py-1 text-xs border rounded bg-background"
                  value={editedFields?.vintage_year ?? ''}
                  onChange={e => onChange({ editedFields: { ...editedFields, vintage_year: e.target.value ? Number(e.target.value) : undefined } })}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Average price (USD)</label>
                <input
                  type="number"
                  className="mt-0.5 w-full px-2 py-1 text-xs border rounded bg-background"
                  value={editedFields?.average_price ?? ''}
                  onChange={e => onChange({ editedFields: { ...editedFields, average_price: e.target.value ? Number(e.target.value) : undefined } })}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function DuplicatesPage() {
  const [groupStates, setGroupStates] = useState<GroupState[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalGroups, setTotalGroups] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/wines-duplicates');
      const data = await res.json() as { groups: DuplicateGroup[]; total_groups: number };
      setTotalGroups(data.total_groups ?? 0);
      setGroupStates((data.groups ?? []).map(g => ({
        group: g,
        keepId: g.wines[0]?.id ?? '',
        status: 'idle',
        showSuggestion: false,
        merged: false,
      })));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateGroup = (i: number, patch: Partial<GroupState>) =>
    setGroupStates(prev => prev.map((s, idx) => idx === i ? { ...s, ...patch } : s));

  const removeGroup = (i: number) =>
    setGroupStates(prev => prev.filter((_, idx) => idx !== i));

  const visible = groupStates.filter(s => !s.merged || s.merged);

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/wines" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <GitMerge className="h-5 w-5 text-primary" />
            Duplicate Wine Finder
          </h2>
          <p className="text-sm text-muted-foreground">
            Fuzzy-matched potential duplicates. Verify with Gemini, then merge into one record.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Scanning for duplicates…</span>
        </div>
      ) : totalGroups === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-center space-y-2">
          <CheckCircle className="h-10 w-10 mx-auto text-green-500" />
          <p className="font-semibold">No duplicates found!</p>
          <p className="text-sm text-muted-foreground">No similar wine records were detected in your database.</p>
          <Link href="/wines" className="mt-2 inline-block text-sm text-primary hover:underline">← Back to wines</Link>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{totalGroups} potential duplicate group{totalGroups !== 1 ? 's' : ''} found</span>
            <button
              onClick={load}
              className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm hover:bg-accent"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </button>
          </div>

          <div className="space-y-4">
            {visible.map((state, i) => (
              <GroupCard
                key={state.group.wines.map(w => w.id).join('-')}
                state={state}
                onChange={patch => updateGroup(i, patch)}
                onRemove={() => removeGroup(i)}
              />
            ))}
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Select which wine record to keep (canonical), optionally verify and get Gemini suggestions, then merge.
            Inventory, pairings, and tags are moved to the kept record; duplicates are deleted.
          </p>
        </>
      )}
    </div>
  );
}
