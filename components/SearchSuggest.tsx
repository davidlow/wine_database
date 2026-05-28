'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface Props {
  field: 'variety' | 'country' | 'region' | 'producer' | 'appellation';
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
}

export default function SearchSuggest({ field, value, onChange, placeholder, className, inputClassName }: Props) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchSuggestions = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) { setSuggestions([]); setOpen(false); return; }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/wines/facets?field=${field}&q=${encodeURIComponent(q)}`);
        if (!res.ok) return;
        const data: string[] = await res.json();
        setSuggestions(data);
        setOpen(data.length > 0);
        setActiveIdx(-1);
      } catch {
        // ignore
      }
    }, 200);
  }, [field]);

  useEffect(() => {
    fetchSuggestions(value);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [value, fetchSuggestions]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectSuggestion = (s: string) => {
    onChange(s);
    setOpen(false);
    setActiveIdx(-1);
    inputRef.current?.blur();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx(i => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx(i => Math.max(i - 1, -1));
    } else if (e.key === 'Enter' && activeIdx >= 0) {
      e.preventDefault();
      selectSuggestion(suggestions[activeIdx]);
    } else if (e.key === 'Escape') {
      setOpen(false);
      setActiveIdx(-1);
    }
  };

  const defaultInputCls = 'w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring';

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => { if (suggestions.length > 0) setOpen(true); }}
        placeholder={placeholder}
        className={inputClassName ?? defaultInputCls}
        autoComplete="off"
      />
      {open && suggestions.length > 0 && (
        <ul className="absolute z-20 left-0 right-0 mt-1 max-h-52 overflow-y-auto rounded-md border bg-popover shadow-md text-sm">
          {suggestions.map((s, i) => (
            <li
              key={s}
              onMouseDown={(e) => { e.preventDefault(); selectSuggestion(s); }}
              className={cn(
                'px-3 py-2 cursor-pointer',
                i === activeIdx ? 'bg-accent text-accent-foreground' : 'hover:bg-accent hover:text-accent-foreground'
              )}
            >
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
