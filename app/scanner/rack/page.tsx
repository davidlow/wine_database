'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle, Loader2, RotateCcw, X } from 'lucide-react';
import BarcodeScanner from '@/components/BarcodeScanner';
import LabelCapture, { type LabelCaptureResult } from '@/components/LabelCapture';
import LocationPicker from '@/components/LocationPicker';
import SearchSuggest from '@/components/SearchSuggest';
import { useProfile } from '@/hooks/useProfile';
import { cn } from '@/lib/utils';
import type { Wine, WineType } from '@/types';

// ── Types ──────────────────────────────────────────────────────────────────────

type Phase = 'setup' | 'scanning' | 'review' | 'saving' | 'done';

type BottleStep =
  | 'barcode-scan'      // BarcodeScanner open — default entry each bottle
  | 'label-capture'     // LabelCapture open, barcode lookup running in BG
  | 'producer-search'   // SearchSuggest + wine list (no-barcode path)
  | 'qty';              // wine confirmed (barcode-found / search / manual), qty picker

type EntrySource = 'barcode' | 'gemini' | 'search' | 'manual' | 'pending';

interface ScanEntry {
  id: string;
  wine: Partial<Wine>;
  quantity: number;
  labelThumbnail?: string;
  source: EntrySource;
}

interface ReviewEntry extends ScanEntry {
  name: string;
  producer: string;
  vintage_year: number | undefined;
  wine_type: WineType | undefined;
  variety: string;
  region: string;
  country: string;
  purchase_price: number | undefined;
}

const SOURCE_COLORS: Record<EntrySource, string> = {
  barcode:  'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  gemini:   'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  search:   'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  manual:   'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  pending:  'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
};

const WINE_TYPES: WineType[] = ['red', 'white', 'rosé', 'sparkling', 'dessert', 'fortified', 'other'];
const TYPE_LABELS: Record<WineType, string> = {
  red: 'Red', white: 'White', rosé: 'Rosé', sparkling: 'Sparkling',
  dessert: 'Dessert', fortified: 'Fortified', other: 'Other',
};

const BATCH_SIZES = [1, 4, 6, 8, 12] as const;

