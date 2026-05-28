'use client';

import { useEffect, useState, useMemo } from 'react';
import { useProfile } from '@/hooks/useProfile';
import type { CellarInventory, BottleTransaction } from '@/types';
import { cn, wineTypeColor, wineTypeLabel, formatPrice } from '@/lib/utils';
import { BarChart2, TrendingDown, DollarSign, Wine } from 'lucide-react';

// ── Simple horizontal bar ──────────────────────────────────────────────────────
function HBar({ label, value, max, colorCls = 'bg-primary', sub }: {
  label: string; value: number; max: number; colorCls?: string; sub?: string;
}) {
  const pct = max > 0 ? Math.max(1, Math.round((value / max) * 100)) : 0;
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-36 shrink-0 text-right text-xs text-muted-foreground truncate" title={label}>{label}</span>
      <div className="flex-1 h-5 bg-muted rounded overflow-hidden">
        <div className={cn('h-full rounded transition-all', colorCls)} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-12 shrink-0 text-xs font-medium tabular-nums">{value}</span>
      {sub && <span className="w-16 shrink-0 text-xs text-muted-foreground tabular-nums">{sub}</span>}
    </div>
  );
}

// ── Vertical bar chart (for timeline) ────────────────────────────────────────
function VBarChart({ data, colorFn }: {
  data: { label: string; segments: { key: string; value: number; color: string }[] }[];
  colorFn?: (key: string) => string;
}) {
  void colorFn;
  const maxTotal = Math.max(1, ...data.map(d => d.segments.reduce((s, seg) => s + seg.value, 0)));
  return (
    <div className="flex items-end gap-1 h-40 overflow-x-auto pb-6 relative">
      {data.map((d, i) => {
        const total = d.segments.reduce((s, seg) => s + seg.value, 0);
        return (
          <div key={i} className="flex flex-col items-center gap-0.5 shrink-0" style={{ minWidth: 32 }}>
            <span className="text-[9px] text-muted-foreground tabular-nums">{total || ''}</span>
            <div className="w-6 flex flex-col-reverse overflow-hidden rounded-sm" style={{ height: Math.round((total / maxTotal) * 120) + 'px' }}>
              {d.segments.map((seg, j) => (
                seg.value > 0 && (
                  <div
                    key={j}
                    className={seg.color}
                    title={`${seg.key}: ${seg.value}`}
                    style={{ height: Math.round((seg.value / Math.max(1, total)) * 100) + '%' }}
                  />
                )
              ))}
            </div>
            <span className="text-[9px] text-muted-foreground -rotate-45 origin-left mt-1 truncate w-8" title={d.label}>{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Section header ─────────────────────────────────────────────────────────────
function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="space-y-0.5">
      <h3 className="font-semibold text-sm">{title}</h3>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function StatisticsPage() {
  const { profiles, activeProfile, loading: profilesLoading } = useProfile();
  const [selectedProfileId, setSelectedProfileId] = useState<string | 'all'>('all');
  const [inventory, setInventory] = useState<CellarInventory[]>([]);
  const [transactions, setTransactions] = useState<BottleTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  // Determine active profile for fetching
  const fetchProfileIds = useMemo(() => {
    if (selectedProfileId === 'all') return profiles.map(p => p.id);
    return [selectedProfileId];
  }, [selectedProfileId, profiles]);

  useEffect(() => {
    if (profilesLoading) return;
    if (profiles.length === 0) { setLoading(false); return; }

    const load = async () => {
      setLoading(true);
      try {
        const [invArrays, txArrays] = await Promise.all([
          Promise.all(fetchProfileIds.map(pid =>
            fetch(`/api/cellar?profile_id=${pid}`).then(r => r.ok ? r.json() as Promise<CellarInventory[]> : [])
          )),
          Promise.all(fetchProfileIds.map(pid =>
            fetch(`/api/transactions?profile_id=${pid}&limit=1000`).then(r => r.ok ? r.json() as Promise<BottleTransaction[]> : [])
          )),
        ]);
        setInventory(invArrays.flat());
        setTransactions(txArrays.flat());
      } finally {
        setLoading(false);
      }
    };
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchProfileIds.join(','), profilesLoading]);

  // Set default selection to active profile
  useEffect(() => {
    if (activeProfile && selectedProfileId === 'all') setSelectedProfileId(activeProfile.id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProfile?.id]);

  // ── Derived stats ──────────────────────────────────────────────────────────

  const totalBottles = useMemo(() => inventory.reduce((s, i) => s + i.quantity, 0), [inventory]);

  const totalValue = useMemo(() =>
    inventory.reduce((s, i) => s + (i.purchase_price ?? i.wine?.average_price ?? 0) * i.quantity, 0),
    [inventory]
  );

  const uniqueWines = useMemo(() => new Set(inventory.map(i => i.wine_id)).size, [inventory]);

  // Bottles by wine type
  const byType = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of inventory) {
      const t = item.wine?.wine_type ?? 'other';
      map.set(t, (map.get(t) ?? 0) + item.quantity);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [inventory]);

  // Bottles by variety (top 15)
  const byVariety = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of inventory) {
      const v = item.wine?.variety;
      if (!v) continue;
      map.set(v, (map.get(v) ?? 0) + item.quantity);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
  }, [inventory]);

  // Price distribution buckets
  const priceBuckets = useMemo(() => {
    const buckets: Record<string, number> = {
      'Under $20': 0, '$20–50': 0, '$50–100': 0, '$100–200': 0, '$200+': 0, 'Unknown': 0,
    };
    for (const item of inventory) {
      const price = item.purchase_price ?? item.wine?.average_price;
      let bucket: string;
      if (price == null) bucket = 'Unknown';
      else if (price < 20) bucket = 'Under $20';
      else if (price < 50) bucket = '$20–50';
      else if (price < 100) bucket = '$50–100';
      else if (price < 200) bucket = '$100–200';
      else bucket = '$200+';
      buckets[bucket] += item.quantity;
    }
    return Object.entries(buckets).filter(([, v]) => v > 0);
  }, [inventory]);

  // Bottles by location (top 10)
  const byLocation = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of inventory) {
      const loc = item.location || '(Unlocated)';
      map.set(loc, (map.get(loc) ?? 0) + item.quantity);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [inventory]);

  // Consumption: removals only, grouped by month (last 12)
  const consumptionByMonth = useMemo(() => {
    const now = new Date();
    const months: { label: string; key: string }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      months.push({ label, key });
    }

    // Wine type color map for stacked bars
    const typeColors: Record<string, string> = {
      red: 'bg-red-400', white: 'bg-yellow-300', 'rosé': 'bg-pink-400',
      sparkling: 'bg-blue-300', dessert: 'bg-amber-300', fortified: 'bg-orange-400', other: 'bg-gray-300',
    };
    const allTypes = ['red', 'white', 'rosé', 'sparkling', 'dessert', 'fortified', 'other'];

    return months.map(({ label, key }) => {
      const segMap = new Map<string, number>();
      for (const tx of transactions) {
        if (tx.transaction_type !== 'remove') continue;
        const txKey = tx.created_at.slice(0, 7);
        if (txKey !== key) continue;
        const wineType = (tx as BottleTransaction & { wine_type?: string }).wine_type ?? 'other';
        segMap.set(wineType, (segMap.get(wineType) ?? 0) + tx.quantity);
      }
      const segments = allTypes
        .filter(t => (segMap.get(t) ?? 0) > 0)
        .map(t => ({ key: t, value: segMap.get(t) ?? 0, color: typeColors[t] ?? 'bg-gray-300' }));
      return { label, segments };
    });
  }, [transactions]);

  const totalConsumed = useMemo(() =>
    transactions.filter(t => t.transaction_type === 'remove').reduce((s, t) => s + t.quantity, 0),
    [transactions]
  );

  const totalSpent = useMemo(() => {
    const map = new Map<string, number>(); // inv id → price per bottle
    for (const item of inventory) {
      if (item.purchase_price != null) map.set(item.wine_id + item.location, item.purchase_price);
    }
    return transactions
      .filter(t => t.transaction_type === 'remove')
      .reduce((s, t) => {
        const price = map.get((t.wine_id ?? '') + (t.location ?? '')) ?? 0;
        return s + price * t.quantity;
      }, 0);
  }, [transactions, inventory]);

  // Consumption by variety (removals)
  const consumedByVariety = useMemo(() => {
    const map = new Map<string, number>();
    // Use wine info from inventory to map wine_id → variety
    const varietyByWineId = new Map<string, string>();
    for (const item of inventory) {
      if (item.wine?.variety) varietyByWineId.set(item.wine_id, item.wine.variety);
    }
    for (const tx of transactions) {
      if (tx.transaction_type !== 'remove' || !tx.wine_id) continue;
      const v = varietyByWineId.get(tx.wine_id) ?? 'Unknown';
      map.set(v, (map.get(v) ?? 0) + tx.quantity);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [transactions, inventory]);

  const maxByType = Math.max(1, ...byType.map(([, v]) => v));
  const maxByVariety = Math.max(1, ...byVariety.map(([, v]) => v));
  const maxByPrice = Math.max(1, ...priceBuckets.map(([, v]) => v));
  const maxByLocation = Math.max(1, ...byLocation.map(([, v]) => v));
  const maxConsumed = Math.max(1, ...consumedByVariety.map(([, v]) => v));

  const typeColorMap: Record<string, string> = {
    red: 'bg-red-400', white: 'bg-yellow-300', 'rosé': 'bg-pink-400',
    sparkling: 'bg-blue-300', dessert: 'bg-amber-300', fortified: 'bg-orange-400', other: 'bg-gray-300',
  };

  if (profilesLoading) {
    return <div className="flex items-center justify-center h-64 text-sm text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <BarChart2 className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-bold">Statistics</h2>
        </div>
        {/* Profile selector */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setSelectedProfileId('all')}
            className={cn('text-xs px-3 py-1 rounded-full border transition-colors',
              selectedProfileId === 'all' ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-accent border-input text-muted-foreground')}
          >
            All Cellars
          </button>
          {profiles.map(p => (
            <button
              key={p.id}
              onClick={() => setSelectedProfileId(p.id)}
              className={cn('text-xs px-3 py-1 rounded-full border transition-colors',
                selectedProfileId === p.id ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-accent border-input text-muted-foreground')}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading statistics…</div>
      ) : (
        <>
          {/* ── Summary cards ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-lg border bg-card px-4 py-3 text-center">
              <p className="text-2xl font-bold tabular-nums">{totalBottles}</p>
              <p className="text-xs text-muted-foreground">Bottles</p>
            </div>
            <div className="rounded-lg border bg-card px-4 py-3 text-center">
              <p className="text-2xl font-bold tabular-nums">{uniqueWines}</p>
              <p className="text-xs text-muted-foreground">Unique Wines</p>
            </div>
            <div className="rounded-lg border bg-card px-4 py-3 text-center">
              <p className="text-2xl font-bold tabular-nums">{totalConsumed}</p>
              <p className="text-xs text-muted-foreground">Consumed</p>
            </div>
            <div className="rounded-lg border bg-card px-4 py-3 text-center">
              <p className="text-lg font-bold tabular-nums">{totalValue > 0 ? formatPrice(totalValue) : '—'}</p>
              <p className="text-xs text-muted-foreground">Cellar Value</p>
            </div>
          </div>

          {/* ── Inventory breakdown ── */}
          <div className="rounded-lg border bg-card p-4 space-y-4">
            <SectionHeader title="Inventory" sub="Current bottles in cellar" />

            {/* By wine type */}
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">By Type</p>
              {byType.map(([type, count]) => (
                <HBar
                  key={type}
                  label={wineTypeLabel(type)}
                  value={count}
                  max={maxByType}
                  colorCls={typeColorMap[type] ?? 'bg-gray-300'}
                />
              ))}
              {byType.length === 0 && <p className="text-xs text-muted-foreground">No data</p>}
            </div>

            {/* By variety */}
            {byVariety.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">By Variety (top {byVariety.length})</p>
                {byVariety.map(([variety, count]) => (
                  <HBar key={variety} label={variety} value={count} max={maxByVariety} />
                ))}
              </div>
            )}

            {/* By price range */}
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">By Price Range</p>
              {priceBuckets.map(([bucket, count]) => (
                <HBar key={bucket} label={bucket} value={count} max={maxByPrice} colorCls="bg-emerald-400" />
              ))}
              {priceBuckets.length === 0 && <p className="text-xs text-muted-foreground">No data</p>}
            </div>

            {/* By location */}
            {byLocation.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">By Location (top {byLocation.length})</p>
                {byLocation.map(([loc, count]) => (
                  <HBar key={loc} label={loc} value={count} max={maxByLocation} colorCls="bg-violet-400" />
                ))}
              </div>
            )}
          </div>

          {/* ── Consumption ── */}
          <div className="rounded-lg border bg-card p-4 space-y-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <SectionHeader title="Consumption" sub="Bottles removed from cellar" />
              <div className="flex gap-4 text-sm">
                <div className="text-center">
                  <p className="font-bold tabular-nums flex items-center gap-1">
                    <TrendingDown className="h-4 w-4 text-muted-foreground" />
                    {totalConsumed}
                  </p>
                  <p className="text-xs text-muted-foreground">total removed</p>
                </div>
                {totalSpent > 0 && (
                  <div className="text-center">
                    <p className="font-bold tabular-nums flex items-center gap-1">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      {formatPrice(totalSpent)}
                    </p>
                    <p className="text-xs text-muted-foreground">est. spent</p>
                  </div>
                )}
              </div>
            </div>

            {/* Monthly consumption chart */}
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Monthly (last 12 months)</p>
              <VBarChart data={consumptionByMonth} />
              {/* Legend */}
              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                {['red', 'white', 'rosé', 'sparkling', 'other'].map(t => (
                  <div key={t} className="flex items-center gap-1 text-xs text-muted-foreground">
                    <div className={cn('w-2.5 h-2.5 rounded-sm', typeColorMap[t] ?? 'bg-gray-300')} />
                    {wineTypeLabel(t)}
                  </div>
                ))}
              </div>
            </div>

            {/* Consumed by variety */}
            {consumedByVariety.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">By Variety</p>
                {consumedByVariety.map(([variety, count]) => (
                  <HBar key={variety} label={variety} value={count} max={maxConsumed} colorCls="bg-red-300" />
                ))}
              </div>
            )}

            {totalConsumed === 0 && (
              <div className="text-center py-4 text-sm text-muted-foreground flex items-center justify-center gap-2">
                <Wine className="h-4 w-4" />
                No removals recorded yet.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
