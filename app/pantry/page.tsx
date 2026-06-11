'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Plus, ShoppingBasket, Trash2, Edit2, ChevronDown, ChevronUp,
  Loader2, AlertCircle, Search, X, RotateCcw, SlidersHorizontal, TrendingDown,
} from 'lucide-react';
import { useProfile } from '@/hooks/useProfile';
import type { PantryItem, PantryTransaction, PantryUsageSetting } from '@/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { computeUsagePrediction, formatDays } from '@/lib/pantry-utils';

const TODAY = new Date().toISOString().slice(0, 10);

const COMMON_UNITS = ['unit', 'box', 'bottle', 'bar', 'bag', 'can', 'pack', 'roll', 'tube', 'jug', 'container'];
const COMMON_CATEGORIES = ['Personal Care', 'Cleaning', 'Laundry', 'Food', 'Beverages', 'Paper Products', 'Health', 'Pet', 'Other'];

function formatDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function bestByColor(bestByDate?: string) {
  if (!bestByDate) return 'text-muted-foreground';
  const days = (new Date(bestByDate + 'T00:00:00').getTime() - Date.now()) / 86_400_000;
  if (days < 0) return 'text-destructive font-semibold';
  if (days < 60) return 'text-orange-500 font-medium';
  return 'text-muted-foreground';
}

interface PantryFormState {
  name: string;
  brand: string;
  category: string;
  quantity: string;
  unit: string;
  location: string;
  stored_date: string;
  best_by_date: string;
  best_by_days: string;
  notes: string;
}

const DEFAULT_FORM: PantryFormState = {
  name: '',
  brand: '',
  category: '',
  quantity: '1',
  unit: 'unit',
  location: '',
  stored_date: TODAY,
  best_by_date: '',
  best_by_days: '365',
  notes: '',
};

function computeBestByDate(storedDate: string, days: number): string {
  const dt = new Date(storedDate + 'T00:00:00');
  dt.setDate(dt.getDate() + days);
  return dt.toISOString().slice(0, 10);
}

function itemToForm(item: PantryItem): PantryFormState {
  return {
    name: item.name,
    brand: item.brand ?? '',
    category: item.category ?? '',
    quantity: String(item.quantity),
    unit: item.unit,
    location: item.location,
    stored_date: item.stored_date,
    best_by_date: item.best_by_date ?? '',
    best_by_days: String(item.best_by_days),
    notes: item.notes ?? '',
  };
}

