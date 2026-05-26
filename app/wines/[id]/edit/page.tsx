'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import WineForm from '@/components/WineForm';
import type { Wine } from '@/types';

export default function EditWinePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [wine, setWine] = useState<Wine | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/wines/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setWine(data))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSubmit = async (data: Omit<Wine, 'id' | 'created_at' | 'updated_at'>) => {
    const res = await fetch(`/api/wines/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? 'Failed to update wine');
    }
    router.push(`/wines/${id}`);
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-sm text-muted-foreground">Loading…</div>;
  if (!wine) return <div className="px-4 py-6 text-sm text-muted-foreground">Wine not found.</div>;

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/wines/${id}`} className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h2 className="text-xl font-bold">Edit Wine</h2>
      </div>

      <WineForm
        initialData={wine}
        onSubmit={handleSubmit}
        onCancel={() => router.push(`/wines/${id}`)}
        submitLabel="Update Wine"
      />
    </div>
  );
}
