import { useState, useCallback } from 'react';

type Rotation = 0 | 90 | 180 | 270;

const LS_KEY = 'cameraRotation';
const CYCLE: Rotation[] = [0, 90, 180, 270];

export function useCameraRotation(storageKey = LS_KEY) {
  const [rotation, setRotation] = useState<Rotation>(() => {
    if (typeof window === 'undefined') return 0;
    try {
      const stored = localStorage.getItem(storageKey);
      const n = stored ? parseInt(stored, 10) : 0;
      return (CYCLE.includes(n as Rotation) ? n : 0) as Rotation;
    } catch {
      return 0;
    }
  });

  const rotateNext = useCallback(() => {
    setRotation(prev => {
      const next = CYCLE[(CYCLE.indexOf(prev) + 1) % CYCLE.length];
      try { localStorage.setItem(storageKey, String(next)); } catch { /* ignore */ }
      return next;
    });
  }, [storageKey]);

  // CSS transform to apply to the video element inside an aspect-video (16:9) container.
  // scale(16/9) compensates for the aspect flip so the rotated video still covers the container.
  const videoStyle: React.CSSProperties | undefined = rotation === 0
    ? undefined
    : rotation === 90 || rotation === 270
      ? { transform: `rotate(${rotation}deg) scale(1.7778)` }
      : { transform: `rotate(${rotation}deg)` };

  return { rotation, rotateNext, videoStyle };
}
