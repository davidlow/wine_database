'use client';

import { useState, useCallback } from 'react';
import { Camera, ChevronLeft, Loader2, ScanLine, Search } from 'lucide-react';
import BarcodeScanner from '@/components/BarcodeScanner';
import LabelCapture, { type LabelCaptureResult } from '@/components/LabelCapture';
import SearchSuggest from '@/components/SearchSuggest';
import { cn } from '@/lib/utils';
import type { Wine, WineType } from '@/types';

// ── Types ──────────────────────────────────────────────────────────────────────

type Path =
  | 'choice'
  | 'barcode'
  | 'barcode-looking-up'
  | 'barcode-found'
  | 'producer'
  | 'label'
  | 'label-analyzing'
  | 'gemini-result';

export interface WineFinderProps {
  /** If set, producer search is limited to wines in this profile's cellar */
  profileId?: string;
  /** If true (default), a failed barcode/producer lookup redirects to label photo */
  requireLabelIfNotFound?: boolean;
  /** Called when a wine is positively identified */
  onSelect: (wine: Partial<Wine>, labelThumbnail?: string) => void;
  /** Called when the user can't find the wine and wants to enter manually */
  onManualEntry: () => void;
  /** Optional back/cancel — shown on the choice screen */
  onCancel?: () => void;
}

const WINE_TYPES: WineType[] = ['red', 'white', 'rosé', 'sparkling', 'dessert', 'fortified', 'other'];

