'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  ScanLine, Plus, Loader2, X, Check, Camera, CameraOff,
  Sparkles, Archive, AlertCircle, ChevronDown, Trash2,
} from 'lucide-react';
import { useProfile } from '@/hooks/useProfile';
import { useBarcode } from '@/hooks/useBarcode';
import type { Wine, Location, WineType } from '@/types';
import { cn } from '@/lib/utils';

const WINE_TYPES: WineType[] = ['red', 'white', 'rosé', 'sparkling', 'dessert', 'fortified', 'other'];

// Mirror the same resize helper used in LabelCapture.tsx
async function resizeToWebP(source: HTMLCanvasElement, maxW: number, maxH: number, quality: number): Promise<string> {
  const ratio = Math.min(maxW / source.width, maxH / source.height);
  const w = Math.round(source.width * ratio);
  const h = Math.round(source.height * ratio);
  const out = document.createElement('canvas');
  out.width = w; out.height = h;
  out.getContext('2d')!.drawImage(source, 0, 0, w, h);
  return out.toDataURL('image/webp', quality).split(',')[1];
}

type RowStatus =
  | 'idle' | 'looking-up' | 'found' | 'not-found'
  | 'label-scanning' | 'label-found' | 'enriching' | 'saved' | 'error';

interface GeminiExtras {
  appellation?: string;
  country?: string;
  alcohol_content?: number;
  average_price?: number;
  drink_from_year?: number;
  drink_by_year?: number;
  description?: string;
  acidity?: number;
  tannin?: number;
  alcohol?: number;
  sweetness?: number;
  body?: number;
  minerality?: number;
  oak_influence?: number;
  fruit_intensity?: number;
  fruit_profile?: string;
  pairing_weight?: string;
  pairing_rationale?: string;
  food_pairings?: string[];
  cuisine_tags?: string[];
}

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
  labelGemini: string | null;     // front label 400×600 @ 0.7 — sent to /api/label-scan
  labelBackGemini: string | null; // back label 400×600 @ 0.7 — sent alongside front
  labelThumbnail: string | null;  // 150×225 @ 0.35 — displayed + saved to DB
  errorMsg: string | null;
  geminiExtras: GeminiExtras | null;
}

function blankRow(): ScanRow {
  return {
    id: Math.random().toString(36).slice(2),
    barcode: '', status: 'idle',
    wineName: '', producer: '', vintage: '', wineType: '', variety: '', region: '',
    qty: 1, location: '', wineId: null,
    labelGemini: null, labelBackGemini: null, labelThumbnail: null, errorMsg: null, geminiExtras: null,
  };
}

// ── Barcode camera modal — landscape, no rotation ─────────────────────────────
function BarcodeCameraModal({
  onDetected, onClose,
}: { onDetected: (barcode: string) => void; onClose: () => void }) {
  const handleDetected = useCallback((code: string) => {
    onDetected(code);
    onClose();
  }, [onDetected, onClose]);

  const { videoRef, status, error, start, stop } = useBarcode(handleDetected);

  useEffect(() => {
    start();
    return () => stop();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) { stop(); onClose(); } }}>
      <div className="bg-card rounded-xl border shadow-2xl overflow-hidden w-full max-w-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <p className="font-semibold text-sm flex items-center gap-2"><Camera className="h-4 w-4 text-primary" /> Scan Barcode</p>
          <button onClick={() => { stop(); onClose(); }} className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"><X className="h-4 w-4" /></button>
        </div>

        <div className="relative bg-black overflow-hidden" style={{ aspectRatio: '16/9' }}>
          <video
            ref={videoRef}
            className="absolute inset-0 w-full h-full object-cover"
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
              <div className="w-3/4 h-2/3 border-2 border-green-400 rounded-sm opacity-80" />
              <p className="absolute bottom-3 left-0 right-0 text-center text-xs text-green-300">Tilt the bottle so the barcode is horizontal, then center it in the frame</p>
            </div>
          )}
        </div>

        <div className="px-4 py-3 text-center">
          <p className="text-xs text-muted-foreground">Tilt the bottle sideways so the barcode lines run left-to-right.</p>
        </div>
      </div>
    </div>
  );
}

