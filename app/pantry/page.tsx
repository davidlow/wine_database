'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Plus, ShoppingBasket, Trash2, Edit2, ChevronDown, ChevronUp,
  Loader2, AlertCircle, Search, X, RotateCcw, SlidersHorizontal, TrendingDown,
  Minus, Calendar, CalendarOff, Rows3,
} from 'lucide-react';
import { useProfile } from '@/hooks/useProfile';
import type { PantryItem, PantryTransaction, PantryUsageSetting, PantryDateMode } from '@/types';
import PantryBulkAdd from '@/components/bulk-add/PantryBulkAdd';
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

function computeBestByDate(storedDate: string, days: number): string {
  const dt = new Date(storedDate + 'T00:00:00');
  dt.setDate(dt.getDate() + days);
  return dt.toISOString().slice(0, 10);
}

const DATE_MODE_LABELS: Record<PantryDateMode, string> = {
  full: 'Full dates',
  no_best_by: 'Stored date only',
  no_dates: 'No dates',
};

// ─── ItemGroup ────────────────────────────────────────────────────────────────

interface ItemGroup {
  name: string;
  items: PantryItem[];        // sorted oldest stored_date first
  totalQty: number;
  setting: PantryUsageSetting | undefined;
  dateMode: PantryDateMode;
  category: string | undefined;
  unit: string;
  location: string;
  brand: string | undefined;
  earliestBestBy: string | undefined;
}

function makeGroups(items: PantryItem[], usageSettings: PantryUsageSetting[]): ItemGroup[] {
  const map = new Map<string, PantryItem[]>();
  for (const item of items) {
    const key = item.name.toLowerCase();
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }
  return [...map.entries()].map(([, groupItems]) => {
    const sorted = [...groupItems].sort((a, b) =>
      (a.stored_date || '').localeCompare(b.stored_date || '')
    );
    const setting = usageSettings.find(
      s => s.item_name.toLowerCase() === groupItems[0].name.toLowerCase()
    );
    const dateMode: PantryDateMode = (setting?.date_mode ?? 'full') as PantryDateMode;
    const totalQty = groupItems.reduce((s, i) => s + i.quantity, 0);
    const bestByDates = groupItems
      .map(i => i.best_by_date)
      .filter((d): d is string => !!d)
      .sort();
    return {
      name: groupItems[0].name,
      items: sorted,
      totalQty,
      setting,
      dateMode,
      category: sorted[0].category,
      unit: sorted[0].unit,
      location: sorted[0].location,
      brand: sorted[0].brand,
      earliestBestBy: bestByDates[0],
    };
  }).sort((a, b) => a.name.localeCompare(b.name));
}

// ─── PantryForm (full add / edit) ────────────────────────────────────────────

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
  date_mode: PantryDateMode;
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
  date_mode: 'full',
};

function itemToForm(item: PantryItem, dateMode: PantryDateMode): PantryFormState {
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
    date_mode: dateMode,
  };
}

