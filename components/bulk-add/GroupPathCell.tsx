'use client';

import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { getPathSuggestions } from '@/lib/location-utils';
import type { LocationGroup } from '@/types';

interface GroupPathCellProps {
  value: string;
  groups: LocationGroup[];
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}

export default function GroupPathCell({
  value, groups, onChange, disabled, className, placeholder,
}: GroupPathCellProps) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (disabled) { setOpen(false); return; }
    const sugg = getPathSuggestions(value, groups);
    setSuggestions(sugg);
    setActiveIdx(-1);
  }, [value, groups, disabled]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const select = (s: string) => {
    onChange(s);
    setOpen(false);
    setActiveIdx(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open && suggestions.length > 0) { setOpen(true); setActiveIdx(0); return; }
      setActiveIdx(i => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx(i => Math.max(i - 1, -1));
    } else if (e.key === 'Enter' && open && activeIdx >= 0) {
      e.preventDefault();
      select(suggestions[activeIdx]);
    } else if (e.key === 'Escape') {
      setOpen(false);
      setActiveIdx(-1);
    }
  };

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <input
        type="text"
        value={value}
        disabled={disabled}
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => { if (suggestions.length > 0) setOpen(true); }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder ?? 'Group/Subgroup'}
        autoComplete="off"
        className={cn(
          'w-full border rounded px-1.5 py-0.5 text-xs bg-background focus:outline-none focus:ring-1 focus:ring-ring',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      />
      {open && !disabled && suggestions.length > 0 && (
        <ul className="absolute z-30 left-0 mt-1 min-w-[220px] max-h-48 overflow-y-auto rounded-md border bg-popover shadow-lg text-xs py-1">
          {suggestions.map((s, i) => (
            <li
              key={s}
              onMouseDown={e => { e.preventDefault(); select(s); }}
              className={cn(
                'px-3 py-1.5 cursor-pointer whitespace-nowrap',
                i === activeIdx
                  ? 'bg-accent text-accent-foreground'
                  : 'hover:bg-accent hover:text-accent-foreground'
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
