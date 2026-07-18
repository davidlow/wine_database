'use client';

import { useState, useCallback, useEffect } from 'react';
import { Plus, Sparkles, Loader2, Save, Trash2, X, CheckCircle2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { Profile, Location, WineType } from '@/types';

// ── Types ──────────────────────────────────────────────────────────────────────

const WINE_TYPES: WineType[] = ['red', 'white', 'rosé', 'sparkling', 'dessert', 'fortified', 'other'];

type LocAlloc = {
  id: string;
  location: string;
  quantity: string;
  purchase_price: string;
};

type WineRow = {
  id: string;
  name: string;
  producer: string;
  vintage_year: string;
  variety: string;
  wine_type: string;
  region: string;
  country: string;
  appellation: string;
  alcohol_content: string;
  average_price: string;
  drink_from_year: string;
  drink_by_year: string;
  description: string;
  acidity: string;
  tannin: string;
  sweetness: string;
  body: string;
  alcohol_str: string;
  fruit_profile: string;
  locations: LocAlloc[];
  geminiChanged: string[];
};

type Phase = 'entry' | 'enriching' | 'review' | 'saving';

let _counter = 0;
function uid() { return `${++_counter}`; }

function emptyRow(): WineRow {
  return {
    id: uid(), name: '', producer: '', vintage_year: '', variety: '', wine_type: '',
    region: '', country: '', appellation: '', alcohol_content: '', average_price: '',
    drink_from_year: '', drink_by_year: '', description: '', acidity: '', tannin: '',
    sweetness: '', body: '', alcohol_str: '', fruit_profile: '',
    locations: [{ id: uid(), location: '', quantity: '1', purchase_price: '' }],
    geminiChanged: [],
  };
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const cell = 'w-full border rounded px-1.5 py-0.5 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring';
const geminiHl = 'bg-amber-50 dark:bg-amber-950/30 border-amber-400 dark:border-amber-600';
const scoreCell = 'w-12 text-center border rounded px-1 py-0.5 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring';

// ── Main component ─────────────────────────────────────────────────────────────

export default function WineBulkAdd({
  profile,
  locations: knownLocations,
  open,
  onClose,
  onSuccess,
}: {
  profile: Profile;
  locations: Location[];
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [rows, setRows] = useState<WineRow[]>(() => [emptyRow(), emptyRow(), emptyRow()]);
  const [phase, setPhase] = useState<Phase>('entry');
  const [enrichError, setEnrichError] = useState<string | null>(null);
  const [saveResult, setSaveResult] = useState<{ added: number; errors: string[] } | null>(null);

  // Reset when opened
  useEffect(() => {
    if (open) {
      setRows([emptyRow(), emptyRow(), emptyRow()]);
      setPhase('entry');
      setEnrichError(null);
      setSaveResult(null);
    }
  }, [open]);

  const locationNames = knownLocations.map(l => l.name);
  const validRows = rows.filter(r => r.name.trim());

  // ── Row/location CRUD ────────────────────────────────────────────────────────

  const updateRow = useCallback((id: string, field: keyof WineRow, value: string) => {
    setRows(prev => prev.map(r => {
      if (r.id !== id) return r;
      // If user edits a Gemini-changed field, keep it highlighted (it's still Gemini's fill)
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

  const addLocation = useCallback((rowId: string) => {
    setRows(prev => prev.map(r =>
      r.id === rowId
        ? { ...r, locations: [...r.locations, { id: uid(), location: '', quantity: '1', purchase_price: '' }] }
        : r
    ));
  }, []);

  const updateLoc = useCallback((rowId: string, locId: string, field: keyof LocAlloc, val: string) => {
    setRows(prev => prev.map(r =>
      r.id === rowId
        ? { ...r, locations: r.locations.map(l => l.id === locId ? { ...l, [field]: val } : l) }
        : r
    ));
  }, []);

  const removeLoc = useCallback((rowId: string, locId: string) => {
    setRows(prev => prev.map(r =>
      r.id === rowId
        ? { ...r, locations: r.locations.filter(l => l.id !== locId) }
        : r
    ));
  }, []);

  // ── Gemini enrichment ────────────────────────────────────────────────────────

  const handleEnrich = useCallback(async () => {
    if (!validRows.length) return;
    setPhase('enriching');
    setEnrichError(null);

    const payload = rows.map(r => ({
      name: r.name || null,
      producer: r.producer || null,
      vintage_year: r.vintage_year ? Number(r.vintage_year) : null,
      variety: r.variety || null,
      wine_type: r.wine_type || null,
      region: r.region || null,
      country: r.country || null,
      appellation: r.appellation || null,
      alcohol_content: r.alcohol_content ? Number(r.alcohol_content) : null,
      drink_from_year: r.drink_from_year ? Number(r.drink_from_year) : null,
      drink_by_year: r.drink_by_year ? Number(r.drink_by_year) : null,
      description: r.description || null,
      acidity: r.acidity !== '' ? Number(r.acidity) : null,
      tannin: r.tannin !== '' ? Number(r.tannin) : null,
      sweetness: r.sweetness !== '' ? Number(r.sweetness) : null,
      body: r.body !== '' ? Number(r.body) : null,
      alcohol_str: r.alcohol_str !== '' ? Number(r.alcohol_str) : null,
    }));

    try {
      const res = await fetch('/api/wines/bulk-enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wines: payload }),
      });
      if (!res.ok) {
        const err = await res.json() as { error?: string };
        throw new Error(err.error ?? 'Enrichment failed');
      }
      const { enriched } = await res.json() as { enriched: Record<string, unknown>[] };

      setRows(prev => prev.map((row, i) => {
        const gem = enriched[i];
        if (!gem) return row;
        const changed: string[] = [...row.geminiChanged];

        function fill(field: keyof WineRow, gemVal: unknown) {
          if (gemVal == null || gemVal === '') return '';
          const str = String(gemVal);
          if (!(row as Record<string, unknown>)[field]) {
            changed.push(field);
            return str;
          }
          return (row as Record<string, unknown>)[field] as string;
        }

        return {
          ...row,
          producer: fill('producer', gem.producer) || row.producer,
          vintage_year: fill('vintage_year', gem.vintage_year) || row.vintage_year,
          variety: fill('variety', gem.variety) || row.variety,
          wine_type: fill('wine_type', gem.wine_type) || row.wine_type,
          region: fill('region', gem.region) || row.region,
          country: fill('country', gem.country) || row.country,
          appellation: fill('appellation', gem.appellation) || row.appellation,
          alcohol_content: fill('alcohol_content', gem.alcohol_content) || row.alcohol_content,
          average_price: fill('average_price', gem.average_price) || row.average_price,
          drink_from_year: fill('drink_from_year', gem.drink_from_year) || row.drink_from_year,
          drink_by_year: fill('drink_by_year', gem.drink_by_year) || row.drink_by_year,
          description: fill('description', gem.description) || row.description,
          acidity: fill('acidity', gem.acidity) || row.acidity,
          tannin: fill('tannin', gem.tannin) || row.tannin,
          sweetness: fill('sweetness', gem.sweetness) || row.sweetness,
          body: fill('body', gem.body) || row.body,
          alcohol_str: fill('alcohol_str', gem.alcohol_str) || row.alcohol_str,
          fruit_profile: fill('fruit_profile', gem.fruit_profile) || row.fruit_profile,
          geminiChanged: [...new Set(changed)],
        };
      }));

      setPhase('review');
    } catch (err) {
      setEnrichError(err instanceof Error ? err.message : 'Enrichment failed');
      setPhase('entry');
    }
  }, [rows, validRows.length]);

  // ── Save ─────────────────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!validRows.length) return;
    setPhase('saving');
    setSaveResult(null);

    const wines = validRows.map(r => ({
      name: r.name.trim(),
      producer: r.producer || undefined,
      vintage_year: r.vintage_year ? Number(r.vintage_year) : undefined,
      variety: r.variety || undefined,
      wine_type: (r.wine_type as WineType) || undefined,
      region: r.region || undefined,
      appellation: r.appellation || undefined,
      country: r.country || undefined,
      alcohol_content: r.alcohol_content ? Number(r.alcohol_content) : undefined,
      average_price: r.average_price ? Number(r.average_price) : undefined,
      drink_from_year: r.drink_from_year ? Number(r.drink_from_year) : undefined,
      drink_by_year: r.drink_by_year ? Number(r.drink_by_year) : undefined,
      description: r.description || undefined,
      acidity: r.acidity !== '' ? Number(r.acidity) : undefined,
      tannin: r.tannin !== '' ? Number(r.tannin) : undefined,
      sweetness: r.sweetness !== '' ? Number(r.sweetness) : undefined,
      body: r.body !== '' ? Number(r.body) : undefined,
      alcohol: r.alcohol_str !== '' ? Number(r.alcohol_str) : undefined,
      fruit_profile: r.fruit_profile || undefined,
      locations: r.locations
        .filter(l => Number(l.quantity) >= 1)
        .map(l => ({
          location: l.location.trim(),
          quantity: Math.max(1, Number(l.quantity) || 1),
          purchase_price: l.purchase_price ? Number(l.purchase_price) : undefined,
        })),
    }));

    try {
      const res = await fetch('/api/wines/bulk-add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile_id: profile.id, wines }),
      });
      const result = await res.json() as { added: number; errors: string[] };
      setSaveResult(result);
      if (result.added > 0) onSuccess();
    } catch (err) {
      setSaveResult({ added: 0, errors: [err instanceof Error ? err.message : 'Save failed'] });
    } finally {
      setPhase('review');
    }
  }, [validRows, profile.id, onSuccess]);

  // ── Render ───────────────────────────────────────────────────────────────────

  const isLoading = phase === 'enriching' || phase === 'saving';

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-[98vw] w-[98vw] sm:max-w-[98vw] sm:w-[98vw] max-h-[96vh] sm:max-h-[96vh] flex flex-col gap-0 p-0">

        {/* Header */}
        <DialogHeader className="px-5 py-3 border-b shrink-0">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <DialogTitle className="text-base">Bulk Add Wines — {profile.name}</DialogTitle>
            <div className="flex items-center gap-2 flex-wrap">
              {phase === 'review' && (
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="inline-block w-2.5 h-2.5 rounded-sm bg-amber-400" />
                  Amber cells filled by Gemini — review before saving
                </span>
              )}
              <button
                onClick={handleEnrich}
                disabled={isLoading || !validRows.length}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {phase === 'enriching' ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                {phase === 'review' ? 'Re-enrich' : 'Enrich with Gemini'}
              </button>
              <button
                onClick={handleSave}
                disabled={isLoading || !validRows.length}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {phase === 'saving' ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                Save {validRows.length} Wine{validRows.length !== 1 ? 's' : ''}
              </button>
            </div>
          </div>

          {enrichError && (
            <p className="text-xs text-destructive mt-1">{enrichError}</p>
          )}
          {saveResult && (
            <div className="flex items-center gap-1.5 mt-1 text-xs">
              {saveResult.added > 0 && (
                <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                  <CheckCircle2 size={12} />
                  {saveResult.added} wine{saveResult.added !== 1 ? 's' : ''} added
                </span>
              )}
              {saveResult.errors.length > 0 && (
                <span className="text-destructive ml-2">{saveResult.errors.join('; ')}</span>
              )}
            </div>
          )}
        </DialogHeader>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          <div className="overflow-x-auto min-h-0">
            <table className="w-full border-collapse text-sm min-w-max">
              <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm">
                <tr>
                  <Th w="w-7">#</Th>
                  <Th w="min-w-[175px]">Name *</Th>
                  <Th w="min-w-[140px]">Producer</Th>
                  <Th w="min-w-[72px]">Vintage</Th>
                  <Th w="min-w-[140px]">Variety</Th>
                  <Th w="min-w-[100px]">Type</Th>
                  <Th w="min-w-[130px]">Region</Th>
                  <Th w="min-w-[105px]">Country</Th>
                  <Th w="min-w-[68px]" muted>Alc %</Th>
                  <Th w="min-w-[78px]" muted>Drink From</Th>
                  <Th w="min-w-[72px]" muted>Drink By</Th>
                  <Th w="min-w-[190px]" muted>Description</Th>
                  <Th w="min-w-[44px]" muted center>Acid</Th>
                  <Th w="min-w-[44px]" muted center>Tann</Th>
                  <Th w="min-w-[48px]" muted center>Sweet</Th>
                  <Th w="min-w-[44px]" muted center>Body</Th>
                  <Th w="w-8"></Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => {
                  const hl = (f: string) => row.geminiChanged.includes(f) ? geminiHl : '';
                  return (
                    <>
                      {/* Wine info row */}
                      <tr key={row.id} className="border-b border-border/40 hover:bg-muted/10">
                        <td className="px-1.5 py-1 text-xs text-muted-foreground text-center align-top pt-2">
                          {idx + 1}
                        </td>
                        {/* Name */}
                        <td className="px-1 py-1">
                          <input
                            value={row.name}
                            onChange={e => updateRow(row.id, 'name', e.target.value)}
                            placeholder="Wine name *"
                            className={cn(cell, !row.name && phase !== 'entry' && 'border-muted-foreground/30 opacity-50')}
                          />
                        </td>
                        {/* Producer */}
                        <td className="px-1 py-1">
                          <input value={row.producer} onChange={e => updateRow(row.id, 'producer', e.target.value)}
                            placeholder="Producer / Winery" className={cn(cell, hl('producer'))} />
                        </td>
                        {/* Vintage */}
                        <td className="px-1 py-1">
                          <input type="number" value={row.vintage_year}
                            onChange={e => updateRow(row.id, 'vintage_year', e.target.value)}
                            placeholder="Year" min={1800} max={2099}
                            className={cn(cell, hl('vintage_year'))} />
                        </td>
                        {/* Variety */}
                        <td className="px-1 py-1">
                          <input value={row.variety} onChange={e => updateRow(row.id, 'variety', e.target.value)}
                            list="wine-varieties" placeholder="Grape variety"
                            className={cn(cell, hl('variety'))} />
                        </td>
                        {/* Type */}
                        <td className="px-1 py-1">
                          <select value={row.wine_type} onChange={e => updateRow(row.id, 'wine_type', e.target.value)}
                            className={cn(cell, hl('wine_type'))}>
                            <option value="">— type —</option>
                            {WINE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </td>
                        {/* Region */}
                        <td className="px-1 py-1">
                          <input value={row.region} onChange={e => updateRow(row.id, 'region', e.target.value)}
                            placeholder="Region" className={cn(cell, hl('region'))} />
                        </td>
                        {/* Country */}
                        <td className="px-1 py-1">
                          <input value={row.country} onChange={e => updateRow(row.id, 'country', e.target.value)}
                            placeholder="Country" className={cn(cell, hl('country'))} />
                        </td>
                        {/* Alcohol content */}
                        <td className="px-1 py-1">
                          <input type="number" value={row.alcohol_content}
                            onChange={e => updateRow(row.id, 'alcohol_content', e.target.value)}
                            placeholder="14.5" min={0} max={25} step={0.1}
                            className={cn(cell, hl('alcohol_content'))} />
                        </td>
                        {/* Drink from */}
                        <td className="px-1 py-1">
                          <input type="number" value={row.drink_from_year}
                            onChange={e => updateRow(row.id, 'drink_from_year', e.target.value)}
                            placeholder="2025" min={1900} max={2099}
                            className={cn(cell, hl('drink_from_year'))} />
                        </td>
                        {/* Drink by */}
                        <td className="px-1 py-1">
                          <input type="number" value={row.drink_by_year}
                            onChange={e => updateRow(row.id, 'drink_by_year', e.target.value)}
                            placeholder="2035" min={1900} max={2099}
                            className={cn(cell, hl('drink_by_year'))} />
                        </td>
                        {/* Description */}
                        <td className="px-1 py-1">
                          <input value={row.description}
                            onChange={e => updateRow(row.id, 'description', e.target.value)}
                            placeholder="Brief description…"
                            className={cn(cell, hl('description'))} />
                        </td>
                        {/* Structural scores */}
                        {(['acidity', 'tannin', 'sweetness', 'body'] as const).map(f => (
                          <td key={f} className="px-1 py-1 text-center">
                            <input type="number" value={(row as unknown as Record<string, string>)[f]}
                              onChange={e => updateRow(row.id, f, e.target.value)}
                              placeholder="—" min={0} max={5} step={1}
                              className={cn(scoreCell, hl(f))} />
                          </td>
                        ))}
                        {/* Delete row */}
                        <td className="px-1 py-1 text-center">
                          <button onClick={() => removeRow(row.id)}
                            className="text-muted-foreground hover:text-destructive p-0.5 rounded">
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>

                      {/* Location allocations sub-row */}
                      <tr key={`${row.id}-locs`} className="border-b bg-muted/5">
                        <td />
                        <td colSpan={16} className="px-3 py-1.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-xs text-muted-foreground font-medium shrink-0 mr-1">
                              Cellar locations:
                            </span>
                            {row.locations.map((loc, li) => (
                              <div key={loc.id}
                                className="flex items-center gap-1 bg-background border border-border/60 rounded-md px-1.5 py-0.5 text-xs">
                                <input
                                  value={loc.location}
                                  onChange={e => updateLoc(row.id, loc.id, 'location', e.target.value)}
                                  list={`locs-${row.id}`}
                                  placeholder="Location (optional)"
                                  className="bg-transparent outline-none w-32 placeholder:text-muted-foreground/50"
                                />
                                <span className="text-muted-foreground px-0.5">×</span>
                                <input
                                  type="number"
                                  value={loc.quantity}
                                  onChange={e => updateLoc(row.id, loc.id, 'quantity', e.target.value)}
                                  min={1}
                                  className="bg-transparent outline-none w-8 text-center"
                                />
                                <span className="text-muted-foreground/60 text-xs">btl</span>
                                {row.locations.length > 1 && (
                                  <button onClick={() => removeLoc(row.id, loc.id)}
                                    className="ml-0.5 text-muted-foreground hover:text-destructive">
                                    <X size={10} />
                                  </button>
                                )}
                                {/* Purchase price (collapsed — show on focus) */}
                                {loc.purchase_price !== '' ? (
                                  <span className="text-muted-foreground/60 text-xs ml-1">
                                    ${loc.purchase_price}
                                  </span>
                                ) : null}
                              </div>
                            ))}
                            <button
                              onClick={() => addLocation(row.id)}
                              className="flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded border border-dashed border-border/50 hover:border-border">
                              <Plus size={10} /> location
                            </button>

                            {/* Hidden datalist per row (IDs must be unique) */}
                            <datalist id={`locs-${row.id}`}>
                              {locationNames.map(n => <option key={n} value={n} />)}
                            </datalist>
                          </div>
                        </td>
                      </tr>
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-2.5 border-t shrink-0 flex items-center gap-3">
          <button
            onClick={addRow}
            disabled={isLoading}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50">
            <Plus size={14} /> Add row
          </button>
          <span className="text-xs text-muted-foreground ml-auto">
            {validRows.length} / {rows.length} rows have a wine name
          </span>
        </div>

        {/* Global datalist for varieties (populated from existing wines) */}
        <datalist id="wine-varieties" />
      </DialogContent>
    </Dialog>
  );
}

// ── Helper components ──────────────────────────────────────────────────────────

function Th({ children, w, muted, center }: {
  children?: React.ReactNode;
  w?: string;
  muted?: boolean;
  center?: boolean;
}) {
  return (
    <th className={cn(
      'px-2 py-1.5 text-left text-xs font-medium border-b border-border whitespace-nowrap',
      muted && 'text-muted-foreground',
      center && 'text-center',
      w,
    )}>
      {children}
    </th>
  );
}
