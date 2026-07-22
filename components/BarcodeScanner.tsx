'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, Loader2, ScanLine } from 'lucide-react';

interface Props {
  onDetected: (barcode: string) => void;
  autoStart?: boolean;
}

type ScanState = 'idle' | 'starting' | 'ready' | 'decoding' | 'notfound' | 'error';

export default function BarcodeScanner({ onDetected, autoStart = false }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const readerRef = useRef<{ decodeFromCanvas(c: HTMLCanvasElement): { getText(): string } } | null>(null);
  const [scanState, setScanState] = useState<ScanState>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const startCamera = async () => {
    setScanState('starting');
    setErrorMsg(null);
    try {
      const [stream, zxing] = await Promise.all([
        navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        }),
        import('@zxing/browser').then(async ({ BrowserMultiFormatReader, BarcodeFormat }) => {
          const { DecodeHintType } = await import('@zxing/library');
          const hints = new Map();
          hints.set(DecodeHintType.POSSIBLE_FORMATS, [
            BarcodeFormat.EAN_13,
            BarcodeFormat.UPC_A,
            BarcodeFormat.EAN_8,
          ]);
          return new BrowserMultiFormatReader(hints);
        }),
      ]);
      streamRef.current = stream;
      readerRef.current = zxing;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => setScanState('ready');
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Camera access failed');
      setScanState('error');
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    readerRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setScanState('idle');
  };

  const capture = () => {
    const video = videoRef.current;
    const reader = readerRef.current;
    if (!video || !reader || scanState !== 'ready') return;
    setScanState('decoding');

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')!.drawImage(video, 0, 0);

    try {
      const result = reader.decodeFromCanvas(canvas);
      onDetected(result.getText());
    } catch {
      setScanState('notfound');
    }
  };

  useEffect(() => {
    if (autoStart) startCamera();
    return () => stopCamera();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reset "not found" feedback after 1.5 s so user can try again
  useEffect(() => {
    if (scanState !== 'notfound') return;
    const t = setTimeout(() => setScanState('ready'), 1500);
    return () => clearTimeout(t);
  }, [scanState]);

  const isActive = scanState === 'ready' || scanState === 'decoding' || scanState === 'notfound';

  return (
    <div className="space-y-3">
      <div className="relative rounded-lg overflow-hidden bg-black aspect-[4/3] w-full max-w-md mx-auto">
        <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted playsInline />

        {!isActive && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/60 text-white">
            {scanState === 'starting' && <><Loader2 className="h-8 w-8 animate-spin" /><p className="text-sm">Starting camera…</p></>}
            {scanState === 'idle' && <><CameraOff className="h-8 w-8 opacity-60" /><p className="text-sm opacity-80">Camera inactive</p></>}
            {scanState === 'error' && <><CameraOff className="h-8 w-8 text-red-400" /><p className="text-sm text-red-300">{errorMsg ?? 'Camera error'}</p></>}
          </div>
        )}

        {isActive && (
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
            <div className={`w-3/4 h-2/3 border-2 rounded-sm opacity-80 ${scanState === 'notfound' ? 'border-red-400' : 'border-green-400'}`} />
            <p className={`absolute bottom-3 left-0 right-0 text-center text-xs ${scanState === 'notfound' ? 'text-red-300' : 'text-green-300'}`}>
              {scanState === 'notfound' ? 'Barcode not detected — try again' : 'Align barcode in frame, then tap Capture'}
            </p>
          </div>
        )}

        {scanState === 'decoding' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 pointer-events-none">
            <Loader2 className="h-8 w-8 animate-spin text-white" />
          </div>
        )}
      </div>

      <div className="flex justify-center gap-3">
        {!isActive ? (
          <button
            onClick={startCamera}
            disabled={scanState === 'starting'}
            className="flex items-center gap-2 px-5 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-40 transition-colors"
          >
            <Camera className="h-4 w-4" />
            Start Scanner
          </button>
        ) : (
          <>
            <button
              onClick={capture}
              disabled={scanState !== 'ready'}
              className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-white text-black text-sm font-semibold shadow-md disabled:opacity-40 hover:bg-gray-100 transition-colors"
            >
              {scanState === 'decoding' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanLine className="h-4 w-4" />}
              {scanState === 'decoding' ? 'Scanning…' : 'Capture'}
            </button>
            <button
              onClick={stopCamera}
              className="flex items-center gap-2 px-4 py-2.5 rounded-full border text-sm hover:bg-accent transition-colors"
            >
              <CameraOff className="h-4 w-4" />
              Stop
            </button>
          </>
        )}
      </div>
    </div>
  );
}
