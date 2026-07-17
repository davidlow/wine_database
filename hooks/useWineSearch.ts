'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Wine, WineSearchParams } from '@/types';

export function useWineSearch(initialParams: WineSearchParams = {}) {
  const [params, setParams] = useState<WineSearchParams>(initialParams);
  const [wines, setWines] = useState<Wine[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const search = useCallback(async (searchParams: WineSearchParams) => { // eslint-disable-line react-hooks/exhaustive-deps
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      Object.entries(searchParams).forEach(([k, v]) => {
        if (v !== undefined && v !== '') query.set(k, String(v));
      });
      const res = await fetch(`/api/wines?${query}`);
      if (!res.ok) throw new Error('Search failed');
      const data: Wine[] = await res.json();
      setWines(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setWines([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(params), 300);
    return () => clearTimeout(debounceRef.current);
  }, [params, search]);

  const updateParam = useCallback(<K extends keyof WineSearchParams>(key: K, value: WineSearchParams[K]) => {
    setParams((prev) => ({ ...prev, [key]: value }));
  }, []);

  const clearParams = useCallback(() => setParams({}), []);

  return { wines, loading, error, params, updateParam, clearParams, refresh: () => search(params) };
}
