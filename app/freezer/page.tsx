'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Plus, Snowflake, Trash2, ChevronDown, ChevronUp,
  Loader2, AlertCircle, Edit2, Settings2, Check, X,
} from 'lucide-react';
import { useProfile } from '@/hooks/useProfile';
import { MEAT_CUTS, getPrimalForCut, getAnimalForCut, ANIMAL_LABELS, type MeatAnimal } from '@/lib/meat-cuts';
import type { FreezerItem, FreezerTransaction, FreezerLocation } from '@/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

const TODAY = new Date().toISOString().slice(0, 10);
const ANIMAL_ORDER: MeatAnimal[] = ['beef', 'pork', 'chicken', 'lamb', 'other'];
const ANIMAL_COLORS: Record<MeatAnimal, string> = {
  beef:    'border-red-200   bg-red-50   text-red-800',
  pork:    'border-pink-200  bg-pink-50  text-pink-800',
  chicken: 'border-yellow-200 bg-yellow-50 text-yellow-800',
  lamb:    'border-purple-200 bg-purple-50 text-purple-800',
  other:   'border-gray-200  bg-gray-50  text-gray-700',
};

function formatDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function eatByColor(eatByDate: string) {
  const days = (new Date(eatByDate + 'T00:00:00').getTime() - Date.now()) / 86_400_000;
  if (days < 0) return 'text-destructive font-semibold';
  if (days < 60) return 'text-orange-500 font-medium';
  return 'text-muted-foreground';
}

interface FormState {
  meat_cut: string;
  custom_cut: string;
  primal: string;
  quantity: string;
  weight_lbs: string;
  location: string;
  stored_date: string;
  price_per_lb: string;
  notes: string;
}

const DEFAULT_FORM: FormState = {
  meat_cut: '',
  custom_cut: '',
  primal: '',
  quantity: '1',
  weight_lbs: '',
  location: '',
  stored_date: TODAY,
  price_per_lb: '',
  notes: '',
};

function itemToForm(item: FreezerItem): FormState {
  return {
    meat_cut: MEAT_CUTS.some(m => m.cut === item.meat_cut) ? item.meat_cut : '__custom__',
    custom_cut: MEAT_CUTS.some(m => m.cut === item.meat_cut) ? '' : item.meat_cut,
    primal: item.primal ?? '',
    quantity: String(item.quantity),
    weight_lbs: item.weight_lbs != null ? String(item.weight_lbs) : '',
    location: item.location ?? '',
    stored_date: item.stored_date,
    price_per_lb: item.price_per_lb != null ? String(item.price_per_lb) : '',
    notes: item.notes ?? '',
  };
}

