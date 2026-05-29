'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Camera, Upload, Loader2, CheckCircle, AlertCircle, X,
  Search, Plus, ChevronDown
} from 'lucide-react';
import { useProfile } from '@/hooks/useProfile';
import LocationPicker from '@/components/LocationPicker';
import { cn, formatPrice } from '@/lib/utils';
import type { ScannedWineItem, Wine, Profile } from '@/types';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ReviewItem extends ScannedWineItem {
  key: string;            // stable identity for list operations
  skip: boolean;
  review_quantity: number;
  review_price?: number;
  matched_wine: Wine | null;  // null = create new
  is_new: boolean;            // true = no match chosen; create wine from Gemini data
  match_loading: boolean;
  match_query: string;
  match_results: Wine[];
  show_match_dropdown: boolean;
}

type Phase = 'idle' | 'analyzing' | 'reviewing' | 'adding' | 'done' | 'error';

// ── Wine match search ─────────────────────────────────────────────────────────

function useWineSearch() {
  const [results, setResults] = useState<Wine[]>([]);
  const [loading, setLoading] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout>>();

  const search = useCallback((q: string) => {
    clearTimeout(debounce.current);
    if (!q.trim()) { setResults([]); return; }
    debounce.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/wines?query=${encodeURIComponent(q)}&sort=name:asc`);
        if (res.ok) setResults(await res.json());
      } finally { setLoading(false); }
    }, 300);
  }, []);

  return { results, loading, search, setResults };
}

// ── Review card ────────────────────────────────────────────────────────────────

function ReviewCard({
  item,
  index,
  onUpdate,
}: {
  item: ReviewItem;
  index: number;
  onUpdate: (key: string, patch: Partial<ReviewItem>) => void;
}) {
  const { results, loading, search, setResults } = useWineSearch();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onUpdate(item.key, { show_match_dropdown: false });
      }
    }
    if (item.show_match_dropdown) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [item.show_match_dropdown, item.key, onUpdate]);

  const confidenceColor = (item.confidence ?? 1) >= 0.8
    ? 'text-green-600'
    : (item.confidence ?? 1) >= 0.5 ? 'text-amber-600' : 'text-red-500';

  return (
    <div className={cn(
      'rounded-lg border bg-card p-4 space-y-3 transition-opacity',
      item.skip && 'opacity-40'
    )}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-muted-foreground">#{index + 1}</span>
            <p className="font-semibold text-sm truncate">{item.name}</p>
            {item.confidence != null && (
              <span className={cn('text-xs', confidenceColor)}>
                {Math.round(item.confidence * 100)}% confident
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {[item.producer, item.vintage_year, item.variety, item.wine_type].filter(Boolean).join(' · ')}
          </p>
          {item.unit_price != null && (
            <p className="text-xs text-muted-foreground">Scanned price: {formatPrice(item.unit_price)} / bottle</p>
          )}
        </div>
        <button
          onClick={() => onUpdate(item.key, { skip: !item.skip })}
          className={cn(
            'text-xs px-2 py-1 rounded border transition-colors shrink-0',
            item.skip
              ? 'border-primary text-primary bg-primary/5'
              : 'border-input text-muted-foreground hover:border-destructive hover:text-destructive'
          )}
        >
          {item.skip ? 'Include' : 'Skip'}
        </button>
      </div>

      {!item.skip && (
        <>
          {/* Match section */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Match to existing wine</p>

            <div ref={dropdownRef} className="relative">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <input
                  type="search"
                  placeholder={item.matched_wine ? item.matched_wine.name : item.is_new ? 'Will create new wine…' : 'Search existing wines…'}
                  value={item.match_query}
                  onChange={e => {
                    onUpdate(item.key, { match_query: e.target.value, show_match_dropdown: true });
                    search(e.target.value);
                  }}
                  onFocus={() => {
                    onUpdate(item.key, { show_match_dropdown: true });
                    if (item.match_query) search(item.match_query);
                  }}
                  className={cn(
                    'w-full pl-8 pr-8 py-1.5 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring',
                    item.matched_wine && 'border-green-400 bg-green-50/50',
                    item.is_new && !item.matched_wine && 'border-amber-400 bg-amber-50/50'
                  )}
                />
                {loading && (
                  <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground animate-spin" />
                )}
                {item.matched_wine && (
                  <button
                    onClick={() => {
                      onUpdate(item.key, { matched_wine: null, is_new: true, match_query: '', show_match_dropdown: false });
                      setResults([]);
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Match status */}
              {item.matched_wine && !item.show_match_dropdown && (
                <p className="text-xs text-green-700 flex items-center gap-1 mt-1">
                  <CheckCircle className="h-3 w-3" />
                  Matched: {item.matched_wine.name}
                  {item.matched_wine.vintage_year && ` ${item.matched_wine.vintage_year}`}
                  {item.matched_wine.producer && ` — ${item.matched_wine.producer}`}
                </p>
              )}
              {item.is_new && !item.matched_wine && !item.show_match_dropdown && (
                <p className="text-xs text-amber-700 flex items-center gap-1 mt-1">
                  <Plus className="h-3 w-3" />
                  Will create new wine record from scanned data
                </p>
              )}

              {/* Dropdown */}
              {item.show_match_dropdown && (
                <div className="absolute z-20 top-full mt-1 w-full bg-card rounded-md border shadow-lg max-h-48 overflow-y-auto">
                  <button
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => {
                      onUpdate(item.key, { matched_wine: null, is_new: true, match_query: '', show_match_dropdown: false });
                      setResults([]);
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-amber-700 hover:bg-accent border-b flex items-center gap-2"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Create new wine from scanned data
                  </button>
                  {results.map(wine => (
                    <button
                      key={wine.id}
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => {
                        onUpdate(item.key, {
                          matched_wine: wine,
                          is_new: false,
                          match_query: '',
                          show_match_dropdown: false,
                        });
                        setResults([]);
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-accent"
                    >
                      <p className="font-medium leading-snug">{wine.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {[wine.producer, wine.vintage_year, wine.variety].filter(Boolean).join(' · ')}
                      </p>
                    </button>
                  ))}
                  {results.length === 0 && !loading && item.match_query && (
                    <p className="px-3 py-2 text-xs text-muted-foreground">No wines found</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Quantity & price */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground mb-1 block">Quantity</label>
              <input
                type="number"
                value={item.review_quantity}
                onChange={e => onUpdate(item.key, { review_quantity: Math.max(1, Number(e.target.value)) })}
                min={1}
                className="w-full px-2 py-1.5 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs text-muted-foreground mb-1 block">Price / bottle (optional)</label>
              <input
                type="number"
                placeholder="$"
                value={item.review_price ?? ''}
                onChange={e => onUpdate(item.key, { review_price: e.target.value ? Number(e.target.value) : undefined })}
                min={0}
                step={0.01}
                className="w-full px-2 py-1.5 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ReceiptScanPage() {
  const router = useRouter();
  const { profiles, activeProfile } = useProfile();

  const [phase, setPhase] = useState<Phase>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [docType, setDocType] = useState<'receipt' | 'packing_slip'>('packing_slip');
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [profileId, setProfileId] = useState('');
  const [location, setLocation] = useState('');
  const [addedCount, setAddedCount] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  // Set default profile
  useEffect(() => {
    if (!profileId && (activeProfile ?? profiles[0])) {
      setProfileId((activeProfile ?? profiles[0]).id);
    }
  }, [activeProfile, profiles, profileId]);

  async function handleFile(file: File) {
    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please select an image file.');
      setPhase('error');
      return;
    }
    setPhase('analyzing');
    setErrorMsg('');

    try {
      const imageBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const res = await fetch('/api/scan-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64, mimeType: file.type, docType }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Scan failed');

      const extracted: ScannedWineItem[] = data.wines ?? [];
      if (extracted.length === 0) {
        setErrorMsg('No wines were detected in this image. Try a clearer photo or different document.');
        setPhase('error');
        return;
      }

      // Auto-match each item against the wines DB
      const reviewItems: ReviewItem[] = await Promise.all(
        extracted.map(async (item, i) => {
          let matched: Wine | null = null;
          try {
            const q = [item.producer, item.name].filter(Boolean).join(' ');
            const r = await fetch(`/api/wines?query=${encodeURIComponent(q)}&sort=name:asc`);
            if (r.ok) {
              const wines: Wine[] = await r.json();
              if (wines.length > 0) matched = wines[0];
            }
          } catch { /* auto-match best effort */ }
          return {
            ...item,
            key: `item-${i}`,
            skip: false,
            review_quantity: item.quantity,
            review_price: item.unit_price,
            matched_wine: matched,
            is_new: !matched,
            match_loading: false,
            match_query: '',
            match_results: [],
            show_match_dropdown: false,
          };
        })
      );

      setItems(reviewItems);
      setPhase('reviewing');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Scan failed');
      setPhase('error');
    }
  }

  function updateItem(key: string, patch: Partial<ReviewItem>) {
    setItems(prev => prev.map(it => it.key === key ? { ...it, ...patch } : it));
  }

  async function handleAddAll() {
    if (!profileId) return;
    setPhase('adding');
    let count = 0;

    for (const item of items.filter(it => !it.skip)) {
      try {
        let wineId = item.matched_wine?.id;

        if (!wineId) {
          // Create new wine record from scanned data
          const createRes = await fetch('/api/wines', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: item.name,
              producer: item.producer,
              vintage_year: item.vintage_year,
              variety: item.variety,
              wine_type: item.wine_type,
              average_price: item.review_price,
            }),
          });
          if (!createRes.ok) continue;
          const created: Wine = await createRes.json();
          wineId = created.id;
        }

        const addRes = await fetch('/api/cellar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            wine_id: wineId,
            profile_id: profileId,
            location: location.trim(),
            quantity: item.review_quantity,
            purchase_price: item.review_price,
          }),
        });
        if (addRes.ok) count++;
      } catch { /* continue on individual errors */ }
    }

    setAddedCount(count);
    setPhase('done');
  }

  const activeItems = items.filter(it => !it.skip);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/scanner" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h2 className="text-xl font-bold">Scan Receipt / Packing Slip</h2>
      </div>

      {/* Idle: upload UI */}
      {phase === 'idle' && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Upload a photo of a packing slip from a wine club or winery, or a purchase receipt, and Gemini will extract the wines automatically.
          </p>

          {/* Doc type selector */}
          <div className="flex gap-2">
            {(['packing_slip', 'receipt'] as const).map(type => (
              <button
                key={type}
                onClick={() => setDocType(type)}
                className={cn(
                  'flex-1 py-2 text-sm font-medium rounded-md border transition-colors',
                  docType === type
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background hover:bg-accent border-input text-muted-foreground'
                )}
              >
                {type === 'packing_slip' ? 'Packing Slip' : 'Receipt / Invoice'}
              </button>
            ))}
          </div>

          <p className="text-xs text-muted-foreground">
            {docType === 'packing_slip'
              ? 'Best for wine club shipments and winery allocation slips. Prices may be absent.'
              : 'Best for store receipts and invoices. Non-wine items will be filtered out automatically.'}
          </p>

          {/* Drop zone */}
          <label
            htmlFor="receipt-upload"
            className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-input hover:border-primary/50 bg-muted/20 hover:bg-muted/40 transition-colors cursor-pointer py-12 px-6"
            onDragOver={e => e.preventDefault()}
            onDrop={e => {
              e.preventDefault();
              const file = e.dataTransfer.files[0];
              if (file) handleFile(file);
            }}
          >
            <Upload className="h-8 w-8 text-muted-foreground" />
            <div className="text-center">
              <p className="text-sm font-medium">Drop image here or click to browse</p>
              <p className="text-xs text-muted-foreground mt-1">JPG, PNG, WEBP — max 10 MB</p>
            </div>
          </label>
          <input
            id="receipt-upload"
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />

          {/* Mobile camera button */}
          <button
            onClick={() => {
              if (fileRef.current) {
                fileRef.current.setAttribute('capture', 'environment');
                fileRef.current.click();
              }
            }}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-md border text-sm hover:bg-accent transition-colors"
          >
            <Camera className="h-4 w-4" />
            Take Photo
          </button>
        </div>
      )}

      {/* Analyzing */}
      {phase === 'analyzing' && (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Analyzing with Gemini…</p>
        </div>
      )}

      {/* Error */}
      {phase === 'error' && (
        <div className="space-y-4">
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-destructive">Scan failed</p>
              <p className="text-xs text-destructive/80 mt-1">{errorMsg}</p>
            </div>
          </div>
          <button
            onClick={() => { setPhase('idle'); setErrorMsg(''); }}
            className="w-full py-2 rounded-md border text-sm hover:bg-accent transition-colors"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Review */}
      {phase === 'reviewing' && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Found <strong>{items.length}</strong> wine{items.length !== 1 ? 's' : ''}.
            Review the matches, adjust quantities, then add to your cellar.
          </p>

          {/* Review cards */}
          <div className="space-y-3">
            {items.map((item, i) => (
              <ReviewCard key={item.key} item={item} index={i} onUpdate={updateItem} />
            ))}
          </div>

          {/* Global cellar/location + submit */}
          <div className="rounded-lg border bg-muted/30 p-4 space-y-3 sticky bottom-0 bg-card">
            <p className="text-sm font-medium">Add {activeItems.length} wine{activeItems.length !== 1 ? 's' : ''} to cellar</p>

            {profiles.length > 1 && (
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Cellar</label>
                <div className="relative">
                  <select
                    value={profileId}
                    onChange={e => { setProfileId(e.target.value); setLocation(''); }}
                    className="w-full px-3 py-2 pr-8 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring appearance-none"
                  >
                    {profiles.map((p: Profile) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                </div>
              </div>
            )}

            {profileId && (
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Location (optional, applies to all)</label>
                <LocationPicker
                  key={profileId}
                  profileId={profileId}
                  value={location}
                  onChange={setLocation}
                  placeholder="Select or type a location…"
                  allowUnlocated
                />
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleAddAll}
                disabled={activeItems.length === 0 || !profileId}
                className="flex-1 py-2.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                Add {activeItems.length} Wine{activeItems.length !== 1 ? 's' : ''} to Cellar
              </button>
              <button
                onClick={() => setPhase('idle')}
                className="px-4 py-2.5 rounded-md border text-sm hover:bg-accent transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Adding */}
      {phase === 'adding' && (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Adding wines to your cellar…</p>
        </div>
      )}

      {/* Done */}
      {phase === 'done' && (
        <div className="space-y-4 text-center py-12">
          <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
          <div>
            <p className="text-lg font-semibold">Done!</p>
            <p className="text-sm text-muted-foreground mt-1">
              Added {addedCount} wine{addedCount !== 1 ? 's' : ''} to your cellar.
            </p>
          </div>
          <div className="flex gap-3 justify-center">
            <Link
              href="/wines"
              className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              View Wines
            </Link>
            <button
              onClick={() => { setPhase('idle'); setItems([]); setAddedCount(0); }}
              className="px-4 py-2 rounded-md border text-sm hover:bg-accent transition-colors"
            >
              Scan Another
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
