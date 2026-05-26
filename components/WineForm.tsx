'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { Wine, WineType } from '@/types';
import type { WineLookupResult } from '@/lib/wine-lookup/types';
import { cn } from '@/lib/utils';

type WineFormData = Omit<Wine, 'id' | 'created_at' | 'updated_at'>;

interface Props {
  initialData?: Partial<WineFormData>;
  lookupResult?: WineLookupResult;
  onSubmit: (data: WineFormData) => Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
}

const WINE_TYPES: { value: WineType; label: string }[] = [
  { value: 'red', label: 'Red' },
  { value: 'white', label: 'White' },
  { value: 'rosé', label: 'Rosé' },
  { value: 'sparkling', label: 'Sparkling' },
  { value: 'dessert', label: 'Dessert' },
  { value: 'fortified', label: 'Fortified' },
  { value: 'other', label: 'Other' },
];

function Field({ label, required, children, hint }: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium">
        {label}{required && <span className="text-destructive ml-1">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export default function WineForm({ initialData, lookupResult, onSubmit, onCancel, submitLabel = 'Save Wine' }: Props) {
  const merged = { ...lookupResult, ...initialData };
  const [form, setForm] = useState<WineFormData>({
    name: merged.name ?? '',
    producer: merged.producer ?? '',
    variety: merged.variety ?? '',
    wine_type: merged.wine_type,
    region: merged.region ?? '',
    appellation: merged.appellation ?? '',
    country: merged.country ?? '',
    vintage_year: merged.vintage_year,
    description: merged.description ?? '',
    average_price: merged.average_price,
    alcohol_content: merged.alcohol_content,
    barcode: merged.barcode ?? '',
    image_url: merged.image_url ?? '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof WineFormData>(key: K, value: WineFormData[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Wine name is required'); return; }
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit({
        ...form,
        name: form.name.trim(),
        barcode: form.barcode?.trim() || undefined,
        producer: form.producer?.trim() || undefined,
        variety: form.variety?.trim() || undefined,
        region: form.region?.trim() || undefined,
        appellation: form.appellation?.trim() || undefined,
        country: form.country?.trim() || undefined,
        description: form.description?.trim() || undefined,
        image_url: form.image_url?.trim() || undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save wine');
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls = 'w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring';

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {lookupResult?.source && (
        <div className="rounded-md bg-blue-50 border border-blue-200 px-3 py-2 text-sm text-blue-800">
          Wine data auto-filled from{' '}
          {lookupResult.source === 'database' ? 'your database' :
           lookupResult.source === 'openfoodfacts' ? 'Open Food Facts' : 'manual entry'}.
          Please review and correct as needed.
        </div>
      )}

      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <Field label="Wine Name" required>
            <input className={inputCls} value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Opus One" />
          </Field>
        </div>

        <Field label="Producer / Winery">
          <input className={inputCls} value={form.producer ?? ''} onChange={(e) => set('producer', e.target.value)} placeholder="e.g. Opus One Winery" />
        </Field>

        <Field label="Grape Variety">
          <input className={inputCls} value={form.variety ?? ''} onChange={(e) => set('variety', e.target.value)} placeholder="e.g. Cabernet Sauvignon" />
        </Field>

        <Field label="Wine Type">
          <select
            className={cn(inputCls, 'cursor-pointer')}
            value={form.wine_type ?? ''}
            onChange={(e) => set('wine_type', (e.target.value as WineType) || undefined)}
          >
            <option value="">Select type…</option>
            {WINE_TYPES.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </Field>

        <Field label="Vintage Year">
          <input
            type="number"
            className={inputCls}
            value={form.vintage_year ?? ''}
            onChange={(e) => set('vintage_year', e.target.value ? Number(e.target.value) : undefined)}
            placeholder="e.g. 2019"
            min={1900}
            max={new Date().getFullYear()}
          />
        </Field>

        <Field label="Country">
          <input className={inputCls} value={form.country ?? ''} onChange={(e) => set('country', e.target.value)} placeholder="e.g. USA" />
        </Field>

        <Field label="Region">
          <input className={inputCls} value={form.region ?? ''} onChange={(e) => set('region', e.target.value)} placeholder="e.g. Napa Valley" />
        </Field>

        <Field label="Appellation">
          <input className={inputCls} value={form.appellation ?? ''} onChange={(e) => set('appellation', e.target.value)} placeholder="e.g. Oakville" />
        </Field>

        <Field label="Average Price ($)">
          <input
            type="number"
            className={inputCls}
            value={form.average_price ?? ''}
            onChange={(e) => set('average_price', e.target.value ? Number(e.target.value) : undefined)}
            placeholder="0.00"
            min={0}
            step={0.01}
          />
        </Field>

        <Field label="Alcohol (%)">
          <input
            type="number"
            className={inputCls}
            value={form.alcohol_content ?? ''}
            onChange={(e) => set('alcohol_content', e.target.value ? Number(e.target.value) : undefined)}
            placeholder="e.g. 14.5"
            min={0}
            max={100}
            step={0.1}
          />
        </Field>

        <Field label="Barcode (UPC/EAN)" hint="Scan or type the barcode number">
          <input className={inputCls} value={form.barcode ?? ''} onChange={(e) => set('barcode', e.target.value)} placeholder="e.g. 012345678901" />
        </Field>

        <Field label="Image URL">
          <input className={inputCls} type="url" value={form.image_url ?? ''} onChange={(e) => set('image_url', e.target.value)} placeholder="https://…" />
        </Field>

        <div className="sm:col-span-2">
          <Field label="Description / Notes">
            <textarea
              className={cn(inputCls, 'resize-none')}
              rows={3}
              value={form.description ?? ''}
              onChange={(e) => set('description', e.target.value)}
              placeholder="Tasting notes, pairings, etc."
            />
          </Field>
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-2 rounded-md border text-sm font-medium hover:bg-accent transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
