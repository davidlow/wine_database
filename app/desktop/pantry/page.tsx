'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Plus, ShoppingBasket, Trash2, Edit2, ChevronDown, ChevronUp,
  Loader2, AlertCircle, Search, X, Check,
} from 'lucide-react';
import { useProfile } from '@/hooks/useProfile';
import type { PantryItem, PantryTransaction, PantryUsageSetting, PantryDateMode } from '@/types';
import { cn } from '@/lib/utils';
import { computeUsagePrediction } from '@/lib/pantry-utils';

const TODAY = new Date().toISOString().slice(0, 10);
const COMMON_UNITS = ['unit', 'box', 'bottle', 'bar', 'bag', 'can', 'pack', 'roll', 'tube', 'jug', 'container'];
const COMMON_CATEGORIES = ['Personal Care', 'Cleaning', 'Laundry', 'Food', 'Beverages', 'Paper Products', 'Health', 'Pet', 'Other'];

function formatDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function bestByColor(d?: string) {
  if (!d) return 'text-muted-foreground';
  const days = (new Date(d + 'T00:00:00').getTime() - Date.now()) / 86_400_000;
  if (days < 0) return 'text-destructive font-semibold';
  if (days < 60) return 'text-orange-500 font-medium';
  return 'text-muted-foreground';
}
function computeBestByDate(stored: string, days: number) {
  const dt = new Date(stored + 'T00:00:00');
  dt.setDate(dt.getDate() + days);
  return dt.toISOString().slice(0, 10);
}

interface ItemGroup {
  name: string; items: PantryItem[]; totalQty: number;
  setting: PantryUsageSetting | undefined; dateMode: PantryDateMode;
  category: string | undefined; unit: string; location: string;
  brand: string | undefined; earliestBestBy: string | undefined;
}
function makeGroups(items: PantryItem[], settings: PantryUsageSetting[]): ItemGroup[] {
  const map = new Map<string, PantryItem[]>();
  for (const item of items) {
    const key = item.name.toLowerCase();
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }
  return [...map.entries()].map(([, gi]) => {
    const sorted = [...gi].sort((a, b) => (a.stored_date || '').localeCompare(b.stored_date || ''));
    const setting = settings.find(s => s.item_name.toLowerCase() === gi[0].name.toLowerCase());
    const dateMode: PantryDateMode = (setting?.date_mode ?? 'full') as PantryDateMode;
    const totalQty = gi.reduce((s, i) => s + i.quantity, 0);
    const bestByDates = gi.map(i => i.best_by_date).filter((d): d is string => !!d).sort();
    return { name: gi[0].name, items: sorted, totalQty, setting, dateMode, category: sorted[0].category, unit: sorted[0].unit, location: sorted[0].location, brand: sorted[0].brand, earliestBestBy: bestByDates[0] };
  }).sort((a, b) => a.name.localeCompare(b.name));
}

interface RowForm {
  name: string; brand: string; category: string; quantity: string; unit: string;
  location: string; stored_date: string; best_by_date: string; best_by_days: string;
  notes: string; date_mode: PantryDateMode;
}
const BLANK_ROW: RowForm = {
  name: '', brand: '', category: '', quantity: '1', unit: 'unit',
  location: '', stored_date: TODAY, best_by_date: '', best_by_days: '365',
  notes: '', date_mode: 'full',
};
function itemToRow(item: PantryItem, dm: PantryDateMode): RowForm {
  return {
    name: item.name, brand: item.brand ?? '', category: item.category ?? '',
    quantity: String(item.quantity), unit: item.unit, location: item.location,
    stored_date: item.stored_date, best_by_date: item.best_by_date ?? '',
    best_by_days: String(item.best_by_days || 365), notes: item.notes ?? '', date_mode: dm,
  };
}