// ── Label capture modal — landscape orientation, neck pointing left, two-step ─────
// Bottle lies on its side (neck left). Guide box is landscape. After the guide-box
// crop, the raw canvas is rotated 90° CW so the output is portrait (neck at top)
// before being sent to Gemini. Front then back label captured in sequence.
function LabelCaptureModal({
  onCapture, onClose,
}: {
  onCapture: (gemini: string, thumbnail: string, backGemini?: string) => void; onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const guideRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [phase, setPhase] = useState<'front' | 'back'>('front');
  const [frontData, setFrontData] = useState<{ gemini: string; thumbnail: string } | null>(null);

  useEffect(() => {
    let mounted = true;
    navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } })
      .then(stream => {
        if (!mounted) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.onloadedmetadata = () => { if (mounted) setReady(true); }; }
      })
      .catch(err => { if (mounted) setError(err.message ?? 'Camera access failed'); });
    return () => { mounted = false; streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null; };
  }, []);

  const captureFrame = async (): Promise<{ gemini: string; thumbnail: string } | null> => {
    const video = videoRef.current;
    if (!video || !ready || processing) return null;
    const nativeW = video.videoWidth, nativeH = video.videoHeight;
    const guide = guideRef.current;
    if (!guide) return null;
    const containerRect = video.getBoundingClientRect();
    const guideRect = guide.getBoundingClientRect();
    const displayW = containerRect.width, displayH = containerRect.height;
    const scale = Math.max(displayW / nativeW, displayH / nativeH);
    const videoOffsetX = (displayW - nativeW * scale) / 2;
    const videoOffsetY = (displayH - nativeH * scale) / 2;
    const srcX = Math.max(0, (guideRect.left - containerRect.left - videoOffsetX) / scale);
    const srcY = Math.max(0, (guideRect.top - containerRect.top - videoOffsetY) / scale);
    const srcW = Math.min(nativeW - srcX, guideRect.width / scale);
    const srcH = Math.min(nativeH - srcY, guideRect.height / scale);
    const raw = document.createElement('canvas');
    raw.width = Math.round(srcW); raw.height = Math.round(srcH);
    raw.getContext('2d')!.drawImage(video, srcX, srcY, srcW, srcH, 0, 0, raw.width, raw.height);
    // Rotate 90° CW: landscape crop (neck-left) → portrait (neck-top) for Gemini
    const rotated = document.createElement('canvas');
    rotated.width = raw.height; rotated.height = raw.width;
    const rctx = rotated.getContext('2d')!;
    rctx.translate(raw.height, 0); rctx.rotate(Math.PI / 2);
    rctx.drawImage(raw, 0, 0);
    const [gemini, thumbnail] = await Promise.all([
      resizeToWebP(rotated, 400, 600, 0.7),
      resizeToWebP(rotated, 150, 225, 0.35),
    ]);
    return { gemini, thumbnail };
  };

  const handleCaptureFront = async () => {
    setProcessing(true);
    try {
      const data = await captureFrame();
      if (!data) return;
      setFrontData(data);
      setPhase('back');
    } finally { setProcessing(false); }
  };

  const handleCaptureBack = async () => {
    if (!frontData) return;
    setProcessing(true);
    try {
      const data = await captureFrame();
      if (!data) return;
      onCapture(frontData.gemini, frontData.thumbnail, data.gemini);
      onClose();
    } finally { setProcessing(false); }
  };

  const handleSkipBack = () => {
    if (!frontData) return;
    onCapture(frontData.gemini, frontData.thumbnail);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-card rounded-xl border shadow-2xl overflow-hidden w-full max-w-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-3">
            <p className="font-semibold text-sm flex items-center gap-2"><Camera className="h-4 w-4 text-primary" /> Scan Label</p>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className={phase === 'front' ? 'font-semibold text-foreground' : ''}>1. Front</span>
              <span>→</span>
              <span className={phase === 'back' ? 'font-semibold text-foreground' : ''}>2. Back</span>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"><X className="h-4 w-4" /></button>
        </div>
        <div className="relative bg-black overflow-hidden" style={{ aspectRatio: '16/9' }}>
          <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" autoPlay muted playsInline />
          {!ready && !error && <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-white"><Loader2 className="h-6 w-6 animate-spin mr-2" /><span className="text-sm">Starting camera…</span></div>}
          {error && <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-red-300 text-sm px-6 text-center">{error}</div>}
          {ready && phase === 'back' && frontData && (
            <div className="absolute top-2 left-2 z-10">
              <img src={`data:image/webp;base64,${frontData.thumbnail}`} alt="Front captured" className="w-10 h-14 object-cover rounded border-2 border-green-400 shadow" />
              <span className="block text-center text-[9px] text-green-300 mt-0.5">Front ✓</span>
            </div>
          )}
          {ready && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div ref={guideRef} className="relative w-[85%] h-[70%]">
                <div className="w-full h-full border-2 border-white/80 rounded-md" />
                <div className="absolute left-2 top-1/2 -translate-y-1/2">
                  <span className="text-white text-[9px] font-bold tracking-widest uppercase bg-black/50 px-1.5 py-0.5 rounded">NECK</span>
                </div>
                <div className="absolute right-2 top-1/2 -translate-y-1/2">
                  <span className="text-white text-[9px] font-bold tracking-widest uppercase bg-black/50 px-1.5 py-0.5 rounded">BASE</span>
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="px-4 py-2 text-center">
          <p className="text-xs text-muted-foreground">
            {phase === 'front'
              ? 'Lay bottle on its side, neck pointing left · align front label · image will be rotated automatically'
              : 'Flip bottle to back label · align within frame · or skip if no back label'}
          </p>
        </div>
        <div className="px-4 py-3 flex justify-center gap-3">
          {phase === 'front' ? (
            <>
              <button onClick={handleCaptureFront} disabled={!ready || processing} className="flex items-center gap-2 px-6 py-2 rounded-full bg-white text-black text-sm font-semibold shadow-md disabled:opacity-40 hover:bg-gray-100 transition-colors">
                {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                {processing ? 'Processing…' : 'Capture Front'}
              </button>
              <button onClick={onClose} className="flex items-center gap-2 px-4 py-2 rounded-full border text-sm hover:bg-accent transition-colors"><X className="h-4 w-4" /> Cancel</button>
            </>
          ) : (
            <>
              <button onClick={handleCaptureBack} disabled={!ready || processing} className="flex items-center gap-2 px-6 py-2 rounded-full bg-white text-black text-sm font-semibold shadow-md disabled:opacity-40 hover:bg-gray-100 transition-colors">
                {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                {processing ? 'Processing…' : 'Capture Back'}
              </button>
              <button onClick={handleSkipBack} disabled={processing} className="px-4 py-2 rounded-full border text-sm hover:bg-accent transition-colors disabled:opacity-40">Skip Back</button>
            </>
          )}
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

  // After label photo(s) captured — gemini (400×600) → API; thumbnail (150×225) → DB + display
  const handleLabelCapture = useCallback(async (gemini: string, thumbnail: string, backGemini?: string) => {
    const targetRowId = labelRowId;
    if (!targetRowId) return;
    setLabelRowId(null);
    updateRow(targetRowId, { status: 'label-scanning' });
    try {
      const res = await fetch('/api/label-scan', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: gemini, backImageBase64: backGemini ?? null }),
      });
      const data = await res.json();
      if (res.ok && data.name) {
        updateRow(targetRowId, {
          status: 'label-found',
          wineName: data.name ?? '',
          producer: data.producer ?? '',
          vintage: data.vintage_year ? String(data.vintage_year) : '',
          wineType: data.wine_type ?? '',
          variety: data.variety ?? '',
          region: data.region ?? '',
          labelGemini: gemini,
          labelBackGemini: backGemini ?? null,
          labelThumbnail: thumbnail,
          geminiExtras: {
            appellation: data.appellation,
            country: data.country,
            alcohol_content: data.alcohol_content,
            average_price: data.average_price,
            drink_from_year: data.drink_from_year,
            drink_by_year: data.drink_by_year,
            description: data.description,
            acidity: data.acidity,
            tannin: data.tannin,
            alcohol: data.alcohol,
            sweetness: data.sweetness,
            body: data.body,
            minerality: data.minerality,
            oak_influence: data.oak_influence,
            fruit_intensity: data.fruit_intensity,
            fruit_profile: data.fruit_profile,
            pairing_weight: data.pairing_weight,
            pairing_rationale: data.pairing_rationale,
            food_pairings: data.food_pairings,
            cuisine_tags: data.cuisine_tags,
          },
        });
      } else {
        updateRow(targetRowId, { status: 'not-found', errorMsg: data.error ?? 'Label scan failed', labelGemini: null, labelThumbnail: null });
      }
    } catch {
      updateRow(targetRowId, { status: 'not-found', errorMsg: 'Label scan failed', labelGemini: null, labelThumbnail: null });
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

  // Add all rows to cellar — passes all Gemini fields and fires pairings/tags
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
          const extras = row.geminiExtras;
          const res = await fetch('/api/wines', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: row.wineName.trim(),
              producer: row.producer || undefined,
              vintage_year: row.vintage ? parseInt(row.vintage) : undefined,
              wine_type: row.wineType || undefined,
              variety: row.variety || undefined,
              region: row.region || undefined,
              barcode: row.barcode || undefined,
              // All Gemini structural data
              appellation: extras?.appellation,
              country: extras?.country,
              alcohol_content: extras?.alcohol_content,
              average_price: extras?.average_price,
              drink_from_year: extras?.drink_from_year,
              drink_by_year: extras?.drink_by_year,
              description: extras?.description,
              acidity: extras?.acidity,
              tannin: extras?.tannin,
              alcohol: extras?.alcohol,
              sweetness: extras?.sweetness,
              body: extras?.body,
              minerality: extras?.minerality,
              oak_influence: extras?.oak_influence,
              fruit_intensity: extras?.fruit_intensity,
              fruit_profile: extras?.fruit_profile,
              pairing_weight: extras?.pairing_weight,
              pairing_rationale: extras?.pairing_rationale,
            }),
          });
          if (!res.ok) { results[row.id] = 'error'; continue; }
          const wine = await res.json() as Wine;
          wineId = wine.id;
          // Save label thumbnail (150×225 @ 0.35) to DB — same as mobile
          if (row.labelThumbnail && wineId) {
            fetch(`/api/wines/${wineId}`, {
              method: 'PUT', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ label_image: row.labelThumbnail }),
            }).catch(() => {});
          }
          // Fire food pairings and cuisine tags (fire-and-forget, same as mobile scanner)
          if (extras?.food_pairings && wineId) {
            for (const food of extras.food_pairings) {
              fetch(`/api/wines/${wineId}/pairings`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ food }),
              }).catch(() => {});
            }
          }
          if (extras?.cuisine_tags && wineId) {
            for (const tag of extras.cuisine_tags) {
              fetch(`/api/wines/${wineId}/cuisine-tags`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tag }),
              }).catch(() => {});
            }
          }
        }
        // Use bulk endpoint so empty location (unlocated) is accepted
        const cellarRes = await fetch('/api/cellar/bulk', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            profile_id: activeProfile.id,
            location: row.location || '',
            items: [{ wine_id: wineId, quantity: row.qty }],
          }),
        });
        const cellarData = cellarRes.ok ? await cellarRes.json() : null;
        const ok = cellarRes.ok && cellarData?.added > 0;
        results[row.id] = ok ? 'ok' : 'error';
        if (ok) updateRow(row.id, { status: 'saved', wineId });
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
                <th className="px-2 py-2 text-left font-medium text-muted-foreground uppercase tracking-wide w-16">Label</th>
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
                          onBlur={e => { if (e.target.value.trim() && !isSaved) lookupBarcode(row.id, e.target.value.trim()); }}
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

                    {/* Label — shows thumbnail (150×225) or camera button; available for every row */}
                    <td className="px-2 py-1.5">
                      {row.labelThumbnail ? (
                        <button onClick={() => !isSaved && setLabelRowId(row.id)} title="Re-scan label" className="block">
                          <img src={`data:image/webp;base64,${row.labelThumbnail}`} alt="Label" className="w-10 h-12 object-cover rounded border" />
                        </button>
                      ) : (
                        <div className="flex flex-col items-center gap-0.5">
                          <button
                            onClick={() => setLabelRowId(row.id)}
                            disabled={isSaved}
                            title={row.status === 'found' ? 'Wrong wine? Scan label with Gemini to override' : 'Scan label with Gemini AI'}
                            className={cn(
                              'h-10 w-10 flex items-center justify-center rounded border transition-colors disabled:opacity-40',
                              row.status === 'found'
                                ? 'text-amber-600 border-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/20'
                                : 'text-muted-foreground hover:text-primary hover:bg-accent'
                            )}
                          >
                            <Camera className="h-4 w-4" />
                          </button>
                          {row.status === 'found' && (
                            <span className="text-[10px] text-amber-600 leading-tight text-center">Wrong?</span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-2 py-1.5">
                      <span className={cn('text-xs', badge.cls)}>
                        {isLookingUp ? <span className="flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" />{badge.label}</span> : badge.label}
                      </span>
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
        <BarcodeCameraModal onDetected={handleCameraBarcode} onClose={() => setCameraRowId(null)} />
      )}
      {labelRowId && (
        <LabelCaptureModal onCapture={handleLabelCapture} onClose={() => setLabelRowId(null)} />
      )}
    </div>
  );
}