function PantryForm({
  form, onChange, onSubmit, onCancel, submitLabel, saving, error, knownLocations, knownNames, items,
}: {
  form: PantryFormState;
  onChange: (patch: Partial<PantryFormState>) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  submitLabel: string;
  saving: boolean;
  error: string | null;
  knownLocations: string[];
  knownNames: string[];
  items: PantryItem[];
}) {
  const inp = 'w-full h-9 border rounded-md px-3 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring';

  // Auto-fill best_by_date when stored_date or best_by_days changes
  const handleDaysChange = (days: string) => {
    const d = parseInt(days, 10);
    const newBbd = !isNaN(d) && d > 0 && form.stored_date
      ? computeBestByDate(form.stored_date, d)
      : form.best_by_date;
    onChange({ best_by_days: days, best_by_date: newBbd });
  };

  const handleNameChange = (name: string) => {
    // Look up the most recent best_by_days for this item name
    const existing = items
      .filter(i => i.name.toLowerCase() === name.toLowerCase())
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    if (existing) {
      const newBbd = computeBestByDate(form.stored_date, existing.best_by_days);
      onChange({ name, best_by_days: String(existing.best_by_days), best_by_date: newBbd, unit: existing.unit, category: existing.category ?? form.category });
    } else {
      onChange({ name });
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4 mt-2">
      {error && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-destructive/10 border border-destructive/20 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />{error}
        </div>
      )}

      <div className="space-y-1.5">
        <label className="text-sm font-medium">Item Name <span className="text-destructive">*</span></label>
        <input
          type="text" list="pantry-names" value={form.name}
          onChange={e => handleNameChange(e.target.value)}
          placeholder="e.g. Tide Pods, Pasta, Shampoo"
          className={inp} required
        />
        <datalist id="pantry-names">{knownNames.map(n => <option key={n} value={n} />)}</datalist>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Brand</label>
          <input type="text" value={form.brand} onChange={e => onChange({ brand: e.target.value })}
            placeholder="optional" className={inp} />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Category</label>
          <input type="text" list="pantry-cats" value={form.category}
            onChange={e => onChange({ category: e.target.value })}
            placeholder="e.g. Cleaning" className={inp} />
          <datalist id="pantry-cats">{COMMON_CATEGORIES.map(c => <option key={c} value={c} />)}</datalist>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Quantity <span className="text-destructive">*</span></label>
          <input type="number" min={1} value={form.quantity} onChange={e => onChange({ quantity: e.target.value })}
            className={inp} required />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Unit</label>
          <input type="text" list="pantry-units" value={form.unit}
            onChange={e => onChange({ unit: e.target.value })} className={inp} />
          <datalist id="pantry-units">{COMMON_UNITS.map(u => <option key={u} value={u} />)}</datalist>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium">Location</label>
        <input type="text" list="pantry-locs" value={form.location}
          onChange={e => onChange({ location: e.target.value })}
          placeholder="e.g. Kitchen Cabinet, Bathroom" className={inp} />
        <datalist id="pantry-locs">{knownLocations.map(l => <option key={l} value={l} />)}</datalist>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Date Stored <span className="text-destructive">*</span></label>
          <input type="date" value={form.stored_date}
            onChange={e => {
              const newBbd = form.best_by_days && parseInt(form.best_by_days, 10) > 0
                ? computeBestByDate(e.target.value, parseInt(form.best_by_days, 10))
                : form.best_by_date;
              onChange({ stored_date: e.target.value, best_by_date: newBbd });
            }}
            className={inp} required />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Shelf Life (days)</label>
          <input type="number" min={1} value={form.best_by_days}
            onChange={e => handleDaysChange(e.target.value)} className={inp} />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium">Best-By Date</label>
        <input type="date" value={form.best_by_date}
          onChange={e => onChange({ best_by_date: e.target.value })} className={inp} />
        <p className="text-xs text-muted-foreground">Auto-computed from stored date + shelf life. Override if needed.</p>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium">Notes</label>
        <input type="text" value={form.notes} onChange={e => onChange({ notes: e.target.value })}
          placeholder="optional" className={inp} />
      </div>

      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onCancel}
          className="flex-1 h-9 border rounded-md text-sm hover:bg-accent transition-colors">Cancel</button>
        <button type="submit" disabled={saving}
          className="flex-1 h-9 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

export default function PantryPage() {
  const { activeProfile } = useProfile();
  const [items, setItems] = useState<PantryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showHistory, setShowHistory] = useState(false);

  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState<PantryFormState>(DEFAULT_FORM);
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const [editItem, setEditItem] = useState<PantryItem | null>(null);
  const [editForm, setEditForm] = useState<PantryFormState>(DEFAULT_FORM);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [removing, setRemoving] = useState<string | null>(null);
  const [removeQty, setRemoveQty] = useState<Record<string, string>>({});

  const [transactions, setTransactions] = useState<PantryTransaction[]>([]);
  const [usageSettings, setUsageSettings] = useState<PantryUsageSetting[]>([]);
  const [overrideItem, setOverrideItem] = useState<string | null>(null);
  const [overrideDays, setOverrideDays] = useState('');
  const [savingOverride, setSavingOverride] = useState(false);
  const [savingReset, setSavingReset] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeProfile) return;
    setLoading(true);
    setError(null);
    try {
      const [itemsRes, txRes, settingsRes] = await Promise.all([
        fetch(`/api/pantry?profile_id=${activeProfile.id}`),
        fetch(`/api/pantry/transactions?profile_id=${activeProfile.id}`),
        fetch(`/api/pantry/usage-settings?profile_id=${activeProfile.id}`),
      ]);
      if (itemsRes.ok) setItems(await itemsRes.json());
      if (txRes.ok) setTransactions(await txRes.json());
      if (settingsRes.ok) setUsageSettings(await settingsRes.json());
    } catch {
      setError('Failed to load pantry data');
    } finally {
      setLoading(false);
    }
  }, [activeProfile]);

  useEffect(() => { load(); }, [load]);

  const knownLocations = useMemo(
    () => [...new Set(items.map(i => i.location).filter(Boolean))].sort(),
    [items]
  );
  const knownNames = useMemo(
    () => [...new Set(items.map(i => i.name))].sort(),
    [items]
  );

  const pastBestByItems = useMemo(
    () => items.filter(i => i.best_by_date && i.best_by_date < TODAY)
      .sort((a, b) => (a.best_by_date ?? '').localeCompare(b.best_by_date ?? '')),
    [items]
  );

  const categoryStats = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of items) {
      const cat = item.category || 'Uncategorized';
      map.set(cat, (map.get(cat) ?? 0) + item.quantity);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [items]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return items;
    return items.filter(i =>
      i.name.toLowerCase().includes(q) ||
      (i.brand ?? '').toLowerCase().includes(q) ||
      (i.category ?? '').toLowerCase().includes(q) ||
      (i.notes ?? '').toLowerCase().includes(q) ||
      i.location.toLowerCase().includes(q)
    );
  }, [items, searchQuery]);

  const handleResetUsage = async (itemName: string) => {
    if (!activeProfile) return;
    setSavingReset(itemName);
    try {
      await fetch('/api/pantry/usage-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile_id: activeProfile.id,
          item_name: itemName,
          reset_date: new Date().toISOString().slice(0, 10),
          days_per_unit: null,
        }),
      });
      await load();
    } finally {
      setSavingReset(null);
    }
  };

  const handleSaveOverride = async (itemName: string, daysPerUnit: number | null) => {
    if (!activeProfile) return;
    setSavingOverride(true);
    try {
      await fetch('/api/pantry/usage-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile_id: activeProfile.id,
          item_name: itemName,
          days_per_unit: daysPerUnit,
        }),
      });
      setOverrideItem(null);
      setOverrideDays('');
      await load();
    } finally {
      setSavingOverride(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProfile) return;
    setAddError(null);
    setAddSaving(true);
    try {
      const res = await fetch('/api/pantry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile_id: activeProfile.id,
          name: addForm.name.trim(),
          brand: addForm.brand || undefined,
          category: addForm.category || undefined,
          quantity: Number(addForm.quantity) || 1,
          unit: addForm.unit || 'unit',
          location: addForm.location || '',
          stored_date: addForm.stored_date,
          best_by_date: addForm.best_by_date || undefined,
          best_by_days: parseInt(addForm.best_by_days, 10) || 365,
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

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editItem) return;
    setEditError(null);
    setEditSaving(true);
    try {
      const res = await fetch(`/api/pantry/${editItem.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editForm.name.trim(),
          brand: editForm.brand || undefined,
          category: editForm.category || undefined,
          quantity: Number(editForm.quantity) || 1,
          unit: editForm.unit || 'unit',
          location: editForm.location || '',
          stored_date: editForm.stored_date,
          best_by_date: editForm.best_by_date || undefined,
          best_by_days: parseInt(editForm.best_by_days, 10) || 365,
          notes: editForm.notes || undefined,
        }),
      });
      if (!res.ok) { setEditError((await res.json()).error ?? 'Failed'); return; }
      setEditItem(null);
      await load();
    } catch { setEditError('Failed to update item'); }
    finally { setEditSaving(false); }
  };

  const handleRemove = async (item: PantryItem, overrideQty?: number) => {
    const qty = overrideQty ?? Number(removeQty[item.id] ?? 1);
    if (qty < 1 || qty > item.quantity) return;
    setRemoving(item.id);
    try {
      const res = await fetch(`/api/pantry/${item.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: qty }),
      });
      if (res.ok) {
        await load();
        setRemoveQty(r => { const n = { ...r }; delete n[item.id]; return n; });
      }
    } finally { setRemoving(null); }
  };

  if (!activeProfile) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center text-muted-foreground">
        <ShoppingBasket className="h-8 w-8 mx-auto mb-3 opacity-40" />
        <p>Select a cellar profile to view the pantry.</p>
      </div>
    );
  }

  const totalItems = items.reduce((s, i) => s + i.quantity, 0);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShoppingBasket className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold">Pantry</h1>
          {totalItems > 0 && <span className="text-sm text-muted-foreground">({totalItems} items)</span>}
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

      {/* Category stats */}
      {!loading && categoryStats.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {categoryStats.map(([cat, count]) => (
            <span key={cat} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium bg-card">
              {cat} <span className="text-muted-foreground tabular-nums">{count}</span>
            </span>
          ))}
        </div>
      )}

      {/* Past best-by section */}
      {!loading && pastBestByItems.length > 0 && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5">
          <div className="px-4 py-3 border-b border-destructive/30 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-destructive">Past Best-By Date</h3>
            <span className="text-xs text-destructive/70">{pastBestByItems.length} items</span>
          </div>
          <div className="divide-y divide-destructive/10">
            {pastBestByItems.map(item => {
              const daysOver = Math.floor((Date.now() - new Date((item.best_by_date ?? TODAY) + 'T00:00:00').getTime()) / 86_400_000);
              return (
                <div key={item.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.name}{item.brand ? ` – ${item.brand}` : ''}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.location || 'No location'} · best by {formatDate(item.best_by_date!)}
                    </p>
                  </div>
                  <span className="text-xs font-medium text-destructive shrink-0">{daysOver}d over</span>
                  <span className="text-xs text-muted-foreground shrink-0">{item.quantity} {item.unit}</span>
                  <button
                    onClick={() => { setEditItem(item); setEditForm(itemToForm(item)); setEditError(null); }}
                    className="text-xs px-2 py-1 rounded border text-muted-foreground hover:bg-accent transition-colors shrink-0"
                  >
                    <Edit2 className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => handleRemove(item, item.quantity)}
                    disabled={removing === item.id}
                    className="text-xs px-2 py-1 rounded border border-destructive/40 text-destructive hover:bg-destructive/10 transition-colors shrink-0 disabled:opacity-50"
                  >
                    {removing === item.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Search bar */}
      {!loading && items.length > 0 && (
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            type="search"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search items… (e.g. Tide Pods, pasta, soap)"
            className="w-full h-9 pl-8 pr-8 border rounded-md text-sm bg-background"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Items list */}
      {!loading && filteredItems.length > 0 && (
        <div className="space-y-2">
          {filteredItems.map(item => {
            const setting = usageSettings.find(s => s.item_name.toLowerCase() === item.name.toLowerCase());
            const pred = computeUsagePrediction(transactions, item.name, setting?.reset_date);
            const effectiveDays = setting?.days_per_unit ?? pred?.daysPerUnit;
            const daysLeft = effectiveDays != null && item.quantity > 0
              ? Math.round(item.quantity * effectiveDays)
              : null;
            return (
            <div key={item.id} className="border rounded-lg p-4 bg-card space-y-3">
              <div className="flex items-start gap-2 justify-between">
                <div className="min-w-0">
                  <p className="font-semibold truncate">{item.name}</p>
                  <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-muted-foreground mt-0.5">
                    {item.brand && <span>{item.brand}</span>}
                    {item.category && <span className="bg-muted px-1.5 py-0.5 rounded">{item.category}</span>}
                  </div>
                </div>
                <span className="shrink-0 text-sm font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full tabular-nums">
                  {item.quantity} {item.unit}{item.quantity !== 1 ? 's' : ''}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-muted-foreground">
                {item.location && <span>{item.location}</span>}
                <span>Stored: {formatDate(item.stored_date)}</span>
                {item.best_by_date && (
                  <span className={bestByColor(item.best_by_date)}>
                    Best by: {formatDate(item.best_by_date)}
                  </span>
                )}
                {item.notes && <span className="col-span-2 italic">{item.notes}</span>}
              </div>

              {/* Usage prediction — shown only when enough data (≥2 remove events) or manual override */}
              {effectiveDays != null && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs">
                    <TrendingDown className="h-3 w-3 text-primary/70 shrink-0" />
                    {daysLeft != null && (
                      <span className="font-medium text-foreground/80">~{formatDays(daysLeft)} of stock left</span>
                    )}
                    <span className="text-muted-foreground flex-1 truncate ml-1">
                      {setting?.days_per_unit != null
                        ? `1 ${item.unit} every ${Math.round(setting.days_per_unit)}d (custom)`
                        : pred ? `1 ${item.unit} every ~${Math.round(pred.daysPerUnit)}d (${pred.eventCount} uses)` : null}
                    </span>
                    <button
                      onClick={() => handleResetUsage(item.name)}
                      disabled={savingReset === item.name}
                      title="Reset: restart calculation from today"
                      className="p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-50 shrink-0"
                    >
                      {savingReset === item.name ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                    </button>
                    <button
                      onClick={() => {
                        if (overrideItem === item.name) { setOverrideItem(null); setOverrideDays(''); }
                        else { setOverrideItem(item.name); setOverrideDays(String(Math.round(effectiveDays))); }
                      }}
                      title="Manually adjust consumption rate"
                      className={cn('p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shrink-0', overrideItem === item.name && 'bg-accent text-foreground')}
                    >
                      <SlidersHorizontal className="h-3 w-3" />
                    </button>
                  </div>
                  {overrideItem === item.name && (
                    <div className="flex flex-wrap items-center gap-1.5 pl-4">
                      <span className="text-xs text-muted-foreground">1 {item.unit} every</span>
                      <input
                        type="number" min="1"
                        value={overrideDays}
                        onChange={e => setOverrideDays(e.target.value)}
                        className="w-14 h-6 text-xs text-center border rounded px-1 bg-background"
                      />
                      <span className="text-xs text-muted-foreground">days</span>
                      <button
                        onClick={() => handleSaveOverride(item.name, Number(overrideDays))}
                        disabled={savingOverride || !overrideDays || Number(overrideDays) <= 0}
                        className="text-xs px-2 py-0.5 rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                      >
                        {savingOverride ? <Loader2 className="h-3 w-3 animate-spin inline" /> : 'Save'}
                      </button>
                      <button
                        onClick={() => { setOverrideItem(null); setOverrideDays(''); }}
                        className="text-xs px-2 py-0.5 rounded border text-muted-foreground hover:bg-accent transition-colors"
                      >
                        Cancel
                      </button>
                      {setting?.days_per_unit != null && (
                        <button
                          onClick={() => handleSaveOverride(item.name, null)}
                          disabled={savingOverride}
                          className="text-xs text-primary hover:underline disabled:opacity-50"
                        >
                          Use calculated
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center gap-2 pt-1 border-t">
                <label className="text-xs text-muted-foreground">Remove</label>
                <input
                  type="number" min={1} max={item.quantity}
                  value={removeQty[item.id] ?? '1'}
                  onChange={e => setRemoveQty(r => ({ ...r, [item.id]: e.target.value }))}
                  className="w-14 h-7 text-sm text-center border rounded px-1 bg-background"
                />
                <span className="text-xs text-muted-foreground">{item.unit}{(Number(removeQty[item.id] ?? 1)) !== 1 ? 's' : ''}</span>
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
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {!loading && items.length === 0 && (
        <div className="text-center py-16 border border-dashed rounded-lg text-muted-foreground">
          <ShoppingBasket className="h-8 w-8 mx-auto mb-3 opacity-40" />
          <p className="text-sm font-medium">No pantry items yet</p>
          <p className="text-xs mt-1">Track household staples like soap, pasta, or laundry detergent.</p>
          <button
            onClick={() => { setShowAdd(true); setAddForm(DEFAULT_FORM); setAddError(null); }}
            className="mt-4 px-4 py-1.5 rounded-md bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors"
          >
            Add First Item
          </button>
        </div>
      )}

      {/* No search results */}
      {!loading && items.length > 0 && filteredItems.length === 0 && searchQuery && (
        <div className="text-center py-8 border border-dashed rounded-lg text-muted-foreground">
          <p className="text-sm">No items match &ldquo;{searchQuery}&rdquo;</p>
          <button onClick={() => setSearchQuery('')} className="text-xs text-primary mt-1 hover:underline">Clear search</button>
        </div>
      )}

      {/* Usage history (collapsible) */}
      {!loading && items.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <button
            onClick={() => setShowHistory(h => !h)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-accent/50 transition-colors"
          >
            <span>Category Breakdown</span>
            {showHistory ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {showHistory && (
            <div className="border-t divide-y">
              {categoryStats.map(([cat, count]) => (
                <div key={cat} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span>{cat}</span>
                  <span className="text-muted-foreground tabular-nums">{count} items</span>
                </div>
              ))}
              <div className="px-4 py-2.5 text-sm space-y-1">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-2">By Location</p>
                {[...new Set(items.map(i => i.location || 'No location'))].sort().map(loc => {
                  const locItems = items.filter(i => (i.location || 'No location') === loc);
                  const locTotal = locItems.reduce((s, i) => s + i.quantity, 0);
                  return (
                    <div key={loc} className="flex items-center justify-between">
                      <span className="text-muted-foreground">{loc}</span>
                      <span className="text-muted-foreground tabular-nums">{locTotal} items ({locItems.length} types)</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingBasket className="h-4 w-4 text-primary" />
              Add Pantry Item
            </DialogTitle>
          </DialogHeader>
          <PantryForm
            form={addForm}
            onChange={patch => setAddForm(f => ({ ...f, ...patch }))}
            onSubmit={handleAdd}
            onCancel={() => setShowAdd(false)}
            submitLabel="Add to Pantry"
            saving={addSaving}
            error={addError}
            knownLocations={knownLocations}
            knownNames={knownNames}
            items={items}
          />
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editItem} onOpenChange={open => { if (!open) setEditItem(null); }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="h-4 w-4 text-primary" />
              Edit Pantry Item
            </DialogTitle>
          </DialogHeader>
          <PantryForm
            form={editForm}
            onChange={patch => setEditForm(f => ({ ...f, ...patch }))}
            onSubmit={handleEdit}
            onCancel={() => setEditItem(null)}
            submitLabel="Save Changes"
            saving={editSaving}
            error={editError}
            knownLocations={knownLocations}
            knownNames={knownNames}
            items={items}
          />
        </DialogContent>
      </Dialog>

    </div>
  );
}
