'use client';

import { useEffect } from 'react';
import { Camera, CameraOff, Loader2 } from 'lucide-react';
import { useBarcode } from '@/hooks/useBarcode';

interface Props {
  onDetected: (barcode: string) => void;
  autoStart?: boolean;
}

export default function BarcodeScanner({ onDetected, autoStart = false }: Props) {
  const { videoRef, status, error, start, stop } = useBarcode(onDetected);

  useEffect(() => {
    if (autoStart) start();
    return () => stop();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-3">
      <div className="relative rounded-lg overflow-hidden bg-black aspect-video w-full max-w-md mx-auto">
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          autoPlay
          muted
          playsInline
        />
        {status !== 'scanning' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/60 text-white">
            {status === 'starting' && (
              <>
                <Loader2 className="h-8 w-8 animate-spin" />
                <p className="text-sm">Starting camera…</p>
              </>
            )}
            {status === 'idle' && (
              <>
                <CameraOff className="h-8 w-8 opacity-60" />
                <p className="text-sm opacity-80">Camera inactive</p>
              </>
            )}
            {status === 'error' && (
              <>
                <CameraOff className="h-8 w-8 text-red-400" />
                <p className="text-sm text-red-300">{error ?? 'Camera error'}</p>
              </>
            )}
          </div>
        )}
        {status === 'scanning' && (
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3/4 h-24 border-2 border-green-400 rounded-sm opacity-80" />
            <p className="absolute bottom-3 left-0 right-0 text-center text-xs text-green-300">
              Align barcode in the frame
            </p>
          </div>
        )}
      </div>

      <div className="flex justify-center gap-3">
        {status === 'idle' || status === 'error' ? (
          <button
            onClick={start}
            className="flex items-center gap-2 px-5 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Camera className="h-4 w-4" />
            Start Scanner
          </button>
        ) : (
          <button
            onClick={stop}
            className="flex items-center gap-2 px-5 py-2 rounded-md border text-sm font-medium hover:bg-accent transition-colors"
          >
            <CameraOff className="h-4 w-4" />
            Stop Scanner
          </button>
        )}
      </div>
    </div>
  );
}
