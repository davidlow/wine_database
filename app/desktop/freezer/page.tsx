'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Plus, Snowflake, Trash2, ChevronDown, ChevronUp,
  Loader2, AlertCircle, Edit2, Settings2, Check, X, Search,
} from 'lucide-react';
import { useProfile } from '@/hooks/useProfile';
import { MEAT_CUTS, getPrimalForCut, getAnimalForCut, ANIMAL_LABELS, type MeatAnimal } from '@/lib/meat-cuts';
import type { FreezerItem, FreezerTransaction, FreezerLocation } from '@/types';
import { cn } from '@/lib/utils';

const TODAY = new Date().toISOString().slice(0, 10);
const ANIMAL_ORDER: MeatAnimal[] = ['beef', 'pork', 'chicken', 'lamb', 'other'];
const ANIMAL_COLORS: Record<MeatAnimal, string> = {
  beef:    'border-red-200   bg-red-50   text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300',
  pork:    'border-pink-200  bg-pink-50  text-pink-800 dark:border-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
  chicken: 'border-yellow-200 bg-yellow-50 text-yellow-800 dark:border-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  lamb:    'border-purple-200 bg-purple-50 text-purple-800 dark:border-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  other:   'border-gray-200  bg-gray-50  text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300',
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

interface RowForm {
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
const BLANK_ROW: RowForm = {
  meat_cut: '', custom_cut: '', primal: '', quantity: '1',
  weight_lbs: '', location: '', stored_date: TODAY, price_per_lb: '', notes: '',
};
function itemToRow(item: FreezerItem): RowForm {
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

// ── Inline editable row ───────────────────────────────────────────────────────
function EditableRow({
  form, onChange, onSave, onCancel, saving, error, locations, lookupLoading, onLookupPrimal,
}: {
  form: RowForm; onChange: (patch: Partial<RowForm>) => void;
  onSave: () => void; onCancel: () => void;
  saving: boolean; error: string | null;
  locations: FreezerLocation[]; lookupLoading: boolean;
  onLookupPrimal: (cut: string) => void;
}) {
  const inp = 'h-7 border rounded px-2 text-xs bg-background focus:outline-none focus:ring-1 focus:ring-ring w-full';
  const firstRef = useRef<HTMLSelectElement>(null);

  useEffect(() => { firstRef.current?.focus(); }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSave(); }
    if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
  };

  const handleCutChange = (v: string) => {
    if (v === '__custom__') onChange({ meat_cut: '__custom__', primal: '' });
    else onChange({ meat_cut: v, custom_cut: '', primal: getPrimalForCut(v) ?? '' });
  };

  return (
    <tr className="bg-primary/5 border-y border-primary/20" onKeyDown={handleKeyDown}>
      <td className="px-2 py-1.5" colSpan={form.meat_cut === '__custom__' ? 1 : 2}>
        <select ref={firstRef} value={form.meat_cut} onChange={e => handleCutChange(e.target.value)} className={inp} required>
          <option value="">Select cut…</option>
          {MEAT_CUTS.map(m => <option key={m.cut} value={m.cut}>{m.cut}</option>)}
          <option value="__custom__">Custom cut…</option>
        </select>
      </td>
      {form.meat_cut === '__custom__' && (
        <td className="px-2 py-1.5">
          <div className="flex gap-1">
            <input type="text" value={form.custom_cut} onChange={e => onChange({ custom_cut: e.target.value })} placeholder="e.g. Lamb shoulder" className={`${inp} flex-1`} />
            <button type="button" onClick={() => onLookupPrimal(form.custom_cut)} disabled={!form.custom_cut.trim() || lookupLoading}
              className="h-7 px-2 border rounded text-xs hover:bg-accent transition-colors disabled:opacity-50 whitespace-nowrap">
              {lookupLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : 'AI'}
            </button>
          </div>
        </td>
      )}
      <td className="px-2 py-1.5"><input type="text" value={form.primal} onChange={e => onChange({ primal: e.target.value })} placeholder="Primal" className={inp} /></td>
      <td className="px-2 py-1.5"><input type="number" value={form.quantity} onChange={e => onChange({ quantity: e.target.value })} min={1} className={inp} style={{ width: 56 }} /></td>
      <td className="px-2 py-1.5"><input type="number" value={form.weight_lbs} onChange={e => onChange({ weight_lbs: e.target.value })} min={0} step={0.1} placeholder="lbs" className={inp} style={{ width: 68 }} /></td>
      <td className="px-2 py-1.5">
        {locations.length > 0 ? (
          <select value={form.location} onChange={e => onChange({ location: e.target.value })} className={inp}>
            <option value="">Unlocated</option>
            {locations.map(l => <option key={l.id} value={l.name}>{l.name}</option>)}
          </select>
        ) : (
          <input type="text" value={form.location} onChange={e => onChange({ location: e.target.value })} placeholder="Location" className={inp} />
        )}
      </td>
      <td className="px-2 py-1.5"><input type="date" value={form.stored_date} onChange={e => onChange({ stored_date: e.target.value })} className={inp} required /></td>
      <td className="px-2 py-1.5"><input type="number" value={form.price_per_lb} onChange={e => onChange({ price_per_lb: e.target.value })} min={0} step={0.01} placeholder="$/lb" className={inp} style={{ width: 72 }} /></td>
      <td className="px-2 py-1.5"><input type="text" value={form.notes} onChange={e => onChange({ notes: e.target.value })} placeholder="Notes" className={inp} /></td>
      <td className="px-2 py-1.5">
        <div className="flex gap-1">
          <button onClick={onSave} disabled={saving} className="h-7 w-7 flex items-center justify-center rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          </button>
          <button onClick={onCancel} className="h-7 w-7 flex items-center justify-center rounded border hover:bg-accent transition-colors">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        {error && <p className="text-xs text-destructive mt-1 whitespace-nowrap">{error}</p>}
      </td>
    </tr>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function DesktopFreezerPage() {
  const { activeProfile } = useProfile();
  const [items, setItems] = useState<FreezerItem[]>([]);
  const [txs, setTxs] = useState<FreezerTransaction[]>([]);
  const [locations, setLocations] = useState<FreezerLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [sortBy, setSortBy] = useState<'oldest' | 'newest' | 'most' | 'least' | 'az'>('oldest');

  // Inline add row state
  const [addingRow, setAddingRow] = useState(false);
  const [addForm, setAddForm] = useState<RowForm>(BLANK_ROW);
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Inline edit state
  const [editItemId, setEditItemId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<RowForm>(BLANK_ROW);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [removing, setRemoving] = useState<string | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [showManageLocs, setShowManageLocs] = useState(false);
  const [newLocName, setNewLocName] = useState('');
  const [addingLoc, setAddingLoc] = useState(false);
  const [renamingLocId, setRenamingLocId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deletingLocId, setDeletingLocId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeProfile) return;
    setLoading(true); setError(null);
    try {
      const [iR, tR, lR] = await Promise.all([
        fetch(`/api/freezer?profile_id=${activeProfile.id}`),
        fetch(`/api/freezer/transactions?profile_id=${activeProfile.id}`),
        fetch(`/api/freezer/locations?profile_id=${activeProfile.id}`),
      ]);
      if (iR.ok) setItems(await iR.json());
      if (tR.ok) setTxs(await tR.json());
      if (lR.ok) setLocations(await lR.json());
    } catch { setError('Failed to load'); }
    finally { setLoading(false); }
  }, [activeProfile]);
  useEffect(() => { load(); }, [load]);

  const animalStats = useMemo(() => {
    const byAnimal = new Map<MeatAnimal, { packs: number; weight: number }>();
    for (const item of items) {
      const a = getAnimalForCut(item.meat_cut);
      const cur = byAnimal.get(a) ?? { packs: 0, weight: 0 };
      cur.packs += item.quantity;
      cur.weight += item.weight_lbs != null ? item.weight_lbs * item.quantity : 0;
      byAnimal.set(a, cur);
    }
    return ANIMAL_ORDER.map(a => ({ animal: a, ...(byAnimal.get(a) ?? { packs: 0, weight: 0 }) })).filter(a => a.packs > 0);
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
    return [...byCut.entries()].sort((a, b) => b[1].total - a[1].total).slice(0, 6).map(([name, stats]) => {
      const monthsSpan = Math.max(1, (new Date(stats.latest).getTime() - new Date(stats.earliest).getTime()) / (30 * 86_400_000));
      const monthlyRate = stats.total / monthsSpan;
      const currentStock = items.filter(i => i.meat_cut === name).reduce((s, i) => s + i.quantity, 0);
      return { name, currentStock, monthlyRate, monthsSupply: monthlyRate > 0 ? currentStock / monthlyRate : null };
    });
  }, [txs, items]);

  const consumptionStats = useMemo(() => {
    const removeTxs = txs.filter(t => t.action === 'remove');
    const totalPacks = removeTxs.reduce((s, t) => s + t.quantity, 0);
    const byAnimal = new Map<MeatAnimal, { packs: number; weight: number; hasWeight: boolean }>();
    for (const t of removeTxs) {
      const a = getAnimalForCut(t.meat_cut ?? '');
      const cur = byAnimal.get(a) ?? { packs: 0, weight: 0, hasWeight: false };
      cur.packs += t.quantity;
      if (t.weight_lbs != null) { cur.weight += t.weight_lbs; cur.hasWeight = true; }
      byAnimal.set(a, cur);
    }
    return { totalPacks, byAnimal, removeTxs };
  }, [txs]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = q ? items.filter(i => i.meat_cut.toLowerCase().includes(q) || (i.primal ?? '').toLowerCase().includes(q)) : items;
    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'oldest': return a.stored_date.localeCompare(b.stored_date);
        case 'newest': return b.stored_date.localeCompare(a.stored_date);
        case 'most':   return b.quantity - a.quantity;
        case 'least':  return a.quantity - b.quantity;
        case 'az':     return a.meat_cut.localeCompare(b.meat_cut);
        default:       return 0;
      }
    });
  }, [items, searchQuery, sortBy]);

  const pastBestByItems = items.filter(i => i.eat_by_date < TODAY);
  const totalPacks = items.reduce((s, i) => s + i.quantity, 0);

  const handleLookupPrimal = async (cut: string, setter: (patch: Partial<RowForm>) => void) => {
    if (!cut.trim()) return;
    setLookupLoading(true);
    try {
      const res = await fetch('/api/freezer/lookup-primal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cut }) });
      if (res.ok) { const d = await res.json(); setter({ primal: d.primal ?? '' }); }
    } finally { setLookupLoading(false); }
  };

  const handleAdd = async () => {
    const cutName = addForm.meat_cut === '__custom__' ? addForm.custom_cut.trim() : addForm.meat_cut;
    if (!cutName) { setAddError('Select or enter a meat cut'); return; }
    setAddSaving(true); setAddError(null);
    try {
      const res = await fetch('/api/freezer', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile_id: activeProfile!.id, meat_cut: cutName,
          primal: addForm.primal || undefined, quantity: 1,
          weight_lbs: addForm.weight_lbs ? Number(addForm.weight_lbs) : undefined,
          location: addForm.location || '', stored_date: addForm.stored_date,
          price_per_lb: addForm.price_per_lb ? Number(addForm.price_per_lb) : undefined,
          notes: addForm.notes || undefined,
        }),
      });
      if (!res.ok) { setAddError((await res.json()).error ?? 'Failed'); return; }
      setAddingRow(false); setAddForm(BLANK_ROW); await load();
    } catch { setAddError('Failed to add item'); }
    finally { setAddSaving(false); }
  };

  const startEdit = (item: FreezerItem) => {
    setEditItemId(item.id); setEditForm(itemToRow(item)); setEditError(null);
  };

  const handleEdit = async () => {
    if (!editItemId) return;
    const cutName = editForm.meat_cut === '__custom__' ? editForm.custom_cut.trim() : editForm.meat_cut;
    if (!cutName) { setEditError('Select or enter a meat cut'); return; }
    setEditSaving(true); setEditError(null);
    try {
      const res = await fetch(`/api/freezer/${editItemId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meat_cut: cutName, primal: editForm.primal || undefined,
          quantity: Number(editForm.quantity) || 1,
          weight_lbs: editForm.weight_lbs ? Number(editForm.weight_lbs) : undefined,
          location: editForm.location || '', stored_date: editForm.stored_date,
          price_per_lb: editForm.price_per_lb ? Number(editForm.price_per_lb) : undefined,
          notes: editForm.notes || undefined,
        }),
      });
      if (!res.ok) { setEditError((await res.json()).error ?? 'Failed'); return; }
      setEditItemId(null); await load();
    } catch { setEditError('Failed to update'); }
    finally { setEditSaving(false); }
  };

  const handleRemove = async (item: FreezerItem) => {
    setRemoving(item.id);
    try {
      const res = await fetch(`/api/freezer/${item.id}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ quantity: item.quantity }) });
      if (res.ok) await load();
    } finally { setRemoving(null); }
  };

  const handleAddLocation = async () => {
    if (!newLocName.trim() || !activeProfile) return;
    setAddingLoc(true);
    try {
      const res = await fetch('/api/freezer/locations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ profile_id: activeProfile.id, name: newLocName.trim() }) });
      if (res.ok) { setNewLocName(''); await load(); }
    } finally { setAddingLoc(false); }
  };
  const handleRenameLocation = async (id: string) => {
    if (!renameValue.trim()) return;
    await fetch(`/api/freezer/locations/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: renameValue.trim() }) });
    setRenamingLocId(null); await load();
  };
  const handleDeleteLocation = async (id: string) => {
    await fetch(`/api/freezer/locations/${id}`, { method: 'DELETE' });
    setDeletingLocId(null); await load();
  };

  if (!activeProfile) {
    return <div className="px-6 py-12 text-center text-muted-foreground"><Snowflake className="h-8 w-8 mx-auto mb-3 opacity-40" /><p>Select a cellar profile to view the freezer inventory.</p></div>;
  }

  return (
    <div className="px-6 py-5 space-y-5 max-w-screen-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Snowflake className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold">Desktop Freezer</h1>
          {totalPacks > 0 && <span className="text-sm text-muted-foreground">({totalPacks} packages)</span>}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowManageLocs(v => !v)} className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm font-medium hover:bg-muted transition-colors', showManageLocs && 'bg-muted')}>
            <Settings2 className="h-4 w-4" /> Locations
          </button>
          <button onClick={() => { setAddingRow(true); setAddForm(BLANK_ROW); setAddError(null); setEditItemId(null); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
            <Plus className="h-4 w-4" /> Add Row
          </button>
        </div>
      </div>

      {error && <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-destructive/10 border border-destructive/20 text-sm text-destructive"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div>}

      {/* Animal stats */}
      {!loading && animalStats.length > 0 && (
        <div className="flex gap-3 flex-wrap">
          {animalStats.map(stat => (
            <div key={stat.animal} className={cn('rounded-lg border px-4 py-2.5 text-center min-w-[90px]', ANIMAL_COLORS[stat.animal])}>
              <p className="text-lg font-bold tabular-nums">{stat.packs}</p>
              <p className="text-xs font-medium">{ANIMAL_LABELS[stat.animal]}</p>
              {stat.weight > 0 && <p className="text-xs opacity-70 mt-0.5">{stat.weight % 1 === 0 ? stat.weight : stat.weight.toFixed(1)} lbs</p>}
            </div>
          ))}
        </div>
      )}

      {/* Past best-by */}
      {!loading && pastBestByItems.length > 0 && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-destructive/30 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-destructive">Past Best-By Date</h3>
            <span className="text-xs text-destructive/70">{pastBestByItems.reduce((s, i) => s + i.quantity, 0)} packs</span>
          </div>
          <div className="divide-y divide-destructive/10">
            {pastBestByItems.sort((a, b) => a.eat_by_date.localeCompare(b.eat_by_date)).map(item => {
              const daysOver = Math.floor((Date.now() - new Date(item.eat_by_date + 'T00:00:00').getTime()) / 86_400_000);
              return (
                <div key={item.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                  <div className="flex-1 min-w-0"><p className="font-medium truncate">{item.meat_cut}</p><p className="text-xs text-muted-foreground">{item.location || 'Unlocated'} · {formatDate(item.eat_by_date)}</p></div>
                  <span className="text-xs font-medium text-destructive shrink-0">{daysOver}d over</span>
                  <button onClick={() => startEdit(item)} className="text-xs px-2 py-1 rounded border text-muted-foreground hover:bg-accent transition-colors"><Edit2 className="h-3 w-3" /></button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Manage locations panel */}
      {showManageLocs && (
        <div className="rounded-lg border p-4 space-y-3">
          <p className="text-sm font-semibold">Manage Freezer Locations</p>
          <div className="flex gap-2">
            <input type="text" value={newLocName} onChange={e => setNewLocName(e.target.value)} placeholder="New location name…" className="flex-1 h-8 border rounded px-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" onKeyDown={e => e.key === 'Enter' && handleAddLocation()} />
            <button onClick={handleAddLocation} disabled={!newLocName.trim() || addingLoc} className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-sm disabled:opacity-50 hover:bg-primary/90 transition-colors">
              {addingLoc ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Add'}
            </button>
          </div>
          {locations.length > 0 && (
            <div className="space-y-1">
              {locations.map(loc => (
                <div key={loc.id} className="flex items-center gap-2">
                  {renamingLocId === loc.id ? (
                    <>
                      <input type="text" value={renameValue} onChange={e => setRenameValue(e.target.value)} className="flex-1 h-7 border rounded px-2 text-sm bg-background" autoFocus onKeyDown={e => { if (e.key === 'Enter') handleRenameLocation(loc.id); if (e.key === 'Escape') setRenamingLocId(null); }} />
                      <button onClick={() => handleRenameLocation(loc.id)} className="h-7 px-2 rounded bg-primary text-primary-foreground text-xs"><Check className="h-3 w-3" /></button>
                      <button onClick={() => setRenamingLocId(null)} className="h-7 px-2 rounded border text-xs"><X className="h-3 w-3" /></button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-sm">{loc.name}</span>
                      <button onClick={() => { setRenamingLocId(loc.id); setRenameValue(loc.name); }} className="h-7 px-2 rounded border text-xs text-muted-foreground hover:bg-accent transition-colors">Rename</button>
                      {deletingLocId === loc.id ? (
                        <>
                          <button onClick={() => handleDeleteLocation(loc.id)} className="h-7 px-2 rounded bg-destructive text-destructive-foreground text-xs">Confirm</button>
                          <button onClick={() => setDeletingLocId(null)} className="h-7 px-2 rounded border text-xs"><X className="h-3 w-3" /></button>
                        </>
                      ) : (
                        <button onClick={() => setDeletingLocId(loc.id)} className="h-7 px-2 rounded border text-xs text-destructive hover:bg-destructive/10 transition-colors"><Trash2 className="h-3 w-3" /></button>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Search + sort */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input type="search" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search cuts…" className="w-full h-8 pl-8 pr-3 border rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)} className="h-8 border rounded text-sm px-2 bg-background">
          <option value="oldest">Oldest first</option>
          <option value="newest">Newest first</option>
          <option value="most">Most packs</option>
          <option value="least">Fewest packs</option>
          <option value="az">A – Z</option>
        </select>
      </div>

      {/* Main spreadsheet table */}
      <div className="rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Cut</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Primal</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground uppercase tracking-wide">Qty</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground uppercase tracking-wide">Weight</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Location</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Stored</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Eat by</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground uppercase tracking-wide">$/lb</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Notes</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                [...Array(4)].map((_, i) => <tr key={i}><td colSpan={10} className="px-3 py-3"><div className="h-4 rounded bg-muted animate-pulse" /></td></tr>)
              ) : filteredItems.length === 0 && !addingRow ? (
                <tr><td colSpan={10} className="px-4 py-10 text-center text-muted-foreground text-sm">
                  {items.length === 0 ? 'No items in the freezer yet. Click "Add Row" to get started.' : 'No items match your search.'}
                </td></tr>
              ) : (
                filteredItems.map(item => (
                  editItemId === item.id ? (
                    <EditableRow
                      key={item.id}
                      form={editForm}
                      onChange={patch => setEditForm(f => ({ ...f, ...patch }))}
                      onSave={handleEdit}
                      onCancel={() => setEditItemId(null)}
                      saving={editSaving}
                      error={editError}
                      locations={locations}
                      lookupLoading={lookupLoading}
                      onLookupPrimal={cut => handleLookupPrimal(cut, patch => setEditForm(f => ({ ...f, ...patch })))}
                    />
                  ) : (
                    <tr key={item.id} className="hover:bg-accent/30 transition-colors">
                      <td className="px-3 py-2.5 font-medium">{item.meat_cut}</td>
                      <td className="px-3 py-2.5 text-muted-foreground text-xs">{item.primal ?? '—'}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{item.quantity}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{item.weight_lbs != null ? `${item.weight_lbs} lbs` : '—'}</td>
                      <td className="px-3 py-2.5 text-muted-foreground text-xs">{item.location || '—'}</td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{formatDate(item.stored_date)}</td>
                      <td className={cn('px-3 py-2.5 text-xs whitespace-nowrap', eatByColor(item.eat_by_date))}>{formatDate(item.eat_by_date)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{item.price_per_lb != null ? `$${item.price_per_lb.toFixed(2)}` : '—'}</td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground italic">{item.notes ?? ''}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => startEdit(item)} className="h-7 px-2 rounded border text-xs text-muted-foreground hover:bg-accent transition-colors"><Edit2 className="h-3 w-3" /></button>
                          <button onClick={() => handleRemove(item)} disabled={removing === item.id} className="h-7 px-2 rounded border text-xs text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50">
                            {removing === item.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                ))
              )}
              {/* Add row at bottom */}
              {addingRow && (
                <EditableRow
                  form={addForm}
                  onChange={patch => setAddForm(f => ({ ...f, ...patch }))}
                  onSave={handleAdd}
                  onCancel={() => { setAddingRow(false); setAddError(null); }}
                  saving={addSaving}
                  error={addError}
                  locations={locations}
                  lookupLoading={lookupLoading}
                  onLookupPrimal={cut => handleLookupPrimal(cut, patch => setAddForm(f => ({ ...f, ...patch })))}
                />
              )}
            </tbody>
          </table>
        </div>
        {!loading && (
          <div className="px-4 py-2 border-t bg-muted/20 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{filteredItems.length} {filteredItems.length === 1 ? 'item' : 'items'}{searchQuery && ` matching "${searchQuery}"`}</span>
            <button onClick={() => { setAddingRow(true); setAddForm(BLANK_ROW); setAddError(null); setEditItemId(null); }} className="flex items-center gap-1 text-xs text-primary hover:underline">
              <Plus className="h-3 w-3" /> Add row
            </button>
          </div>
        )}
      </div>

      {/* Reorder monitor */}
      {!loading && reorderCuts.length > 0 && (
        <div className="rounded-lg border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <h3 className="text-sm font-semibold">Reorder Monitor</h3>
            <span className="text-xs text-muted-foreground">top cuts by usage</span>
          </div>
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/20">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Cut</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground">In stock</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground">Rate/mo</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground">Supply</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {reorderCuts.map(cut => {
                const supply = cut.monthsSupply;
                const supplyColor = supply == null ? 'text-muted-foreground' : supply < 0.5 ? 'text-destructive font-semibold' : supply < 1.5 ? 'text-amber-600 font-medium' : 'text-green-600';
                return (
                  <tr key={cut.name}>
                    <td className="px-4 py-2.5 truncate max-w-[160px]">{cut.name}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{cut.currentStock} pk</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{cut.monthlyRate.toFixed(1)}</td>
                    <td className={cn('px-4 py-2.5 text-right tabular-nums', supplyColor)}>{supply == null ? '—' : supply < 0.1 ? 'Out' : `${supply.toFixed(1)} mo`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Consumption history */}
      {consumptionStats.removeTxs.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <button onClick={() => setShowHistory(h => !h)} className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-accent/50 transition-colors">
            <span>Consumption History ({consumptionStats.totalPacks} packs consumed)</span>
            {showHistory ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {showHistory && (
            <div className="border-t px-4 py-3 bg-muted/20">
              {consumptionStats.byAnimal.size > 0 && (
                <div className="flex gap-3 flex-wrap">
                  {ANIMAL_ORDER.filter(a => consumptionStats.byAnimal.has(a)).map(animal => {
                    const s = consumptionStats.byAnimal.get(animal)!;
                    return (
                      <div key={animal} className={cn('rounded border px-3 py-1.5 text-xs', ANIMAL_COLORS[animal])}>
                        <span className="font-medium">{ANIMAL_LABELS[animal]}</span>
                        <span className="ml-2">{s.packs} pk</span>
                        {s.hasWeight && <span className="ml-1 opacity-75">{s.weight.toFixed(1)} lbs</span>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
