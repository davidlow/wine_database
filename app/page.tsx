'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Wine, ScanLine, Plus, ArrowRight, Layers, AlertTriangle, Clock, GlassWater } from 'lucide-react';
import { useProfile } from '@/hooks/useProfile';
import type { CellarInventory, BottleTransaction, Profile } from '@/types';
import type { ExpiringBottle } from '@/app/api/wines/expiring/route';
import TransactionLog from '@/components/TransactionLog';
import { cn, wineTypeColor, wineTypeLabel } from '@/lib/utils';

interface ProfileSummary {
  profile: Profile;
  totalBottles: number;
  uniqueWines: number;
}

export default function DashboardPage() {
  const { profiles, activeProfile, loading: profileLoading } = useProfile();
  const [summaries, setSummaries] = useState<ProfileSummary[]>([]);
  const [transactions, setTransactions] = useState<BottleTransaction[]>([]);
  const [expiring, setExpiring] = useState<ExpiringBottle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profileLoading) return;

    const loadData = async () => {
      setLoading(true);
      try {
        const [inventoryResults, expiringRes] = await Promise.all([
          Promise.all(
            profiles.map(async (p) => {
              const res = await fetch(`/api/cellar?profile_id=${p.id}`);
              const inv: CellarInventory[] = res.ok ? await res.json() : [];
              return {
                profile: p,
                totalBottles: inv.reduce((s, i) => s + i.quantity, 0),
                uniqueWines: new Set(inv.map((i) => i.wine_id)).size,
              };
            })
          ),
          fetch('/api/wines/expiring'),
        ]);

        setSummaries(inventoryResults);
        if (expiringRes.ok) setExpiring(await expiringRes.json());

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
        <p className="text-sm text-muted-foreground mb-6">Create a cellar to start managing your wine collection.</p>
        <Link href="/profiles" className="inline-flex items-center gap-2 px-5 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
          <Plus className="h-4 w-4" />
          Create Cellar
        </Link>
      </div>
    );
  }

  const expired = expiring.filter(b => b.status === 'expired');
  const expiringSoon = expiring.filter(b => b.status === 'expiring_soon');
  const tooYoung = expiring.filter(b => b.status === 'too_young');

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
          { href: '/scanner', icon: ScanLine, label: 'Scanner' },
          { href: '/wines/new', icon: Plus, label: 'Add Wine' },
          { href: '/wines', icon: Wine, label: 'Wine Catalog' },
          { href: '/profiles', icon: Layers, label: 'Cellars' },
        ].map(({ href, icon: Icon, label }) => (
          <Link key={href} href={href} className="flex flex-col items-center gap-2 rounded-lg border bg-card p-4 hover:shadow-md hover:border-primary/30 transition-all">
            <Icon className="h-6 w-6 text-primary" />
            <span className="text-sm font-medium">{label}</span>
          </Link>
        ))}
      </div>

      {/* Drink window alerts */}
      {!loading && expiring.length > 0 && (
        <div>
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-1.5">
            <GlassWater className="h-4 w-4 text-primary" />
            Drink Window Alerts
            <span className="text-xs font-normal text-muted-foreground">({expiring.length} bottles)</span>
          </h3>
          <div className="space-y-2">
            {expired.length > 0 && (
              <DrinkWindowGroup
                title="Past peak — drink now"
                icon={<AlertTriangle className="h-3.5 w-3.5" />}
                colorCls="bg-red-50 border-red-200"
                headerCls="text-red-700"
                bottles={expired}
              />
            )}
            {expiringSoon.length > 0 && (
              <DrinkWindowGroup
                title="Expiring soon (within 2 years)"
                icon={<Clock className="h-3.5 w-3.5" />}
                colorCls="bg-amber-50 border-amber-200"
                headerCls="text-amber-700"
                bottles={expiringSoon}
              />
            )}
            {tooYoung.length > 0 && (
              <DrinkWindowGroup
                title="Too young — not ready yet"
                icon={<GlassWater className="h-3.5 w-3.5" />}
                colorCls="bg-blue-50 border-blue-200"
                headerCls="text-blue-700"
                bottles={tooYoung}
              />
            )}
          </div>
        </div>
      )}

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

function DrinkWindowGroup({
  title,
  icon,
  colorCls,
  headerCls,
  bottles,
}: {
  title: string;
  icon: React.ReactNode;
  colorCls: string;
  headerCls: string;
  bottles: ExpiringBottle[];
}) {
  return (
    <div className={cn('rounded-lg border p-3 space-y-2', colorCls)}>
      <div className={cn('flex items-center gap-1.5 text-xs font-semibold', headerCls)}>
        {icon}
        {title}
        <span className="font-normal">({bottles.length})</span>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {bottles.map((b, i) => (
          <Link
            key={`${b.wine_id}-${b.profile_id}-${b.location}-${i}`}
            href={`/wines/${b.wine_id}`}
            className="shrink-0 rounded-md border bg-white/80 px-3 py-2 text-xs min-w-[140px] max-w-[180px] hover:bg-white transition-colors"
          >
            <div className="flex items-center gap-1 mb-1">
              {b.wine_type && (
                <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium', wineTypeColor(b.wine_type as Parameters<typeof wineTypeColor>[0]))}>
                  {wineTypeLabel(b.wine_type as Parameters<typeof wineTypeLabel>[0])}
                </span>
              )}
              <span className="text-muted-foreground">{b.quantity}×</span>
            </div>
            <p className="font-medium leading-tight line-clamp-2">{b.wine_name}</p>
            {b.vintage_year && <p className="text-muted-foreground mt-0.5">{b.vintage_year}</p>}
            <p className="text-muted-foreground truncate mt-0.5">{b.profile_name}</p>
            {b.drink_by_year && (
              <p className="text-muted-foreground">By {b.drink_by_year}</p>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
