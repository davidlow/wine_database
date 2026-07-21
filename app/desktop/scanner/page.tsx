'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  ScanLine, Plus, Loader2, X, Check, Camera, CameraOff,
  Sparkles, Archive, AlertCircle, ChevronDown, RotateCw, Trash2,
} from 'lucide-react';
import { useProfile } from '@/hooks/useProfile';
import { useBarcode } from '@/hooks/useBarcode';
import { useCameraRotation } from '@/hooks/useCameraRotation';
import type { Wine, Location, WineType } from '@/types';
import { cn } from '@/lib/utils';

const WINE_TYPES: WineType[] = ['red', 'white', 'rosé', 'sparkling', 'dessert', 'fortified', 'other'];

type RowStatus =
  | 'idle' | 'looking-up' | 'found' | 'not-found'
  | 'label-scanning' | 'label-found' | 'enriching' | 'saved' | 'error';

interface ScanRow {
  id: string;
  barcode: string;
  status: RowStatus;
  wineName: string;
  producer: string;
  vintage: string;
  wineType: string;
  variety: string;
  region: string;
  qty: number;
  location: string;
  wineId: string | null;
  labelImage: string | null;
  errorMsg: string | null;
}

function blankRow(): ScanRow {
  return {
    id: Math.random().toString(36).slice(2),
    barcode: '', status: 'idle',
    wineName: '', producer: '', vintage: '', wineType: '', variety: '', region: '',
    qty: 1, location: '', wineId: null, labelImage: null, errorMsg: null,
  };
}

// ── Portrait barcode camera modal ─────────────────────────────────────────────
function PortraitCameraModal({
  onDetected, onClose,
}: { onDetected: (barcode: string) => void; onClose: () => void }) {
  const handleDetected = useCallback((code: string) => {
    onDetected(code);
    onClose();
  }, [onDetected, onClose]);

  const { videoRef, status, error, start, stop } = useBarcode(handleDetected);
  const { rotation, rotateNext, videoStyle } = useCameraRotation();

  useEffect(() => {
    start();
    return () => stop();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) { stop(); onClose(); } }}>
      <div className="bg-card rounded-xl border shadow-2xl overflow-hidden w-full max-w-lg">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <p className="font-semibold text-sm flex items-center gap-2"><Camera className="h-4 w-4 text-primary" /> Scan Barcode</p>
          <div className="flex items-center gap-2">
            {status === 'scanning' && (
              <button onClick={rotateNext} title={`Rotate (${rotation}°)`} className="p-1.5 rounded-md border text-muted-foreground hover:bg-accent transition-colors">
                <RotateCw className="h-4 w-4" />
              </button>
            )}
            <button onClick={() => { stop(); onClose(); }} className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"><X className="h-4 w-4" /></button>
          </div>
        </div>

        {/* Portrait-oriented camera area: swapped aspect so it appears taller on screen */}
        <div className="relative bg-black overflow-hidden" style={{ aspectRatio: '9/12', maxHeight: '70vh' }}>
          <video
            ref={videoRef}
            className="absolute inset-0 w-full h-full object-cover"
            style={videoStyle ?? { transform: 'rotate(90deg) scale(1.78)' }}
            autoPlay muted playsInline
          />
          {status !== 'scanning' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/60 text-white">
              {status === 'starting' && <><Loader2 className="h-8 w-8 animate-spin" /><p className="text-sm">Starting camera…</p></>}
              {status === 'idle' && <><CameraOff className="h-8 w-8 opacity-60" /><p className="text-sm opacity-80">Camera inactive</p></>}
              {status === 'error' && <><CameraOff className="h-8 w-8 text-red-400" /><p className="text-sm text-red-300">{error ?? 'Camera error'}</p></>}
            </div>
          )}
          {status === 'scanning' && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-16 h-3/4 border-2 border-green-400 rounded-sm opacity-80" />
              <p className="absolute bottom-3 left-0 right-0 text-center text-xs text-green-300">Align barcode — hold bottle upright</p>
            </div>
          )}
        </div>

        <div className="px-4 py-3 text-center">
          <p className="text-xs text-muted-foreground">Camera rotated 90° for vertical bottles. Use the rotate button to adjust.</p>
        </div>
      </div>
    </div>
  );
}

