'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, Loader2, X } from 'lucide-react';

// Stored label dimensions and quality — small enough for ~5-10KB per image
const TARGET_W = 200;
const TARGET_H = 300;
const WEBP_QUALITY = 0.45;

// Resize + convert to WebP. Returns base64 without data: prefix.
async function processLabelImage(source: HTMLCanvasElement): Promise<string> {
  const ratio = Math.min(TARGET_W / source.width, TARGET_H / source.height);
  const w = Math.round(source.width * ratio);
  const h = Math.round(source.height * ratio);
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  out.getContext('2d')!.drawImage(source, 0, 0, w, h);
  return out.toDataURL('image/webp', WEBP_QUALITY).split(',')[1];
}

interface Props {
  onCapture: (imageBase64: string) => void;
  onCancel: () => void;
}

export default function LabelCapture({ onCapture, onCancel }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 960 },
          },
        });
        if (!mounted) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => { if (mounted) setReady(true); };
        }
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : 'Camera access failed');
      }
    }

    startCamera();
    return () => {
      mounted = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  const capture = async () => {
    const video = videoRef.current;
    if (!video || !ready || processing) return;
    setProcessing(true);

    const raw = document.createElement('canvas');
    raw.width = video.videoWidth;
    raw.height = video.videoHeight;
    const ctx = raw.getContext('2d');
    if (!ctx) { setProcessing(false); return; }

    // Browser applies EXIF orientation when drawing from <video>
    ctx.drawImage(video, 0, 0);

    try {
      const base64 = await processLabelImage(raw);
      onCapture(base64);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="relative rounded-lg overflow-hidden bg-black aspect-video w-full max-w-md mx-auto">
        <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted playsInline />

        {!ready && !error && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/70 text-white">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="text-sm">Starting camera…</span>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-red-300 text-sm px-6 text-center">
            {error}
          </div>
        )}

        {ready && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            {/* Portrait guide frame with TOP/BOTTOM orientation markers */}
            <div className="relative w-2/5 h-4/5">
              {/* TOP label */}
              <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-center">
                <span className="text-white text-[9px] font-bold tracking-widest uppercase bg-black/50 px-1.5 py-0.5 rounded">
                  TOP
                </span>
                <div className="w-px h-2 bg-white/60 mx-auto mt-0.5" />
              </div>
              {/* Guide box */}
              <div className="w-full h-full border-2 border-white/70 rounded-md" />
              {/* BOTTOM label */}
              <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-center">
                <div className="w-px h-2 bg-white/60 mx-auto mb-0.5" />
                <span className="text-white text-[9px] font-bold tracking-widest uppercase bg-black/50 px-1.5 py-0.5 rounded">
                  BTM
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Hold label upright · align within the frame · TOP and BTM mark the correct orientation
      </p>

      <div className="flex justify-center gap-3">
        <button
          onClick={capture}
          disabled={!ready || processing}
          className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-white text-black text-sm font-semibold shadow-md disabled:opacity-40 hover:bg-gray-100 transition-colors"
        >
          {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
          {processing ? 'Processing…' : 'Capture'}
        </button>
        <button
          onClick={onCancel}
          disabled={processing}
          className="flex items-center gap-2 px-4 py-2.5 rounded-full border text-sm hover:bg-accent transition-colors disabled:opacity-40"
        >
          <X className="h-4 w-4" />
          Cancel
        </button>
      </div>
    </div>
  );
}
