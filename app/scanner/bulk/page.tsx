'use client';

import { useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle, Barcode, Camera, Check, CheckCircle,
  ChevronDown, ChevronUp, Loader2, PackagePlus, RotateCcw, Trash2, X,
} from 'lucide-react';
import BarcodeScanner from '@/components/BarcodeScanner';
import LabelCapture from '@/components/LabelCapture';
import LocationPicker from '@/components/LocationPicker';
import { useProfile } from '@/hooks/useProfile';
import type { BulkScanItem, WineType } from '@/types';
import type { WineLookupResult } from '@/lib/wine-lookup/types';
import { cn } from '@/lib/utils';

type Phase = 'scan' | 'lookup' | 'review' | 'done';
type ScanState = 'looking-up' | 'found' | 'not-found' | 'label-scanning' | 'label-found' | 'label-failed';

interface ScanEntry {
  barcode: string;
  state: ScanState;
  data?: Partial<BulkScanItem>;
}

const WINE_TYPES: WineType[] = ['red', 'white', 'rosé', 'sparkling', 'dessert', 'fortified', 'other'];

const SOURCE_LABELS: Record<string, string> = {
  database: 'In Library',
  openfoodfacts: 'Web',
  'label-scan': 'Label',
  'gemini-batch': 'AI',
  manual: 'Manual',
};

const SOURCE_COLORS: Record<string, string> = {
  database: 'bg-blue-100 text-blue-700',
  openfoodfacts: 'bg-green-100 text-green-700',
  'label-scan': 'bg-purple-100 text-purple-700',
  'gemini-batch': 'bg-purple-100 text-purple-700',
  manual: 'bg-muted text-muted-foreground',
};

const inputCls = 'mt-1 w-full px-3 py-1.5 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring';

