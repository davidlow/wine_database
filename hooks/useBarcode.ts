'use client';

import { useRef, useState, useCallback } from 'react';

export type BarcodeStatus = 'idle' | 'starting' | 'scanning' | 'error';

// ZXing fires the callback on every decoded video frame — without a cooldown
// you get dozens of API calls per second for the same barcode. We deduplicate
// by ignoring repeats of the same code within COOLDOWN_MS.
const COOLDOWN_MS = 2500;

export function useBarcode(onDetected: (barcode: string) => void) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<{ stop(): void } | null>(null);
  const lastDetectionRef = useRef<{ code: string; time: number } | null>(null);
  // Always call the latest onDetected even though the ZXing closure is created once.
  const onDetectedRef = useRef(onDetected);
  onDetectedRef.current = onDetected;

  const [status, setStatus] = useState<BarcodeStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const start = useCallback(async () => {
    if (!videoRef.current) return;
    setStatus('starting');
    setError(null);
    lastDetectionRef.current = null;

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
          if (!result) return;
          const code = result.getText();
          const now = Date.now();
          const last = lastDetectionRef.current;
          if (last?.code === code && now - last.time < COOLDOWN_MS) return;
          lastDetectionRef.current = { code, time: now };
          onDetectedRef.current(code);
        }
      );

      controlsRef.current = controls;
      setStatus('scanning');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Camera access failed');
      setStatus('error');
    }
  }, []); // stable — onDetected changes go through onDetectedRef

  const stop = useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    lastDetectionRef.current = null;
    setStatus('idle');
  }, []);

  return { videoRef, status, error, start, stop };
}
