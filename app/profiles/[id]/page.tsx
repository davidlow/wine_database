'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { ArrowLeft, MapPin, Wine } from 'lucide-react';
import type { CellarInventory, Profile, BottleTransaction } from '@/types';
import { useProfile } from '@/hooks/useProfile';
import TransactionLog from '@/components/TransactionLog';
import BottleManager from '@/components/BottleManager';
import { cn } from '@/lib/utils';

export default function ProfileDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { profiles } = useProfile();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [inventory, setInventory] = useState<CellarInventory[]>([]);
  const [transactions, setTransactions] = useState<BottleTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'inventory' | 'transactions'>('inventory');
  const [selectedWineId, setSelectedWineId] = useState<string | null>(null);

  const loadInventory = async () => {
    const res = await fetch(`/api/cellar?profile_id=${id}`);
    if (res.ok) setInventory(await res.json());
  };

  const loadTransactions = async () => {
    const res = await fetch(`/api/transactions?profile_id=${id}`);
    if (res.ok) setTransactions(await res.json());
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/profiles/${id}`);
        if (res.ok) setProfile(await res.json());
        await Promise.all([loadInventory(), loadTransactions()]);
      } finally {
        setLoading(false);
      }
    };
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) return <div className="flex items-center justify-center h-64 text-sm text-muted-foreground">Loading…</div>;
  if (!profile) return <div className="px-4 py-6 text-sm text-muted-foreground">Profile not found.</div>;

  const totalBottles = inventory.reduce((s, i) => s + i.quantity, 0);
  const uniqueWines = new Set(inventory.map((i) => i.wine_id)).size;

  // Group inventory by wine
  const byWine = inventory.reduce<Record<string, CellarInventory[]>>((acc, item) => {
    const key = item.wine_id;
    acc[key] = [...(acc[key] ?? []), item];
    return acc;
  }, {});

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/profiles" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h2 className="text-xl font-bold">{profile.name}</h2>
          {profile.description && <p className="text-sm text-muted-foreground">{profile.description}</p>}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border bg-card px-4 py-3 text-center">
          <p className="text-2xl font-bold">{totalBottles}</p>
          <p className="text-xs text-muted-foreground">Total Bottles</p>
        </div>
        <div className="rounded-lg border bg-card px-4 py-3 text-center">
          <p className="text-2xl font-bold">{uniqueWines}</p>
          <p className="text-xs text-muted-foreground">Unique Wines</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="space-y-4">
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
          <div className="space-y-4">
            {inventory.length === 0 ? (
              <div className="text-center py-8 space-y-2">
                <Wine className="h-10 w-10 mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No bottles in this cellar.</p>
                <Link href="/wines" className="text-primary text-sm underline">Browse wine catalog</Link>
              </div>
            ) : (
              Object.entries(byWine).map(([wineId, items]) => {
                const wine = items[0]?.wine;
                const total = items.reduce((s, i) => s + i.quantity, 0);
                return (
                  <div key={wineId} className="rounded-lg border bg-card overflow-hidden">
                    <div
                      className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => setSelectedWineId(selectedWineId === wineId ? null : wineId)}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{wine?.name ?? 'Unknown Wine'}</p>
                        {wine?.producer && <p className="text-xs text-muted-foreground">{wine.producer}</p>}
                      </div>
                      <span className="text-sm font-semibold ml-3 shrink-0">{total} btl</span>
                    </div>
                    {selectedWineId === wineId && (
                      <div className="border-t px-4 py-3 space-y-2">
                        {items.map((item) => (
                          <div key={item.id} className="flex items-center gap-2 text-sm">
                            <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className="flex-1 text-muted-foreground">{item.location}</span>
                            <span className="font-medium">{item.quantity}</span>
                          </div>
                        ))}
                        <Link href={`/wines/${wineId}`} className="text-xs text-primary hover:underline">
                          View wine & manage bottles →
                        </Link>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {activeTab === 'transactions' && (
          <div className="rounded-lg border bg-card px-4 py-2">
            <TransactionLog transactions={transactions} />
          </div>
        )}
      </div>
    </div>
  );
}