export default function BulkScanPage() {
  const router = useRouter();
  const { activeProfile } = useProfile();

  // Scan phase
  const scannedRef = useRef<Set<string>>(new Set());
  const [scanEntries, setScanEntries] = useState<ScanEntry[]>([]);
  const [capturingLabel, setCapturingLabel] = useState<string | null>(null);

  // Review phase
  const [items, setItems] = useState<BulkScanItem[]>([]);
  const [location, setLocation] = useState('');
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);

  // Done phase
  const [addedCount, setAddedCount] = useState(0);
  const [addErrors, setAddErrors] = useState<string[]>([]);

  const [phase, setPhase] = useState<Phase>('scan');

  // Called for each new unique barcode scan — immediately looks up DB + Open Food Facts
  const handleDetected = useCallback(async (barcode: string) => {
    if (scannedRef.current.has(barcode)) return;
    scannedRef.current.add(barcode);
    setScanEntries(prev => [...prev, { barcode, state: 'looking-up' }]);

    try {
      const res = await fetch(`/api/barcode/${encodeURIComponent(barcode)}`);
      if (!res.ok) throw new Error('lookup failed');
      const result: WineLookupResult = await res.json();
      setScanEntries(prev => prev.map(e => e.barcode !== barcode ? e : {
        barcode,
        state: result.found ? 'found' : 'not-found',
        data: result.found ? {
          name: result.name,
          producer: result.producer,
          vintage_year: result.vintage_year,
          variety: result.variety,
          wine_type: result.wine_type,
          region: result.region,
          appellation: result.appellation,
          country: result.country,
          description: result.description,
          average_price: result.average_price,
          source: result.source as BulkScanItem['source'],
        } : undefined,
      }));
    } catch {
      setScanEntries(prev => prev.map(e => e.barcode === barcode ? { ...e, state: 'not-found' } : e));
    }
  }, []);

  const handleLabelCapture = async (barcode: string, { gemini }: { gemini: string; thumbnail: string }) => {
    setCapturingLabel(null);
    setScanEntries(prev => prev.map(e => e.barcode === barcode ? { ...e, state: 'label-scanning' } : e));

    try {
      const res = await fetch('/api/label-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: gemini, barcode }),
      });
      const result: WineLookupResult = await res.json();

      if (result.found && result.name) {
        setScanEntries(prev => prev.map(e => e.barcode !== barcode ? e : {
          barcode,
          state: 'label-found',
          data: {
            name: result.name,
            producer: result.producer,
            vintage_year: result.vintage_year,
            variety: result.variety,
            wine_type: result.wine_type,
            region: result.region,
            appellation: result.appellation,
            country: result.country,
            description: result.description,
            average_price: result.average_price,
            source: 'label-scan',
          },
        }));
      } else {
        setScanEntries(prev => prev.map(e => e.barcode === barcode ? { ...e, state: 'label-failed' } : e));
      }
    } catch {
      setScanEntries(prev => prev.map(e => e.barcode === barcode ? { ...e, state: 'label-failed' } : e));
    }
  };

  const removeEntry = (barcode: string) => {
    scannedRef.current.delete(barcode);
    setScanEntries(prev => prev.filter(e => e.barcode !== barcode));
  };

  const handleDoneScanning = () => {
    const reviewItems: BulkScanItem[] = scanEntries.map(entry => {
      const d = entry.data ?? {};
      return {
        barcode: entry.barcode,
        quantity: 1,
        found: entry.state === 'found' || entry.state === 'label-found',
        name: d.name ?? '',
        producer: d.producer,
        vintage_year: d.vintage_year,
        variety: d.variety,
        wine_type: d.wine_type,
        region: d.region,
        appellation: d.appellation,
        country: d.country,
        description: d.description,
        average_price: d.average_price,
        purchase_price: d.average_price,
        source: d.source ?? 'manual',
      };
    });
    setItems(reviewItems);
    setPhase('review');
  };

  const updateItem = (index: number, updates: Partial<BulkScanItem>) =>
    setItems(prev => prev.map((item, i) => i === index ? { ...item, ...updates } : item));

  const removeItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
    if (expandedRow === index) setExpandedRow(null);
    else if (expandedRow !== null && expandedRow > index) setExpandedRow(expandedRow - 1);
  };

  const handleAddAll = async () => {
    if (!activeProfile) return;
    const validItems = items.filter(i => i.name?.trim());
    if (validItems.length === 0) return;

    setPhase('lookup');
    setLookupError(null);
    try {
      const res = await fetch('/api/cellar/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile_id: activeProfile.id,
          location,
          items: validItems.map(item => ({
            barcode: item.barcode,
            wine_id: item.wine_id,
            name: item.name!.trim(),
            producer: item.producer,
            vintage_year: item.vintage_year,
            variety: item.variety,
            wine_type: item.wine_type,
            region: item.region,
            appellation: item.appellation,
            country: item.country,
            description: item.description,
            quantity: Math.max(1, item.quantity),
            purchase_price: item.purchase_price,
          })),
        }),
      });
      const data = await res.json();
      setAddedCount(data.added ?? 0);
      setAddErrors(data.errors ?? []);
      setPhase('done');
    } catch (err) {
      setLookupError(err instanceof Error ? err.message : 'Add failed');
      setPhase('review');
    }
  };

  const handleReset = () => {
    scannedRef.current.clear();
    setScanEntries([]);
    setCapturingLabel(null);
    setItems([]);
    setLocation('');
    setExpandedRow(null);
    setLookupError(null);
    setPhase('scan');
  };

  const hasPending = scanEntries.some(e => e.state === 'looking-up' || e.state === 'label-scanning');
  const unnamedCount = items.filter(i => !i.name?.trim()).length;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <PackagePlus className="h-6 w-6 text-primary shrink-0" />
        <div>
          <h2 className="text-xl font-bold">Bulk Scan</h2>
          <p className="text-sm text-muted-foreground">
            {phase === 'scan' && 'Scan barcodes — found wines appear instantly. Use "Scan Label" for unknown bottles.'}
            {phase === 'lookup' && 'Adding bottles to your cellar…'}
            {phase === 'review' && 'Review and edit, then add to your cellar.'}
            {phase === 'done' && 'Bottles added to your cellar.'}
          </p>
        </div>
      </div>

      {/* ── Phase 1: Scan ── */}
      {phase === 'scan' && (
        <div className="space-y-4">
          {/* Barcode scanner — hidden while label capture overlay is open */}
          {!capturingLabel && <BarcodeScanner onDetected={handleDetected} autoStart />}

          {/* Scanned items list */}
          <div className="rounded-lg border bg-card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
              <span className="text-sm font-medium flex items-center gap-2">
                <Barcode className="h-4 w-4" />
                Scanned
              </span>
              <span className="text-xs text-muted-foreground">{scanEntries.length} unique</span>
            </div>

            {scanEntries.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground text-center">
                Point the scanner at a barcode to begin.
              </p>
            ) : (
              <ul className="divide-y max-h-80 overflow-y-auto">
                {scanEntries.map(entry => (
                  <li key={entry.barcode} className="px-4 py-3">

                    {/* Looking up */}
                    {entry.state === 'looking-up' && (
                      <div className="flex items-center gap-3">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
                        <span className="text-xs font-mono text-muted-foreground flex-1 truncate">{entry.barcode}</span>
                      </div>
                    )}

                    {/* Found (DB or Open Food Facts) */}
                    {(entry.state === 'found' || entry.state === 'label-found') && (
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 h-5 w-5 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                          <Check className="h-3 w-3 text-green-700" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {entry.data?.source && (
                              <span className={cn('text-xs px-1.5 py-0.5 rounded font-medium shrink-0', SOURCE_COLORS[entry.data.source] ?? 'bg-muted text-muted-foreground')}>
                                {SOURCE_LABELS[entry.data.source] ?? entry.data.source}
                              </span>
                            )}
                            <span className="text-sm font-medium">{entry.data?.name}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {[entry.data?.producer, entry.data?.vintage_year, entry.data?.wine_type].filter(Boolean).join(' · ')}
                          </p>
                        </div>
                        <button type="button" onClick={() => removeEntry(entry.barcode)} className="text-muted-foreground hover:text-destructive transition-colors shrink-0">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}

                    {/* Not found — offer label scan */}
                    {entry.state === 'not-found' && (
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
                        <span className="text-xs font-mono text-muted-foreground flex-1 truncate">{entry.barcode}</span>
                        <button
                          type="button"
                          onClick={() => setCapturingLabel(entry.barcode)}
                          className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-primary/40 text-primary hover:bg-primary/5 transition-colors shrink-0"
                        >
                          <Camera className="h-3 w-3" />
                          Scan Label
                        </button>
                        <button type="button" onClick={() => removeEntry(entry.barcode)} className="text-muted-foreground hover:text-destructive transition-colors shrink-0">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}

                    {/* Label is being sent to AI */}
                    {entry.state === 'label-scanning' && (
                      <div className="flex items-center gap-3">
                        <Loader2 className="h-4 w-4 animate-spin text-purple-600 shrink-0" />
                        <span className="text-xs text-muted-foreground flex-1">Reading label…</span>
                        <span className="text-xs font-mono text-muted-foreground/50 truncate max-w-[120px]">{entry.barcode}</span>
                      </div>
                    )}

                    {/* Label scan failed */}
                    {entry.state === 'label-failed' && (
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                        <span className="text-xs text-muted-foreground flex-1 truncate">{entry.barcode}</span>
                        <button
                          type="button"
                          onClick={() => setCapturingLabel(entry.barcode)}
                          className="flex items-center gap-1 text-xs px-2 py-1 rounded border text-muted-foreground hover:bg-accent transition-colors shrink-0"
                        >
                          <RotateCcw className="h-3 w-3" />
                          Retry
                        </button>
                        <button type="button" onClick={() => removeEntry(entry.barcode)} className="text-muted-foreground hover:text-destructive transition-colors shrink-0">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}

                  </li>
                ))}
              </ul>
            )}
          </div>

          <button
            type="button"
            onClick={handleDoneScanning}
            disabled={scanEntries.length === 0 || hasPending}
            className="w-full py-2.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-40 transition-colors"
          >
            {hasPending
              ? 'Looking up…'
              : scanEntries.length === 0
                ? 'Scan a barcode to begin'
                : `Review ${scanEntries.length} Bottle${scanEntries.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      )}

      {/* ── Label capture overlay (full-screen, replaces scan view) ── */}
      {capturingLabel && (
        <div className="fixed inset-0 z-50 bg-background flex flex-col">
          <div className="flex items-center gap-3 px-4 py-3 border-b shrink-0">
            <button
              type="button"
              onClick={() => setCapturingLabel(null)}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
            <div>
              <p className="text-sm font-medium">Scan Wine Label</p>
              <p className="text-xs text-muted-foreground font-mono">{capturingLabel}</p>
            </div>
          </div>
          <div className="flex-1 overflow-auto p-4">
            <LabelCapture
              onCapture={(imageBase64) => handleLabelCapture(capturingLabel, imageBase64)}
              onCancel={() => setCapturingLabel(null)}
            />
          </div>
        </div>
      )}

      {/* ── Phase 2: Adding to cellar (loading) ── */}
      {phase === 'lookup' && (
        <div className="flex flex-col items-center gap-4 py-16">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground text-center">Adding bottles to your cellar…</p>
        </div>
      )}

      {/* ── Phase 3: Review ── */}
      {phase === 'review' && (
        <div className="space-y-5">
          {activeProfile && (
            <div className="rounded-lg border bg-card p-4 space-y-2">
              <label className="text-sm font-medium block">Storage Location</label>
              <p className="text-xs text-muted-foreground">All bottles in this batch will be assigned to this location. You can change individual bottles later.</p>
              <LocationPicker
                profileId={activeProfile.id}
                value={location}
                onChange={setLocation}
                placeholder="Select or create a location…"
              />
            </div>
          )}

          {lookupError && (
            <div className="rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
              {lookupError}
            </div>
          )}

          {unnamedCount > 0 && (
            <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
              {unnamedCount} bottle{unnamedCount !== 1 ? 's' : ''} ha{unnamedCount !== 1 ? 've' : 's'} no name — enter a name or remove them before adding.
            </div>
          )}

          <div className="rounded-lg border bg-card overflow-hidden divide-y">
            {items.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground text-center">No items remaining.</p>
            ) : (
              items.map((item, idx) => (
                <div key={`${item.barcode}-${idx}`}>
                  {/* Row summary */}
                  <div
                    className={cn('flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/40 transition-colors', !item.name?.trim() && 'bg-amber-50/60')}
                    onClick={() => setExpandedRow(expandedRow === idx ? null : idx)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {item.source && (
                          <span className={cn('text-xs px-1.5 py-0.5 rounded font-medium shrink-0', SOURCE_COLORS[item.source] ?? 'bg-muted text-muted-foreground')}>
                            {SOURCE_LABELS[item.source] ?? item.source}
                          </span>
                        )}
                        <span className={cn('text-sm font-medium truncate', !item.name?.trim() && 'italic text-muted-foreground')}>
                          {item.name?.trim() || 'Unnamed — tap to edit'}
                        </span>
                      </div>
                      {item.producer && <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.producer}</p>}
                      {(item.purchase_price ?? item.average_price) != null && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          ${(item.purchase_price ?? item.average_price)!.toFixed(2)}
                          {item.purchase_price == null && item.average_price != null && ' (suggested)'}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-sm font-semibold text-primary">{item.quantity}×</span>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); removeItem(idx); }}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                      {expandedRow === idx
                        ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    </div>
                  </div>

                  {/* Expanded edit form */}
                  {expandedRow === idx && (
                    <div className="px-4 py-3 border-t bg-muted/20 space-y-3" onClick={e => e.stopPropagation()}>
                      <p className="text-xs text-muted-foreground font-mono">{item.barcode}</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2">
                          <label className="text-xs font-medium text-muted-foreground">Wine Name *</label>
                          <input className={inputCls} value={item.name ?? ''} onChange={e => updateItem(idx, { name: e.target.value })} placeholder="Required" />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground">Producer</label>
                          <input className={inputCls} value={item.producer ?? ''} onChange={e => updateItem(idx, { producer: e.target.value })} />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground">Vintage</label>
                          <input type="number" className={inputCls} value={item.vintage_year ?? ''} onChange={e => updateItem(idx, { vintage_year: e.target.value ? parseInt(e.target.value, 10) : undefined })} min={1900} max={new Date().getFullYear() + 1} />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground">Type</label>
                          <select className={inputCls} value={item.wine_type ?? ''} onChange={e => updateItem(idx, { wine_type: e.target.value as WineType || undefined })}>
                            <option value="">Unknown</option>
                            {WINE_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground">Quantity</label>
                          <input type="number" className={inputCls} value={item.quantity} onChange={e => updateItem(idx, { quantity: Math.max(1, parseInt(e.target.value, 10) || 1) })} min={1} />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground">Variety</label>
                          <input className={inputCls} value={item.variety ?? ''} onChange={e => updateItem(idx, { variety: e.target.value })} />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground">Region</label>
                          <input className={inputCls} value={item.region ?? ''} onChange={e => updateItem(idx, { region: e.target.value })} />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground">Country</label>
                          <input className={inputCls} value={item.country ?? ''} onChange={e => updateItem(idx, { country: e.target.value })} />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground">
                            Purchase Price ($)
                            {item.average_price != null && item.purchase_price == null && (
                              <span className="ml-1 text-muted-foreground/60">suggested: ${item.average_price.toFixed(2)}</span>
                            )}
                          </label>
                          <input type="number" className={inputCls} value={item.purchase_price ?? ''} onChange={e => updateItem(idx, { purchase_price: e.target.value ? parseFloat(e.target.value) : undefined })} placeholder={item.average_price != null ? `~$${item.average_price.toFixed(2)}` : 'Optional'} min={0} step={0.01} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          <div className="flex gap-3">
            <button type="button" onClick={handleReset} className="px-4 py-2 rounded-md border text-sm hover:bg-accent transition-colors">
              Start Over
            </button>
            <button
              type="button"
              onClick={handleAddAll}
              disabled={items.length === 0 || unnamedCount > 0 || !activeProfile}
              className="flex-1 py-2.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-40 transition-colors"
            >
              Add {items.reduce((s, i) => s + i.quantity, 0)} Bottle{items.reduce((s, i) => s + i.quantity, 0) !== 1 ? 's' : ''} to Cellar
            </button>
          </div>
        </div>
      )}

      {/* ── Phase 4: Done ── */}
      {phase === 'done' && (
        <div className="rounded-lg border bg-card p-6 space-y-4 text-center">
          <CheckCircle className="h-12 w-12 mx-auto text-green-600" />
          <div>
            <p className="text-xl font-bold">{addedCount} bottle{addedCount !== 1 ? 's' : ''} added!</p>
            {location
              ? <p className="text-sm text-muted-foreground mt-1">Stored in <strong>{location}</strong></p>
              : <p className="text-sm text-muted-foreground mt-1">Added as unlocated — assign locations from the cellar view.</p>
            }
          </div>

          {addErrors.length > 0 && (
            <div className="text-left rounded-md bg-amber-50 border border-amber-200 px-3 py-2 space-y-1">
              <p className="text-xs font-medium text-amber-800">Some items could not be added:</p>
              {addErrors.map((e, i) => <p key={i} className="text-xs text-amber-700">{e}</p>)}
            </div>
          )}

          <div className="flex flex-col gap-2 pt-2">
            {activeProfile && (
              <button type="button" onClick={() => router.push(`/profiles/${activeProfile.id}`)} className="w-full py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
                View Cellar
              </button>
            )}
            <button type="button" onClick={handleReset} className="w-full py-2 rounded-md border text-sm hover:bg-accent transition-colors">
              Scan More Bottles
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