function PantryForm({
  form, onChange, onSubmit, onCancel, submitLabel, saving, error, knownLocations, knownNames, items, isEdit,
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
  isEdit?: boolean;
}) {
  const inp = 'w-full h-9 border rounded-md px-3 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring';

  const handleDaysChange = (days: string) => {
    const d = parseInt(days, 10);
    const newBbd = !isNaN(d) && d > 0 && form.stored_date
      ? computeBestByDate(form.stored_date, d)
      : form.best_by_date;
    onChange({ best_by_days: days, best_by_date: newBbd });
  };

  const handleNameChange = (name: string) => {
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

  const showStoredDate = form.date_mode !== 'no_dates';
  const showBestBy = form.date_mode === 'full';

  return (
    <form onSubmit={onSubmit} className="space-y-4 mt-2">
      {error && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-destructive/10 border border-destructive/20 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />{error}
        </div>
      )}

      {/* Date mode selector */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium">Date Tracking</label>
        <div className="flex gap-2">
          {(['full', 'no_best_by', 'no_dates'] as PantryDateMode[]).map(mode => (
            <button
              key={mode}
              type="button"
              onClick={() => onChange({ date_mode: mode })}
              className={cn(
                'flex-1 h-8 text-xs rounded-md border transition-colors',
                form.date_mode === mode
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'text-muted-foreground hover:bg-accent'
              )}
            >
              {mode === 'full' ? 'Full' : mode === 'no_best_by' ? 'No Best-By' : 'No Dates'}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {form.date_mode === 'full' && 'Track stored date and best-by date (e.g. canned food)'}
          {form.date_mode === 'no_best_by' && 'Track when stored but skip best-by date'}
          {form.date_mode === 'no_dates' && 'No date tracking (e.g. toilet paper, trash bags)'}
        </p>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium">Item Name <span className="text-destructive">*</span></label>
        {isEdit ? (
          <input type="text" value={form.name} onChange={e => onChange({ name: e.target.value })} className={inp} required />
        ) : (
          <>
            <input
              type="text" list="pantry-names" value={form.name}
              onChange={e => handleNameChange(e.target.value)}
              placeholder="e.g. Tide Pods, Pasta, Canned Tomatoes"
              className={inp} required
            />
            <datalist id="pantry-names">{knownNames.map(n => <option key={n} value={n} />)}</datalist>
          </>
        )}
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

      {showStoredDate && (
        <div className={cn('gap-3', showBestBy ? 'grid grid-cols-2' : '')}>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Date Stored <span className="text-destructive">*</span></label>
            <input type="date" value={form.stored_date}
              onChange={e => {
                const newBbd = showBestBy && form.best_by_days && parseInt(form.best_by_days, 10) > 0
                  ? computeBestByDate(e.target.value, parseInt(form.best_by_days, 10))
                  : form.best_by_date;
                onChange({ stored_date: e.target.value, best_by_date: newBbd });
              }}
              className={inp} required />
          </div>
          {showBestBy && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Shelf Life (days)</label>
              <input type="number" min={1} value={form.best_by_days}
                onChange={e => handleDaysChange(e.target.value)} className={inp} />
            </div>
          )}
        </div>
      )}

      {showBestBy && (
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Best-By Date</label>
          <input type="date" value={form.best_by_date}
            onChange={e => onChange({ best_by_date: e.target.value })} className={inp} />
          <p className="text-xs text-muted-foreground">Auto-computed from stored date + shelf life. Override if needed.</p>
        </div>
      )}

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

// ─── QuickAddDialog ───────────────────────────────────────────────────────────

interface QuickAddForm {
  stored_date: string;
  best_by_date: string;
  quantity: string;
}

function QuickAddDialog({
  group, form, onChange, onSubmit, onCancel, saving, error,
}: {
  group: ItemGroup;
  form: QuickAddForm;
  onChange: (patch: Partial<QuickAddForm>) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  saving: boolean;
  error: string | null;
}) {
  const inp = 'w-full h-9 border rounded-md px-3 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring';
  const showStoredDate = group.dateMode !== 'no_dates';
  const showBestBy = group.dateMode === 'full';

  return (
    <form onSubmit={onSubmit} className="space-y-4 mt-2">
      {error && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-destructive/10 border border-destructive/20 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />{error}
        </div>
      )}

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-muted text-xs">
          {group.dateMode === 'no_dates' ? <CalendarOff className="h-3 w-3" /> : <Calendar className="h-3 w-3" />}
          {DATE_MODE_LABELS[group.dateMode]}
        </span>
        {group.category && <span className="bg-muted px-1.5 py-0.5 rounded text-xs">{group.category}</span>}
        {group.location && <span className="text-xs">{group.location}</span>}
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium">Quantity</label>
        <input type="number" min={1} value={form.quantity}
          onChange={e => onChange({ quantity: e.target.value })}
          className={inp} required />
      </div>

      {showStoredDate && (
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Date Purchased</label>
          <input type="date" value={form.stored_date}
            onChange={e => {
              if (showBestBy && group.items[0]?.best_by_days > 0) {
                const newBbd = computeBestByDate(e.target.value, group.items[0].best_by_days);
                onChange({ stored_date: e.target.value, best_by_date: newBbd });
              } else {
                onChange({ stored_date: e.target.value });
              }
            }}
            className={inp} required />
        </div>
      )}

      {showBestBy && (
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Best-By Date</label>
          <input type="date" value={form.best_by_date}
            onChange={e => onChange({ best_by_date: e.target.value })} className={inp} />
        </div>
      )}

      {group.dateMode === 'no_dates' && (
        <p className="text-xs text-muted-foreground">No date tracking for this item.</p>
      )}

      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onCancel}
          className="flex-1 h-9 border rounded-md text-sm hover:bg-accent transition-colors">Cancel</button>
        <button type="submit" disabled={saving}
          className="flex-1 h-9 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Add {group.unit}
        </button>
      </div>
    </form>
  );
}

// ─── RemoveDialog ─────────────────────────────────────────────────────────────

function RemoveDialog({
  group, onClose, onRemove, removing,
}: {
  group: ItemGroup;
  onClose: () => void;
  onRemove: (itemId: string) => void;
  removing: string | null;
}) {
  const [selectedId, setSelectedId] = useState(group.items[0]?.id ?? '');

  return (
    <div className="space-y-4 mt-2">
      <p className="text-sm text-muted-foreground">
        Select which {group.unit} to remove. Defaults to oldest.
      </p>

      <div className="space-y-2 max-h-64 overflow-y-auto">
        {group.items.map((item, idx) => {
          const isOldest = idx === 0;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelectedId(item.id)}
              className={cn(
                'w-full text-left px-3 py-2.5 rounded-lg border text-sm transition-colors',
                selectedId === item.id
                  ? 'border-primary bg-primary/5'
                  : 'hover:bg-accent'
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  {group.dateMode === 'no_dates' ? (
                    <span className="text-muted-foreground">No date tracked</span>
                  ) : (
                    <span>Stored: {formatDate(item.stored_date)}</span>
                  )}
                  {item.best_by_date && group.dateMode === 'full' && (
                    <span className={cn('ml-2', bestByColor(item.best_by_date))}>
                      · Best by: {formatDate(item.best_by_date)}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {item.quantity > 1 && (
                    <span className="text-xs text-muted-foreground">{item.quantity} {group.unit}s</span>
                  )}
                  {isOldest && (
                    <span className="text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground">oldest</span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onClose}
          className="flex-1 h-9 border rounded-md text-sm hover:bg-accent transition-colors">Cancel</button>
        <button
          type="button"
          onClick={() => selectedId && onRemove(selectedId)}
          disabled={!selectedId || !!removing}
          className="flex-1 h-9 rounded-md bg-destructive text-destructive-foreground text-sm font-medium hover:bg-destructive/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
        >
          {removing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          Remove 1 {group.unit}
        </button>
      </div>
    </div>
  );
}

// ─── PantryGroupCard ──────────────────────────────────────────────────────────

function PantryGroupCard({
  group,
  transactions,
  onQuickAdd,
  onRemove,
  onEdit,
  onChangeDateMode,
  overrideItem,
  overrideDays,
  setOverrideItem,
  setOverrideDays,
  handleSaveOverride,
  handleResetUsage,
  savingOverride,
  savingReset,
}: {
  group: ItemGroup;
  transactions: PantryTransaction[];
  onQuickAdd: (group: ItemGroup) => void;
  onRemove: (group: ItemGroup) => void;
  onEdit: (item: PantryItem, dateMode: PantryDateMode) => void;
  onChangeDateMode: (groupName: string, mode: PantryDateMode) => void;
  overrideItem: string | null;
  overrideDays: string;
  setOverrideItem: (v: string | null) => void;
  setOverrideDays: (v: string) => void;
  handleSaveOverride: (name: string, days: number | null) => void;
  handleResetUsage: (name: string) => void;
  savingOverride: boolean;
  savingReset: string | null;
}) {
  const [showItems, setShowItems] = useState(false);
  const [showDateMode, setShowDateMode] = useState(false);

  const pred = computeUsagePrediction(transactions, group.name, group.setting?.reset_date);
  const effectiveDays = group.setting?.days_per_unit ?? pred?.daysPerUnit;
  const daysLeft = effectiveDays != null && group.totalQty > 0
    ? Math.round(group.totalQty * effectiveDays)
    : null;

  return (
    <div className="border rounded-lg bg-card overflow-hidden">
      {/* Group header */}
      <div className="px-4 py-3 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold">{group.name}</p>
            {group.brand && <span className="text-xs text-muted-foreground">{group.brand}</span>}
          </div>
          <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-muted-foreground mt-0.5">
            {group.category && <span className="bg-muted px-1.5 py-0.5 rounded">{group.category}</span>}
            {group.location && <span>{group.location}</span>}
            {group.earliestBestBy && group.dateMode === 'full' && (
              <span className={bestByColor(group.earliestBestBy)}>
                Best by: {formatDate(group.earliestBestBy)}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-sm font-semibold bg-primary/10 text-primary px-2.5 py-0.5 rounded-full tabular-nums">
            {group.totalQty} {group.unit}{group.totalQty !== 1 ? 's' : ''}
          </span>
          <button
            onClick={() => onQuickAdd(group)}
            className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            title="Add one"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            onClick={() => onRemove(group)}
            className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
            title="Remove one"
          >
            <Minus className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Usage prediction */}
      {effectiveDays != null && (
        <div className="px-4 pb-2 space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs">
            <TrendingDown className="h-3 w-3 text-primary/70 shrink-0" />
            {daysLeft != null && (
              <span className="font-medium text-foreground/80">~{formatDays(daysLeft)} of stock left</span>
            )}
            <span className="text-muted-foreground flex-1 truncate ml-1">
              {group.setting?.days_per_unit != null
                ? `1 ${group.unit} every ${Math.round(group.setting.days_per_unit)}d (custom)`
                : pred ? `1 ${group.unit} every ~${Math.round(pred.daysPerUnit)}d (${pred.eventCount} uses)` : null}
            </span>
            <button
              onClick={() => handleResetUsage(group.name)}
              disabled={savingReset === group.name}
              title="Reset usage calculation"
              className="p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-50"
            >
              {savingReset === group.name ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
            </button>
            <button
              onClick={() => {
                if (overrideItem === group.name) { setOverrideItem(null); setOverrideDays(''); }
                else { setOverrideItem(group.name); setOverrideDays(String(Math.round(effectiveDays))); }
              }}
              className={cn('p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors', overrideItem === group.name && 'bg-accent text-foreground')}
            >
              <SlidersHorizontal className="h-3 w-3" />
            </button>
          </div>
          {overrideItem === group.name && (
            <div className="flex flex-wrap items-center gap-1.5 pl-4">
              <span className="text-xs text-muted-foreground">1 {group.unit} every</span>
              <input
                type="number" min="1" value={overrideDays}
                onChange={e => setOverrideDays(e.target.value)}
                className="w-14 h-6 text-xs text-center border rounded px-1 bg-background"
              />
              <span className="text-xs text-muted-foreground">days</span>
              <button
                onClick={() => handleSaveOverride(group.name, Number(overrideDays))}
                disabled={savingOverride || !overrideDays || Number(overrideDays) <= 0}
                className="text-xs px-2 py-0.5 rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {savingOverride ? <Loader2 className="h-3 w-3 animate-spin inline" /> : 'Save'}
              </button>
              <button
                onClick={() => { setOverrideItem(null); setOverrideDays(''); }}
                className="text-xs px-2 py-0.5 rounded border text-muted-foreground hover:bg-accent transition-colors"
              >Cancel</button>
              {group.setting?.days_per_unit != null && (
                <button
                  onClick={() => handleSaveOverride(group.name, null)}
                  disabled={savingOverride}
                  className="text-xs text-primary hover:underline disabled:opacity-50"
                >Use calculated</button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Footer: expand + date mode */}
      <div className="px-4 py-2 border-t flex items-center gap-2">
        <button
          onClick={() => setShowDateMode(v => !v)}
          className={cn('flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors rounded px-1 py-0.5 hover:bg-accent', showDateMode && 'text-foreground bg-accent')}
          title="Change date tracking mode"
        >
          {group.dateMode === 'no_dates' ? <CalendarOff className="h-3 w-3" /> : <Calendar className="h-3 w-3" />}
          {DATE_MODE_LABELS[group.dateMode]}
        </button>
        <div className="flex-1" />
        <button
          onClick={() => onEdit(group.items[0], group.dateMode)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded px-2 py-0.5 transition-colors"
        >
          <Edit2 className="h-3 w-3" />Edit
        </button>
        <button
          onClick={() => setShowItems(v => !v)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded px-2 py-0.5 transition-colors"
        >
          {showItems ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {group.items.length} {group.items.length === 1 ? 'batch' : 'batches'}
        </button>
      </div>

      {/* Date mode picker (inline) */}
      {showDateMode && (
        <div className="px-4 pb-3 border-t bg-muted/30">
          <p className="text-xs text-muted-foreground pt-2 mb-1.5">Change date tracking for all {group.name}:</p>
          <div className="flex gap-2">
            {(['full', 'no_best_by', 'no_dates'] as PantryDateMode[]).map(mode => (
              <button
                key={mode}
                type="button"
                onClick={() => { onChangeDateMode(group.name, mode); setShowDateMode(false); }}
                className={cn(
                  'flex-1 h-7 text-xs rounded-md border transition-colors',
                  group.dateMode === mode
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'text-muted-foreground hover:bg-accent bg-background'
                )}
              >
                {mode === 'full' ? 'Full' : mode === 'no_best_by' ? 'No Best-By' : 'No Dates'}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Individual batches */}
      {showItems && (
        <div className="border-t divide-y bg-muted/20">
          {group.items.map((item, idx) => (
            <div key={item.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
              <div className="flex-1 min-w-0">
                {group.dateMode === 'no_dates' ? (
                  <span className="text-muted-foreground text-xs">No date</span>
                ) : (
                  <span className="text-xs">Stored: {formatDate(item.stored_date)}</span>
                )}
                {item.best_by_date && group.dateMode === 'full' && (
                  <span className={cn('text-xs ml-2', bestByColor(item.best_by_date))}>
                    · Best by: {formatDate(item.best_by_date)}
                  </span>
                )}
              </div>
              <span className="text-xs text-muted-foreground shrink-0">{item.quantity} {group.unit}{item.quantity !== 1 ? 's' : ''}</span>
              {idx === 0 && <span className="text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground shrink-0">oldest</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PantryPage() {
  const { activeProfile } = useProfile();
  const [items, setItems] = useState<PantryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showHistory, setShowHistory] = useState(false);

  // Full add form
  const [showAdd, setShowAdd] = useState(false);
  const [showBulkAdd, setShowBulkAdd] = useState(false);
  const [addForm, setAddForm] = useState<PantryFormState>(DEFAULT_FORM);
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Edit form
  const [editItem, setEditItem] = useState<PantryItem | null>(null);
  const [editDateMode, setEditDateMode] = useState<PantryDateMode>('full');
  const [editForm, setEditForm] = useState<PantryFormState>(DEFAULT_FORM);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Quick add (per group)
  const [quickAddGroup, setQuickAddGroup] = useState<ItemGroup | null>(null);
  const [quickAddForm, setQuickAddForm] = useState<QuickAddForm>({ stored_date: TODAY, best_by_date: '', quantity: '1' });
  const [quickAddSaving, setQuickAddSaving] = useState(false);
  const [quickAddError, setQuickAddError] = useState<string | null>(null);

  // Remove dialog
  const [removeGroup, setRemoveGroup] = useState<ItemGroup | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

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

  const allGroups = useMemo(() => makeGroups(items, usageSettings), [items, usageSettings]);

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

  const filteredGroups = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return allGroups;
    return allGroups.filter(g =>
      g.name.toLowerCase().includes(q) ||
      (g.brand ?? '').toLowerCase().includes(q) ||
      (g.category ?? '').toLowerCase().includes(q) ||
      g.items.some(i => (i.notes ?? '').toLowerCase().includes(q) || i.location.toLowerCase().includes(q))
    );
  }, [allGroups, searchQuery]);

  const upsertSetting = async (itemName: string, updates: { days_per_unit?: number | null; reset_date?: string | null; date_mode?: PantryDateMode | null }) => {
    if (!activeProfile) return;
    await fetch('/api/pantry/usage-settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile_id: activeProfile.id, item_name: itemName, ...updates }),
    });
  };

  const handleResetUsage = async (itemName: string) => {
    if (!activeProfile) return;
    setSavingReset(itemName);
    try {
      await upsertSetting(itemName, { reset_date: new Date().toISOString().slice(0, 10), days_per_unit: null });
      await load();
    } finally { setSavingReset(null); }
  };

  const handleSaveOverride = async (itemName: string, daysPerUnit: number | null) => {
    if (!activeProfile) return;
    setSavingOverride(true);
    try {
      await upsertSetting(itemName, { days_per_unit: daysPerUnit });
      setOverrideItem(null);
      setOverrideDays('');
      await load();
    } finally { setSavingOverride(false); }
  };

  const handleChangeDateMode = async (itemName: string, mode: PantryDateMode) => {
    if (!activeProfile) return;
    await upsertSetting(itemName, { date_mode: mode });
    await load();
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProfile) return;
    setAddError(null);
    setAddSaving(true);
    try {
      const noExpiry = addForm.date_mode !== 'full';
      const noDate = addForm.date_mode === 'no_dates';
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
          stored_date: noDate ? TODAY : addForm.stored_date,
          best_by_date: noExpiry ? null : (addForm.best_by_date || undefined),
          best_by_days: noExpiry ? 0 : (parseInt(addForm.best_by_days, 10) || 365),
          notes: addForm.notes || undefined,
        }),
      });
      if (!res.ok) { setAddError((await res.json()).error ?? 'Failed'); return; }
      await upsertSetting(addForm.name.trim(), { date_mode: addForm.date_mode });
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
      const noExpiry = editForm.date_mode !== 'full';
      const noDate = editForm.date_mode === 'no_dates';
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
          stored_date: noDate ? TODAY : editForm.stored_date,
          best_by_date: noExpiry ? null : (editForm.best_by_date || undefined),
          best_by_days: noExpiry ? 0 : (parseInt(editForm.best_by_days, 10) || 365),
          notes: editForm.notes || undefined,
        }),
      });
      if (!res.ok) { setEditError((await res.json()).error ?? 'Failed'); return; }
      await upsertSetting(editForm.name.trim(), { date_mode: editForm.date_mode });
      setEditItem(null);
      await load();
    } catch { setEditError('Failed to update item'); }
    finally { setEditSaving(false); }
  };

  const openQuickAdd = (group: ItemGroup) => {
    const lastItem = [...group.items].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    const bestByDays = lastItem?.best_by_days ?? 365;
    const bestBy = bestByDays > 0 ? computeBestByDate(TODAY, bestByDays) : '';
    setQuickAddGroup(group);
    setQuickAddForm({ stored_date: TODAY, best_by_date: bestBy, quantity: '1' });
    setQuickAddError(null);
  };

  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickAddGroup || !activeProfile) return;
    setQuickAddError(null);
    setQuickAddSaving(true);
    try {
      const g = quickAddGroup;
      const refItem = g.items[0];
      const noExpiry = g.dateMode !== 'full';
      const noDate = g.dateMode === 'no_dates';
      const res = await fetch('/api/pantry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile_id: activeProfile.id,
          name: g.name,
          brand: refItem?.brand,
          category: refItem?.category,
          quantity: Number(quickAddForm.quantity) || 1,
          unit: g.unit,
          location: g.location,
          stored_date: noDate ? TODAY : quickAddForm.stored_date,
          best_by_date: noExpiry ? null : (quickAddForm.best_by_date || undefined),
          best_by_days: noExpiry ? 0 : (refItem?.best_by_days ?? 365),
          notes: refItem?.notes,
        }),
      });
      if (!res.ok) { setQuickAddError((await res.json()).error ?? 'Failed'); return; }
      setQuickAddGroup(null);
      await load();
    } catch { setQuickAddError('Failed to add item'); }
    finally { setQuickAddSaving(false); }
  };

  const handleRemove = async (itemId: string) => {
    setRemoving(itemId);
    try {
      const res = await fetch(`/api/pantry/${itemId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: 1 }),
      });
      if (res.ok) {
        setRemoveGroup(null);
        await load();
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
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowBulkAdd(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm font-medium hover:bg-muted transition-colors"
          >
            <Rows3 className="h-4 w-4" />
            Bulk Add
          </button>
          <button
            onClick={() => { setShowAdd(true); setAddForm(DEFAULT_FORM); setAddError(null); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Item
          </button>
        </div>
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
                    onClick={() => {
                      const group = allGroups.find(g => g.name.toLowerCase() === item.name.toLowerCase());
                      setEditItem(item);
                      setEditDateMode(group?.dateMode ?? 'full');
                      setEditForm(itemToForm(item, group?.dateMode ?? 'full'));
                      setEditError(null);
                    }}
                    className="text-xs px-2 py-1 rounded border text-muted-foreground hover:bg-accent transition-colors shrink-0"
                  >
                    <Edit2 className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => handleRemove(item.id)}
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
      {!loading && allGroups.length > 0 && (
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            type="search"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search pantry…"
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

      {/* Item groups */}
      {!loading && filteredGroups.length > 0 && (
        <div className="space-y-3">
          {filteredGroups.map(group => (
            <PantryGroupCard
              key={group.name}
              group={group}
              transactions={transactions}
              onQuickAdd={openQuickAdd}
              onRemove={g => setRemoveGroup(g)}
              onEdit={(item, dateMode) => {
                setEditItem(item);
                setEditDateMode(dateMode);
                setEditForm(itemToForm(item, dateMode));
                setEditError(null);
              }}
              onChangeDateMode={handleChangeDateMode}
              overrideItem={overrideItem}
              overrideDays={overrideDays}
              setOverrideItem={setOverrideItem}
              setOverrideDays={setOverrideDays}
              handleSaveOverride={handleSaveOverride}
              handleResetUsage={handleResetUsage}
              savingOverride={savingOverride}
              savingReset={savingReset}
            />
          ))}
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
      {!loading && items.length > 0 && filteredGroups.length === 0 && searchQuery && (
        <div className="text-center py-8 border border-dashed rounded-lg text-muted-foreground">
          <p className="text-sm">No items match &ldquo;{searchQuery}&rdquo;</p>
          <button onClick={() => setSearchQuery('')} className="text-xs text-primary mt-1 hover:underline">Clear search</button>
        </div>
      )}

      {/* Category breakdown */}
      {!loading && allGroups.length > 0 && (
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

      {/* ── Dialogs ── */}

      {/* Full Add dialog */}
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
            isEdit
          />
        </DialogContent>
      </Dialog>

      {/* Quick Add dialog */}
      <Dialog open={!!quickAddGroup} onOpenChange={open => { if (!open) setQuickAddGroup(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-4 w-4 text-primary" />
              Add {quickAddGroup?.name}
            </DialogTitle>
          </DialogHeader>
          {quickAddGroup && (
            <QuickAddDialog
              group={quickAddGroup}
              form={quickAddForm}
              onChange={patch => setQuickAddForm(f => ({ ...f, ...patch }))}
              onSubmit={handleQuickAdd}
              onCancel={() => setQuickAddGroup(null)}
              saving={quickAddSaving}
              error={quickAddError}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Remove dialog */}
      <Dialog open={!!removeGroup} onOpenChange={open => { if (!open) setRemoveGroup(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-4 w-4 text-destructive" />
              Remove {removeGroup?.name}
            </DialogTitle>
          </DialogHeader>
          {removeGroup && (
            <RemoveDialog
              group={removeGroup}
              onClose={() => setRemoveGroup(null)}
              onRemove={handleRemove}
              removing={removing}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* ── Bulk Add ── */}
      {activeProfile && (
        <PantryBulkAdd
          profile={activeProfile}
          existingItems={items}
          open={showBulkAdd}
          onClose={() => setShowBulkAdd(false)}
          onSuccess={() => { void load(); setShowBulkAdd(false); }}
        />
      )}

    </div>
  );
}
