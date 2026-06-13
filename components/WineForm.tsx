'use client';

import { useState } from 'react';
import { Camera, Loader2, X } from 'lucide-react';
import type { Wine, WineType } from '@/types';
import type { WineLookupResult } from '@/lib/wine-lookup/types';
import { cn } from '@/lib/utils';
import SearchSuggest from '@/components/SearchSuggest';
import LabelCapture from '@/components/LabelCapture';

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

const STRUCTURE_LABELS: Record<string, { lo: string; hi: string }> = {
  acidity:   { lo: 'Flat', hi: 'Tart' },
  tannin:    { lo: 'Silky', hi: 'Grippy' },
  alcohol:   { lo: 'Low', hi: 'High' },
  sweetness: { lo: 'Dry', hi: 'Sweet' },
  body:      { lo: 'Light', hi: 'Full' },
};

function StructureSlider({
  label, fieldKey, value, onChange,
}: {
  label: string;
  fieldKey: string;
  value: number | undefined;
  onChange: (v: number | undefined) => void;
}) {
  const desc = STRUCTURE_LABELS[fieldKey];
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-1">
        <span className="text-sm font-medium">{label}</span>
        {value != null ? (
          <div className="flex items-center gap-1">
            <span className="text-xs font-semibold tabular-nums w-3 text-right">{value}</span>
            <button type="button" onClick={() => onChange(undefined)} className="text-muted-foreground hover:text-foreground leading-none text-base px-0.5">×</button>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        {desc && <span className="text-[10px] text-muted-foreground w-8 shrink-0 text-right">{desc.lo}</span>}
        <input
          type="range" min={0} max={5} step={1}
          value={value ?? 0}
          onChange={(e) => onChange(Number(e.target.value))}
          className="flex-1 h-1.5 cursor-pointer accent-primary"
          style={{ opacity: value == null ? 0.3 : 1 }}
        />
        {desc && <span className="text-[10px] text-muted-foreground w-8 shrink-0">{desc.hi}</span>}
      </div>
    </div>
  );
}

export default function WineForm({ initialData, lookupResult, onSubmit, onCancel, submitLabel = 'Save Wine' }: Props) {
  const currentYear = new Date().getFullYear();
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
    drink_from_year: merged.drink_from_year ?? currentYear,
    drink_by_year: merged.drink_by_year ?? (currentYear + 10),
    barcode: merged.barcode ?? '',
    image_url: merged.image_url ?? '',
    label_image: (merged as Partial<Wine>).label_image,
    acidity: (merged as Partial<Wine>).acidity,
    tannin: (merged as Partial<Wine>).tannin,
    alcohol: (merged as Partial<Wine>).alcohol,
    sweetness: (merged as Partial<Wine>).sweetness,
    body: (merged as Partial<Wine>).body,
    fruit_profile: (merged as Partial<Wine>).fruit_profile ?? '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLabelCapture, setShowLabelCapture] = useState(false);
  const [labelScanning, setLabelScanning] = useState(false);
  const [labelScanMsg, setLabelScanMsg] = useState<string | null>(null);

  const set = <K extends keyof WineFormData>(key: K, value: WineFormData[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleLabelCapture = async ({ gemini, thumbnail }: { gemini: string; thumbnail: string }) => {
    setShowLabelCapture(false);
    setLabelScanning(true);
    setLabelScanMsg(null);
    try {
      const res = await fetch('/api/label-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: gemini, barcode: form.barcode || undefined }),
      });
      const result: WineLookupResult = await res.json();
      if (result.found) {
        setForm(prev => ({
          ...prev,
          label_image: thumbnail,
          name: result.name ?? prev.name,
          producer: result.producer ?? prev.producer,
          variety: result.variety ?? prev.variety,
          wine_type: result.wine_type ?? prev.wine_type,
          region: result.region ?? prev.region,
          appellation: result.appellation ?? prev.appellation,
          country: result.country ?? prev.country,
          vintage_year: result.vintage_year ?? prev.vintage_year,
          description: result.description ?? prev.description,
          average_price: result.average_price ?? prev.average_price,
          alcohol_content: result.alcohol_content ?? prev.alcohol_content,
          drink_from_year: result.drink_from_year ?? prev.drink_from_year,
          drink_by_year: result.drink_by_year ?? prev.drink_by_year,
          acidity: result.acidity ?? prev.acidity,
          tannin: result.tannin ?? prev.tannin,
          alcohol: result.alcohol ?? prev.alcohol,
          sweetness: result.sweetness ?? prev.sweetness,
          body: result.body ?? prev.body,
          fruit_profile: result.fruit_profile ?? prev.fruit_profile,
        }));
        setLabelScanMsg('Label scanned — fields updated from AI. Review and correct as needed.');
      } else {
        // Still save the thumbnail even if AI couldn't identify the wine
        setForm(prev => ({ ...prev, label_image: thumbnail }));
        setLabelScanMsg('Label photo saved, but the wine could not be identified. Fields unchanged.');
      }
    } catch {
      setLabelScanMsg('Label scan failed — please try again.');
    } finally {
      setLabelScanning(false);
    }
  };

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
           lookupResult.source === 'openfoodfacts' ? 'Open Food Facts' :
           lookupResult.source === 'label-scan' ? 'Gemini AI + web search' :
           'manual entry'}.
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
          <SearchSuggest
            field="variety"
            value={form.variety ?? ''}
            onChange={(v) => set('variety', v)}
            placeholder="e.g. Cabernet Sauvignon"
            inputClassName={inputCls}
          />
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
          <SearchSuggest
            field="country"
            value={form.country ?? ''}
            onChange={(v) => set('country', v)}
            placeholder="e.g. USA"
            inputClassName={inputCls}
          />
        </Field>

        <Field label="Region">
          <SearchSuggest
            field="region"
            value={form.region ?? ''}
            onChange={(v) => set('region', v)}
            placeholder="e.g. Napa Valley"
            inputClassName={inputCls}
          />
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

        <Field label="Drink From Year" hint="Earliest year this wine is ready to drink">
          <input
            type="number"
            className={inputCls}
            value={form.drink_from_year ?? ''}
            onChange={(e) => set('drink_from_year', e.target.value ? Number(e.target.value) : undefined)}
            placeholder={String(new Date().getFullYear())}
            min={1900}
            max={2100}
          />
        </Field>

        <Field label="Drink By Year" hint="Last recommended year to drink this wine">
          <input
            type="number"
            className={inputCls}
            value={form.drink_by_year ?? ''}
            onChange={(e) => set('drink_by_year', e.target.value ? Number(e.target.value) : undefined)}
            placeholder={String(new Date().getFullYear() + 10)}
            min={1900}
            max={2100}
          />
        </Field>

        <Field label="Barcode (UPC/EAN)" hint="Scan or type the barcode number">
          <input className={inputCls} value={form.barcode ?? ''} onChange={(e) => set('barcode', e.target.value)} placeholder="e.g. 012345678901" />
        </Field>

        <Field label="Image URL">
          <input className={inputCls} type="url" value={form.image_url ?? ''} onChange={(e) => set('image_url', e.target.value)} placeholder="https://…" />
        </Field>

        <div className="sm:col-span-2 space-y-2">
          <label className="block text-sm font-medium">Label Photo</label>
          {form.label_image ? (
            <div className="flex items-start gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`data:image/webp;base64,${form.label_image}`}
                alt="Wine label"
                className="h-24 w-auto rounded border object-contain bg-muted"
              />
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => setShowLabelCapture(true)}
                  disabled={labelScanning}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm hover:bg-accent transition-colors disabled:opacity-50"
                >
                  {labelScanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
                  {labelScanning ? 'Scanning…' : 'Retake Photo'}
                </button>
                <button
                  type="button"
                  onClick={() => { set('label_image', undefined); setLabelScanMsg(null); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                  Remove Photo
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowLabelCapture(true)}
              disabled={labelScanning}
              className="flex items-center gap-1.5 px-3 py-2 rounded-md border text-sm hover:bg-accent transition-colors disabled:opacity-50"
            >
              {labelScanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
              {labelScanning ? 'Scanning…' : 'Scan Label'}
            </button>
          )}
          {labelScanMsg && (
            <p className="text-xs text-muted-foreground">{labelScanMsg}</p>
          )}
        </div>

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

      {/* Structural profile */}
      <div className="rounded-md border bg-muted/30 p-3 space-y-3">
        <p className="text-sm font-semibold text-muted-foreground">Structural Profile <span className="font-normal">(0 = less · 5 = more)</span></p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
          {(['acidity', 'tannin', 'sweetness', 'body', 'alcohol'] as const).map((key) => (
            <StructureSlider
              key={key}
              label={key.charAt(0).toUpperCase() + key.slice(1)}
              fieldKey={key}
              value={form[key] as number | undefined}
              onChange={(v) => set(key, v)}
            />
          ))}
          <div className="sm:col-span-2">
            <Field label="Fruit Profile">
              <input
                className={inputCls}
                value={form.fruit_profile ?? ''}
                onChange={(e) => set('fruit_profile', e.target.value || undefined)}
                placeholder="e.g. dark cherry, blackcurrant, plum with hints of cedar"
              />
            </Field>
          </div>
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

      {/* Full-screen label capture overlay */}
      {showLabelCapture && (
        <div className="fixed inset-0 z-50 bg-background flex flex-col">
          <div className="flex items-center gap-3 px-4 py-3 border-b shrink-0">
            <button
              type="button"
              onClick={() => setShowLabelCapture(false)}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
            <p className="text-sm font-medium">Scan Wine Label</p>
          </div>
          <div className="flex-1 overflow-auto p-4">
            <LabelCapture
              onCapture={handleLabelCapture}
              onCancel={() => setShowLabelCapture(false)}
            />
          </div>
        </div>
      )}
    </form>
  );
}
