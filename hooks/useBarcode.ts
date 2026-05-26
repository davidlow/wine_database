'use client';

import { useRef, useState, useCallback } from 'react';

export type BarcodeStatus = 'idle' | 'starting' | 'scanning' | 'error';

export function useBarcode(onDetected: (barcode: string) => void) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<{ stop(): void } | null>(null);
  const [status, setStatus] = useState<BarcodeStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const start = useCallback(async () => {
    if (!videoRef.current) return;
    setStatus('starting');
    setError(null);

    try {
      const { BrowserMultiFormatReader } = await import('@zxing/browser');
      const reader = new BrowserMultiFormatReader();

      const devices = await BrowserMultiFormatReader.listVideoInputDevices();
      const deviceId = devices.find((d) =>
        d.label.toLowerCase().includes('back') ||
        d.label.toLowerCase().includes('rear')
      )?.deviceId ?? devices[0]?.deviceId;

      const controls = await reader.decodeFromVideoDevice(
        deviceId,
        videoRef.current,
        (result) => {
          if (result) {
            onDetected(result.getText());
          }
        }
      );

      controlsRef.current = controls;
      setStatus('scanning');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Camera access failed');
      setStatus('error');
    }
  }, [onDetected]);

  const stop = useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setStatus('idle');
  }, []);

  return { videoRef, status, error, start, stop };
}
