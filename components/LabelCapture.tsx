'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, Loader2, X } from 'lucide-react';

async function resizeToWebP(source: HTMLCanvasElement, maxW: number, maxH: number, quality: number): Promise<string> {
  const ratio = Math.min(maxW / source.width, maxH / source.height);
  const w = Math.round(source.width * ratio);
  const h = Math.round(source.height * ratio);
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  out.getContext('2d')!.drawImage(source, 0, 0, w, h);
  return out.toDataURL('image/webp', quality).split(',')[1];
}

export interface LabelCaptureResult {
  gemini: string;       // front label, 400×600 @ 0.7 — sent to the label-scan API
  backGemini?: string;  // back label, 400×600 @ 0.7 — sent alongside front for better ID
  thumbnail: string;    // front label, 150×225 @ 0.35 — stored in the database
}

interface Props {
  onCapture: (result: LabelCaptureResult) => void;
  onCancel: () => void;
}

type Phase = 'front' | 'back';

export default function LabelCapture({ onCapture, onCancel }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const guideRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [phase, setPhase] = useState<Phase>('front');
  const [frontData, setFrontData] = useState<{ gemini: string; thumbnail: string } | null>(null);

  useEffect(() => {
    let mounted = true;

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 960 },
            height: { ideal: 1280 },
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

  const captureFrame = async (): Promise<{ gemini: string; thumbnail: string } | null> => {
    const video = videoRef.current;
    if (!video || !ready || processing) return null;

    const nativeW = video.videoWidth;
    const nativeH = video.videoHeight;

    const guide = guideRef.current;
    if (!guide) return null;

    const containerRect = video.getBoundingClientRect();
    const guideRect = guide.getBoundingClientRect();
    const displayW = containerRect.width;
    const displayH = containerRect.height;
    const scale = Math.max(displayW / nativeW, displayH / nativeH);
    const videoOffsetX = (displayW - nativeW * scale) / 2;
    const videoOffsetY = (displayH - nativeH * scale) / 2;
    const srcX = Math.max(0, (guideRect.left - containerRect.left - videoOffsetX) / scale);
    const srcY = Math.max(0, (guideRect.top - containerRect.top - videoOffsetY) / scale);
    const srcW = Math.min(nativeW - srcX, guideRect.width / scale);
    const srcH = Math.min(nativeH - srcY, guideRect.height / scale);

    const raw = document.createElement('canvas');
    raw.width = Math.round(srcW);
    raw.height = Math.round(srcH);
    const ctx = raw.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, srcX, srcY, srcW, srcH, 0, 0, raw.width, raw.height);

    const [gemini, thumbnail] = await Promise.all([
      resizeToWebP(raw, 400, 600, 0.7),
      resizeToWebP(raw, 150, 225, 0.35),
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
    } finally {
      setProcessing(false);
    }
  };

  const handleCaptureBack = async () => {
    if (!frontData) return;
    setProcessing(true);
    try {
      const data = await captureFrame();
      if (!data) return;
      onCapture({ gemini: frontData.gemini, backGemini: data.gemini, thumbnail: frontData.thumbnail });
    } finally {
      setProcessing(false);
    }
  };

  const handleSkipBack = () => {
    if (!frontData) return;
    onCapture({ gemini: frontData.gemini, thumbnail: frontData.thumbnail });
  };

  return (
    <div className="space-y-3">
      {/* Step indicator */}
      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <span className={phase === 'front' ? 'font-semibold text-foreground' : ''}>1. Front label</span>
        <span>→</span>
        <span className={phase === 'back' ? 'font-semibold text-foreground' : ''}>2. Back label</span>
      </div>

      {/* Portrait camera — tall and narrow for maximum vertical label coverage */}
      <div className="relative rounded-lg overflow-hidden bg-black aspect-[3/4] w-full max-w-sm mx-auto">
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          autoPlay
          muted
          playsInline
        />

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

        {/* Front thumbnail overlay in back phase */}
        {ready && phase === 'back' && frontData && (
          <div className="absolute top-2 left-2 z-10">
            <img
              src={`data:image/webp;base64,${frontData.thumbnail}`}
              alt="Front label captured"
              className="w-10 h-14 object-cover rounded border-2 border-green-400 shadow"
            />
            <span className="block text-center text-[9px] text-green-300 mt-0.5">Front ✓</span>
          </div>
        )}

        {ready && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div ref={guideRef} className="relative w-[80%] h-[85%]">
              <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-center">
                <span className="text-white text-[9px] font-bold tracking-widest uppercase bg-black/50 px-1.5 py-0.5 rounded">
                  TOP
                </span>
                <div className="w-px h-2 bg-white/60 mx-auto mt-0.5" />
              </div>
              <div className="w-full h-full border-2 border-white/80 rounded-md" />
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
        {phase === 'front'
          ? 'Hold front label upright · align within frame · TOP and BTM mark correct orientation'
          : 'Flip bottle · align back label upright · or skip if no back label'}
      </p>

      <div className="flex justify-center gap-3">
        {phase === 'front' ? (
          <>
            <button
              onClick={handleCaptureFront}
              disabled={!ready || processing}
              className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-white text-black text-sm font-semibold shadow-md disabled:opacity-40 hover:bg-gray-100 transition-colors"
            >
              {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
              {processing ? 'Processing…' : 'Capture Front'}
            </button>
            <button
              onClick={onCancel}
              disabled={processing}
              className="flex items-center gap-2 px-4 py-2.5 rounded-full border text-sm hover:bg-accent transition-colors disabled:opacity-40"
            >
              <X className="h-4 w-4" />
              Cancel
            </button>
          </>
        ) : (
          <>
            <button
              onClick={handleCaptureBack}
              disabled={!ready || processing}
              className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-white text-black text-sm font-semibold shadow-md disabled:opacity-40 hover:bg-gray-100 transition-colors"
            >
              {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
              {processing ? 'Processing…' : 'Capture Back'}
            </button>
            <button
              onClick={handleSkipBack}
              disabled={processing}
              className="px-4 py-2.5 rounded-full border text-sm hover:bg-accent transition-colors disabled:opacity-40"
            >
              Skip Back
            </button>
          </>
        )}
      </div>
    </div>
  );
}
