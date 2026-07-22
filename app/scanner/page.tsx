'use client';

import { useRef, useState } from 'react';
import { Loader2, CheckCircle, XCircle, Sparkles } from 'lucide-react';
import BarcodeScanner from '@/components/BarcodeScanner';
import LabelCapture from '@/components/LabelCapture';
import WineForm from '@/components/WineForm';
import type { WineLookupResult } from '@/lib/wine-lookup/types';
import type { Wine } from '@/types';
import Link from 'next/link';
import { PackagePlus, PackageSearch, MapPin, ScanSearch } from 'lucide-react';

type ScanState =
  | 'idle'
  | 'looking-up'       // barcode API in flight
  | 'found'            // barcode hit (internal DB or Open Food Facts)
  | 'not-found'        // barcode not in any external source
  | 'scanning-label'   // LabelCapture camera open
  | 'analyzing-label'  // Gemini API in flight
  | 'confirming'       // WineForm pre-filled with Gemini result
  | 'saving'           // POST /api/wines in flight
  | 'saved'            // wine created successfully
  | 'error';

export default function ScannerPage() {
  // Ref-based guard prevents the ZXing callback race: even with the debounce
  // in useBarcode, React state updates are async so scanState can lag by one
  // render. processingRef is synchronous and blocks immediately.
  const processingRef = useRef(false);

  const [scanState, setScanState] = useState<ScanState>('idle');
  const [result, setResult] = useState<WineLookupResult | null>(null);
  const [scannedCode, setScannedCode] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [savedWineId, setSavedWineId] = useState<string | null>(null);
  const [savedWineName, setSavedWineName] = useState<string | null>(null);
  const [showScanner, setShowScanner] = useState(true);
  const [manualBarcode, setManualBarcode] = useState('');
  const [capturedLabelImage, setCapturedLabelImage] = useState<string | null>(null);
  const [labelFoodPairings, setLabelFoodPairings] = useState<string[]>([]);
  const [labelCuisineTags, setLabelCuisineTags] = useState<string[]>([]);

  const handleDetected = async (barcode: string) => {
    if (processingRef.current) return;
    processingRef.current = true;
    setShowScanner(false);
    setScannedCode(barcode);
    setScanState('looking-up');

    try {
      const res = await fetch(`/api/barcode/${barcode}`);
      if (!res.ok) throw new Error('Lookup failed');
      const data: WineLookupResult = await res.json();
      setResult(data);
      setScanState(data.found ? 'found' : 'not-found');
    } catch {
      setErrorMessage('Barcode lookup failed. You can try scanning the label or add manually.');
      setScanState('error');
    }
  };

  const handleReset = () => {
    processingRef.current = false;
    setScanState('idle');
    setResult(null);
    setScannedCode(null);
    setErrorMessage(null);
    setSavedWineId(null);
    setSavedWineName(null);
    setShowScanner(true);
    setManualBarcode('');
    setCapturedLabelImage(null);
    setLabelFoodPairings([]);
  };

  const handleLabelCapture = async ({ gemini, thumbnail }: { gemini: string; thumbnail: string }) => {
    setCapturedLabelImage(thumbnail);
    setScanState('analyzing-label');
    setErrorMessage(null);
    try {
      const res = await fetch('/api/label-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: gemini, barcode: scannedCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Analysis failed');
      if (!data.found || !data.name) {
        setErrorMessage("Gemini couldn't identify this wine. Try a clearer shot or add manually.");
        setScanState('not-found');
        return;
      }
      setResult(data as WineLookupResult);
      if (Array.isArray(data.food_pairings) && data.food_pairings.length > 0) {
        setLabelFoodPairings(data.food_pairings as string[]);
      }
      if (Array.isArray(data.cuisine_tags) && data.cuisine_tags.length > 0) {
        setLabelCuisineTags(data.cuisine_tags as string[]);
      }
      setScanState('confirming');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Label analysis failed');
      setScanState('error');
    }
  };

  const handleSaveWine = async (data: Omit<Wine, 'id' | 'created_at' | 'updated_at'>) => {
    // Merge label image and structural elements from Gemini into the payload
    const extras: Partial<Wine> = {};
    if (capturedLabelImage) extras.label_image = capturedLabelImage;
    if (result?.acidity != null) extras.acidity = result.acidity;
    if (result?.tannin != null) extras.tannin = result.tannin;
    if (result?.alcohol != null) extras.alcohol = result.alcohol;
    if (result?.sweetness != null) extras.sweetness = result.sweetness;
    if (result?.body != null) extras.body = result.body;
    if (result?.minerality != null) extras.minerality = result.minerality;
    if (result?.oak_influence != null) extras.oak_influence = result.oak_influence;
    if (result?.fruit_intensity != null) extras.fruit_intensity = result.fruit_intensity;
    if (result?.fruit_profile) extras.fruit_profile = result.fruit_profile;
    if (result?.pairing_rationale) extras.pairing_rationale = result.pairing_rationale;

    const res = await fetch('/api/wines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, ...extras }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? 'Failed to save wine');
    }
    const wine: Wine = await res.json();

    // Batch-add food pairings from Gemini label scan (fire-and-forget, non-blocking)
    if (labelFoodPairings.length > 0) {
      for (const food of labelFoodPairings) {
        fetch(`/api/wines/${wine.id}/pairings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ food }),
        }).catch(() => { /* ignore individual pairing failures */ });
      }
    }
    // Batch-add cuisine tags from Gemini label scan (fire-and-forget, non-blocking)
    if (labelCuisineTags.length > 0) {
      for (const tag of labelCuisineTags) {
        fetch(`/api/wines/${wine.id}/cuisine-tags`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tag }),
        }).catch(() => { /* ignore individual tag failures */ });
      }
    }

    setSavedWineId(wine.id);
    setSavedWineName(wine.name);
    setScanState('saved');
  };

  return (
    <div className="max-w-md mx-auto px-4 py-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold">
            {scanState === 'scanning-label' ? 'Scan Label' :
             scanState === 'confirming' ? 'Confirm Wine Details' :
             'Barcode Scanner'}
          </h2>
          <p className="text-sm text-muted-foreground">
            {scanState === 'scanning-label' ? 'Point camera at the wine label, then tap Capture.' :
             scanState === 'confirming' ? 'Review the AI-extracted details before saving.' :
             'Scan a barcode to look up wine info automatically.'}
          </p>
        </div>
        {scanState === 'idle' && (
          <div className="flex gap-2 shrink-0">
            <Link
              href="/scanner/receipt"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium hover:bg-accent transition-colors"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Scan Receipt
            </Link>
            <Link
              href="/scanner/bulk"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium hover:bg-accent transition-colors"
            >
              <PackagePlus className="h-3.5 w-3.5" />
              Bulk Scan
            </Link>
            <Link
              href="/scanner/rack"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium hover:bg-accent transition-colors"
            >
              <PackageSearch className="h-3.5 w-3.5" />
              Rack Scan
            </Link>
            <Link
              href="/scanner/locate"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium hover:bg-accent transition-colors"
            >
              <MapPin className="h-3.5 w-3.5" />
              Locate
            </Link>
            <Link
              href="/finder"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium hover:bg-accent transition-colors"
            >
              <ScanSearch className="h-3.5 w-3.5" />
              Finder
            </Link>
          </div>
        )}
      </div>

      {/* Barcode scanner */}
      {showScanner && (
        <>
          <BarcodeScanner onDetected={handleDetected} autoStart />
          {/* Manual entry fallback — if ZXing doesn't detect on this device */}
          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                value={manualBarcode}
                onChange={e => setManualBarcode(e.target.value.trim())}
                onKeyDown={e => {
                  if (e.key === 'Enter' && manualBarcode) handleDetected(manualBarcode);
                }}
                placeholder="Or type barcode manually…"
                className="flex-1 px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                disabled={!manualBarcode}
                onClick={() => handleDetected(manualBarcode)}
                className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-40 transition-colors"
              >
                Look Up
              </button>
            </div>
            <button
              onClick={() => { setShowScanner(false); setScanState('scanning-label'); }}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-md border text-sm text-muted-foreground hover:bg-accent transition-colors"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Skip barcode — scan label with Gemini instead
            </button>
          </div>
        </>
      )}

      {/* Label capture camera */}
      {scanState === 'scanning-label' && (
        <LabelCapture
          onCapture={handleLabelCapture}
          onCancel={() => setScanState('not-found')}
        />
      )}

      {/* Loading spinners */}
      {(scanState === 'looking-up' || scanState === 'analyzing-label' || scanState === 'saving') && (
        <div className="flex flex-col items-center gap-3 py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground text-center">
            {scanState === 'looking-up' && `Looking up barcode ${scannedCode}…`}
            {scanState === 'analyzing-label' && 'Analyzing label with Gemini AI…\nThis takes ~5 seconds.'}
            {scanState === 'saving' && 'Saving wine…'}
          </p>
        </div>
      )}

      {/* ── Found ── */}
      {scanState === 'found' && result && (
        <div className="rounded-lg border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2 text-green-700">
            <CheckCircle className="h-5 w-5" />
            <span className="font-semibold text-sm">Wine Found!</span>
            {result.source && (
              <span className="text-xs text-muted-foreground ml-auto">via {result.source}</span>
            )}
          </div>

          <div className="space-y-1 text-sm">
            <p className="font-bold text-base">{result.name}</p>
            {result.producer && <p className="text-muted-foreground">{result.producer}</p>}
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mt-2">
              {result.vintage_year && <span>🍾 {result.vintage_year}</span>}
              {result.variety && <span>🍇 {result.variety}</span>}
              {result.region && <span>📍 {result.region}</span>}
              {result.country && <span>{result.country}</span>}
            </div>
          </div>

          <div className="flex flex-col gap-2 pt-2">
            {result.source === 'database' ? (
              <Link
                href={`/wines?query=${encodeURIComponent(result.name ?? '')}`}
                className="text-center py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                View in Catalog
              </Link>
            ) : (
              <Link
                href={`/wines/new?barcode=${scannedCode}`}
                className="text-center py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                Add to My Cellar
              </Link>
            )}
            <button onClick={handleReset} className="py-2 rounded-md border text-sm hover:bg-accent transition-colors">
              Scan Another
            </button>
            <button
              onClick={() => { setErrorMessage(null); setScanState('scanning-label'); }}
              className="flex items-center justify-center gap-2 py-2 rounded-md border text-sm text-muted-foreground hover:bg-accent transition-colors"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Wrong wine? Scan label with Gemini
            </button>
          </div>
        </div>
      )}

      {/* ── Not found (also shown after a failed label read) ── */}
      {scanState === 'not-found' && (
        <div className="rounded-lg border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2 text-amber-600">
            <XCircle className="h-5 w-5" />
            <span className="font-semibold text-sm">Wine Not Found</span>
          </div>

          {errorMessage && (
            <p className="text-sm text-amber-700 bg-amber-50 rounded-md px-3 py-2">{errorMessage}</p>
          )}

          {!errorMessage && (
            <p className="text-sm text-muted-foreground">
              Barcode <code className="text-xs bg-muted px-1 rounded">{scannedCode}</code> was not
              found in any database. Scan the label to have AI identify it.
            </p>
          )}

          <div className="flex flex-col gap-2 pt-1">
            <button
              onClick={() => { setErrorMessage(null); setScanState('scanning-label'); }}
              className="flex items-center justify-center gap-2 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              <Sparkles className="h-4 w-4" />
              Scan Label with Gemini AI
            </button>
            <Link
              href={`/wines/new${scannedCode ? `?barcode=${scannedCode}` : ''}`}
              className="text-center py-2 rounded-md border text-sm hover:bg-accent transition-colors"
            >
              Add Manually
            </Link>
            <button onClick={handleReset} className="py-2 rounded-md border text-sm hover:bg-accent transition-colors">
              Scan Again
            </button>
          </div>
        </div>
      )}

      {/* ── Confirm AI results ── */}
      {scanState === 'confirming' && result && (
        <div className="space-y-3">
          {result.confidence != null && (
            <div className="flex items-center gap-2 text-sm text-purple-700 bg-purple-50 rounded-md px-3 py-2">
              <Sparkles className="h-4 w-4 shrink-0" />
              <span>
                Gemini identified this wine with{' '}
                <span className="font-semibold">{Math.round(result.confidence * 100)}%</span> confidence.
                Review and edit before saving.
              </span>
            </div>
          )}
          <WineForm
            lookupResult={result}
            onSubmit={handleSaveWine}
            onCancel={() => setScanState('not-found')}
            submitLabel="Confirm & Save Wine"
          />
        </div>
      )}

      {/* ── Saved ── */}
      {scanState === 'saved' && savedWineId && (
        <div className="rounded-lg border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2 text-green-700">
            <CheckCircle className="h-5 w-5" />
            <span className="font-semibold text-sm">Wine Saved!</span>
          </div>
          {savedWineName && <p className="font-semibold">{savedWineName}</p>}
          <p className="text-xs text-muted-foreground">
            Future scans of this barcode will return instantly from your private database.
          </p>
          <div className="flex flex-col gap-2 pt-1">
            <Link
              href={`/wines/${savedWineId}`}
              className="text-center py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              View Wine
            </Link>
            <Link
              href="/cellar"
              className="text-center py-2 rounded-md border text-sm hover:bg-accent transition-colors"
            >
              Go to Cellar
            </Link>
            <button onClick={handleReset} className="py-2 rounded-md border text-sm hover:bg-accent transition-colors">
              Scan Another
            </button>
          </div>
        </div>
      )}

      {/* ── Error ── */}
      {scanState === 'error' && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 space-y-3">
          <p className="text-sm text-destructive font-medium">
            {errorMessage ?? 'Something went wrong.'}
          </p>
          <div className="flex flex-col gap-2">
            {scannedCode && (
              <button
                onClick={() => { setErrorMessage(null); setScanState('scanning-label'); }}
                className="flex items-center justify-center gap-2 py-2 rounded-md bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors"
              >
                <Sparkles className="h-4 w-4" />
                Try Scanning Label
              </button>
            )}
            <Link
              href={`/wines/new${scannedCode ? `?barcode=${scannedCode}` : ''}`}
              className="text-center py-2 rounded-md border text-sm hover:bg-accent transition-colors"
            >
              Add Manually
            </Link>
            <button onClick={handleReset} className="py-2 rounded-md border text-sm hover:bg-accent transition-colors">
              Start Over
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
