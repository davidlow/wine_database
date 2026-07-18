'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, Loader2, X, RotateCw } from 'lucide-react';
import { useCameraRotation } from '@/hooks/useCameraRotation';

export interface ReceiptCaptureResult {
  imageBase64: string;
  mimeType: string;
}

interface Props {
  onCapture: (result: ReceiptCaptureResult) => void;
  onCancel: () => void;
}

export default function ReceiptCapture({ onCapture, onCancel }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
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
            width: { ideal: 1920 },
            height: { ideal: 1080 },
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

    try {
      const nativeW = video.videoWidth;
      const nativeH = video.videoHeight;
      const swap = rotation === 90 || rotation === 270;

      const canvas = document.createElement('canvas');
      canvas.width = swap ? nativeH : nativeW;
      canvas.height = swap ? nativeW : nativeH;
      const ctx = canvas.getContext('2d')!;

      if (rotation !== 0) {
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.drawImage(video, -nativeW / 2, -nativeH / 2, nativeW, nativeH);
      } else {
        ctx.drawImage(video, 0, 0, nativeW, nativeH);
      }

      const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
      onCapture({ imageBase64: dataUrl.split(',')[1], mimeType: 'image/jpeg' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Capture failed');
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="relative rounded-lg overflow-hidden bg-black aspect-video w-full">
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
          <div className="absolute inset-x-0 bottom-3 flex justify-center pointer-events-none">
            <span className="text-white text-xs bg-black/50 px-2.5 py-1 rounded-full">
              Place document flat · avoid glare
            </span>
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground text-center">
        {rotation !== 0
          ? `Camera rotated ${rotation}° · tap the rotate button to adjust`
          : 'Tap Capture when the document fills the frame'}
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
