'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, Loader2, X, RotateCw } from 'lucide-react';
import { useCameraRotation } from '@/hooks/useCameraRotation';

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
  gemini: string;    // 400×600 @ 0.7 — sent to the label-scan API
  thumbnail: string; // 150×225 @ 0.35 — stored in the database
}

interface Props {
  onCapture: (result: LabelCaptureResult) => void;
  onCancel: () => void;
}

export default function LabelCapture({ onCapture, onCancel }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const guideRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const { rotation, rotateNext, videoStyle } = useCameraRotation();

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

    const nativeW = video.videoWidth;
    const nativeH = video.videoHeight;
    let raw: HTMLCanvasElement;

    if (rotation === 0) {
      // Use guide-box crop for precise label extraction
      const guide = guideRef.current;
      if (!guide) { setProcessing(false); return; }

      const containerRect = video.getBoundingClientRect();
      const guideRect = guide.getBoundingClientRect();
      const displayW = containerRect.width;
      const displayH = containerRect.height;
      const scale = Math.max(displayW / nativeW, displayH / nativeH);
      const videoOffsetX = (displayW - nativeW * scale) / 2;
      const videoOffsetY = (displayH - nativeH * scale) / 2;
      const guideLeft = guideRect.left - containerRect.left;
      const guideTop = guideRect.top - containerRect.top;
      const guideW = guideRect.width;
      const guideH = guideRect.height;
      const srcX = Math.max(0, (guideLeft - videoOffsetX) / scale);
      const srcY = Math.max(0, (guideTop - videoOffsetY) / scale);
      const srcW = Math.min(nativeW - srcX, guideW / scale);
      const srcH = Math.min(nativeH - srcY, guideH / scale);

      raw = document.createElement('canvas');
      raw.width = Math.round(srcW);
      raw.height = Math.round(srcH);
      const ctx = raw.getContext('2d');
      if (!ctx) { setProcessing(false); return; }
      ctx.drawImage(video, srcX, srcY, srcW, srcH, 0, 0, raw.width, raw.height);
    } else {
      // Rotate the full frame so Gemini receives a correctly-oriented image
      const swap = rotation === 90 || rotation === 270;
      raw = document.createElement('canvas');
      raw.width = swap ? nativeH : nativeW;
      raw.height = swap ? nativeW : nativeH;
      const ctx = raw.getContext('2d');
      if (!ctx) { setProcessing(false); return; }
      ctx.translate(raw.width / 2, raw.height / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.drawImage(video, -nativeW / 2, -nativeH / 2, nativeW, nativeH);
    }

    try {
      const [gemini, thumbnail] = await Promise.all([
        resizeToWebP(raw, 400, 600, 0.7),
        resizeToWebP(raw, 150, 225, 0.35),
      ]);
      onCapture({ gemini, thumbnail });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="relative rounded-lg overflow-hidden bg-black aspect-video w-full max-w-md mx-auto">
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          style={videoStyle}
          autoPlay
          muted
          playsInline
        />

        {/* Rotate button */}
        {ready && (
          <button
            onClick={rotateNext}
            className="absolute top-2 right-2 z-10 bg-black/50 text-white rounded-full p-1.5 hover:bg-black/70 transition-colors"
            title={`Rotate camera (currently ${rotation}°)`}
          >
            <RotateCw className="h-4 w-4" />
          </button>
        )}

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
            <div ref={guideRef} className="relative w-1/2 h-[88%]">
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
        {rotation === 0
          ? 'Hold label upright · align within the frame · TOP and BTM mark the correct orientation'
          : `Camera rotated ${rotation}° · tap the rotate button to adjust if the preview looks wrong`}
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
