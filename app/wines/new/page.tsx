'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import WineForm from '@/components/WineForm';
import type { Wine } from '@/types';
import type { WineLookupResult } from '@/lib/wine-lookup/types';

function NewWineContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const barcode = searchParams.get('barcode');
  const copyFrom = searchParams.get('copy_from');
  const [lookupResult, setLookupResult] = useState<WineLookupResult | undefined>();
  const [copyData, setCopyData] = useState<Partial<Omit<Wine, 'id' | 'created_at' | 'updated_at'>> | undefined>();
  const [lookupLoading, setLookupLoading] = useState(false);

  // Barcode lookup
  useEffect(() => {
    if (!barcode) return;
    setLookupLoading(true);
    fetch(`/api/barcode/${barcode}`)
      .then((r) => r.json())
      .then((data) => setLookupResult(data))
      .catch(() => setLookupResult({ found: false, barcode }))
      .finally(() => setLookupLoading(false));
  }, [barcode]);

  // Copy-from wine lookup — strip id/barcode/image so the user gets a blank-barcode duplicate
  useEffect(() => {
    if (!copyFrom) return;
    setLookupLoading(true);
    fetch(`/api/wines/${copyFrom}`)
      .then(r => r.ok ? r.json() : null)
      .then((w: Wine | null) => {
        if (!w) return;
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id, created_at, updated_at, barcode: _b, image_url: _i, ...rest } = w;
        setCopyData(rest);
      })
      .finally(() => setLookupLoading(false));
  }, [copyFrom]);

  const handleSubmit = async (data: Omit<Wine, 'id' | 'created_at' | 'updated_at'>) => {
    const res = await fetch('/api/wines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? 'Failed to create wine');
    }
    const wine: Wine = await res.json();
    router.push(`/wines/${wine.id}`);
  };

  const pageTitle = copyFrom ? 'Duplicate Wine' : 'Add Wine';

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <Link href={copyFrom ? `/wines/${copyFrom}` : '/wines'} className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h2 className="text-xl font-bold">{pageTitle}</h2>
        {copyFrom && (
          <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded">
            Edit fields to make it unique
          </span>
        )}
      </div>

      {lookupLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
          <span className="animate-spin">⟳</span>
          {barcode ? `Looking up barcode ${barcode}…` : 'Loading wine data…'}
        </div>
      ) : null}

      <WineForm
        initialData={copyData}
        lookupResult={lookupResult}
        onSubmit={handleSubmit}
        onCancel={() => router.back()}
        submitLabel="Save Wine"
      />
    </div>
  );
}

export default function NewWinePage() {
  return (
    <Suspense fallback={<div className="px-4 py-6 text-sm text-muted-foreground">Loading…</div>}>
      <NewWineContent />
    </Suspense>
  );
}