function loadBatchSize(): number {
  if (typeof window === 'undefined') return 4;
  const v = parseInt(localStorage.getItem('rackScanner.batchSize') ?? '', 10);
  return BATCH_SIZES.includes(v as typeof BATCH_SIZES[number]) ? v : 4;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function RackScannerPage() {
  const { activeProfile, profiles } = useProfile();

  // ── Phase ──────────────────────────────────────────────────────────────────
  const [phase, setPhase] = useState<Phase>('setup');
  const [location, setLocation] = useState('');

  // ── Scanning sub-state ─────────────────────────────────────────────────────
  const [step, setStep] = useState<BottleStep>('barcode-scan');
  const [pauseEditing, setPauseEditing] = useState(false);
  const [flushingForReview, setFlushingForReview] = useState(false);

  // Per-bottle pending state (qty step only — barcode-found / search / manual)
  const [pendingWine, setPendingWine] = useState<Partial<Wine>>({});
  const [pendingLabel, setPendingLabel] = useState<string | undefined>(undefined);
  const [pendingSource, setPendingSource] = useState<EntrySource>('barcode');
  const [pendingQty, setPendingQty] = useState(1);

  // Manual entry fields
  const [manualName, setManualName] = useState('');
  const [manualProducer, setManualProducer] = useState('');
  const [manualVintage, setManualVintage] = useState('');
  const [manualType, setManualType] = useState<WineType | ''>('');

  // Producer search state
  const [producer, setProducer] = useState('');
  const [producerWines, setProducerWines] = useState<Partial<Wine>[]>([]);
  const [producerLoading, setProducerLoading] = useState(false);
  const [typeFilter, setTypeFilter] = useState<WineType | null>(null);
  const [varietyFilter, setVarietyFilter] = useState<string | null>(null);
  const [vintageFilter, setVintageFilter] = useState<number | null>(null);

  // Duplicate barcode toast
  const [dupeToast, setDupeToast] = useState<string | null>(null);

  // ── Gemini batch state ─────────────────────────────────────────────────────
  const [geminiProcessing, setGeminiProcessing] = useState(false);
  const [batchSize, setBatchSize] = useState<number>(loadBatchSize);

  // ── Entry list ─────────────────────────────────────────────────────────────
  const [entries, setEntries] = useState<ScanEntry[]>([]);
  const [reviewItems, setReviewItems] = useState<ReviewEntry[]>([]);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [addedCount, setAddedCount] = useState(0);
  const [addErrors, setAddErrors] = useState<string[]>([]);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const scannedBarcodes = useRef<Map<string, string>>(new Map()); // barcode → entry id
  const barcodeRef = useRef('');
  const barcodeLookupRef = useRef<Promise<Partial<Wine> | null>>(Promise.resolve(null));

  // Gemini batch refs
  const geminiQueue = useRef<string[]>([]); // entry IDs awaiting batch
  const geminiPendingData = useRef<Map<string, { imageBase64: string; barcode?: string }>>(new Map());
  const batchInFlight = useRef(false);
  const currentBatchPromise = useRef<Promise<void>>(Promise.resolve());
  const triggerGeminiBatchRef = useRef<(force: boolean) => void>(() => {});

  // ── Per-bottle reset ───────────────────────────────────────────────────────

  const resetBottle = useCallback(() => {
    barcodeRef.current = '';
    barcodeLookupRef.current = Promise.resolve(null);
    setPendingWine({});
    setPendingLabel(undefined);
    setPendingSource('barcode');
    setPendingQty(1);
    setManualName('');
    setManualProducer('');
    setManualVintage('');
    setManualType('');
    setProducer('');
    setProducerWines([]);
    setTypeFilter(null);
    setVarietyFilter(null);
    setVintageFilter(null);
  }, []);

  const showDupeToast = (name: string) => {
    setDupeToast(name);
    setTimeout(() => setDupeToast(null), 2500);
  };

  // ── Gemini batch processing ────────────────────────────────────────────────

  const triggerGeminiBatch = useCallback(async (forceFlush: boolean) => {
    if (batchInFlight.current) return;
    if (geminiQueue.current.length === 0) return;
    if (!forceFlush && geminiQueue.current.length < batchSize) return;

    batchInFlight.current = true;
    const ids = [...geminiQueue.current];
    geminiQueue.current = [];
    setGeminiProcessing(true);

    const items = ids.flatMap(id => {
      const d = geminiPendingData.current.get(id);
      return d ? [{ id, imageBase64: d.imageBase64, barcode: d.barcode }] : [];
    });

    const batchPromise = (async () => {
      try {
        const res = await fetch('/api/label-scan/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items }),
        });
        const data = await res.json();
        const results: Array<{ id: string; found: boolean; name?: string } & Partial<Wine>> =
          Array.isArray(data.results) ? data.results : [];

        setEntries(prev => prev.map(entry => {
          const r = results.find(x => x.id === entry.id);
          if (!r) return entry;
          geminiPendingData.current.delete(entry.id);
          if (r.found && r.name) {
            return { ...entry, wine: r as Partial<Wine>, source: 'gemini' as const };
          }
          return { ...entry, source: 'manual' as const };
        }));
      } catch {
        // On fetch failure, leave as manual so user can fill in review
        setEntries(prev => prev.map(e =>
          ids.includes(e.id) ? { ...e, source: 'manual' as const } : e
        ));
      } finally {
        batchInFlight.current = false;
        setGeminiProcessing(false);
        // Trigger again if more items accumulated while this batch ran
        if (geminiQueue.current.length >= batchSize) {
          setTimeout(() => triggerGeminiBatchRef.current(false), 0);
        }
      }
    })();

    currentBatchPromise.current = batchPromise;
  }, [batchSize]);

  // Keep ref in sync so the setTimeout callback always calls the current version
  useEffect(() => { triggerGeminiBatchRef.current = triggerGeminiBatch; }, [triggerGeminiBatch]);

  // ── Barcode detection ──────────────────────────────────────────────────────

  const handleBarcodeDetected = useCallback((code: string) => {
    if (scannedBarcodes.current.has(code)) {
      const existingId = scannedBarcodes.current.get(code)!;
      let name = '';
      setEntries(prev => prev.map(e => {
        if (e.id === existingId) { name = e.wine.name ?? ''; return { ...e, quantity: e.quantity + 1 }; }
        return e;
      }));
      showDupeToast(name || 'that wine');
      return;
    }
    barcodeRef.current = code;
    barcodeLookupRef.current = fetch(`/api/barcode/${encodeURIComponent(code)}`)
      .then(r => r.json())
      .then(d => (d.found && d.name ? (d as Partial<Wine>) : null))
      .catch(() => null);
    setStep('label-capture');
  }, []);

  // ── Label capture ──────────────────────────────────────────────────────────

  const handleLabelCapture = useCallback(async ({ gemini, thumbnail }: LabelCaptureResult) => {
    const barcodeWine = await barcodeLookupRef.current;
    if (barcodeWine) {
      // Barcode found — show qty step (user confirms and sets quantity)
      setPendingWine(barcodeWine);
      setPendingLabel(thumbnail);
      setPendingSource('barcode');
      setPendingQty(1);
      setStep('qty');
    } else {
      // Not found — add as 'pending', skip qty step, go straight back to scanner
      const id = Math.random().toString(36).slice(2, 10);
      const barcode = barcodeRef.current || undefined;
      if (barcode) scannedBarcodes.current.set(barcode, id);
      geminiPendingData.current.set(id, { imageBase64: gemini, barcode });
      setEntries(prev => [...prev, { id, wine: {}, quantity: 1, labelThumbnail: thumbnail, source: 'pending' }]);
      geminiQueue.current.push(id);
      resetBottle();
      setStep('barcode-scan');
      // Auto-trigger batch when queue fills up
      if (!batchInFlight.current && geminiQueue.current.length >= batchSize) {
        triggerGeminiBatchRef.current(false);
      }
    }
  }, [batchSize, resetBottle]);

  const handleSkipLabel = useCallback(async () => {
    const barcodeWine = await barcodeLookupRef.current;
    if (barcodeWine) {
      setPendingWine(barcodeWine);
      setPendingSource('barcode');
    } else {
      setPendingWine({});
      setPendingSource('manual');
    }
    setPendingLabel(undefined);
    setPendingQty(1);
    setStep('qty');
  }, []);

  // ── Producer search ────────────────────────────────────────────────────────

  const handleProducerCommit = useCallback(async (name: string) => {
    if (!name.trim()) return;
    setProducer(name);
    setProducerLoading(true);
    setProducerWines([]);
    setTypeFilter(null);
    setVarietyFilter(null);
    setVintageFilter(null);
    try {
      const res = await fetch(`/api/producers/${encodeURIComponent(name)}/wines`);
      const wines = await res.json();
      setProducerWines(Array.isArray(wines) ? wines : []);
    } catch {
      setProducerWines([]);
    } finally {
      setProducerLoading(false);
    }
  }, []);

  const availableTypes = [...new Set(producerWines.map(w => w.wine_type).filter(Boolean) as WineType[])];
  const availableVarieties = [...new Set(
    producerWines
      .filter(w => !typeFilter || w.wine_type === typeFilter)
      .map(w => w.variety).filter(Boolean) as string[]
  )].sort();
  const availableVintages = [...new Set(
    producerWines
      .filter(w => (!typeFilter || w.wine_type === typeFilter) && (!varietyFilter || w.variety === varietyFilter))
      .map(w => w.vintage_year).filter(Boolean) as number[]
  )].sort((a, b) => b - a);
  const filteredWines = producerWines.filter(w => {
    if (typeFilter && w.wine_type !== typeFilter) return false;
    if (varietyFilter && w.variety !== varietyFilter) return false;
    if (vintageFilter && w.vintage_year !== vintageFilter) return false;
    return true;
  });

  // ── Next bottle / Done ─────────────────────────────────────────────────────

  const handleNextBottle = () => {
    const finalWine: Partial<Wine> = pendingSource === 'manual'
      ? {
          name: manualName.trim() || undefined,
          producer: manualProducer.trim() || undefined,
          vintage_year: manualVintage ? Number(manualVintage) : undefined,
          wine_type: manualType || undefined,
        }
      : pendingWine;

    const id = Math.random().toString(36).slice(2, 10);
    if (finalWine.barcode) scannedBarcodes.current.set(finalWine.barcode, id);

    setEntries(prev => [...prev, {
      id,
      wine: finalWine,
      quantity: pendingQty,
      labelThumbnail: pendingLabel,
      source: pendingSource,
    }]);

    resetBottle();
    setStep('barcode-scan');
  };

  const handleDoneScanning = async () => {
    setFlushingForReview(true);
    // Flush any queued items immediately (don't wait for batchSize)
    if (geminiQueue.current.length > 0 && !batchInFlight.current) {
      triggerGeminiBatchRef.current(true);
    }
    // Wait for any in-flight batch to finish
    await currentBatchPromise.current;
    setFlushingForReview(false);

    // Build review list from the now-updated entries
    setEntries(current => {
      const items: ReviewEntry[] = current.map(entry => ({
        ...entry,
        name: entry.wine.name ?? '',
        producer: entry.wine.producer ?? '',
        vintage_year: entry.wine.vintage_year,
        wine_type: entry.wine.wine_type,
        variety: entry.wine.variety ?? '',
        region: entry.wine.region ?? '',
        country: entry.wine.country ?? '',
        purchase_price: entry.wine.average_price as number | undefined,
      }));
      setReviewItems(items);
      return current;
    });
    setExpandedRow(null);
    setPauseEditing(false);
    setPhase('review');
  };

  const updateReview = (id: string, patch: Partial<ReviewEntry>) =>
    setReviewItems(prev => prev.map(it => it.id === id ? { ...it, ...patch } : it));

  const removeReview = (id: string) =>
    setReviewItems(prev => prev.filter(it => it.id !== id));

  // ── Save ───────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!activeProfile) return;
    const valid = reviewItems.filter(it => it.name.trim());
    if (!valid.length) return;
    setPhase('saving');
    try {
      const res = await fetch('/api/cellar/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile_id: activeProfile.id,
          location: location.trim(),
          items: valid.map(it => ({
            barcode: it.wine.barcode,
            name: it.name.trim(),
            producer: it.producer.trim() || undefined,
            vintage_year: it.vintage_year,
            wine_type: it.wine_type,
            variety: it.variety.trim() || undefined,
            region: it.region.trim() || undefined,
            country: it.country.trim() || undefined,
            quantity: Math.max(1, it.quantity),
            purchase_price: it.purchase_price,
            label_image: it.labelThumbnail,
          })),
        }),
      });
      const data = await res.json();
      setAddedCount(data.added ?? 0);
      setAddErrors(data.errors ?? []);
      setPhase('done');
    } catch (err) {
      setAddErrors([err instanceof Error ? err.message : 'Save failed']);
      setPhase('review');
    }
  };

  const handleReset = () => {
    setEntries([]);
    setReviewItems([]);
    setAddedCount(0);
    setAddErrors([]);
    scannedBarcodes.current.clear();
    geminiQueue.current = [];
    geminiPendingData.current.clear();
    resetBottle();
    setStep('barcode-scan');
    setPauseEditing(false);
    setPhase('scanning');
  };

  // ── Computed ───────────────────────────────────────────────────────────────

  const totalBottles = entries.reduce((s, e) => s + e.quantity, 0);
  const pendingCount = entries.filter(e => e.source === 'pending').length;
  const validCount = reviewItems.filter(it => it.name.trim()).length;
  const unnamedCount = reviewItems.filter(it => !it.name.trim()).length;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col">

      {/* ── Setup ── */}
      {phase === 'setup' && (
        <>
          <div className="flex items-center gap-3 px-4 py-3 border-b shrink-0">
            <Link href="/scanner" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h2 className="text-base font-bold flex-1">Rack Scanner</h2>
          </div>
          <div className="flex-1 p-4 max-w-md mx-auto w-full space-y-6 pt-8">
            <div>
              <h3 className="font-semibold text-lg">Where are these bottles?</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Set the location first — all scanned bottles will be added here.
              </p>
            </div>
            {activeProfile ? (
              <div className="space-y-2">
                <label className="text-sm font-medium">Location</label>
                <LocationPicker
                  profileId={activeProfile.id}
                  value={location}
                  onChange={setLocation}
                  placeholder="e.g. Rack 1, Wine Fridge…"
                  allowUnlocated={false}
                />
              </div>
            ) : profiles.length === 0 ? (
              <p className="text-sm text-muted-foreground">No cellar profile found.</p>
            ) : null}

            {/* Gemini batch size setting */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Gemini batch size</label>
              <p className="text-xs text-muted-foreground">
                Label photos are sent to Gemini in groups — fewer API calls, faster scanning.
              </p>
              <div className="flex gap-2 flex-wrap">
                {BATCH_SIZES.map(n => (
                  <button
                    key={n}
                    onClick={() => {
                      setBatchSize(n);
                      localStorage.setItem('rackScanner.batchSize', String(n));
                    }}
                    className={cn(
                      'px-3 py-1.5 rounded-md border text-sm font-medium transition-colors',
                      batchSize === n
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background hover:bg-muted'
                    )}
                  >
                    {n === 1 ? 'Immediately' : n}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => { resetBottle(); setStep('barcode-scan'); setPhase('scanning'); }}
              disabled={!location || !activeProfile}
              className="w-full py-3 rounded-md bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-40"
            >
              Start Scanning
            </button>
            <div className="rounded-lg bg-muted/40 p-3 space-y-1 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">How it works</p>
              <p>• Scan each barcode — lookup happens in the background</p>
              <p>• Take a label photo to confirm or identify the wine</p>
              <p>• Known wines prompt a quantity step; unknown ones queue for Gemini</p>
              <p>• Gemini analyzes queued labels in one batch while you keep scanning</p>
            </div>
          </div>
        </>
      )}

      {/* ── Scanning ── */}
      {phase === 'scanning' && (
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b shrink-0">
            <button
              onClick={() => pauseEditing ? setPauseEditing(false) : setPhase('setup')}
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-bold leading-tight">
                {pauseEditing ? 'Edit Batch' : 'Rack Scanner'}
              </h2>
              {!pauseEditing && location && (
                <p className="text-xs text-muted-foreground truncate">📍 {location}</p>
              )}
            </div>
            {/* Gemini processing indicator */}
            {geminiProcessing && !pauseEditing && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Analyzing…</span>
              </div>
            )}
            {entries.length > 0 && (
              <div className="flex items-center gap-2 shrink-0">
                {!pauseEditing && (
                  <button
                    onClick={() => setPauseEditing(true)}
                    className="px-2.5 py-1.5 text-xs font-medium rounded-md border hover:bg-accent"
                  >
                    Edit ({entries.length})
                  </button>
                )}
                <button
                  onClick={handleDoneScanning}
                  disabled={flushingForReview}
                  className="px-3 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                >
                  Done ({totalBottles})
                </button>
              </div>
            )}
          </div>

          {/* ── Flushing overlay ── */}
          {flushingForReview ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Finishing label analysis…</p>
            </div>
          ) : pauseEditing ? (
            /* ── Pause editing — full entry list with inline ±qty ── */
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Analyze now button when items are pending */}
              {pendingCount > 0 && (
                <div className="px-4 py-2 border-b shrink-0">
                  <button
                    onClick={() => triggerGeminiBatchRef.current(true)}
                    disabled={geminiProcessing}
                    className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400 hover:underline disabled:opacity-50"
                  >
                    {geminiProcessing ? (
                      <><Loader2 className="h-3 w-3 animate-spin" /> Analyzing {pendingCount} label{pendingCount !== 1 ? 's' : ''}…</>
                    ) : (
                      <>Analyze {pendingCount} pending label{pendingCount !== 1 ? 's' : ''} now →</>
                    )}
                  </button>
                </div>
              )}
              <div className="flex-1 overflow-y-auto divide-y">
                {[...entries].reverse().map(entry => (
                  <div key={entry.id} className="flex items-center gap-3 px-4 py-3">
                    {entry.labelThumbnail ? (
                      <img
                        src={`data:image/webp;base64,${entry.labelThumbnail}`}
                        alt=""
                        className="w-10 h-14 object-cover rounded shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-14 rounded bg-muted shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      {entry.source === 'pending' ? (
                        <p className="text-sm italic text-muted-foreground">Identifying…</p>
                      ) : (
                        <p className="text-sm font-medium truncate">
                          {entry.wine.name ?? <span className="italic text-muted-foreground">Unnamed</span>}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground truncate">
                        {[entry.wine.producer, entry.wine.vintage_year].filter(Boolean).join(' · ')}
                      </p>
                      <span className={cn('mt-1 inline-block text-[10px] px-1.5 py-0.5 rounded', SOURCE_COLORS[entry.source])}>
                        {entry.source}
                      </span>
                    </div>
                    {/* Qty controls */}
                    <div className="flex items-center border rounded-md overflow-hidden shrink-0">
                      <button
                        onClick={() => setEntries(prev => prev.map(e => e.id === entry.id ? { ...e, quantity: Math.max(1, e.quantity - 1) } : e))}
                        className="px-3 py-2 text-base hover:bg-muted"
                      >
                        −
                      </button>
                      <span className="px-3 py-2 text-sm font-bold border-x min-w-[2.5rem] text-center">{entry.quantity}</span>
                      <button
                        onClick={() => setEntries(prev => prev.map(e => e.id === entry.id ? { ...e, quantity: e.quantity + 1 } : e))}
                        className="px-3 py-2 text-base hover:bg-muted"
                      >
                        +
                      </button>
                    </div>
                    <button
                      onClick={() => {
                        if (entry.wine.barcode) scannedBarcodes.current.delete(entry.wine.barcode);
                        // If pending, also remove from queue
                        if (entry.source === 'pending') {
                          geminiQueue.current = geminiQueue.current.filter(id => id !== entry.id);
                          geminiPendingData.current.delete(entry.id);
                        }
                        setEntries(prev => prev.filter(e => e.id !== entry.id));
                      }}
                      className="text-muted-foreground hover:text-destructive shrink-0 ml-1"
                      title="Remove"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="border-t p-4 shrink-0">
                <button
                  onClick={() => setPauseEditing(false)}
                  className="w-full py-2.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
                >
                  Resume Scanning →
                </button>
              </div>
            </div>
          ) : (
            /* ── Active per-bottle scanning steps ── */
            <div className="flex-1 overflow-y-auto">
              <div className="max-w-md mx-auto px-4 py-4 space-y-4">

                {/* Duplicate barcode toast */}
                {dupeToast && (
                  <div className="flex items-center gap-2 rounded-md bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 px-3 py-2 text-sm text-green-700 dark:text-green-400">
                    <CheckCircle className="h-4 w-4 shrink-0" />
                    Added 1 more — {dupeToast}
                  </div>
                )}

                {/* Pending count hint (non-intrusive) */}
                {pendingCount > 0 && step === 'barcode-scan' && !geminiProcessing && (
                  <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md px-3 py-1.5">
                    <span>{pendingCount} label{pendingCount !== 1 ? 's' : ''} queued — Gemini will analyze after {batchSize === 1 ? 'each' : `${batchSize}`}</span>
                  </div>
                )}

                {/* ── Barcode scan ── */}
                {step === 'barcode-scan' && (
                  <div className="space-y-3">
                    <BarcodeScanner onDetected={handleBarcodeDetected} autoStart />
                    <button
                      onClick={() => {
                        barcodeRef.current = '';
                        barcodeLookupRef.current = Promise.resolve(null);
                        setStep('producer-search');
                      }}
                      className="w-full text-sm text-muted-foreground hover:text-foreground text-center py-1"
                    >
                      No barcode? Search by producer →
                    </button>
                  </div>
                )}

                {/* ── Label capture ── */}
                {step === 'label-capture' && (
                  <div className="space-y-3">
                    {barcodeRef.current && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 rounded-md px-3 py-1.5">
                        <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                        Looking up barcode {barcodeRef.current}…
                      </div>
                    )}
                    <LabelCapture onCapture={handleLabelCapture} onCancel={() => setStep('barcode-scan')} />
                    <button
                      onClick={handleSkipLabel}
                      className="w-full text-sm text-muted-foreground hover:text-foreground text-center py-1"
                    >
                      Skip label photo →
                    </button>
                  </div>
                )}

                {/* ── Producer search ── */}
                {step === 'producer-search' && (
                  <div className="space-y-3">
                    <button
                      onClick={() => setStep('barcode-scan')}
                      className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Back to barcode scanner
                    </button>

                    <SearchSuggest
                      field="producer"
                      value={producer}
                      onChange={v => { setProducer(v); if (!v.trim()) setProducerWines([]); }}
                      onCommit={handleProducerCommit}
                      placeholder="Type producer name…"
                    />

                    {producerLoading && (
                      <div className="flex items-center justify-center gap-2 py-6 text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm">Loading wines…</span>
                      </div>
                    )}

                    {!producerLoading && producerWines.length > 0 && (
                      <div className="space-y-2">
                        {availableTypes.length > 1 && (
                          <div className="flex flex-wrap gap-1.5">
                            {availableTypes.map(t => (
                              <button
                                key={t}
                                onClick={() => { setTypeFilter(typeFilter === t ? null : t); setVarietyFilter(null); setVintageFilter(null); }}
                                className={cn(
                                  'px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                                  typeFilter === t ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted'
                                )}
                              >
                                {TYPE_LABELS[t]}
                              </button>
                            ))}
                          </div>
                        )}
                        {availableVarieties.length > 1 && (
                          <div className="flex flex-wrap gap-1.5">
                            {availableVarieties.map(v => (
                              <button
                                key={v}
                                onClick={() => { setVarietyFilter(varietyFilter === v ? null : v); setVintageFilter(null); }}
                                className={cn(
                                  'px-2.5 py-1 rounded-full text-xs border transition-colors',
                                  varietyFilter === v ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted'
                                )}
                              >
                                {v}
                              </button>
                            ))}
                          </div>
                        )}
                        {availableVintages.length > 1 && (
                          <div className="flex flex-wrap gap-1.5">
                            {availableVintages.map(y => (
                              <button
                                key={y}
                                onClick={() => setVintageFilter(vintageFilter === y ? null : y)}
                                className={cn(
                                  'px-2.5 py-1 rounded-full text-xs border transition-colors',
                                  vintageFilter === y ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted'
                                )}
                              >
                                {y}
                              </button>
                            ))}
                          </div>
                        )}
                        <div className="space-y-1.5 max-h-64 overflow-y-auto">
                          {filteredWines.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-3">No wines match these filters</p>
                          ) : (
                            filteredWines.map((w, i) => (
                              <button
                                key={w.id ?? i}
                                onClick={() => {
                                  setPendingWine(w);
                                  setPendingLabel(undefined);
                                  setPendingSource('search');
                                  setPendingQty(1);
                                  setStep('qty');
                                }}
                                className="w-full text-left rounded-lg border bg-card px-3 py-2.5 hover:bg-muted/30 transition-colors"
                              >
                                <p className="text-sm font-medium">{w.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {[w.wine_type, w.variety, w.vintage_year, w.region].filter(Boolean).join(' · ')}
                                </p>
                              </button>
                            ))
                          )}
                        </div>
                        <button
                          onClick={() => {
                            barcodeRef.current = '';
                            barcodeLookupRef.current = Promise.resolve(null);
                            setStep('label-capture');
                          }}
                          className="w-full text-xs text-muted-foreground hover:text-foreground text-center py-1"
                        >
                          Not in database — take a label photo →
                        </button>
                      </div>
                    )}

                    {!producerLoading && !producerWines.length && producer && (
                      <p className="text-sm text-muted-foreground text-center py-3">
                        Select a producer from the suggestions or press Enter to search.
                      </p>
                    )}
                  </div>
                )}

                {/* ── Qty (barcode-found, search, or manual skip) ── */}
                {step === 'qty' && (
                  <div className="space-y-4">
                    {pendingSource !== 'manual' && pendingWine.name ? (
                      <div className="flex gap-3 items-start rounded-lg border bg-muted/20 px-4 py-3">
                        {pendingLabel && (
                          <img
                            src={`data:image/webp;base64,${pendingLabel}`}
                            alt=""
                            className="w-14 h-20 object-cover rounded shrink-0"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold truncate">{pendingWine.name}</p>
                          {pendingWine.producer && <p className="text-sm text-muted-foreground truncate">{pendingWine.producer}</p>}
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {[pendingWine.wine_type, pendingWine.variety, pendingWine.vintage_year].filter(Boolean).join(' · ')}
                          </p>
                          <span className={cn('mt-1.5 inline-block text-[10px] px-1.5 py-0.5 rounded', SOURCE_COLORS[pendingSource])}>
                            {pendingSource}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3 rounded-lg border bg-muted/20 px-4 py-3">
                        <p className="text-sm font-medium">Enter wine details</p>
                        <div>
                          <label className="text-xs text-muted-foreground">Name *</label>
                          <input
                            type="text"
                            value={manualName}
                            onChange={e => setManualName(e.target.value)}
                            placeholder="Wine name"
                            className="w-full mt-0.5 px-2 py-1.5 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-xs text-muted-foreground">Producer</label>
                            <input type="text" value={manualProducer} onChange={e => setManualProducer(e.target.value)}
                              className="w-full mt-0.5 px-2 py-1.5 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">Vintage</label>
                            <input type="number" value={manualVintage} onChange={e => setManualVintage(e.target.value)}
                              min={1900} max={2100} placeholder="2022"
                              className="w-full mt-0.5 px-2 py-1.5 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
                          </div>
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">Type</label>
                          <select value={manualType} onChange={e => setManualType(e.target.value as WineType | '')}
                            className="w-full mt-0.5 px-2 py-1.5 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring">
                            <option value="">—</option>
                            {WINE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <label className="text-sm font-medium">How many bottles?</label>
                      <div className="flex items-center border rounded-md overflow-hidden w-fit">
                        <button onClick={() => setPendingQty(q => Math.max(1, q - 1))} className="px-4 py-2.5 text-lg hover:bg-muted">−</button>
                        <span className="px-6 py-2.5 text-lg font-bold border-x">{pendingQty}</span>
                        <button onClick={() => setPendingQty(q => Math.min(99, q + 1))} className="px-4 py-2.5 text-lg hover:bg-muted">+</button>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={handleNextBottle}
                        disabled={pendingSource === 'manual' && !manualName.trim()}
                        className="flex-1 py-3 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-40"
                      >
                        Next Bottle →
                      </button>
                      <button
                        onClick={() => { resetBottle(); setStep('barcode-scan'); }}
                        className="px-4 py-3 rounded-md border text-sm hover:bg-accent"
                      >
                        Back
                      </button>
                    </div>
                  </div>
                )}

              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Review ── */}
      {phase === 'review' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3 border-b shrink-0">
            <button
              onClick={() => { setStep('barcode-scan'); setPhase('scanning'); }}
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h2 className="text-base font-bold flex-1">Review</h2>
            <button
              onClick={() => { setStep('barcode-scan'); setPhase('scanning'); }}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border hover:bg-accent"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Scan More
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="p-4 space-y-4 max-w-2xl mx-auto">
              <p className="text-sm text-muted-foreground">
                {reviewItems.length} wine{reviewItems.length !== 1 ? 's' : ''}. Review then save.
              </p>

              {activeProfile && (
                <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Location</label>
                  <LocationPicker profileId={activeProfile.id} value={location} onChange={setLocation} allowUnlocated />
                </div>
              )}

              {unnamedCount > 0 && (
                <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                  {unnamedCount} item{unnamedCount !== 1 ? 's' : ''} need a name before saving.
                </div>
              )}

              <div className="space-y-2">
                {reviewItems.map((item, i) => (
                  <div key={item.id} className="rounded-lg border bg-card overflow-hidden">
                    <button
                      className="w-full flex items-center gap-3 px-3 py-3 text-left hover:bg-muted/30"
                      onClick={() => setExpandedRow(expandedRow === i ? null : i)}
                    >
                      {item.labelThumbnail && (
                        <img src={`data:image/webp;base64,${item.labelThumbnail}`} alt="" className="w-8 h-11 object-cover rounded shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        {item.name ? (
                          <p className="text-sm font-medium truncate">{item.name}</p>
                        ) : (
                          <p className="text-sm font-medium text-destructive italic">Needs a name</p>
                        )}
                        <p className="text-xs text-muted-foreground truncate">
                          {[item.producer, item.vintage_year, item.variety].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={cn('text-[10px] px-1.5 py-0.5 rounded', SOURCE_COLORS[item.source])}>
                          {item.source}
                        </span>
                        <span className="text-sm font-bold text-muted-foreground">×{item.quantity}</span>
                      </div>
                    </button>
                    {expandedRow === i && (
                      <div className="border-t px-3 py-3 grid grid-cols-2 gap-3">
                        <div className="col-span-2">
                          <label className="text-xs text-muted-foreground">Name *</label>
                          <input type="text" value={item.name} onChange={e => updateReview(item.id, { name: e.target.value })}
                            className={cn('w-full mt-0.5 px-2 py-1.5 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring', !item.name && 'border-destructive')} />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">Producer</label>
                          <input type="text" value={item.producer} onChange={e => updateReview(item.id, { producer: e.target.value })}
                            className="w-full mt-0.5 px-2 py-1.5 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">Vintage</label>
                          <input type="number" value={item.vintage_year ?? ''} onChange={e => updateReview(item.id, { vintage_year: e.target.value ? Number(e.target.value) : undefined })}
                            min={1900} max={2100} className="w-full mt-0.5 px-2 py-1.5 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">Type</label>
                          <select value={item.wine_type ?? ''} onChange={e => updateReview(item.id, { wine_type: e.target.value as WineType || undefined })}
                            className="w-full mt-0.5 px-2 py-1.5 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring">
                            <option value="">—</option>
                            {WINE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">Qty</label>
                          <input type="number" value={item.quantity} onChange={e => updateReview(item.id, { quantity: Math.max(1, Number(e.target.value)) })}
                            min={1} className="w-full mt-0.5 px-2 py-1.5 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">Price/bottle</label>
                          <input type="number" value={item.purchase_price ?? ''} onChange={e => updateReview(item.id, { purchase_price: e.target.value ? Number(e.target.value) : undefined })}
                            min={0} step={0.01} placeholder="$" className="w-full mt-0.5 px-2 py-1.5 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">Variety</label>
                          <input type="text" value={item.variety} onChange={e => updateReview(item.id, { variety: e.target.value })}
                            className="w-full mt-0.5 px-2 py-1.5 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">Region</label>
                          <input type="text" value={item.region} onChange={e => updateReview(item.id, { region: e.target.value })}
                            className="w-full mt-0.5 px-2 py-1.5 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
                        </div>
                        <div className="col-span-2 flex justify-end">
                          <button onClick={() => { removeReview(item.id); setExpandedRow(null); }} className="text-xs text-destructive hover:underline">
                            Remove
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="h-16" />
            </div>
          </div>

          <div className="border-t px-4 py-3 shrink-0 bg-card">
            <button
              onClick={handleSave}
              disabled={validCount === 0}
              className="w-full py-2.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-40"
            >
              Add {validCount} Bottle{validCount !== 1 ? 's' : ''} to Cellar
            </button>
          </div>
        </div>
      )}

      {/* ── Saving ── */}
      {phase === 'saving' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Saving to cellar…</p>
        </div>
      )}

      {/* ── Done ── */}
      {phase === 'done' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 py-12 px-4 text-center">
          <CheckCircle className="h-12 w-12 text-green-500" />
          <div>
            <p className="text-lg font-semibold">Done!</p>
            <p className="text-sm text-muted-foreground mt-1">
              Added {addedCount} bottle{addedCount !== 1 ? 's' : ''} to {location || 'cellar'}.
            </p>
          </div>
          {addErrors.length > 0 && (
            <div className="w-full max-w-sm rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-left">
              <p className="text-xs font-medium text-destructive mb-1">{addErrors.length} error{addErrors.length !== 1 ? 's' : ''}</p>
              {addErrors.map((e, i) => <p key={i} className="text-xs text-destructive/80">{e}</p>)}
            </div>
          )}
          <div className="flex gap-3">
            <Link href="/wines" className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">
              View Wines
            </Link>
            <button onClick={handleReset} className="px-4 py-2 rounded-md border text-sm hover:bg-accent">
              Scan Another Rack
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
