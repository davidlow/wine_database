'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, CheckCircle, XCircle, Camera } from 'lucide-react';
import BarcodeScanner from '@/components/BarcodeScanner';
import type { WineLookupResult } from '@/lib/wine-lookup/types';
import Link from 'next/link';

type ScanState = 'idle' | 'looking-up' | 'found' | 'not-found' | 'error';

export default function ScannerPage() {
  const router = useRouter();
  const [scanState, setScanState] = useState<ScanState>('idle');
  const [result, setResult] = useState<WineLookupResult | null>(null);
  const [scannedCode, setScannedCode] = useState<string | null>(null);
  const [active, setActive] = useState(true);

  const handleDetected = async (barcode: string) => {
    if (scanState === 'looking-up') return;
    setActive(false);
    setScannedCode(barcode);
    setScanState('looking-up');

    try {
      const res = await fetch(`/api/barcode/${barcode}`);
      if (!res.ok) throw new Error('Lookup failed');
      const data: WineLookupResult = await res.json();
      setResult(data);
      setScanState(data.found ? 'found' : 'not-found');
    } catch {
      setScanState('error');
    }
  };

  const handleReset = () => {
    setScanState('idle');
    setResult(null);
    setScannedCode(null);
    setActive(true);
  };

  return (
    <div className="max-w-md mx-auto px-4 py-6 space-y-6">
      <div>
        <h2 className="text-xl font-bold">Barcode Scanner</h2>
        <p className="text-sm text-muted-foreground">Scan a wine barcode to look up information.</p>
      </div>

      {/* Scanner view — only when active */}
      {active && (
        <BarcodeScanner onDetected={handleDetected} autoStart />
      )}

      {/* Result panel */}
      {scanState === 'looking-up' && (
        <div className="flex flex-col items-center gap-3 py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Looking up barcode {scannedCode}…</p>
        </div>
      )}

      {scanState === 'found' && result && (
        <div className="rounded-lg border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2 text-green-700">
            <CheckCircle className="h-5 w-5" />
            <span className="font-semibold text-sm">Wine Found!</span>
            {result.source && <span className="text-xs text-muted-foreground">via {result.source}</span>}
          </div>

          <div className="space-y-1 text-sm">
            <p className="font-bold text-base">{result.name}</p>
            {result.producer && <p className="text-muted-foreground">{result.producer}</p>}
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground text-xs mt-2">
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
                className="flex-1 text-center py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                View in Catalog
              </Link>
            ) : (
              <Link
                href={`/wines/new?barcode=${scannedCode}`}
                className="flex-1 text-center py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                Add to My Cellar
              </Link>
            )}
            <button onClick={handleReset} className="py-2 rounded-md border text-sm hover:bg-accent transition-colors">
              Scan Another
            </button>
          </div>
        </div>
      )}

      {scanState === 'not-found' && (
        <div className="rounded-lg border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2 text-amber-600">
            <XCircle className="h-5 w-5" />
            <span className="font-semibold text-sm">Wine Not Found</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Barcode <code className="text-xs bg-muted px-1 rounded">{scannedCode}</code> was not found in any database.
          </p>
          <div className="flex flex-col gap-2">
            <Link
              href={`/wines/new?barcode=${scannedCode}`}
              className="text-center py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Add Manually
            </Link>
            <button onClick={handleReset} className="py-2 rounded-md border text-sm hover:bg-accent transition-colors">
              Scan Again
            </button>
          </div>
        </div>
      )}

      {scanState === 'error' && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 space-y-3">
          <p className="text-sm text-destructive font-medium">Lookup failed. Please try again.</p>
          <button onClick={handleReset} className="py-2 px-4 rounded-md border text-sm hover:bg-accent transition-colors">
            Try Again
          </button>
        </div>
      )}

      {/* Label scan stub */}
      <div className="rounded-lg border border-dashed p-4 text-center space-y-2">
        <Camera className="h-6 w-6 mx-auto text-muted-foreground" />
        <p className="text-sm font-medium text-muted-foreground">Scan Label with AI</p>
        <p className="text-xs text-muted-foreground">Coming soon — point camera at label to extract wine info via vision AI</p>
        <button disabled className="text-xs px-4 py-1.5 rounded-md border opacity-50 cursor-not-allowed">
          Scan Label (Coming Soon)
        </button>
      </div>
    </div>
  );
}