// ── Inline editable row ───────────────────────────────────────────────────────
function EditableRow({
  form, onChange, knownNames, onSave, onCancel, saving, error, isNew,
}: {
  form: RowForm; onChange: (p: Partial<RowForm>) => void;
  knownNames: string[]; onSave: () => void; onCancel: () => void;
  saving: boolean; error: string | null; isNew?: boolean;
}) {
  const inp = 'h-7 border rounded px-2 text-xs bg-background focus:outline-none focus:ring-1 focus:ring-ring w-full';
  const firstRef = useRef<HTMLInputElement>(null);
  useEffect(() => { firstRef.current?.focus(); }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSave(); }
    if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
  };

  const handleNameChange = (v: string) => {
    onChange({ name: v });
  };

  const updateBestBy = (stored: string, days: string) => {
    const n = parseInt(days);
    if (!isNaN(n) && n > 0 && stored) onChange({ best_by_date: computeBestByDate(stored, n) });
  };

  return (
    <tr className="bg-primary/5 border-y border-primary/20" onKeyDown={handleKeyDown}>
      <td className="px-2 py-1.5">
        <input ref={firstRef} type="text" list="pantry-names" value={form.name} onChange={e => handleNameChange(e.target.value)} placeholder="Item name" className={inp} required />
        <datalist id="pantry-names">{knownNames.map(n => <option key={n} value={n} />)}</datalist>
      </td>
      <td className="px-2 py-1.5"><input type="text" value={form.brand} onChange={e => onChange({ brand: e.target.value })} placeholder="Brand" className={inp} /></td>
      <td className="px-2 py-1.5">
        <input type="text" list="pantry-cats" value={form.category} onChange={e => onChange({ category: e.target.value })} placeholder="Category" className={inp} />
        <datalist id="pantry-cats">{COMMON_CATEGORIES.map(c => <option key={c} value={c} />)}</datalist>
      </td>
      <td className="px-2 py-1.5"><input type="number" value={form.quantity} onChange={e => onChange({ quantity: e.target.value })} min={1} className={inp} style={{ width: 56 }} /></td>
      <td className="px-2 py-1.5">
        <input type="text" list="pantry-units" value={form.unit} onChange={e => onChange({ unit: e.target.value })} placeholder="unit" className={inp} />
        <datalist id="pantry-units">{COMMON_UNITS.map(u => <option key={u} value={u} />)}</datalist>
      </td>
      <td className="px-2 py-1.5"><input type="text" value={form.location} onChange={e => onChange({ location: e.target.value })} placeholder="Location" className={inp} /></td>
      <td className="px-2 py-1.5">
        <select value={form.date_mode} onChange={e => onChange({ date_mode: e.target.value as PantryDateMode })} className={`${inp} text-xs`}>
          <option value="full">Full</option>
          <option value="no_best_by">Stored only</option>
          <option value="no_dates">No dates</option>
        </select>
      </td>
      {form.date_mode !== 'no_dates' && (
        <td className="px-2 py-1.5"><input type="date" value={form.stored_date} onChange={e => { onChange({ stored_date: e.target.value }); if (form.date_mode === 'full') updateBestBy(e.target.value, form.best_by_days); }} className={inp} required /></td>
      )}
      {form.date_mode === 'no_dates' && <td className="px-2 py-1.5 text-muted-foreground text-xs">—</td>}
      {form.date_mode === 'full' && (
        <td className="px-2 py-1.5"><input type="date" value={form.best_by_date} onChange={e => onChange({ best_by_date: e.target.value })} className={inp} /></td>
      )}
      {form.date_mode !== 'full' && <td className="px-2 py-1.5 text-muted-foreground text-xs">—</td>}
      <td className="px-2 py-1.5"><input type="text" value={form.notes} onChange={e => onChange({ notes: e.target.value })} placeholder="Notes" className={inp} /></td>
      <td className="px-2 py-1.5">
        <div className="flex gap-1">
          <button onClick={onSave} disabled={saving || !form.name.trim()} className="h-7 w-7 flex items-center justify-center rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          </button>
          <button onClick={onCancel} className="h-7 w-7 flex items-center justify-center rounded border hover:bg-accent transition-colors"><X className="h-3.5 w-3.5" /></button>
        </div>
        {error && <p className="text-xs text-destructive mt-1 whitespace-nowrap">{error}</p>}
      </td>
    </tr>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function DesktopPantryPage() {
  const { activeProfile } = useProfile();
  const [items, setItems] = useState<PantryItem[]>([]);
  const [txs, setTxs] = useState<PantryTransaction[]>([]);
  const [usageSettings, setUsageSettings] = useState<PantryUsageSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // Add row state
  const [addingRow, setAddingRow] = useState(false);
  const [addForm, setAddForm] = useState<RowForm>(BLANK_ROW);
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Edit row state
  const [editItemId, setEditItemId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<RowForm>(BLANK_ROW);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeProfile) return;
    setLoading(true); setError(null);
    try {
      const [iR, tR, sR] = await Promise.all([
        fetch(`/api/pantry?profile_id=${activeProfile.id}`),
        fetch(`/api/pantry/transactions?profile_id=${activeProfile.id}`),
        fetch(`/api/pantry/usage-settings?profile_id=${activeProfile.id}`),
      ]);
      if (iR.ok) setItems(await iR.json());
      if (tR.ok) setTxs(await tR.json());
      if (sR.ok) setUsageSettings(await sR.json());
    } catch { setError('Failed to load'); }
    finally { setLoading(false); }
  }, [activeProfile]);
  useEffect(() => { load(); }, [load]);

  const allGroups = useMemo(() => makeGroups(items, usageSettings), [items, usageSettings]);

  const filteredGroups = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return allGroups;
    return allGroups.filter(g => g.name.toLowerCase().includes(q) || (g.category ?? '').toLowerCase().includes(q) || (g.brand ?? '').toLowerCase().includes(q));
  }, [allGroups, searchQuery]);

  const knownNames = useMemo(() => [...new Set(items.map(i => i.name))].sort(), [items]);
  const pastBestByGroups = allGroups.filter(g => g.earliestBestBy && g.earliestBestBy < TODAY);

  const upsertDateMode = async (name: string, dateMode: PantryDateMode) => {
    if (!activeProfile) return;
    await fetch('/api/pantry/usage-settings', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile_id: activeProfile.id, item_name: name, date_mode: dateMode }),
    });
    await load();
  };

  const handleAdd = async () => {
    if (!addForm.name.trim()) { setAddError('Item name is required'); return; }
    setAddSaving(true); setAddError(null);
    try {
      const res = await fetch('/api/pantry', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile_id: activeProfile!.id, name: addForm.name.trim(), brand: addForm.brand || undefined,
          category: addForm.category || undefined, quantity: Number(addForm.quantity) || 1,
          unit: addForm.unit || 'unit', location: addForm.location || '',
          stored_date: addForm.date_mode === 'no_dates' ? undefined : addForm.stored_date,
          best_by_date: addForm.date_mode === 'full' ? (addForm.best_by_date || undefined) : null,
          best_by_days: Number(addForm.best_by_days) || 365,
          notes: addForm.notes || undefined,
        }),
      });
      if (!res.ok) { setAddError((await res.json()).error ?? 'Failed'); return; }
      if (addForm.date_mode !== 'full') await upsertDateMode(addForm.name.trim(), addForm.date_mode);
      setAddingRow(false); setAddForm(BLANK_ROW); await load();
    } catch { setAddError('Failed to add'); }
    finally { setAddSaving(false); }
  };

  const startEdit = (item: PantryItem, group: ItemGroup) => {
    setEditItemId(item.id); setEditForm(itemToRow(item, group.dateMode)); setEditError(null);
  };

  const handleEdit = async () => {
    if (!editItemId) return;
    setEditSaving(true); setEditError(null);
    try {
      const res = await fetch(`/api/pantry/${editItemId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editForm.name.trim(), brand: editForm.brand || undefined,
          category: editForm.category || undefined, quantity: Number(editForm.quantity) || 1,
          unit: editForm.unit || 'unit', location: editForm.location || '',
          stored_date: editForm.date_mode === 'no_dates' ? TODAY : editForm.stored_date,
          best_by_date: editForm.date_mode === 'full' ? (editForm.best_by_date || undefined) : null,
          best_by_days: Number(editForm.best_by_days) || 365,
          notes: editForm.notes || undefined,
        }),
      });
      if (!res.ok) { setEditError((await res.json()).error ?? 'Failed'); return; }
      setEditItemId(null); await load();
    } catch { setEditError('Failed to update'); }
    finally { setEditSaving(false); }
  };

  const handleRemove = async (item: PantryItem) => {
    setRemoving(item.id);
    try {
      const res = await fetch(`/api/pantry/${item.id}`, { method: 'DELETE' });
      if (res.ok) await load();
    } finally { setRemoving(null); }
  };

  const toggleGroup = (name: string) => setCollapsedGroups(s => { const n = new Set(s); if (n.has(name)) n.delete(name); else n.add(name); return n; });

  if (!activeProfile) {
    return <div className="px-6 py-12 text-center text-muted-foreground"><ShoppingBasket className="h-8 w-8 mx-auto mb-3 opacity-40" /><p>Select a cellar profile to view the pantry.</p></div>;
  }

  const totalItems = items.reduce((s, i) => s + i.quantity, 0);

  return (
    <div className="px-6 py-5 space-y-5 max-w-screen-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShoppingBasket className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold">Desktop Pantry</h1>
          {totalItems > 0 && <span className="text-sm text-muted-foreground">({totalItems} items)</span>}
        </div>
        <button onClick={() => { setAddingRow(true); setAddForm(BLANK_ROW); setAddError(null); setEditItemId(null); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
          <Plus className="h-4 w-4" /> Add Row
        </button>
      </div>

      {error && <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-destructive/10 border border-destructive/20 text-sm text-destructive"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div>}

      {/* Past best-by */}
      {!loading && pastBestByGroups.length > 0 && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-destructive/30">
            <h3 className="text-sm font-semibold text-destructive">Past Best-By Date ({pastBestByGroups.length} items)</h3>
          </div>
          <div className="flex flex-wrap gap-2 px-4 py-3">
            {pastBestByGroups.map(g => (
              <span key={g.name} className="text-xs px-2 py-1 rounded bg-destructive/10 border border-destructive/20 text-destructive">
                {g.name} · {g.earliestBestBy ? formatDate(g.earliestBestBy) : ''}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <input type="search" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search pantry…" className="w-full h-8 pl-8 pr-3 border rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
      </div>

      {/* Spreadsheet table */}
      <div className="rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Item</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Brand</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Category</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground uppercase tracking-wide">Qty</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Unit</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Location</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Dates</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Stored</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Best By</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Notes</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                [...Array(4)].map((_, i) => <tr key={i}><td colSpan={11} className="px-3 py-3"><div className="h-4 rounded bg-muted animate-pulse" /></td></tr>)
              ) : filteredGroups.length === 0 && !addingRow ? (
                <tr><td colSpan={11} className="px-4 py-10 text-center text-muted-foreground text-sm">
                  {items.length === 0 ? 'No items in the pantry yet. Click "Add Row" to get started.' : 'No items match your search.'}
                </td></tr>
              ) : (
                filteredGroups.flatMap(group => {
                  const isCollapsed = collapsedGroups.has(group.name);
                  const prediction = (() => {
                    try {
                      const p = computeUsagePrediction(txs, group.name, group.setting?.reset_date ?? null);
                      if (!p) return null;
                      return { daysOfStockLeft: Math.round(p.daysPerUnit * group.totalQty), ...p };
                    } catch { return null; }
                  })();
                  const rows: React.ReactNode[] = [];
                  // Group header row
                  rows.push(
                    <tr key={`g-${group.name}`} className="bg-muted/20">
                      <td colSpan={8} className="px-3 py-2">
                        <button onClick={() => toggleGroup(group.name)} className="flex items-center gap-2 text-sm font-semibold hover:text-primary transition-colors">
                          {isCollapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
                          {group.name}
                          <span className="text-xs font-normal text-muted-foreground ml-1">{group.totalQty} {group.unit}</span>
                          {group.category && <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{group.category}</span>}
                          {group.earliestBestBy && <span className={cn('text-xs ml-1', bestByColor(group.earliestBestBy))}>Best by {formatDate(group.earliestBestBy)}</span>}
                        </button>
                      </td>
                      <td colSpan={3} className="px-3 py-2 text-right">
                        {prediction && prediction.daysOfStockLeft != null && (
                          <span className="text-xs text-muted-foreground">{prediction.daysOfStockLeft}d left</span>
                        )}
                      </td>
                    </tr>
                  );
                  if (!isCollapsed) {
                    group.items.forEach(item => {
                      if (editItemId === item.id) {
                        rows.push(
                          <EditableRow key={item.id} form={editForm} onChange={p => setEditForm(f => ({ ...f, ...p }))}
                            knownNames={knownNames} onSave={handleEdit} onCancel={() => setEditItemId(null)}
                            saving={editSaving} error={editError} />
                        );
                      } else {
                        rows.push(
                          <tr key={item.id} className="hover:bg-accent/30 transition-colors">
                            <td className="px-3 py-2 pl-8 text-sm">{item.name}</td>
                            <td className="px-3 py-2 text-xs text-muted-foreground">{item.brand ?? '—'}</td>
                            <td className="px-3 py-2 text-xs text-muted-foreground">{item.category ?? '—'}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{item.quantity}</td>
                            <td className="px-3 py-2 text-xs text-muted-foreground">{item.unit}</td>
                            <td className="px-3 py-2 text-xs text-muted-foreground">{item.location || '—'}</td>
                            <td className="px-3 py-2 text-xs text-muted-foreground">{group.dateMode === 'full' ? 'Full' : group.dateMode === 'no_best_by' ? 'Stored only' : 'None'}</td>
                            <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">{item.stored_date ? formatDate(item.stored_date) : '—'}</td>
                            <td className={cn('px-3 py-2 text-xs whitespace-nowrap', bestByColor(item.best_by_date))}>{item.best_by_date ? formatDate(item.best_by_date) : '—'}</td>
                            <td className="px-3 py-2 text-xs text-muted-foreground italic">{item.notes ?? ''}</td>
                            <td className="px-3 py-2">
                              <div className="flex items-center justify-end gap-1">
                                <button onClick={() => startEdit(item, group)} className="h-7 px-2 rounded border text-xs text-muted-foreground hover:bg-accent transition-colors"><Edit2 className="h-3 w-3" /></button>
                                <button onClick={() => handleRemove(item)} disabled={removing === item.id} className="h-7 px-2 rounded border text-xs text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50">
                                  {removing === item.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      }
                    });
                  }
                  return rows;
                })
              )}
              {/* Add row */}
              {addingRow && (
                <EditableRow form={addForm} onChange={p => setAddForm(f => ({ ...f, ...p }))}
                  knownNames={knownNames} onSave={handleAdd} onCancel={() => { setAddingRow(false); setAddError(null); }}
                  saving={addSaving} error={addError} isNew />
              )}
            </tbody>
          </table>
        </div>
        {!loading && (
          <div className="px-4 py-2 border-t bg-muted/20 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{filteredGroups.length} {filteredGroups.length === 1 ? 'item type' : 'item types'} · {totalItems} total</span>
            <button onClick={() => { setAddingRow(true); setAddForm(BLANK_ROW); setAddError(null); setEditItemId(null); }} className="flex items-center gap-1 text-xs text-primary hover:underline">
              <Plus className="h-3 w-3" /> Add row
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
