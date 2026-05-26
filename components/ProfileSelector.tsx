'use client';

import { ChevronDown, Plus, Check, Layers } from 'lucide-react';
import { useState } from 'react';
import Link from 'next/link';
import { useProfile } from '@/hooks/useProfile';
import { cn } from '@/lib/utils';

interface Props {
  compact?: boolean;
}

export default function ProfileSelector({ compact = false }: Props) {
  const { profiles, activeProfile, setActiveProfile, loading } = useProfile();
  const [open, setOpen] = useState(false);

  if (loading) {
    return (
      <div className={cn('flex items-center gap-2 text-muted-foreground', compact ? 'text-xs' : 'text-sm')}>
        <Layers className="h-4 w-4 animate-pulse" />
        {!compact && <span>Loading…</span>}
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex items-center gap-2 rounded-md hover:bg-accent transition-colors w-full',
          compact ? 'p-1' : 'px-3 py-2 text-sm font-medium'
        )}
      >
        <Layers className="h-4 w-4 shrink-0 text-muted-foreground" />
        {!compact && (
          <span className="flex-1 text-left truncate">
            {activeProfile?.name ?? 'No profile'}
          </span>
        )}
        <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full mb-1 left-0 z-20 min-w-[180px] rounded-md border bg-popover shadow-md py-1">
            <p className="px-3 py-1 text-xs text-muted-foreground font-medium uppercase tracking-wide">
              Profiles
            </p>
            {profiles.map((p) => (
              <button
                key={p.id}
                onClick={() => { setActiveProfile(p); setOpen(false); }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent transition-colors text-left"
              >
                <Check className={cn('h-3 w-3', activeProfile?.id === p.id ? 'opacity-100' : 'opacity-0')} />
                <span className="truncate">{p.name}</span>
              </button>
            ))}
            <div className="border-t my-1" />
            <Link
              href="/profiles"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors text-muted-foreground"
            >
              <Plus className="h-3 w-3" />
              Manage profiles
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