// ── Item form (shared by Add and Edit dialogs) ────────────────────────────────
function ItemForm({
  form, onChange, onCutChange, onLookupPrimal, lookupLoading, locations, knownLocations, error, saving, onSubmit, onCancel, submitLabel,
}: {
  form: FormState;
  onChange: (patch: Partial<FormState>) => void;
  onCutChange: (v: string) => void;
  onLookupPrimal: () => void;
  lookupLoading: boolean;
  locations: FreezerLocation[];
  knownLocations: string[];
  error: string | null;
  saving: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  submitLabel: string;
}) {
  const inp = 'w-full h-9 border rounded-md px-3 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring';
  return (
    <form onSubmit={onSubmit} className="space-y-4 mt-2">
      {error && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-destructive/10 border border-destructive/20 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />{error}
        </div>
      )}

      <div className="space-y-1.5">
        <label className="text-sm font-medium">Meat Cut</label>
        <select value={form.meat_cut} onChange={e => onCutChange(e.target.value)} className={inp} required>
          <option value="">Select a cut…</option>
          {MEAT_CUTS.map(m => <option key={m.cut} value={m.cut}>{m.cut}</option>)}
          <option value="__custom__">Custom cut…</option>
        </select>
      </div>

      {form.meat_cut === '__custom__' && (
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Cut Name</label>
          <div className="flex gap-2">
            <input type="text" value={form.custom_cut} onChange={e => onChange({ custom_cut: e.target.value })}
              placeholder="e.g. Lamb Shoulder" className={`${inp} flex-1`} />
            <button type="button" onClick={onLookupPrimal} disabled={!form.custom_cut.trim() || lookupLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 border rounded-md text-sm hover:bg-accent transition-colors disabled:opacity-50">
              {lookupLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Lookup'}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <label className="text-sm font-medium">Primal / Area</label>
        <input type="text" value={form.primal} onChange={e => onChange({ primal: e.target.value })}
          placeholder="Auto-filled from cut" className={inp} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Packs</label>
          <input type="number" min={1} value={form.quantity} onChange={e => onChange({ quantity: e.target.value })} className={inp} required />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Weight/pack (lbs)</label>
          <input type="number" min={0} step={0.1} value={form.weight_lbs} onChange={e => onChange({ weight_lbs: e.target.value })}
            placeholder="optional" className={inp} />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium">Freezer Location</label>
        {locations.length > 0 ? (
          <select value={form.location} onChange={e => onChange({ location: e.target.value })} className={inp}>
            <option value="">Unlocated</option>
            {locations.map(l => <option key={l.id} value={l.name}>{l.name}</option>)}
          </select>
        ) : (
          <input type="text" list="freezer-locs" value={form.location} onChange={e => onChange({ location: e.target.value })}
            placeholder="e.g. Garage Freezer" className={inp} />
        )}
        <datalist id="freezer-locs">{knownLocations.map(l => <option key={l} value={l} />)}</datalist>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Date Stored</label>
          <input type="date" value={form.stored_date} onChange={e => onChange({ stored_date: e.target.value })} className={inp} required />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Price/lb ($)</label>
          <input type="number" min={0} step={0.01} value={form.price_per_lb} onChange={e => onChange({ price_per_lb: e.target.value })}
            placeholder="optional" className={inp} />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium">Notes</label>
        <input type="text" value={form.notes} onChange={e => onChange({ notes: e.target.value })} placeholder="optional" className={inp} />
      </div>

      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onCancel} className="flex-1 h-9 border rounded-md text-sm hover:bg-accent transition-colors">Cancel</button>
        <button type="submit" disabled={saving}
          className="flex-1 h-9 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function FreezerPage() {
  const { activeProfile } = useProfile();
  const [items, setItems] = useState<FreezerItem[]>([]);
  const [txs, setTxs] = useState<FreezerTransaction[]>([]);
  const [locations, setLocations] = useState<FreezerLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // View state
  const [activeLocation, setActiveLocation] = useState<string | null>(null); // null = All
  const [sortBy, setSortBy] = useState<'oldest' | 'newest' | 'most' | 'least' | 'az'>('oldest');
  const [showHistory, setShowHistory] = useState(false);

  // Add form
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState<FormState>(DEFAULT_FORM);
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);

  // Edit form
  const [editItem, setEditItem] = useState<FreezerItem | null>(null);
  const [editForm, setEditForm] = useState<FormState>(DEFAULT_FORM);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Remove
  const [removing, setRemoving] = useState<string | null>(null);
  const [removeQty, setRemoveQty] = useState<Record<string, string>>({});

  // Manage locations dialog
  const [showManageLocs, setShowManageLocs] = useState(false);
  const [newLocName, setNewLocName] = useState('');
  const [addingLoc, setAddingLoc] = useState(false);
  const [renamingLocId, setRenamingLocId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deletingLocId, setDeletingLocId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeProfile) return;
    setLoading(true);
    setError(null);
    try {
      const [itemsRes, txsRes, locsRes] = await Promise.all([
        fetch(`/api/freezer?profile_id=${activeProfile.id}`),
        fetch(`/api/freezer/transactions?profile_id=${activeProfile.id}`),
        fetch(`/api/freezer/locations?profile_id=${activeProfile.id}`),
      ]);
      if (itemsRes.ok) setItems(await itemsRes.json());
      if (txsRes.ok) setTxs(await txsRes.json());
      if (locsRes.ok) setLocations(await locsRes.json());
    } catch {
      setError('Failed to load freezer data');
    } finally {
      setLoading(false);
    }
  }, [activeProfile]);

  useEffect(() => { load(); }, [load]);

  // ── Derived data ─────────────────────────────────────────────────────────────

  const knownLocations = useMemo(
    () => [...new Set(items.map(i => i.location).filter(Boolean))].sort(),
    [items]
  );

  const animalStats = useMemo(() => {
    const byAnimal = new Map<MeatAnimal, { packs: number; weight: number }>();
    for (const item of items) {
      const a = getAnimalForCut(item.meat_cut);
      const cur = byAnimal.get(a) ?? { packs: 0, weight: 0 };
      cur.packs += item.quantity;
      cur.weight += item.weight_lbs != null ? item.weight_lbs * item.quantity : 0;
      byAnimal.set(a, cur);
    }
    return ANIMAL_ORDER
      .map(a => ({ animal: a, ...(byAnimal.get(a) ?? { packs: 0, weight: 0 }) }))
      .filter(a => a.packs > 0);
  }, [items]);

  const reorderCuts = useMemo(() => {
    const removes = txs.filter(t => t.action === 'remove');
    const byCut = new Map<string, { total: number; earliest: string; latest: string }>();
    for (const t of removes) {
      const cut = t.meat_cut ?? 'Unknown';
      const cur = byCut.get(cut) ?? { total: 0, earliest: t.created_at, latest: t.created_at };
      cur.total += t.quantity;
      if (t.created_at < cur.earliest) cur.earliest = t.created_at;
      if (t.created_at > cur.latest) cur.latest = t.created_at;
      byCut.set(cut, cur);
    }
    return [...byCut.entries()]
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 6)
      .map(([name, stats]) => {
        const monthsSpan = Math.max(1,
          (new Date(stats.latest).getTime() - new Date(stats.earliest).getTime()) / (30 * 86_400_000)
        );
        const monthlyRate = stats.total / monthsSpan;
        const currentStock = items.filter(i => i.meat_cut === name).reduce((s, i) => s + i.quantity, 0);
        const monthsSupply = monthlyRate > 0 ? currentStock / monthlyRate : null;
        return { name, currentStock, monthlyRate, monthsSupply };
      });
  }, [txs, items]);

  const registeredLocNames = useMemo(() => new Set(locations.map(l => l.name)), [locations]);

  const tabLocations = useMemo(() => {
    const hasUnlocated = items.some(i => !i.location || !registeredLocNames.has(i.location));
    return [
      { key: null,           label: 'All',       count: items.length },
      ...locations.map(l => ({ key: l.name,   label: l.name, count: items.filter(i => i.location === l.name).length })),
      ...(hasUnlocated ? [{ key: '__unlocated__', label: 'Unlocated', count: items.filter(i => !i.location || !registeredLocNames.has(i.location)).length }] : []),
    ];
  }, [items, locations, registeredLocNames]);

  const sortedItems = useMemo(() => {
    const filtered = activeLocation === null
      ? [...items]
      : activeLocation === '__unlocated__'
      ? items.filter(i => !i.location || !registeredLocNames.has(i.location))
      : items.filter(i => i.location === activeLocation);

    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'oldest': return a.stored_date.localeCompare(b.stored_date);
        case 'newest': return b.stored_date.localeCompare(a.stored_date);
        case 'most':   return b.quantity - a.quantity;
        case 'least':  return a.quantity - b.quantity;
        case 'az':     return a.meat_cut.localeCompare(b.meat_cut);
        default:       return 0;
      }
    });
  }, [items, locations, activeLocation, sortBy, registeredLocNames]);

  // ── Cut change helper (shared) ──────────────────────────────────────────────
  const makeCutChange = (setter: React.Dispatch<React.SetStateAction<FormState>>) =>
    (value: string) => {
      if (value === '__custom__') setter(f => ({ ...f, meat_cut: '__custom__', primal: '' }));
      else setter(f => ({ ...f, meat_cut: value, custom_cut: '', primal: getPrimalForCut(value) ?? '' }));
    };

  const handleLookupPrimal = async (cut: string, setter: React.Dispatch<React.SetStateAction<FormState>>) => {
    if (!cut.trim()) return;
    setLookupLoading(true);
    try {
      const res = await fetch('/api/freezer/lookup-primal', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cut }),
      });
      if (res.ok) { const d = await res.json(); setter(f => ({ ...f, primal: d.primal ?? '' })); }
    } finally { setLookupLoading(false); }
  };

  // ── Add ──────────────────────────────────────────────────────────────────────
  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);
    const cutName = addForm.meat_cut === '__custom__' ? addForm.custom_cut.trim() : addForm.meat_cut;
    if (!cutName) { setAddError('Select or enter a meat cut'); return; }
    setAddSaving(true);
    try {
      const res = await fetch('/api/freezer', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile_id: activeProfile!.id,
          meat_cut: cutName,
          primal: addForm.primal || undefined,
          quantity: Number(addForm.quantity) || 1,
          weight_lbs: addForm.weight_lbs ? Number(addForm.weight_lbs) : undefined,
          location: addForm.location || '',
          stored_date: addForm.stored_date,
          price_per_lb: addForm.price_per_lb ? Number(addForm.price_per_lb) : undefined,
          notes: addForm.notes || undefined,
        }),
      });
      if (!res.ok) { setAddError((await res.json()).error ?? 'Failed'); return; }
      setShowAdd(false);
      setAddForm(DEFAULT_FORM);
      await load();
    } catch { setAddError('Failed to add item'); }
    finally { setAddSaving(false); }
  };

  // ── Edit ─────────────────────────────────────────────────────────────────────
  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editItem) return;
    setEditError(null);
    const cutName = editForm.meat_cut === '__custom__' ? editForm.custom_cut.trim() : editForm.meat_cut;
    if (!cutName) { setEditError('Select or enter a meat cut'); return; }
    setEditSaving(true);
    try {
      const res = await fetch(`/api/freezer/${editItem.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meat_cut: cutName,
          primal: editForm.primal || undefined,
          quantity: Number(editForm.quantity) || 1,
          weight_lbs: editForm.weight_lbs ? Number(editForm.weight_lbs) : undefined,
          location: editForm.location || '',
          stored_date: editForm.stored_date,
          price_per_lb: editForm.price_per_lb ? Number(editForm.price_per_lb) : undefined,
          notes: editForm.notes || undefined,
        }),
      });
      if (!res.ok) { setEditError((await res.json()).error ?? 'Failed'); return; }
      setEditItem(null);
      await load();
    } catch { setEditError('Failed to update item'); }
    finally { setEditSaving(false); }
  };

  // ── Remove ───────────────────────────────────────────────────────────────────
  const handleRemove = async (item: FreezerItem) => {
    const qty = Number(removeQty[item.id] ?? 1);
    if (qty < 1 || qty > item.quantity) return;
    setRemoving(item.id);
    try {
      const res = await fetch(`/api/freezer/${item.id}`, {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: qty }),
      });
      if (res.ok) { await load(); setRemoveQty(r => { const n = { ...r }; delete n[item.id]; return n; }); }
    } finally { setRemoving(null); }
  };

  // ── Location management ──────────────────────────────────────────────────────
  const handleAddLocation = async () => {
    if (!newLocName.trim() || !activeProfile) return;
    setAddingLoc(true);
    try {
      const res = await fetch('/api/freezer/locations', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile_id: activeProfile.id, name: newLocName.trim() }),
      });
      if (res.ok) { setNewLocName(''); await load(); }
    } finally { setAddingLoc(false); }
  };

  const handleRenameLocation = async (id: string) => {
    if (!renameValue.trim()) return;
    await fetch(`/api/freezer/locations/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: renameValue.trim() }),
    });
    setRenamingLocId(null);
    await load();
  };

  const handleDeleteLocation = async (id: string) => {
    await fetch(`/api/freezer/locations/${id}`, { method: 'DELETE' });
    setDeletingLocId(null);
    await load();
  };

  // ── Empty state ───────────────────────────────────────────────────────────────
  if (!activeProfile) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center text-muted-foreground">
        <Snowflake className="h-8 w-8 mx-auto mb-3 opacity-40" />
        <p>Select a cellar profile to view the freezer inventory.</p>
      </div>
    );
  }

  const totalPacks = items.reduce((s, i) => s + i.quantity, 0);
  const hasPriceData = items.some(i => i.price_per_lb != null);
  const removeTxs = txs.filter(t => t.action === 'remove');

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Snowflake className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold">Freezer</h1>
          {totalPacks > 0 && <span className="text-sm text-muted-foreground">({totalPacks} packs)</span>}
        </div>
        <button
          onClick={() => { setShowAdd(true); setAddForm(DEFAULT_FORM); setAddError(null); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Item
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-destructive/10 border border-destructive/20 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />{error}
        </div>
      )}

      {/* ── Animal stats ── */}
      {!loading && animalStats.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {animalStats.map(stat => (
            <div key={stat.animal} className={cn('rounded-lg border p-3 text-center', ANIMAL_COLORS[stat.animal])}>
              <p className="text-lg font-bold tabular-nums">{stat.packs}</p>
              <p className="text-xs font-medium">{ANIMAL_LABELS[stat.animal]}</p>
              {stat.weight > 0 && (
                <p className="text-xs opacity-70 mt-0.5">≈{stat.weight % 1 === 0 ? stat.weight : stat.weight.toFixed(1)} lbs</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Reorder monitor ── */}
      {!loading && reorderCuts.length > 0 && (
        <div className="rounded-lg border bg-card">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <h3 className="text-sm font-semibold">Reorder Monitor</h3>
            <span className="text-xs text-muted-foreground">top cuts by usage</span>
          </div>
          <div className="px-4 py-2 space-y-1">
            <div className="grid grid-cols-[1fr_5rem_5rem_5rem] gap-2 text-xs text-muted-foreground pb-1 border-b">
              <span>Cut</span>
              <span className="text-right">In stock</span>
              <span className="text-right">Rate/mo</span>
              <span className="text-right">Supply</span>
            </div>
            {reorderCuts.map(cut => {
              const supply = cut.monthsSupply;
              const supplyColor = supply == null ? 'text-muted-foreground'
                : supply < 0.5 ? 'text-destructive font-semibold'
                : supply < 1.5 ? 'text-amber-600 font-medium'
                : 'text-green-600';
              return (
                <div key={cut.name} className="grid grid-cols-[1fr_5rem_5rem_5rem] gap-2 text-sm items-center py-1">
                  <span className="truncate">{cut.name}</span>
                  <span className="text-right tabular-nums">{cut.currentStock} pk</span>
                  <span className="text-right tabular-nums text-muted-foreground">{cut.monthlyRate.toFixed(1)}</span>
                  <span className={cn('text-right tabular-nums', supplyColor)}>
                    {supply == null ? '—' : supply < 0.1 ? 'Out' : `${supply.toFixed(1)} mo`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Location tabs + inventory ── */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-3">
          {/* Tab bar */}
          <div className="flex items-center gap-2">
            <div className="flex gap-0 border-b flex-1 overflow-x-auto">
              {tabLocations.map(tab => (
                <button
                  key={String(tab.key)}
                  onClick={() => setActiveLocation(tab.key)}
                  className={cn(
                    'px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-1.5 whitespace-nowrap',
                    activeLocation === tab.key
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  )}
                >
                  {tab.label}
                  <span className="text-xs bg-muted px-1.5 py-0.5 rounded-full">{tab.count}</span>
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowManageLocs(true)}
              className="text-xs text-muted-foreground hover:text-foreground p-1.5 rounded hover:bg-accent transition-colors shrink-0"
              title="Manage freezer locations"
            >
              <Settings2 className="h-4 w-4" />
            </button>
          </div>

          {/* Sort bar */}
          {items.length > 0 && (
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground shrink-0">Sort:</label>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as typeof sortBy)}
                className="h-7 border rounded text-xs px-2 bg-background"
              >
                <option value="oldest">Oldest stored first (eat next)</option>
                <option value="newest">Newest stored first</option>
                <option value="most">Most packs first</option>
                <option value="least">Fewest packs first</option>
                <option value="az">A – Z</option>
              </select>
            </div>
          )}

          {/* Items */}
          {sortedItems.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground border border-dashed rounded-lg">
              <Snowflake className="h-8 w-8 mx-auto mb-3 opacity-30" />
              {items.length === 0
                ? <><p className="text-sm">No items yet.</p><p className="text-xs mt-1">Click &quot;Add Item&quot; to get started.</p></>
                : <p className="text-sm">No items in this location.</p>
              }
            </div>
          ) : (
            <div className="space-y-2">
              {sortedItems.map(item => (
                <div key={item.id} className="border rounded-lg p-4 bg-card space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{item.meat_cut}</p>
                      {item.primal && <p className="text-xs text-muted-foreground">{item.primal}</p>}
                    </div>
                    <span className="shrink-0 text-sm font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                      {item.quantity} {item.quantity === 1 ? 'pack' : 'packs'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    {item.weight_lbs != null && <span>~{item.weight_lbs} lbs/pack</span>}
                    {item.location && <span>{item.location}</span>}
                    <span>Stored: {formatDate(item.stored_date)}</span>
                    <span className={eatByColor(item.eat_by_date)}>Eat by: {formatDate(item.eat_by_date)}</span>
                    {hasPriceData && item.price_per_lb != null && <span>${item.price_per_lb.toFixed(2)}/lb</span>}
                    {item.notes && <span className="col-span-2 italic">{item.notes}</span>}
                  </div>

                  <div className="flex items-center gap-2 pt-1 border-t">
                    <label className="text-xs text-muted-foreground">Remove</label>
                    <input
                      type="number" min={1} max={item.quantity}
                      value={removeQty[item.id] ?? '1'}
                      onChange={e => setRemoveQty(r => ({ ...r, [item.id]: e.target.value }))}
                      className="w-14 h-7 text-sm text-center border rounded px-1 bg-background"
                    />
                    <span className="text-xs text-muted-foreground">pack{(Number(removeQty[item.id] ?? 1)) !== 1 ? 's' : ''}</span>
                    <div className="flex items-center gap-1.5 ml-auto">
                      <button
                        onClick={() => { setEditItem(item); setEditForm(itemToForm(item)); setEditError(null); }}
                        className="flex items-center gap-1 text-xs px-2 py-1 rounded border text-muted-foreground hover:bg-accent transition-colors"
                      >
                        <Edit2 className="h-3 w-3" />Edit
                      </button>
                      <button
                        onClick={() => handleRemove(item)}
                        disabled={removing === item.id}
                        className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-destructive/40 text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                      >
                        {removing === item.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Consumption history ── */}
      {txs.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <button
            onClick={() => setShowHistory(h => !h)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-accent/50 transition-colors"
          >
            <span>Consumption History</span>
            {showHistory ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {showHistory && (
            <div className="border-t px-4 py-3 space-y-1">
              {removeTxs.slice(0, 30).map(t => (
                <div key={t.id} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{new Date(t.created_at).toLocaleDateString()}</span>
                  <span className="flex-1 px-3 truncate">{t.meat_cut}</span>
                  <span className="text-muted-foreground">−{t.quantity}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Manage Locations dialog ── */}
      <Dialog open={showManageLocs} onOpenChange={setShowManageLocs}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-primary" />
              Manage Freezer Locations
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-xs text-muted-foreground">
              Named locations let you track items per freezer. Deleting a location leaves items unlocated (they stay in &ldquo;All&rdquo;).
            </p>

            {locations.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-2">No freezer locations yet.</p>
            ) : (
              <ul className="space-y-1">
                {locations.map(loc => (
                  <li key={loc.id} className="flex items-center gap-2 rounded-md border px-3 py-2 bg-card">
                    {renamingLocId === loc.id ? (
                      <>
                        <input
                          autoFocus
                          value={renameValue}
                          onChange={e => setRenameValue(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleRenameLocation(loc.id); if (e.key === 'Escape') setRenamingLocId(null); }}
                          className="flex-1 h-7 text-sm border rounded px-2 bg-background"
                        />
                        <button onClick={() => handleRenameLocation(loc.id)} className="p-1 text-green-600 hover:bg-green-50 rounded">
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => setRenamingLocId(null)} className="p-1 text-muted-foreground hover:bg-accent rounded">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </>
                    ) : deletingLocId === loc.id ? (
                      <>
                        <span className="flex-1 text-sm truncate">{loc.name}</span>
                        <button onClick={() => handleDeleteLocation(loc.id)} className="text-xs px-2 py-0.5 rounded bg-destructive text-destructive-foreground">Delete</button>
                        <button onClick={() => setDeletingLocId(null)} className="text-xs px-2 py-0.5 rounded border hover:bg-accent">Cancel</button>
                      </>
                    ) : (
                      <>
                        <span className="flex-1 text-sm truncate">{loc.name}</span>
                        <button onClick={() => { setRenamingLocId(loc.id); setRenameValue(loc.name); }}
                          className="p-1 text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors">
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => setDeletingLocId(loc.id)}
                          className="p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}

            <div className="flex gap-2">
              <input
                value={newLocName}
                onChange={e => setNewLocName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddLocation(); } }}
                placeholder="New location name…"
                className="flex-1 h-9 border rounded-md px-3 text-sm bg-background"
              />
              <button
                onClick={handleAddLocation}
                disabled={!newLocName.trim() || addingLoc}
                className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm disabled:opacity-50"
              >
                {addingLoc ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                Add
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Edit dialog ── */}
      <Dialog open={!!editItem} onOpenChange={open => { if (!open) setEditItem(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="h-4 w-4 text-primary" />
              Edit Freezer Item
            </DialogTitle>
          </DialogHeader>
          <ItemForm
            form={editForm}
            onChange={patch => setEditForm(f => ({ ...f, ...patch }))}
            onCutChange={makeCutChange(setEditForm)}
            onLookupPrimal={() => handleLookupPrimal(editForm.custom_cut, setEditForm)}
            lookupLoading={lookupLoading}
            locations={locations}
            knownLocations={knownLocations}
            error={editError}
            saving={editSaving}
            onSubmit={handleEdit}
            onCancel={() => setEditItem(null)}
            submitLabel="Save Changes"
          />
        </DialogContent>
      </Dialog>

      {/* ── Add dialog ── */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Snowflake className="h-4 w-4 text-primary" />
              Add to Freezer
            </DialogTitle>
          </DialogHeader>
          <ItemForm
            form={addForm}
            onChange={patch => setAddForm(f => ({ ...f, ...patch }))}
            onCutChange={makeCutChange(setAddForm)}
            onLookupPrimal={() => handleLookupPrimal(addForm.custom_cut, setAddForm)}
            lookupLoading={lookupLoading}
            locations={locations}
            knownLocations={knownLocations}
            error={addError}
            saving={addSaving}
            onSubmit={handleAdd}
            onCancel={() => setShowAdd(false)}
            submitLabel="Add to Freezer"
          />
        </DialogContent>
      </Dialog>

    </div>
  );
}
