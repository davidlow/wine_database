'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Wine, ScanLine, Plus, ArrowRight, Layers } from 'lucide-react';
import { useProfile } from '@/hooks/useProfile';
import type { CellarInventory, BottleTransaction, Profile } from '@/types';
import TransactionLog from '@/components/TransactionLog';

interface ProfileSummary {
  profile: Profile;
  totalBottles: number;
  uniqueWines: number;
}

export default function DashboardPage() {
  const { profiles, activeProfile, loading: profileLoading } = useProfile();
  const [summaries, setSummaries] = useState<ProfileSummary[]>([]);
  const [transactions, setTransactions] = useState<BottleTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profileLoading) return;

    const loadData = async () => {
      setLoading(true);
      try {
        const inventoryResults = await Promise.all(
          profiles.map(async (p) => {
            const res = await fetch(`/api/cellar?profile_id=${p.id}`);
            const inv: CellarInventory[] = res.ok ? await res.json() : [];
            return {
              profile: p,
              totalBottles: inv.reduce((s, i) => s + i.quantity, 0),
              uniqueWines: new Set(inv.map((i) => i.wine_id)).size,
            };
          })
        );
        setSummaries(inventoryResults);

        if (activeProfile) {
          const txRes = await fetch(`/api/transactions?profile_id=${activeProfile.id}&limit=10`);
          if (txRes.ok) setTransactions(await txRes.json());
        }
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [profiles, activeProfile, profileLoading]);

  if (profileLoading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">Loading…</div>;
  }

  if (profiles.length === 0) {
    return (
      <div className="max-w-md mx-auto px-4 py-12 text-center">
        <Layers className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-lg font-semibold mb-2">No profiles yet</h2>
        <p className="text-sm text-muted-foreground mb-6">Create a profile to start managing your wine cellar.</p>
        <Link href="/profiles" className="inline-flex items-center gap-2 px-5 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
          <Plus className="h-4 w-4" />
          Create Profile
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h2 className="text-xl font-bold">Dashboard</h2>
        <p className="text-sm text-muted-foreground">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { href: '/scanner', icon: ScanLine, label: 'Scan Barcode' },
          { href: '/wines/new', icon: Plus, label: 'Add Wine' },
          { href: '/wines', icon: Wine, label: 'Wine Catalog' },
          { href: '/profiles', icon: Layers, label: 'Profiles' },
        ].map(({ href, icon: Icon, label }) => (
          <Link key={href} href={href} className="flex flex-col items-center gap-2 rounded-lg border bg-card p-4 hover:shadow-md hover:border-primary/30 transition-all">
            <Icon className="h-6 w-6 text-primary" />
            <span className="text-sm font-medium">{label}</span>
          </Link>
        ))}
      </div>

      {/* Cellar overview */}
      <div>
        <h3 className="font-semibold text-sm mb-3">Cellar Overview</h3>
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading inventory…</div>
        ) : (
          <div className="space-y-2">
            {summaries.map(({ profile, totalBottles, uniqueWines }) => (
              <Link key={profile.id} href={`/profiles/${profile.id}`}
                className="flex items-center justify-between rounded-lg border bg-card px-4 py-3 hover:shadow-sm hover:border-primary/30 transition-all">
                <div>
                  <p className="font-medium text-sm">{profile.name}</p>
                  {profile.description && <p className="text-xs text-muted-foreground">{profile.description}</p>}
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="text-right">
                    <p className="font-semibold text-foreground">{totalBottles}</p>
                    <p className="text-xs">bottles</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-foreground">{uniqueWines}</p>
                    <p className="text-xs">wines</p>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Recent activity */}
      {activeProfile && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm">Recent Activity</h3>
            <span className="text-xs text-muted-foreground">{activeProfile.name}</span>
          </div>
          <div className="rounded-lg border bg-card px-4 py-2">
            <TransactionLog transactions={transactions} />
          </div>
        </div>
      )}
    </div>
  );
}
