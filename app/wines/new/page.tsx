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
  const [lookupResult, setLookupResult] = useState<WineLookupResult | undefined>();
  const [lookupLoading, setLookupLoading] = useState(false);

  useEffect(() => {
    if (!barcode) return;
    setLookupLoading(true);
    fetch(`/api/barcode/${barcode}`)
      .then((r) => r.json())
      .then((data) => setLookupResult(data))
      .catch(() => setLookupResult({ found: false, barcode }))
      .finally(() => setLookupLoading(false));
  }, [barcode]);

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

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/wines" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h2 className="text-xl font-bold">Add Wine</h2>
      </div>

      {lookupLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
          <span className="animate-spin">⟳</span> Looking up barcode {barcode}…
        </div>
      ) : null}

      <WineForm
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
