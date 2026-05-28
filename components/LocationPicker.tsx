'use client';

import { useEffect, useRef, useState } from 'react';
import { MapPin, Plus, X, Loader2 } from 'lucide-react';
import type { Location } from '@/types';
import { cn } from '@/lib/utils';

interface Props {
  profileId: string;
  value: string;             // '' = unlocated
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  allowUnlocated?: boolean;
}

export default function LocationPicker({ profileId, value, onChange, placeholder = 'Search or enter location…', className, allowUnlocated = true }: Props) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newCapacity, setNewCapacity] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep query in sync when value changes externally
  useEffect(() => { setQuery(value); }, [value]);

  useEffect(() => {
    if (!profileId) return;
    setLoading(true);
    fetch(`/api/locations?profile_id=${profileId}`)
      .then(r => r.ok ? r.json() : [])
      .then((data: Location[]) => setLocations(data))
      .finally(() => setLoading(false));
  }, [profileId]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setCreating(false);
        // Revert query to committed value if user didn't pick anything
        setQuery(value);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [value]);

  const filtered = locations.filter(l =>
    !query || l.name.toLowerCase().includes(query.toLowerCase())
  );
  const queryIsNew = query.trim() !== '' && !locations.some(l => l.name.toLowerCase() === query.trim().toLowerCase());

  const select = (name: string) => {
    onChange(name);
    setQuery(name);
    setOpen(false);
    setCreating(false);
  };

  const handleCreateLocation = async () => {
    if (!query.trim()) return;
    setCreateLoading(true);
    try {
      const res = await fetch('/api/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile_id: profileId,
          name: query.trim(),
          max_capacity: newCapacity ? parseInt(newCapacity, 10) : undefined,
        }),
      });
      if (!res.ok) throw new Error('Failed to create location');
      const loc: Location = await res.json();
      setLocations(prev => [...prev, loc].sort((a, b) => a.name.localeCompare(b.name)));
      select(loc.name);
      setNewCapacity('');
    } catch {
      // Still select the name even if creation failed (free-text fallback)
      select(query.trim());
    } finally {
      setCreateLoading(false);
    }
  };

  const capacityLabel = (loc: Location) => {
    if (loc.max_capacity == null) return null;
    const used = loc.current_quantity ?? 0;
    const avail = loc.available_capacity ?? (loc.max_capacity - used);
    const pct = Math.round((used / loc.max_capacity) * 100);
    return (
      <span className={cn('text-xs shrink-0', avail === 0 ? 'text-red-500' : avail <= 2 ? 'text-amber-600' : 'text-muted-foreground')}>
        {used}/{loc.max_capacity} ({avail} free)
        <span className="inline-block ml-1 align-middle">
          <span className="inline-flex h-1.5 w-12 rounded-full bg-muted overflow-hidden">
            <span className={cn('h-full rounded-full', avail === 0 ? 'bg-red-400' : avail <= 2 ? 'bg-amber-400' : 'bg-green-400')} style={{ width: `${pct}%` }} />
          </span>
        </span>
      </span>
    );
  };

  const inputCls = 'w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring';

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <input
          ref={inputRef}
          className={cn(inputCls, 'pl-8 pr-7')}
          value={query}
          placeholder={loading ? 'Loading…' : placeholder}
          onFocus={() => setOpen(true)}
          onChange={e => { setQuery(e.target.value); setOpen(true); setCreating(false); }}
        />
        {query && (
          <button
            type="button"
            onClick={() => { onChange(''); setQuery(''); inputRef.current?.focus(); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute z-50 w-full mt-1 rounded-md border bg-popover shadow-md max-h-64 overflow-y-auto">
          {/* Unlocated option */}
          {allowUnlocated && (
            <button
              type="button"
              onClick={() => select('')}
              className={cn('w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors flex items-center gap-2',
                value === '' && 'bg-accent/60'
              )}
            >
              <span className="text-muted-foreground">No location (unlocated)</span>
            </button>
          )}

          {/* Existing locations */}
          {filtered.map(loc => (
            <button
              key={loc.id}
              type="button"
              onClick={() => select(loc.name)}
              className={cn('w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors flex items-center justify-between gap-2',
                value === loc.name && 'bg-accent/60'
              )}
            >
              <span className="truncate">{loc.name}</span>
              {capacityLabel(loc)}
            </button>
          ))}

          {/* Create new location */}
          {queryIsNew && !creating && (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors flex items-center gap-2 text-primary border-t"
            >
              <Plus className="h-3.5 w-3.5" />
              Add &ldquo;{query.trim()}&rdquo; as new location
            </button>
          )}

          {/* Inline create form */}
          {queryIsNew && creating && (
            <div className="px-3 py-2 border-t space-y-2">
              <p className="text-xs text-muted-foreground font-medium">New location: <strong>{query.trim()}</strong></p>
              <div className="flex gap-2">
                <input
                  type="number"
                  className="flex-1 px-2 py-1.5 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Max capacity (optional)"
                  value={newCapacity}
                  onChange={e => setNewCapacity(e.target.value)}
                  min={1}
                />
                <button
                  type="button"
                  onClick={handleCreateLocation}
                  disabled={createLoading}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs hover:bg-primary/90 disabled:opacity-50"
                >
                  {createLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                  Create
                </button>
              </div>
              <button type="button" onClick={() => { select(query.trim()); }} className="text-xs text-muted-foreground hover:text-foreground">
                Use without saving →
              </button>
            </div>
          )}

          {filtered.length === 0 && !queryIsNew && (
            <p className="px-3 py-2 text-sm text-muted-foreground">No locations yet. Type a name to create one.</p>
          )}
        </div>
      )}
    </div>
  );
}
