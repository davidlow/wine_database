'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, Edit, Trash2, MapPin, Calendar, DollarSign, Percent } from 'lucide-react';
import { useProfile } from '@/hooks/useProfile';
import type { Wine, CellarInventory } from '@/types';
import BottleManager from '@/components/BottleManager';
import TransactionLog from '@/components/TransactionLog';
import { cn, wineTypeLabel, wineTypeColor, formatPrice } from '@/lib/utils';

export default function WineDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { profiles } = useProfile();
  const [wine, setWine] = useState<Wine | null>(null);
  const [inventory, setInventory] = useState<CellarInventory[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState<'inventory' | 'transactions'>('inventory');
  const [transactions, setTransactions] = useState<CellarInventory[]>([]);

  const loadInventory = async () => {
    if (!profiles.length) return;
    const results = await Promise.all(
      profiles.map(async (p) => {
        const res = await fetch(`/api/cellar?wine_id=${id}&profile_id=${p.id}`);
        const items: CellarInventory[] = res.ok ? await res.json() : [];
        return items.map((item) => ({ ...item, profile: p }));
      })
    );
    setInventory(results.flat());
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/wines/${id}`);
        if (res.ok) setWine(await res.json());
        await loadInventory();
      } finally {
        setLoading(false);
      }
    };
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, profiles.length]);

  const handleDelete = async () => {
    const res = await fetch(`/api/wines/${id}`, { method: 'DELETE' });
    if (res.ok) window.location.href = '/wines';
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-sm text-muted-foreground">Loading…</div>;
  if (!wine) return <div className="px-4 py-6 text-sm text-muted-foreground">Wine not found.</div>;

  const totalBottles = inventory.reduce((s, i) => s + i.quantity, 0);

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/wines" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h2 className="text-lg font-bold truncate">{wine.name}</h2>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/wines/${id}/edit`} className="p-2 rounded-md hover:bg-accent transition-colors text-muted-foreground hover:text-foreground">
            <Edit className="h-4 w-4" />
          </Link>
          {deleteConfirm ? (
            <div className="flex items-center gap-1">
              <button onClick={handleDelete} className="text-xs px-2 py-1 rounded bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</button>
              <button onClick={() => setDeleteConfirm(false)} className="text-xs px-2 py-1 rounded border hover:bg-accent">Cancel</button>
            </div>
          ) : (
            <button onClick={() => setDeleteConfirm(true)} className="p-2 rounded-md hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive">
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Wine info */}
      <div className="rounded-lg border bg-card overflow-hidden">
        {wine.image_url && (
          <div className="relative h-40 w-full bg-muted">
            <Image src={wine.image_url} alt={wine.name} fill className="object-contain" />
          </div>
        )}
        <div className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-bold text-lg">{wine.name}</h3>
              {wine.producer && <p className="text-sm text-muted-foreground">{wine.producer}</p>}
            </div>
            {wine.wine_type && (
              <span className={cn('shrink-0 text-xs px-2 py-1 rounded-full font-medium', wineTypeColor(wine.wine_type))}>
                {wineTypeLabel(wine.wine_type)}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {wine.vintage_year && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Calendar className="h-3.5 w-3.5 shrink-0" />
                <span>{wine.vintage_year}</span>
              </div>
            )}
            {wine.variety && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <span className="text-base">🍇</span>
                <span>{wine.variety}</span>
              </div>
            )}
            {(wine.region || wine.country) && (
              <div className="flex items-center gap-1.5 text-muted-foreground col-span-2">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span>{[wine.appellation, wine.region, wine.country].filter(Boolean).join(', ')}</span>
              </div>
            )}
            {wine.average_price != null && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <DollarSign className="h-3.5 w-3.5 shrink-0" />
                <span>{formatPrice(wine.average_price)}</span>
              </div>
            )}
            {wine.alcohol_content != null && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Percent className="h-3.5 w-3.5 shrink-0" />
                <span>{wine.alcohol_content}% ABV</span>
              </div>
            )}
          </div>

          {wine.description && (
            <p className="text-sm text-muted-foreground border-t pt-3">{wine.description}</p>
          )}

          {wine.barcode && (
            <p className="text-xs text-muted-foreground">Barcode: {wine.barcode}</p>
          )}

          <div className="border-t pt-3">
            <span className={cn('text-sm font-medium px-2 py-1 rounded',
              totalBottles > 0 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'
            )}>
              {totalBottles} {totalBottles === 1 ? 'bottle' : 'bottles'} in cellar
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="space-y-3">
        <div className="flex gap-1 border-b">
          {(['inventory', 'transactions'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn('px-4 py-2 text-sm font-medium capitalize border-b-2 -mb-px transition-colors',
                activeTab === tab ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        {activeTab === 'inventory' && (
          <BottleManager
            wineId={id}
            profiles={profiles}
            inventory={inventory}
            onRefresh={loadInventory}
          />
        )}
      </div>
    </div>
  );
}