const TYPE_LABELS: Record<WineType, string> = {
  red: 'Red', white: 'White', rosé: 'Rosé', sparkling: 'Sparkling',
  dessert: 'Dessert', fortified: 'Fortified', other: 'Other',
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function WineFinder({
  profileId,
  requireLabelIfNotFound = true,
  onSelect,
  onManualEntry,
  onCancel,
}: WineFinderProps) {
  const [path, setPath] = useState<Path>('choice');

  // Barcode path
  const [barcodeCode, setBarcodeCode] = useState('');
  const [barcodeResult, setBarcodeResult] = useState<Partial<Wine> | null>(null);

  // Producer path
  const [producer, setProducer] = useState('');
  const [producerWines, setProducerWines] = useState<Partial<Wine>[]>([]);
  const [producerLoading, setProducerLoading] = useState(false);
  const [typeFilter, setTypeFilter] = useState<WineType | null>(null);
  const [varietyFilter, setVarietyFilter] = useState<string | null>(null);
  const [vintageFilter, setVintageFilter] = useState<number | null>(null);

  // Label / Gemini path
  const [capturedThumbnail, setCapturedThumbnail] = useState<string | null>(null);
  const [geminiResult, setGeminiResult] = useState<Partial<Wine> | null>(null);
  const [geminiError, setGeminiError] = useState<string | null>(null);

  // ── Reset ────────────────────────────────────────────────────────────────

  const reset = useCallback(() => {
    setPath('choice');
    setBarcodeCode('');
    setBarcodeResult(null);
    setProducer('');
    setProducerWines([]);
    setProducerLoading(false);
    setTypeFilter(null);
    setVarietyFilter(null);
    setVintageFilter(null);
    setCapturedThumbnail(null);
    setGeminiResult(null);
    setGeminiError(null);
  }, []);

  // ── Path A: Barcode ──────────────────────────────────────────────────────

  const handleBarcodeDetected = useCallback(async (barcode: string) => {
    setBarcodeCode(barcode);
    setPath('barcode-looking-up');
    try {
      const res = await fetch(`/api/barcode/${encodeURIComponent(barcode)}`);
      const data = await res.json();
      if (data.found && data.name) {
        setBarcodeResult(data);
        setPath('barcode-found');
      } else if (requireLabelIfNotFound) {
        setPath('label');
      } else {
        onManualEntry();
      }
    } catch {
      if (requireLabelIfNotFound) setPath('label');
      else onManualEntry();
    }
  }, [requireLabelIfNotFound, onManualEntry]);

  // ── Path B: Producer ─────────────────────────────────────────────────────

  const handleProducerCommit = useCallback(async (name: string) => {
    if (!name.trim()) return;
    setProducer(name);
    setProducerLoading(true);
    setProducerWines([]);
    setTypeFilter(null);
    setVarietyFilter(null);
    setVintageFilter(null);
    try {
      let wines: Partial<Wine>[] = [];
      if (profileId) {
        const res = await fetch(
          `/api/wines?profile_ids=${encodeURIComponent(profileId)}&producer=${encodeURIComponent(name)}`
        );
        wines = await res.json();
      } else {
        const res = await fetch(`/api/producers/${encodeURIComponent(name)}/wines`);
        wines = await res.json();
      }
      setProducerWines(Array.isArray(wines) ? wines : []);
    } catch {
      setProducerWines([]);
    } finally {
      setProducerLoading(false);
    }
  }, [profileId]);

  // Derived filter chips (client-side)
  const availableTypes = [...new Set(
    producerWines.map(w => w.wine_type).filter(Boolean) as WineType[]
  )];
  const availableVarieties = [...new Set(
    producerWines
      .filter(w => !typeFilter || w.wine_type === typeFilter)
      .map(w => w.variety).filter(Boolean) as string[]
  )].sort();
  const availableVintages = [...new Set(
    producerWines
      .filter(w =>
        (!typeFilter || w.wine_type === typeFilter) &&
        (!varietyFilter || w.variety === varietyFilter)
      )
      .map(w => w.vintage_year).filter(Boolean) as number[]
  )].sort((a, b) => b - a);

  const filteredWines = producerWines.filter(w => {
    if (typeFilter && w.wine_type !== typeFilter) return false;
    if (varietyFilter && w.variety !== varietyFilter) return false;
    if (vintageFilter && w.vintage_year !== vintageFilter) return false;
    return true;
  });

  // ── Path C: Label / Gemini ───────────────────────────────────────────────

  const handleLabelCapture = useCallback(async (result: LabelCaptureResult) => {
    setCapturedThumbnail(result.thumbnail);
    setGeminiResult(null);
    setGeminiError(null);
    setPath('label-analyzing');
    try {
      const res = await fetch('/api/label-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: result.gemini,
          backImageBase64: result.backGemini ?? null,
          barcode: barcodeCode || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.name) {
        setGeminiResult(data);
      } else {
        setGeminiError('Gemini could not identify the wine.');
      }
    } catch {
      setGeminiError('Label scan failed. Check your connection.');
    }
    setPath('gemini-result');
  }, [barcodeCode]);

  // ── Render ───────────────────────────────────────────────────────────────

  if (path === 'choice') {
    return (
      <div className="space-y-4 py-2">
        <p className="text-sm text-muted-foreground text-center">
          How would you like to identify this bottle?
        </p>
        <div className="grid grid-cols-3 gap-3">
          <EntryButton icon={<ScanLine className="h-6 w-6 text-primary" />} label="Scan Barcode" onClick={() => setPath('barcode')} />
          <EntryButton icon={<Search className="h-6 w-6 text-primary" />} label="Search Producer" onClick={() => setPath('producer')} />
          <EntryButton icon={<Camera className="h-6 w-6 text-primary" />} label="Photo Label" onClick={() => setPath('label')} />
        </div>
        {onCancel && (
          <button onClick={onCancel} className="w-full text-xs text-muted-foreground hover:text-foreground text-center py-1">
            Cancel
          </button>
        )}
      </div>
    );
  }

  if (path === 'barcode') {
    return (
      <div className="space-y-3">
        <BackHeader label="Scan Barcode" onBack={reset} />
        <BarcodeScanner onDetected={handleBarcodeDetected} autoStart />
      </div>
    );
  }

  if (path === 'barcode-looking-up') {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Looking up barcode…</p>
        <p className="text-xs font-mono text-muted-foreground/60">{barcodeCode}</p>
      </div>
    );
  }

  if (path === 'barcode-found' && barcodeResult) {
    return (
      <div className="space-y-4 py-2">
        <BackHeader label="Is this the right wine?" onBack={reset} />
        <WineCard wine={barcodeResult} />
        <div className="flex gap-3">
          <button
            onClick={() => onSelect(barcodeResult)}
            className="flex-1 py-2.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
          >
            ✓ Yes, this is it
          </button>
          <button onClick={reset} className="px-4 py-2.5 rounded-md border text-sm hover:bg-accent">
            ✗ Wrong
          </button>
        </div>
      </div>
    );
  }

  if (path === 'producer') {
    return (
      <div className="space-y-3">
        <BackHeader label="Search by Producer" onBack={reset} />

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
            {/* Type chips */}
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

            {/* Variety chips */}
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

            {/* Vintage chips */}
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

            {/* Wine list */}
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {filteredWines.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-3">No wines match these filters</p>
              ) : (
                filteredWines.map((w, i) => (
                  <button
                    key={w.id ?? i}
                    onClick={() => onSelect(w)}
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
              onClick={() => requireLabelIfNotFound ? setPath('label') : onManualEntry()}
              className="w-full text-xs text-muted-foreground hover:text-foreground text-center py-1"
            >
              {requireLabelIfNotFound ? 'Not in database — take a label photo →' : 'Not in database'}
            </button>
          </div>
        )}

        {!producerLoading && !producerWines.length && producer && (
          <p className="text-sm text-muted-foreground text-center py-3">
            Select a producer from the suggestions or press Enter to search.
          </p>
        )}
      </div>
    );
  }

  if (path === 'label') {
    return (
      <div className="space-y-3">
        <BackHeader
          label={requireLabelIfNotFound && barcodeCode ? 'Not in database — take a label photo' : 'Photo Label'}
          onBack={reset}
        />
        <LabelCapture onCapture={handleLabelCapture} onCancel={reset} />
        {requireLabelIfNotFound && (
          <button onClick={onManualEntry} className="w-full text-xs text-muted-foreground hover:text-foreground text-center py-1">
            Skip — add manually
          </button>
        )}
      </div>
    );
  }

  if (path === 'label-analyzing') {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Analyzing label with Gemini…</p>
      </div>
    );
  }

  if (path === 'gemini-result') {
    if (geminiError || !geminiResult) {
      return (
        <div className="space-y-4 py-2">
          <p className="text-sm text-destructive text-center">
            {geminiError ?? 'Could not identify the wine.'}
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => { setGeminiError(null); setGeminiResult(null); setCapturedThumbnail(null); setPath('label'); }}
              className="flex-1 py-2 rounded-md border text-sm hover:bg-accent"
            >
              Try again
            </button>
            <button onClick={onManualEntry} className="flex-1 py-2 rounded-md bg-primary text-primary-foreground text-sm hover:bg-primary/90">
              Add manually
            </button>
          </div>
          <button onClick={reset} className="w-full text-xs text-muted-foreground hover:text-foreground text-center">
            ← Choose different method
          </button>
        </div>
      );
    }

    return (
      <div className="space-y-4 py-2">
        <BackHeader
          label="Is this correct?"
          onBack={() => { setGeminiResult(null); setCapturedThumbnail(null); setPath('label'); }}
        />
        <div className="flex gap-3 items-start">
          {capturedThumbnail && (
            <img
              src={`data:image/webp;base64,${capturedThumbnail}`}
              alt=""
              className="w-16 h-24 object-cover rounded-lg shrink-0"
            />
          )}
          <WineCard wine={geminiResult} />
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => onSelect(geminiResult!, capturedThumbnail ?? undefined)}
            className="flex-1 py-2.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
          >
            ✓ Yes, that&apos;s it
          </button>
          <button
            onClick={() => { setGeminiResult(null); setCapturedThumbnail(null); setPath('label'); }}
            className="px-4 py-2.5 rounded-md border text-sm hover:bg-accent"
          >
            ✗ Wrong
          </button>
        </div>
        <button onClick={onManualEntry} className="w-full text-xs text-muted-foreground hover:text-foreground text-center py-1">
          Add manually instead
        </button>
      </div>
    );
  }

  return null;
}

// ── Small shared sub-components ───────────────────────────────────────────────

function BackHeader({ label, onBack }: { label: string; onBack: () => void }) {
  return (
    <div className="flex items-center gap-2">
      <button onClick={onBack} className="text-muted-foreground hover:text-foreground shrink-0">
        <ChevronLeft className="h-5 w-5" />
      </button>
      <p className="text-sm font-medium">{label}</p>
    </div>
  );
}

function EntryButton({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-2 rounded-xl border-2 border-muted hover:border-primary/60 hover:bg-muted/30 p-4 transition-colors text-center"
    >
      {icon}
      <span className="text-xs font-medium leading-tight">{label}</span>
    </button>
  );
}

function WineCard({ wine }: { wine: Partial<Wine> }) {
  return (
    <div className="rounded-lg border bg-muted/20 px-4 py-3 flex-1 min-w-0">
      <p className="font-semibold truncate">{wine.name ?? 'Unknown wine'}</p>
      {wine.producer && <p className="text-sm text-muted-foreground truncate">{wine.producer}</p>}
      <p className="text-xs text-muted-foreground mt-0.5">
        {[wine.wine_type, wine.variety, wine.vintage_year, wine.region].filter(Boolean).join(' · ')}
      </p>
    </div>
  );
}