// ── Label capture modal (reuses existing component concept) ────────────────────
function LabelCaptureModal({
  onCapture, onClose,
}: {
  onCapture: (base64: string) => void; onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const { rotation, rotateNext, videoStyle } = useCameraRotation();

  useEffect(() => {
    let mounted = true;
    navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 960 } } })
      .then(stream => {
        if (!mounted) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.onloadedmetadata = () => { if (mounted) setReady(true); }; }
      })
      .catch(err => { if (mounted) setError(err.message ?? 'Camera access failed'); });
    return () => { mounted = false; streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null; };
  }, []);

  const capture = async () => {
    const video = videoRef.current;
    if (!video || !ready || processing) return;
    setProcessing(true);
    const nativeW = video.videoWidth, nativeH = video.videoHeight;
    const swap = rotation === 90 || rotation === 270;
    const canvas = document.createElement('canvas');
    canvas.width = swap ? nativeH : nativeW;
    canvas.height = swap ? nativeW : nativeH;
    const ctx = canvas.getContext('2d')!;
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.drawImage(video, -nativeW / 2, -nativeH / 2, nativeW, nativeH);

    const out = document.createElement('canvas');
    const ratio = Math.min(400 / canvas.width, 600 / canvas.height);
    out.width = Math.round(canvas.width * ratio);
    out.height = Math.round(canvas.height * ratio);
    out.getContext('2d')!.drawImage(canvas, 0, 0, out.width, out.height);
    const base64 = out.toDataURL('image/webp', 0.7).split(',')[1];
    setProcessing(false);
    onCapture(base64);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-card rounded-xl border shadow-2xl overflow-hidden w-full max-w-lg">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <p className="font-semibold text-sm flex items-center gap-2"><Camera className="h-4 w-4 text-primary" /> Scan Label</p>
          <div className="flex items-center gap-2">
            {ready && <button onClick={rotateNext} title={`Rotate (${rotation}°)`} className="p-1.5 rounded-md border text-muted-foreground hover:bg-accent transition-colors"><RotateCw className="h-4 w-4" /></button>}
            <button onClick={onClose} className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"><X className="h-4 w-4" /></button>
          </div>
        </div>
        <div className="relative bg-black overflow-hidden" style={{ aspectRatio: '9/12', maxHeight: '70vh' }}>
          <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" style={videoStyle} autoPlay muted playsInline />
          {!ready && !error && <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-white"><Loader2 className="h-6 w-6 animate-spin mr-2" /><span className="text-sm">Starting camera…</span></div>}
          {error && <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-red-300 text-sm px-6 text-center">{error}</div>}
          {ready && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-1/2 h-[88%] border-2 border-white/80 rounded-md" />
              <p className="absolute bottom-3 left-0 right-0 text-center text-xs text-white/80">Align label in frame</p>
            </div>
          )}
        </div>
        <div className="px-4 py-3 flex justify-center gap-3">
          <button onClick={capture} disabled={!ready || processing} className="flex items-center gap-2 px-6 py-2 rounded-full bg-white text-black text-sm font-semibold shadow-md disabled:opacity-40 hover:bg-gray-100 transition-colors">
            {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            {processing ? 'Processing…' : 'Capture'}
          </button>
          <button onClick={onClose} className="flex items-center gap-2 px-4 py-2 rounded-full border text-sm hover:bg-accent transition-colors"><X className="h-4 w-4" /> Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── Producer autocomplete ─────────────────────────────────────────────────────
function ProducerCell({
  value, rowId, onSelect, onWineSelect,
}: {
  value: string; rowId: string;
  onSelect: (rowId: string, producer: string) => void;
  onWineSelect: (rowId: string, wine: Wine) => void;
}) {
  const [results, setResults] = useState<string[]>([]);
  const [wines, setWines] = useState<Wine[]>([]);
  const [open, setOpen] = useState(false);
  const [showWines, setShowWines] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback((q: string) => {
    if (!q.trim() || q.length < 2) { setResults([]); setOpen(false); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/producers?q=${encodeURIComponent(q)}&limit=8`);
        if (res.ok) {
          const data = await res.json() as Array<{ name: string }>;
          const names = data.map(d => d.name);
          setResults(names); setOpen(names.length > 0);
        }
      } catch { /* ignore */ }
    }, 250);
  }, []);

  const selectProducer = async (name: string) => {
    onSelect(rowId, name);
    setOpen(false); setResults([]);
    try {
      const res = await fetch(`/api/producers/${encodeURIComponent(name)}/wines`);
      if (res.ok) { const w = await res.json() as Wine[]; setWines(w); if (w.length > 0) setShowWines(true); }
    } catch { /* ignore */ }
  };

  return (
    <div className="relative">
      <input
        type="text" value={value}
        onChange={e => { onSelect(rowId, e.target.value); search(e.target.value); }}
        onFocus={() => { if (results.length > 0) setOpen(true); }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="h-7 border rounded px-2 text-xs bg-background focus:outline-none focus:ring-1 focus:ring-ring w-full"
        placeholder="Producer…"
      />
      {open && results.length > 0 && (
        <div className="absolute z-20 top-full left-0 mt-1 bg-card border rounded-md shadow-lg py-1 min-w-[200px] max-h-48 overflow-y-auto">
          {results.map(name => (
            <button key={name} className="w-full text-left px-3 py-1.5 text-xs hover:bg-accent transition-colors" onMouseDown={() => selectProducer(name)}>{name}</button>
          ))}
        </div>
      )}
      {showWines && wines.length > 0 && (
        <div className="absolute z-20 top-full left-0 mt-1 bg-card border rounded-md shadow-lg py-1 min-w-[280px] max-h-48 overflow-y-auto">
          <div className="px-3 py-1 text-xs text-muted-foreground border-b mb-1">Select a wine to fill all fields:</div>
          {wines.map(w => (
            <button key={w.id} className="w-full text-left px-3 py-1.5 text-xs hover:bg-accent transition-colors" onMouseDown={() => { onWineSelect(rowId, w); setShowWines(false); }}>
              <span className="font-medium">{w.name}</span>
              {w.vintage_year && <span className="ml-1 text-muted-foreground">{w.vintage_year}</span>}
              {w.variety && <span className="ml-1 text-muted-foreground">· {w.variety}</span>}
            </button>
          ))}
          <button className="w-full text-left px-3 py-1 text-xs text-muted-foreground hover:bg-accent transition-colors" onMouseDown={() => setShowWines(false)}>— None, enter manually —</button>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function DesktopScannerPage() {
  const { activeProfile } = useProfile();
  const [rows, setRows] = useState<ScanRow[]>([blankRow()]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [cameraRowId, setCameraRowId] = useState<string | null>(null);
  const [labelRowId, setLabelRowId] = useState<string | null>(null);
  const [enriching, setEnriching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveResults, setSaveResults] = useState<Record<string, 'ok' | 'error'>>({});

  useEffect(() => {
    if (!activeProfile) return;
    fetch(`/api/locations?profile_id=${activeProfile.id}`)
      .then(r => r.ok ? r.json() : [])
      .then((data: Location[]) => setLocations(data))
      .catch(() => {});
  }, [activeProfile]);

  const updateRow = useCallback((id: string, patch: Partial<ScanRow>) => {
    setRows(rs => rs.map(r => r.id === id ? { ...r, ...patch } : r));
  }, []);

  const addRow = useCallback(() => {
    setRows(rs => [...rs, blankRow()]);
  }, []);

  const deleteRow = useCallback((id: string) => {
    setRows(rs => rs.filter(r => r.id !== id));
  }, []);

  // Barcode lookup after camera scan or manual entry
  const lookupBarcode = useCallback(async (rowId: string, barcode: string) => {
    if (!barcode.trim()) return;
    updateRow(rowId, { barcode, status: 'looking-up', errorMsg: null });
    try {
      const res = await fetch(`/api/barcode/${encodeURIComponent(barcode.trim())}`);
      const data = await res.json();
      if (data.found) {
        updateRow(rowId, {
          status: 'found',
          wineId: data.wine_id ?? null,
          wineName: data.name ?? '',
          producer: data.producer ?? '',
          vintage: data.vintage_year ? String(data.vintage_year) : '',
          wineType: data.wine_type ?? '',
          variety: data.variety ?? '',
          region: data.region ?? '',
        });
      } else {
        updateRow(rowId, { status: 'not-found' });
      }
    } catch {
      updateRow(rowId, { status: 'error', errorMsg: 'Lookup failed' });
    }
  }, [updateRow]);

  // After portrait camera detects a barcode
  const handleCameraBarcode = useCallback((barcode: string) => {
    if (!cameraRowId) return;
    setCameraRowId(null);
    lookupBarcode(cameraRowId, barcode);
  }, [cameraRowId, lookupBarcode]);

  // After label photo captured
  const handleLabelCapture = useCallback(async (base64: string) => {
    if (!labelRowId) return;
    updateRow(labelRowId, { status: 'label-scanning' });
    try {
      const res = await fetch('/api/label-scan', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64 }),
      });
      const data = await res.json();
      if (res.ok && data.name) {
        updateRow(labelRowId, {
          status: 'label-found',
          wineName: data.name ?? '',
          producer: data.producer ?? '',
          vintage: data.vintage_year ? String(data.vintage_year) : '',
          wineType: data.wine_type ?? '',
          variety: data.variety ?? '',
          region: data.region ?? '',
          labelImage: base64,
        });
      } else {
        updateRow(labelRowId, { status: 'not-found', errorMsg: data.error ?? 'Label scan failed' });
      }
    } catch {
      updateRow(labelRowId, { status: 'not-found', errorMsg: 'Label scan failed' });
    }
  }, [labelRowId, updateRow]);

  // Gemini enrichment for incomplete rows
  const enrichableRows = useMemo(
    () => rows.filter(r => r.wineName && !r.wineId && r.status !== 'enriching' && r.status !== 'saved'),
    [rows]
  );

  const handleEnrich = async () => {
    if (enrichableRows.length === 0) return;
    setEnriching(true);
    enrichableRows.forEach(r => updateRow(r.id, { status: 'enriching' }));
    try {
      const wines = enrichableRows.map(r => ({
        name: r.wineName, producer: r.producer || null,
        vintage_year: r.vintage ? parseInt(r.vintage) : null,
        variety: r.variety || null, wine_type: r.wineType || null,
        region: r.region || null,
      }));
      const res = await fetch('/api/wines/bulk-enrich', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wines }),
      });
      if (res.ok) {
        const { enriched } = await res.json() as { enriched: Array<Record<string, unknown>> };
        enrichableRows.forEach((r, i) => {
          const e = enriched[i];
          if (!e) return;
          updateRow(r.id, {
            status: 'found',
            producer: (e.producer as string) ?? r.producer,
            vintage: e.vintage_year ? String(e.vintage_year) : r.vintage,
            wineType: (e.wine_type as string) ?? r.wineType,
            variety: (e.variety as string) ?? r.variety,
            region: (e.region as string) ?? r.region,
          });
        });
      } else {
        enrichableRows.forEach(r => updateRow(r.id, { status: 'not-found' }));
      }
    } catch {
      enrichableRows.forEach(r => updateRow(r.id, { status: 'not-found' }));
    } finally { setEnriching(false); }
  };

  // Add all rows to cellar
  const handleAddToCellar = async () => {
    if (!activeProfile) return;
    const validRows = rows.filter(r => r.wineName.trim() && r.status !== 'saved');
    if (validRows.length === 0) return;
    setSaving(true);
    const results: Record<string, 'ok' | 'error'> = {};
    for (const row of validRows) {
      try {
        let wineId = row.wineId;
        if (!wineId) {
          const res = await fetch('/api/wines', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: row.wineName.trim(), producer: row.producer || undefined,
              vintage_year: row.vintage ? parseInt(row.vintage) : undefined,
              wine_type: row.wineType || undefined, variety: row.variety || undefined,
              region: row.region || undefined, barcode: row.barcode || undefined,
            }),
          });
          if (!res.ok) { results[row.id] = 'error'; continue; }
          const wine = await res.json() as Wine;
          wineId = wine.id;
          // Save label image if available
          if (row.labelImage && wineId) {
            await fetch(`/api/wines/${wineId}`, {
              method: 'PUT', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ label_image: row.labelImage }),
            }).catch(() => {});
          }
        }
        const cellarRes = await fetch('/api/cellar', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            wine_id: wineId, profile_id: activeProfile.id,
            location: row.location || '', quantity: row.qty,
          }),
        });
        results[row.id] = cellarRes.ok ? 'ok' : 'error';
        if (cellarRes.ok) updateRow(row.id, { status: 'saved', wineId });
      } catch { results[row.id] = 'error'; }
    }
    setSaveResults(results); setSaving(false);
  };

  const STATUS_BADGE: Record<RowStatus, { label: string; cls: string }> = {
    idle:          { label: '—',          cls: 'text-muted-foreground' },
    'looking-up':  { label: 'Looking up…', cls: 'text-blue-600 dark:text-blue-400' },
    found:         { label: 'Found',       cls: 'text-green-600 dark:text-green-400 font-medium' },
    'not-found':   { label: 'Not found',   cls: 'text-orange-600 dark:text-orange-400' },
    'label-scanning': { label: 'Scanning…', cls: 'text-purple-600 dark:text-purple-400' },
    'label-found': { label: 'Label ✓',    cls: 'text-purple-600 dark:text-purple-400 font-medium' },
    enriching:     { label: 'Enriching…', cls: 'text-amber-600 dark:text-amber-400' },
    saved:         { label: 'Saved ✓',    cls: 'text-green-600 dark:text-green-400 font-semibold' },
    error:         { label: 'Error',       cls: 'text-destructive' },
  };

  const inp = 'h-7 border rounded px-2 text-xs bg-background focus:outline-none focus:ring-1 focus:ring-ring w-full';

  if (!activeProfile) {
    return (
      <div className="px-6 py-12 text-center text-muted-foreground">
        <ScanLine className="h-8 w-8 mx-auto mb-3 opacity-40" />
        <p>Select a cellar profile to use the desktop scanner.</p>
      </div>
    );
  }

  const savedCount = rows.filter(r => r.status === 'saved').length;
  const validCount = rows.filter(r => r.wineName.trim() && r.status !== 'saved').length;

  return (
    <div className="px-6 py-5 space-y-4 max-w-screen-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <ScanLine className="h-5 w-5 text-primary" />
          <div>
            <h1 className="text-xl font-bold">Desktop Scanner</h1>
            <p className="text-xs text-muted-foreground">Click a barcode cell to open the camera, or type a barcode and press Enter</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {enrichableRows.length > 0 && (
            <button onClick={handleEnrich} disabled={enriching}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50">
              {enriching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 text-amber-500" />}
              {enriching ? 'Enriching…' : `Enrich with Gemini (${enrichableRows.length})`}
            </button>
          )}
          <button onClick={handleAddToCellar} disabled={saving || validCount === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />}
            {saving ? 'Adding…' : `Add to Cellar${validCount > 0 ? ` (${validCount})` : ''}`}
          </button>
        </div>
      </div>

      {savedCount > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-sm text-green-700 dark:text-green-300">
          <Check className="h-4 w-4" /> {savedCount} {savedCount === 1 ? 'bottle' : 'bottles'} added to cellar
        </div>
      )}

      {/* Spreadsheet table */}
      <div className="rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/40 border-b">
              <tr>
                <th className="px-2 py-2 text-left font-medium text-muted-foreground uppercase tracking-wide w-8">#</th>
                <th className="px-2 py-2 text-left font-medium text-muted-foreground uppercase tracking-wide w-32">Barcode</th>
                <th className="px-2 py-2 text-left font-medium text-muted-foreground uppercase tracking-wide w-24">Status</th>
                <th className="px-2 py-2 text-left font-medium text-muted-foreground uppercase tracking-wide min-w-[180px]">Wine Name</th>
                <th className="px-2 py-2 text-left font-medium text-muted-foreground uppercase tracking-wide w-36">Producer</th>
                <th className="px-2 py-2 text-left font-medium text-muted-foreground uppercase tracking-wide w-20">Vintage</th>
                <th className="px-2 py-2 text-left font-medium text-muted-foreground uppercase tracking-wide w-24">Type</th>
                <th className="px-2 py-2 text-left font-medium text-muted-foreground uppercase tracking-wide w-28">Variety</th>
                <th className="px-2 py-2 text-left font-medium text-muted-foreground uppercase tracking-wide w-28">Region</th>
                <th className="px-2 py-2 text-right font-medium text-muted-foreground uppercase tracking-wide w-14">Qty</th>
                <th className="px-2 py-2 text-left font-medium text-muted-foreground uppercase tracking-wide w-32">Location</th>
                <th className="px-2 py-2 text-right font-medium text-muted-foreground uppercase tracking-wide w-20">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((row, idx) => {
                const badge = STATUS_BADGE[row.status];
                const isSaved = row.status === 'saved';
                const isLookingUp = row.status === 'looking-up' || row.status === 'label-scanning' || row.status === 'enriching';
                return (
                  <tr key={row.id} className={cn('transition-colors', isSaved ? 'bg-green-50/50 dark:bg-green-900/10 opacity-70' : 'hover:bg-accent/20')}>
                    {/* Row number */}
                    <td className="px-2 py-1.5 text-muted-foreground tabular-nums">{idx + 1}</td>

                    {/* Barcode — click to open camera */}
                    <td className="px-2 py-1.5">
                      <div className="flex gap-1">
                        <input
                          type="text" value={row.barcode}
                          readOnly={isSaved}
                          onChange={e => updateRow(row.id, { barcode: e.target.value })}
                          onKeyDown={e => { if (e.key === 'Enter' && row.barcode.trim()) lookupBarcode(row.id, row.barcode); }}
                          placeholder="Barcode…"
                          className={cn(inp, 'flex-1', isSaved && 'opacity-60')}
                        />
                        {!isSaved && (
                          <button onClick={() => setCameraRowId(row.id)} title="Open camera" className="h-7 w-7 flex items-center justify-center rounded border hover:bg-accent transition-colors shrink-0">
                            <Camera className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-2 py-1.5">
                      <span className={cn('text-xs', badge.cls)}>
                        {isLookingUp ? <span className="flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" />{badge.label}</span> : badge.label}
                      </span>
                      {row.status === 'not-found' && (
                        <button onClick={() => setLabelRowId(row.id)} className="text-xs text-primary hover:underline block mt-0.5 whitespace-nowrap">
                          Scan label
                        </button>
                      )}
                      {row.errorMsg && <p className="text-xs text-destructive">{row.errorMsg}</p>}
                      {saveResults[row.id] === 'error' && <p className="text-xs text-destructive">Save failed</p>}
                    </td>

                    {/* Wine Name */}
                    <td className="px-2 py-1.5">
                      <input type="text" value={row.wineName} readOnly={isSaved}
                        onChange={e => updateRow(row.id, { wineName: e.target.value, status: row.status === 'idle' ? 'idle' : row.status })}
                        placeholder="Wine name…" className={cn(inp, isSaved && 'opacity-60')} />
                    </td>

                    {/* Producer with autocomplete */}
                    <td className="px-2 py-1.5">
                      {isSaved ? (
                        <span className="text-xs text-muted-foreground">{row.producer}</span>
                      ) : (
                        <ProducerCell
                          value={row.producer} rowId={row.id}
                          onSelect={(id, v) => updateRow(id, { producer: v })}
                          onWineSelect={(id, wine) => updateRow(id, {
                            wineId: wine.id, wineName: wine.name,
                            producer: wine.producer ?? '', vintage: wine.vintage_year ? String(wine.vintage_year) : '',
                            wineType: wine.wine_type ?? '', variety: wine.variety ?? '',
                            region: wine.region ?? '', status: 'found',
                          })}
                        />
                      )}
                    </td>

                    {/* Vintage */}
                    <td className="px-2 py-1.5">
                      <input type="number" value={row.vintage} readOnly={isSaved}
                        onChange={e => updateRow(row.id, { vintage: e.target.value })}
                        placeholder="2020" min={1900} max={2100}
                        className={cn(inp, isSaved && 'opacity-60')} />
                    </td>

                    {/* Type */}
                    <td className="px-2 py-1.5">
                      {isSaved ? (
                        <span className="text-xs text-muted-foreground">{row.wineType}</span>
                      ) : (
                        <select value={row.wineType} onChange={e => updateRow(row.id, { wineType: e.target.value })} className={inp}>
                          <option value="">Type…</option>
                          {WINE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      )}
                    </td>

                    {/* Variety */}
                    <td className="px-2 py-1.5">
                      <input type="text" value={row.variety} readOnly={isSaved}
                        onChange={e => updateRow(row.id, { variety: e.target.value })}
                        placeholder="Cabernet…" className={cn(inp, isSaved && 'opacity-60')} />
                    </td>

                    {/* Region */}
                    <td className="px-2 py-1.5">
                      <input type="text" value={row.region} readOnly={isSaved}
                        onChange={e => updateRow(row.id, { region: e.target.value })}
                        placeholder="Region…" className={cn(inp, isSaved && 'opacity-60')} />
                    </td>

                    {/* Qty */}
                    <td className="px-2 py-1.5">
                      <input type="number" value={row.qty} readOnly={isSaved}
                        onChange={e => updateRow(row.id, { qty: Math.max(1, parseInt(e.target.value) || 1) })}
                        min={1} className={cn(inp, 'text-right', isSaved && 'opacity-60')} />
                    </td>

                    {/* Location */}
                    <td className="px-2 py-1.5">
                      {isSaved ? (
                        <span className="text-xs text-muted-foreground">{row.location || '—'}</span>
                      ) : (
                        <select value={row.location} onChange={e => updateRow(row.id, { location: e.target.value })} className={inp}>
                          <option value="">Unlocated</option>
                          {locations.map(l => <option key={l.id} value={l.name}>{l.name}</option>)}
                        </select>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-2 py-1.5">
                      <div className="flex items-center justify-end gap-1">
                        {!isSaved && rows.length > 1 && (
                          <button onClick={() => deleteRow(row.id)} className="h-7 w-7 flex items-center justify-center rounded border text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t bg-muted/20 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{rows.length} {rows.length === 1 ? 'row' : 'rows'}</span>
          <button onClick={addRow} className="flex items-center gap-1 text-xs text-primary hover:underline">
            <Plus className="h-3 w-3" /> Add row
          </button>
        </div>
      </div>

      {/* Camera modals */}
      {cameraRowId && (
        <PortraitCameraModal onDetected={handleCameraBarcode} onClose={() => setCameraRowId(null)} />
      )}
      {labelRowId && (
        <LabelCaptureModal onCapture={handleLabelCapture} onClose={() => setLabelRowId(null)} />
      )}
    </div>
  );
}
