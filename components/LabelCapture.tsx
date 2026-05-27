'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, Loader2, X } from 'lucide-react';

interface Props {
  onCapture: (imageBase64: string) => void;
  onCancel: () => void;
}

export default function LabelCapture({ onCapture, onCancel }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const capture = () => {
    const video = videoRef.current;
    if (!video || !ready) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);

    // Strip the data URL prefix — API only wants the base64 payload
    const base64 = canvas.toDataURL('image/jpeg', 0.88).split(',')[1];
    onCapture(base64);
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
            {/* Label guide frame */}
            <div className="w-4/5 h-3/5 border-2 border-white/70 rounded-md" />
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Align the wine label within the frame, then tap Capture
      </p>

      <div className="flex justify-center gap-3">
        <button
          onClick={capture}
          disabled={!ready}
          className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-white text-black text-sm font-semibold shadow-md disabled:opacity-40 hover:bg-gray-100 transition-colors"
        >
          <Camera className="h-4 w-4" />
          Capture
        </button>
        <button
          onClick={onCancel}
          className="flex items-center gap-2 px-4 py-2.5 rounded-full border text-sm hover:bg-accent transition-colors"
        >
          <X className="h-4 w-4" />
          Cancel
        </button>
      </div>
    </div>
  );
}
