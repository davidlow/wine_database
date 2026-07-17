'use client';

import { useState, useCallback, useEffect } from 'react';
import { Plus, Loader2, Save, Trash2, CheckCircle2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { MEAT_CUTS, getPrimalForCut } from '@/lib/meat-cuts';
import type { Profile, FreezerLocation } from '@/types';

// ── Types ──────────────────────────────────────────────────────────────────────

type FreezerRow = {
  id: string;
  meat_cut: string;
  primal: string;
  quantity: string;
  weight_lbs: string;
  location: string;
  stored_date: string;
  price_per_lb: string;
  notes: string;
};

let _counter = 0;
function uid() { return `f${++_counter}`; }

function today() {
  return new Date().toISOString().split('T')[0];
}

function emptyRow(): FreezerRow {
  return {
    id: uid(), meat_cut: '', primal: '', quantity: '1',
    weight_lbs: '', location: '', stored_date: today(),
    price_per_lb: '', notes: '',
  };
}

const cell = 'w-full border rounded px-1.5 py-0.5 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring';
const CUT_NAMES = MEAT_CUTS.map(m => m.cut);

// ── Component ──────────────────────────────────────────────────────────────────

export default function FreezerBulkAdd({
  profile,
  locations: knownLocations,
  open,
  onClose,
  onSuccess,
}: {
  profile: Profile;
  locations: FreezerLocation[];
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [rows, setRows] = useState<FreezerRow[]>(() => [emptyRow(), emptyRow(), emptyRow()]);
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{ added: number; errors: string[] } | null>(null);

  useEffect(() => {
    if (open) {
      setRows([emptyRow(), emptyRow(), emptyRow()]);
      setSaving(false);
      setSaveResult(null);
    }
  }, [open]);

  const locationNames = knownLocations.map(l => l.name);

  const updateRow = useCallback((id: string, field: keyof FreezerRow, value: string) => {
    setRows(prev => prev.map(r => {
      if (r.id !== id) return r;
      if (field === 'meat_cut') {
        const primal = getPrimalForCut(value) ?? '';
        return { ...r, meat_cut: value, primal };
      }
      return { ...r, [field]: value };
    }));
  }, []);

  const addRow = useCallback(() => setRows(prev => [...prev, emptyRow()]), []);

  const removeRow = useCallback((id: string) => {
    setRows(prev => {
      const next = prev.filter(r => r.id !== id);
      return next.length ? next : [emptyRow()];
    });
  }, []);

  const handleSave = useCallback(async () => {
    const valid = rows.filter(r => r.meat_cut.trim());
    if (!valid.length) return;
    setSaving(true);
    setSaveResult(null);

    let added = 0;
    const errors: string[] = [];

    for (const r of valid) {
      try {
        const res = await fetch('/api/freezer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            profile_id: profile.id,
            meat_cut: r.meat_cut.trim(),
            primal: r.primal || undefined,
            quantity: Math.max(1, Number(r.quantity) || 1),
            weight_lbs: r.weight_lbs ? Number(r.weight_lbs) : undefined,
            location: r.location.trim(),
            stored_date: r.stored_date || today(),
            price_per_lb: r.price_per_lb ? Number(r.price_per_lb) : undefined,
            notes: r.notes || undefined,
          }),
        });
        if (!res.ok) {
          const err = await res.json() as { error?: string };
          throw new Error(err.error ?? `HTTP ${res.status}`);
        }
        added++;
      } catch (err) {
        errors.push(`"${r.meat_cut}": ${err instanceof Error ? err.message : 'failed'}`);
      }
    }

    setSaveResult({ added, errors });
    setSaving(false);
    if (added > 0) onSuccess();
  }, [rows, profile.id, onSuccess]);

  const validCount = rows.filter(r => r.meat_cut.trim()).length;

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-[92vw] w-[92vw] max-h-[90vh] flex flex-col gap-0 p-0">

        <DialogHeader className="px-5 py-3 border-b shrink-0">
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className="text-base">Bulk Add to Freezer — {profile.name}</DialogTitle>
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
                  <Th w="min-w-[200px]">Meat Cut *</Th>
                  <Th w="min-w-[120px]">Primal</Th>
                  <Th w="min-w-[70px]">Qty</Th>
                  <Th w="min-w-[85px]">Weight (lbs)</Th>
                  <Th w="min-w-[150px]">Location</Th>
                  <Th w="min-w-[125px]">Stored Date</Th>
                  <Th w="min-w-[90px]">Price / lb</Th>
                  <Th w="min-w-[160px]">Notes</Th>
                  <Th w="w-8"></Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr key={row.id} className="border-b border-border/40 hover:bg-muted/10">
                    <td className="px-1.5 py-1 text-xs text-muted-foreground text-center">{idx + 1}</td>

                    {/* Meat cut — autocomplete from static list */}
                    <td className="px-1 py-1">
                      <input
                        value={row.meat_cut}
                        onChange={e => updateRow(row.id, 'meat_cut', e.target.value)}
                        list="freezer-cuts"
                        placeholder="e.g. Beef Ribeye Steak"
                        className={cn(cell, !row.meat_cut && 'placeholder:text-muted-foreground/40')}
                      />
                    </td>

                    {/* Primal — auto-filled, editable */}
                    <td className="px-1 py-1">
                      <input
                        value={row.primal}
                        onChange={e => updateRow(row.id, 'primal', e.target.value)}
                        placeholder="auto"
                        className={cn(cell, 'text-muted-foreground')}
                      />
                    </td>

                    {/* Quantity */}
                    <td className="px-1 py-1">
                      <input type="number" value={row.quantity}
                        onChange={e => updateRow(row.id, 'quantity', e.target.value)}
                        min={1} className={cell} />
                    </td>

                    {/* Weight */}
                    <td className="px-1 py-1">
                      <input type="number" value={row.weight_lbs}
                        onChange={e => updateRow(row.id, 'weight_lbs', e.target.value)}
                        placeholder="optional" min={0} step={0.1} className={cell} />
                    </td>

                    {/* Location */}
                    <td className="px-1 py-1">
                      <input value={row.location}
                        onChange={e => updateRow(row.id, 'location', e.target.value)}
                        list="freezer-locs" placeholder="Location (optional)"
                        className={cell} />
                    </td>

                    {/* Stored date */}
                    <td className="px-1 py-1">
                      <input type="date" value={row.stored_date}
                        onChange={e => updateRow(row.id, 'stored_date', e.target.value)}
                        className={cell} />
                    </td>

                    {/* Price per lb */}
                    <td className="px-1 py-1">
                      <input type="number" value={row.price_per_lb}
                        onChange={e => updateRow(row.id, 'price_per_lb', e.target.value)}
                        placeholder="optional" min={0} step={0.01} className={cell} />
                    </td>

                    {/* Notes */}
                    <td className="px-1 py-1">
                      <input value={row.notes}
                        onChange={e => updateRow(row.id, 'notes', e.target.value)}
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
        <datalist id="freezer-cuts">
          {CUT_NAMES.map(c => <option key={c} value={c} />)}
        </datalist>
        <datalist id="freezer-locs">
          {locationNames.map(l => <option key={l} value={l} />)}
        </datalist>

        <div className="px-5 py-2.5 border-t shrink-0 flex items-center gap-3">
          <button onClick={addRow} disabled={saving}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50">
            <Plus size={14} /> Add row
          </button>
          <span className="text-xs text-muted-foreground ml-auto">
            {validCount} / {rows.length} rows have a cut
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
