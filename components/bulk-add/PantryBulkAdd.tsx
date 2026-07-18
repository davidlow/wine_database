'use client';

import { useState, useCallback, useEffect } from 'react';
import { Plus, Loader2, Save, Trash2, CheckCircle2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { Profile, PantryItem } from '@/types';

// ── Types ──────────────────────────────────────────────────────────────────────

const COMMON_UNITS = ['unit', 'box', 'bottle', 'bar', 'bag', 'can', 'pack', 'roll', 'tube', 'jug', 'container'];
const COMMON_CATEGORIES = ['Personal Care', 'Cleaning', 'Laundry', 'Food', 'Beverages', 'Paper Products', 'Health', 'Pet', 'Other'];

type PantryRow = {
  id: string;
  name: string;
  brand: string;
  category: string;
  quantity: string;
  unit: string;
  location: string;
  stored_date: string;
  best_by_date: string;
  notes: string;
};

let _counter = 0;
function uid() { return `p${++_counter}`; }

function today() {
  return new Date().toISOString().split('T')[0];
}

function emptyRow(): PantryRow {
  return {
    id: uid(), name: '', brand: '', category: '', quantity: '1', unit: 'unit',
    location: '', stored_date: today(), best_by_date: '', notes: '',
  };
}

const cell = 'w-full border rounded px-1.5 py-0.5 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring';

// ── Component ──────────────────────────────────────────────────────────────────

export default function PantryBulkAdd({
  profile,
  existingItems,
  open,
  onClose,
  onSuccess,
}: {
  profile: Profile;
  existingItems: PantryItem[];
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [rows, setRows] = useState<PantryRow[]>(() => [emptyRow(), emptyRow(), emptyRow()]);
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{ added: number; errors: string[] } | null>(null);

  useEffect(() => {
    if (open) {
      setRows([emptyRow(), emptyRow(), emptyRow()]);
      setSaving(false);
      setSaveResult(null);
    }
  }, [open]);

  // Build autocomplete lists from existing items
  const knownNames = [...new Set(existingItems.map(i => i.name))].sort();
  const knownLocations = [...new Set(existingItems.map(i => i.location).filter(Boolean))].sort();

  // When a known item name is picked, auto-fill unit/category from the most recent match
  const handleNameChange = useCallback((id: string, name: string) => {
    setRows(prev => prev.map(r => {
      if (r.id !== id) return r;
      const match = [...existingItems]
        .filter(i => i.name.toLowerCase() === name.toLowerCase())
        .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
      if (match) {
        return {
          ...r, name,
          unit: r.unit === 'unit' ? (match.unit ?? r.unit) : r.unit,
          category: r.category === '' ? (match.category ?? '') : r.category,
        };
      }
      return { ...r, name };
    }));
  }, [existingItems]);

  const updateRow = useCallback((id: string, field: keyof PantryRow, value: string) => {
    if (field === 'name') { handleNameChange(id, value); return; }
    setRows(prev => prev.map(r => r.id !== id ? r : { ...r, [field]: value }));
  }, [handleNameChange]);

  const addRow = useCallback(() => setRows(prev => [...prev, emptyRow()]), []);

  const removeRow = useCallback((id: string) => {
    setRows(prev => {
      const next = prev.filter(r => r.id !== id);
      return next.length ? next : [emptyRow()];
    });
  }, []);

  const handleSave = useCallback(async () => {
    const valid = rows.filter(r => r.name.trim());
    if (!valid.length) return;
    setSaving(true);
    setSaveResult(null);

    let added = 0;
    const errors: string[] = [];

    for (const r of valid) {
      try {
        const res = await fetch('/api/pantry', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            profile_id: profile.id,
            name: r.name.trim(),
            brand: r.brand || undefined,
            category: r.category || undefined,
            quantity: Math.max(1, Number(r.quantity) || 1),
            unit: r.unit || 'unit',
            location: r.location.trim() || undefined,
            stored_date: r.stored_date || today(),
            best_by_date: r.best_by_date || null,
            notes: r.notes || undefined,
          }),
        });
        if (!res.ok) {
          const err = await res.json() as { error?: string };
          throw new Error(err.error ?? `HTTP ${res.status}`);
        }
        added++;
      } catch (err) {
        errors.push(`"${r.name}": ${err instanceof Error ? err.message : 'failed'}`);
      }
    }

    setSaveResult({ added, errors });
    setSaving(false);
    if (added > 0) onSuccess();
  }, [rows, profile.id, onSuccess]);

  const validCount = rows.filter(r => r.name.trim()).length;

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-[98vw] w-[98vw] sm:max-w-[98vw] sm:w-[98vw] max-h-[96vh] sm:max-h-[96vh] flex flex-col gap-0 p-0">

        <DialogHeader className="px-5 py-3 border-b shrink-0">
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className="text-base">Bulk Add to Pantry — {profile.name}</DialogTitle>
            <button
              onClick={handleSave}
              disabled={saving || !validCount}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed">
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              Save {validCount} Item{validCount !== 1 ? 's' : ''}
            </button>
          </div>
          {saveResult && (
            <div className="flex items-center gap-1.5 mt-1 text-xs">
              {saveResult.added > 0 && (
                <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                  <CheckCircle2 size={12} />{saveResult.added} item{saveResult.added !== 1 ? 's' : ''} added
                </span>
              )}
              {saveResult.errors.length > 0 && (
                <span className="text-destructive ml-2">{saveResult.errors.join('; ')}</span>
              )}
            </div>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm min-w-max">
              <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm">
                <tr>
                  <Th w="w-7">#</Th>
                  <Th w="min-w-[185px]">Item Name *</Th>
                  <Th w="min-w-[130px]">Brand</Th>
                  <Th w="min-w-[130px]">Category</Th>
                  <Th w="min-w-[65px]">Qty</Th>
                  <Th w="min-w-[100px]">Unit</Th>
                  <Th w="min-w-[145px]">Location</Th>
                  <Th w="min-w-[125px]">Stored Date</Th>
                  <Th w="min-w-[125px]">Best By</Th>
                  <Th w="min-w-[155px]">Notes</Th>
                  <Th w="w-8"></Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr key={row.id} className="border-b border-border/40 hover:bg-muted/10">
                    <td className="px-1.5 py-1 text-xs text-muted-foreground text-center">{idx + 1}</td>

                    {/* Item name — autocomplete from existing items */}
                    <td className="px-1 py-1">
                      <input
                        value={row.name}
                        onChange={e => updateRow(row.id, 'name', e.target.value)}
                        list="pantry-names"
                        placeholder="Item name *"
                        className={cell}
                      />
                    </td>

                    {/* Brand */}
                    <td className="px-1 py-1">
                      <input value={row.brand} onChange={e => updateRow(row.id, 'brand', e.target.value)}
                        placeholder="optional" className={cell} />
                    </td>

                    {/* Category */}
                    <td className="px-1 py-1">
                      <input value={row.category} onChange={e => updateRow(row.id, 'category', e.target.value)}
                        list="pantry-cats" placeholder="optional" className={cell} />
                    </td>

                    {/* Quantity */}
                    <td className="px-1 py-1">
                      <input type="number" value={row.quantity}
                        onChange={e => updateRow(row.id, 'quantity', e.target.value)}
                        min={1} className={cell} />
                    </td>

                    {/* Unit */}
                    <td className="px-1 py-1">
                      <input value={row.unit} onChange={e => updateRow(row.id, 'unit', e.target.value)}
                        list="pantry-units" placeholder="unit" className={cell} />
                    </td>

                    {/* Location */}
                    <td className="px-1 py-1">
                      <input value={row.location} onChange={e => updateRow(row.id, 'location', e.target.value)}
                        list="pantry-locs" placeholder="optional" className={cell} />
                    </td>

                    {/* Stored date */}
                    <td className="px-1 py-1">
                      <input type="date" value={row.stored_date}
                        onChange={e => updateRow(row.id, 'stored_date', e.target.value)}
                        className={cell} />
                    </td>

                    {/* Best by */}
                    <td className="px-1 py-1">
                      <input type="date" value={row.best_by_date}
                        onChange={e => updateRow(row.id, 'best_by_date', e.target.value)}
                        className={cell} />
                    </td>

                    {/* Notes */}
                    <td className="px-1 py-1">
                      <input value={row.notes} onChange={e => updateRow(row.id, 'notes', e.target.value)}
                        placeholder="optional" className={cell} />
                    </td>

                    {/* Delete */}
                    <td className="px-1 py-1 text-center">
                      <button onClick={() => removeRow(row.id)}
                        className="text-muted-foreground hover:text-destructive p-0.5 rounded">
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Datalists */}
        <datalist id="pantry-names">{knownNames.map(n => <option key={n} value={n} />)}</datalist>
        <datalist id="pantry-cats">{COMMON_CATEGORIES.map(c => <option key={c} value={c} />)}</datalist>
        <datalist id="pantry-units">{COMMON_UNITS.map(u => <option key={u} value={u} />)}</datalist>
        <datalist id="pantry-locs">{knownLocations.map(l => <option key={l} value={l} />)}</datalist>

        <div className="px-5 py-2.5 border-t shrink-0 flex items-center gap-3">
          <button onClick={addRow} disabled={saving}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50">
            <Plus size={14} /> Add row
          </button>
          <span className="text-xs text-muted-foreground ml-auto">
            {validCount} / {rows.length} rows have a name
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Th({ children, w }: { children?: React.ReactNode; w?: string }) {
  return (
    <th className={cn('px-2 py-1.5 text-left text-xs font-medium border-b border-border whitespace-nowrap', w)}>
      {children}
    </th>
  );
}
