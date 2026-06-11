'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Snowflake, Trash2, ChevronDown, ChevronUp, Loader2, AlertCircle, Search, Edit2 } from 'lucide-react';
import { useProfile } from '@/hooks/useProfile';
import { MEAT_CUTS, getPrimalForCut } from '@/lib/meat-cuts';
import type { FreezerItem, FreezerTransaction } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const TODAY = new Date().toISOString().slice(0, 10);

function formatDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function eatByColor(eatByDate: string) {
  const days = (new Date(eatByDate + 'T00:00:00').getTime() - Date.now()) / 86_400_000;
  if (days < 0) return 'text-destructive font-semibold';
  if (days < 60) return 'text-orange-500 font-medium';
  return 'text-muted-foreground';
}

// Average monthly consumption per cut, from remove transactions
function computeConsumption(txs: FreezerTransaction[]) {
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
  return byCut;
}

interface AddFormState {
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

const DEFAULT_FORM: AddFormState = {
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

export default function FreezerPage() {
  const { activeProfile } = useProfile();
  const [items, setItems] = useState<FreezerItem[]>([]);
  const [txs, setTxs] = useState<FreezerTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [locationFilter, setLocationFilter] = useState('');

  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<AddFormState>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [showHistory, setShowHistory] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [removeQty, setRemoveQty] = useState<Record<string, string>>({});

  const [editItem, setEditItem] = useState<FreezerItem | null>(null);
  const [editForm, setEditForm] = useState<AddFormState>(DEFAULT_FORM);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeProfile) return;
    setLoading(true);
    setError(null);
    try {
      const [itemsRes, txsRes] = await Promise.all([
        fetch(`/api/freezer?profile_id=${activeProfile.id}`),
        fetch(`/api/freezer/transactions?profile_id=${activeProfile.id}`),
      ]);
      if (itemsRes.ok) setItems(await itemsRes.json());
      if (txsRes.ok) setTxs(await txsRes.json());
    } catch {
      setError('Failed to load freezer inventory');
    } finally {
      setLoading(false);
    }
  }, [activeProfile]);

  useEffect(() => { load(); }, [load]);

  const handleCutChange = (value: string) => {
    if (value === '__custom__') {
      setForm(f => ({ ...f, meat_cut: '__custom__', primal: '' }));
    } else {
      const primal = getPrimalForCut(value) ?? '';
      setForm(f => ({ ...f, meat_cut: value, custom_cut: '', primal }));
    }
  };

  const handleLookupPrimal = async () => {
    const cut = form.custom_cut.trim();
    if (!cut) return;
    setLookupLoading(true);
    try {
      const res = await fetch('/api/freezer/lookup-primal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cut }),
      });
      if (res.ok) {
        const data = await res.json();
        setForm(f => ({ ...f, primal: data.primal ?? '' }));
      }
    } finally {
      setLookupLoading(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const cutName = form.meat_cut === '__custom__' ? form.custom_cut.trim() : form.meat_cut;
    if (!cutName) { setFormError('Select or enter a meat cut'); return; }
    if (!form.stored_date) { setFormError('Stored date is required'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/freezer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile_id: activeProfile!.id,
          meat_cut: cutName,
          primal: form.primal || undefined,
          quantity: Number(form.quantity) || 1,
          weight_lbs: form.weight_lbs ? Number(form.weight_lbs) : undefined,
          location: form.location || undefined,
          stored_date: form.stored_date,
          price_per_lb: form.price_per_lb ? Number(form.price_per_lb) : undefined,
          notes: form.notes || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setFormError(data.error ?? 'Failed to add item');
        return;
      }
      setShowAdd(false);
      setForm(DEFAULT_FORM);
      await load();
    } catch {
      setFormError('Failed to add item');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (item: FreezerItem) => {
    const qty = Number(removeQty[item.id] ?? 1);
    if (qty < 1 || qty > item.quantity) return;
    setRemoving(item.id);
    try {
      const res = await fetch(`/api/freezer/${item.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: qty }),
      });
      if (res.ok) {
        await load();
        setRemoveQty(r => { const next = { ...r }; delete next[item.id]; return next; });
      }
    } finally {
      setRemoving(null);
    }
  };

  const openEdit = (item: FreezerItem) => {
    setEditItem(item);
    setEditForm({
      meat_cut: MEAT_CUTS.some(m => m.cut === item.meat_cut) ? item.meat_cut : '__custom__',
      custom_cut: MEAT_CUTS.some(m => m.cut === item.meat_cut) ? '' : item.meat_cut,
      primal: item.primal ?? '',
      quantity: String(item.quantity),
      weight_lbs: item.weight_lbs != null ? String(item.weight_lbs) : '',
      location: item.location ?? '',
      stored_date: item.stored_date,
      price_per_lb: item.price_per_lb != null ? String(item.price_per_lb) : '',
      notes: item.notes ?? '',
    });
    setEditError(null);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editItem) return;
    setEditError(null);
    const cutName = editForm.meat_cut === '__custom__' ? editForm.custom_cut.trim() : editForm.meat_cut;
    if (!cutName) { setEditError('Select or enter a meat cut'); return; }
    if (!editForm.stored_date) { setEditError('Stored date is required'); return; }
    setEditSaving(true);
    try {
      const res = await fetch(`/api/freezer/${editItem.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
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
      if (!res.ok) {
        const data = await res.json();
        setEditError(data.error ?? 'Failed to update item');
        return;
      }
      setEditItem(null);
      await load();
    } catch {
      setEditError('Failed to update item');
    } finally {
      setEditSaving(false);
    }
  };

  // Distinct non-empty locations across all items, for filter dropdown and datalist
  const knownLocations = [...new Set(items.map(i => i.location).filter(Boolean))].sort();

  // Client-side filtering
  const filteredItems = items.filter(item => {
    const matchesCut = !searchQuery.trim() ||
      item.meat_cut.toLowerCase().includes(searchQuery.trim().toLowerCase());
    const matchesLocation = !locationFilter ||
      item.location === locationFilter;
    return matchesCut && matchesLocation;
  });

  const consumption = computeConsumption(txs);
  const removeTxs = txs.filter(t => t.action === 'remove');
  const hasPriceData = items.some(i => i.price_per_lb != null);
  const isFiltered = searchQuery.trim() !== '' || locationFilter !== '';

  if (!activeProfile) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center text-muted-foreground">
        <Snowflake className="h-8 w-8 mx-auto mb-3 opacity-40" />
        <p>Select a cellar profile to view the freezer inventory.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Snowflake className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold">Freezer</h1>
          {items.length > 0 && (
            <span className="text-sm text-muted-foreground">
              {isFiltered
                ? `(${filteredItems.reduce((s, i) => s + i.quantity, 0)} of ${items.reduce((s, i) => s + i.quantity, 0)} packs)`
                : `(${items.reduce((s, i) => s + i.quantity, 0)} packs)`}
            </span>
          )}
        </div>
        <button
          onClick={() => { setShowAdd(true); setForm(DEFAULT_FORM); setFormError(null); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Item
        </button>
      </div>

      {/* Search + location filter */}
      {!loading && items.length > 0 && (
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search cuts… (e.g. chuck, steak)"
              className="w-full h-9 pl-8 pr-3 border rounded-md text-sm bg-background"
            />
          </div>
          {knownLocations.length > 1 && (
            <select
              value={locationFilter}
              onChange={e => setLocationFilter(e.target.value)}
              className="h-9 border rounded-md px-2 text-sm bg-background"
            >
              <option value="">All freezers</option>
              {knownLocations.map(loc => (
                <option key={loc} value={loc}>{loc}</option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-destructive/10 border border-destructive/20 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Inventory list */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border border-dashed rounded-lg">
          <Snowflake className="h-8 w-8 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No items in the freezer yet.</p>
          <p className="text-xs mt-1">Click &quot;Add Item&quot; to get started.</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground border border-dashed rounded-lg">
          <Search className="h-6 w-6 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No cuts match &quot;{searchQuery}&quot;{locationFilter ? ` in ${locationFilter}` : ''}.</p>
          <button onClick={() => { setSearchQuery(''); setLocationFilter(''); }} className="text-xs text-primary mt-1 hover:underline">
            Clear filters
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredItems.map(item => (
            <div key={item.id} className="border rounded-lg p-4 bg-card space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{item.meat_cut}</p>
                  {item.primal && (
                    <p className="text-xs text-muted-foreground">{item.primal}</p>
                  )}
                </div>
                <span className="shrink-0 text-sm font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                  {item.quantity} {item.quantity === 1 ? 'pack' : 'packs'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-muted-foreground">
                {item.weight_lbs != null && (
                  <span>~{item.weight_lbs} lbs/pack</span>
                )}
                {item.location && (
                  <span>{item.location}</span>
                )}
                <span>Stored: {formatDate(item.stored_date)}</span>
                <span className={eatByColor(item.eat_by_date)}>
                  Eat by: {formatDate(item.eat_by_date)}
                </span>
                {hasPriceData && item.price_per_lb != null && (
                  <span>${item.price_per_lb.toFixed(2)}/lb</span>
                )}
              </div>

              {/* Remove row */}
              <div className="flex items-center gap-2 pt-1 border-t">
                <label className="text-xs text-muted-foreground">Remove</label>
                <input
                  type="number"
                  min={1}
                  max={item.quantity}
                  value={removeQty[item.id] ?? '1'}
                  onChange={e => setRemoveQty(r => ({ ...r, [item.id]: e.target.value }))}
                  className="w-14 h-7 text-sm text-center border rounded px-1 bg-background"
                />
                <span className="text-xs text-muted-foreground">pack{(Number(removeQty[item.id] ?? 1)) !== 1 ? 's' : ''}</span>
                <div className="flex items-center gap-1.5 ml-auto">
                  <button
                    onClick={() => openEdit(item)}
                    className="flex items-center gap-1 text-xs px-2 py-1 rounded border text-muted-foreground hover:bg-accent transition-colors"
                  >
                    <Edit2 className="h-3 w-3" />
                    Edit
                  </button>
                  <button
                    onClick={() => handleRemove(item)}
                    disabled={removing === item.id}
                    className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-destructive/40 text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                  >
                    {removing === item.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Trash2 className="h-3 w-3" />
                    )}
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Consumption history */}
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
            <div className="border-t px-4 py-3 space-y-4">
              {/* Per-cut summary */}
              {consumption.size > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Avg Monthly Usage</p>
                  <div className="space-y-1">
                    {[...consumption.entries()].map(([cut, stats]) => {
                      const months = Math.max(1,
                        (new Date(stats.latest).getTime() - new Date(stats.earliest).getTime()) / (30 * 86_400_000)
                      );
                      const perMonth = (stats.total / months).toFixed(1);
                      return (
                        <div key={cut} className="flex items-center justify-between text-sm">
                          <span>{cut}</span>
                          <span className="text-muted-foreground">{perMonth} packs/mo</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Remove transaction log */}
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Recent Removals</p>
                <div className="space-y-1">
                  {removeTxs.slice(0, 30).map(t => (
                    <div key={t.id} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{new Date(t.created_at).toLocaleDateString()}</span>
                      <span className="flex-1 px-3 truncate">{t.meat_cut}</span>
                      <span className="text-muted-foreground">−{t.quantity}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Edit Item dialog */}
      <Dialog open={!!editItem} onOpenChange={open => { if (!open) setEditItem(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="h-4 w-4 text-primary" />
              Edit Freezer Item
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleEdit} className="space-y-4 mt-2">
            {editError && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-destructive/10 border border-destructive/20 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {editError}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Meat Cut</label>
              <select
                value={editForm.meat_cut}
                onChange={e => {
                  const v = e.target.value;
                  if (v === '__custom__') {
                    setEditForm(f => ({ ...f, meat_cut: '__custom__', primal: '' }));
                  } else {
                    setEditForm(f => ({ ...f, meat_cut: v, custom_cut: '', primal: getPrimalForCut(v) ?? f.primal }));
                  }
                }}
                className="w-full h-9 border rounded-md px-3 text-sm bg-background"
                required
              >
                <option value="">Select a cut…</option>
                {MEAT_CUTS.map(m => (
                  <option key={m.cut} value={m.cut}>{m.cut}</option>
                ))}
                <option value="__custom__">Custom cut…</option>
              </select>
            </div>

            {editForm.meat_cut === '__custom__' && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Cut Name</label>
                <input
                  type="text"
                  value={editForm.custom_cut}
                  onChange={e => setEditForm(f => ({ ...f, custom_cut: e.target.value }))}
                  placeholder="e.g. Lamb Shoulder"
                  className="w-full h-9 border rounded-md px-3 text-sm bg-background"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Primal / Area</label>
              <input
                type="text"
                value={editForm.primal}
                onChange={e => setEditForm(f => ({ ...f, primal: e.target.value }))}
                placeholder="e.g. Chuck, Loin"
                className="w-full h-9 border rounded-md px-3 text-sm bg-background"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Packs</label>
                <input
                  type="number"
                  min={1}
                  value={editForm.quantity}
                  onChange={e => setEditForm(f => ({ ...f, quantity: e.target.value }))}
                  className="w-full h-9 border rounded-md px-3 text-sm bg-background"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Weight/pack (lbs)</label>
                <input
                  type="number"
                  min={0}
                  step={0.1}
                  value={editForm.weight_lbs}
                  onChange={e => setEditForm(f => ({ ...f, weight_lbs: e.target.value }))}
                  placeholder="optional"
                  className="w-full h-9 border rounded-md px-3 text-sm bg-background"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Freezer / Location</label>
              <input
                type="text"
                list="edit-freezer-locations"
                value={editForm.location}
                onChange={e => setEditForm(f => ({ ...f, location: e.target.value }))}
                placeholder="e.g. Garage Freezer"
                className="w-full h-9 border rounded-md px-3 text-sm bg-background"
              />
              <datalist id="edit-freezer-locations">
                {knownLocations.map(loc => <option key={loc} value={loc} />)}
              </datalist>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Date Stored</label>
                <input
                  type="date"
                  value={editForm.stored_date}
                  onChange={e => setEditForm(f => ({ ...f, stored_date: e.target.value }))}
                  className="w-full h-9 border rounded-md px-3 text-sm bg-background"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Price/lb ($)</label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={editForm.price_per_lb}
                  onChange={e => setEditForm(f => ({ ...f, price_per_lb: e.target.value }))}
                  placeholder="optional"
                  className="w-full h-9 border rounded-md px-3 text-sm bg-background"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Notes</label>
              <input
                type="text"
                value={editForm.notes}
                onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="optional"
                className="w-full h-9 border rounded-md px-3 text-sm bg-background"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setEditItem(null)}
                className="flex-1 h-9 border rounded-md text-sm hover:bg-accent transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={editSaving}
                className="flex-1 h-9 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
              >
                {editSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                Save Changes
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Item dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Snowflake className="h-4 w-4 text-primary" />
              Add to Freezer
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleAdd} className="space-y-4 mt-2">
            {formError && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-destructive/10 border border-destructive/20 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {formError}
              </div>
            )}

            {/* Meat cut */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Meat Cut</label>
              <select
                value={form.meat_cut}
                onChange={e => handleCutChange(e.target.value)}
                className="w-full h-9 border rounded-md px-3 text-sm bg-background"
                required
              >
                <option value="">Select a cut…</option>
                {MEAT_CUTS.map(m => (
                  <option key={m.cut} value={m.cut}>{m.cut}</option>
                ))}
                <option value="__custom__">Custom cut…</option>
              </select>
            </div>

            {/* Custom cut input */}
            {form.meat_cut === '__custom__' && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Cut Name</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={form.custom_cut}
                    onChange={e => setForm(f => ({ ...f, custom_cut: e.target.value }))}
                    placeholder="e.g. Lamb Shoulder"
                    className="flex-1 h-9 border rounded-md px-3 text-sm bg-background"
                  />
                  <button
                    type="button"
                    onClick={handleLookupPrimal}
                    disabled={!form.custom_cut.trim() || lookupLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 border rounded-md text-sm hover:bg-accent transition-colors disabled:opacity-50"
                  >
                    {lookupLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                    Lookup
                  </button>
                </div>
              </div>
            )}

            {/* Primal */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Primal / Area</label>
              <input
                type="text"
                value={form.primal}
                onChange={e => setForm(f => ({ ...f, primal: e.target.value }))}
                placeholder="Auto-filled from cut selection"
                className="w-full h-9 border rounded-md px-3 text-sm bg-background"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Quantity */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Packs</label>
                <input
                  type="number"
                  min={1}
                  value={form.quantity}
                  onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                  className="w-full h-9 border rounded-md px-3 text-sm bg-background"
                  required
                />
              </div>

              {/* Weight */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Weight/pack (lbs)</label>
                <input
                  type="number"
                  min={0}
                  step={0.1}
                  value={form.weight_lbs}
                  onChange={e => setForm(f => ({ ...f, weight_lbs: e.target.value }))}
                  placeholder="optional"
                  className="w-full h-9 border rounded-md px-3 text-sm bg-background"
                />
              </div>
            </div>

            {/* Location */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Freezer / Location</label>
              <input
                type="text"
                list="freezer-locations"
                value={form.location}
                onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                placeholder="e.g. Garage Freezer, Kitchen Freezer"
                className="w-full h-9 border rounded-md px-3 text-sm bg-background"
              />
              <datalist id="freezer-locations">
                {knownLocations.map(loc => <option key={loc} value={loc} />)}
              </datalist>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Stored date */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Date Stored</label>
                <input
                  type="date"
                  value={form.stored_date}
                  onChange={e => setForm(f => ({ ...f, stored_date: e.target.value }))}
                  className="w-full h-9 border rounded-md px-3 text-sm bg-background"
                  required
                />
              </div>

              {/* Price/lb */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Price/lb ($)</label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.price_per_lb}
                  onChange={e => setForm(f => ({ ...f, price_per_lb: e.target.value }))}
                  placeholder="optional"
                  className="w-full h-9 border rounded-md px-3 text-sm bg-background"
                />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Notes</label>
              <input
                type="text"
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="optional"
                className="w-full h-9 border rounded-md px-3 text-sm bg-background"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                className="flex-1 h-9 border rounded-md text-sm hover:bg-accent transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 h-9 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Add to Freezer
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
