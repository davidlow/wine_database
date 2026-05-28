'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Wine, Layers, X, Check, ChevronDown, ChevronRight } from 'lucide-react';
import { useProfile } from '@/hooks/useProfile';
import { cn } from '@/lib/utils';
import type { Profile } from '@/types';

interface Props {
  mode: 'wines' | 'cellars';
  onClose: () => void;
}

export default function ProfilePickerModal({ mode, onClose }: Props) {
  const router = useRouter();
  const { profiles } = useProfile();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const toggleProfile = (id: string) => {
    if (mode === 'cellars') {
      router.push(`/profiles/${id}`);
      onClose();
      return;
    }
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleGroup = (g: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(g)) next.delete(g); else next.add(g);
      return next;
    });
  };

  const handleBrowseWines = () => {
    const ids = [...selected].join(',');
    router.push(ids ? `/wines?profile_ids=${ids}` : '/wines');
    onClose();
  };

  const handleBrowseAll = () => {
    router.push('/wines');
    onClose();
  };

  // Group profiles
  const grouped = profiles.reduce<Record<string, Profile[]>>((acc, p) => {
    const g = p.group_name ?? '';
    if (!acc[g]) acc[g] = [];
    acc[g].push(p);
    return acc;
  }, {});
  const groupKeys = ['', ...Object.keys(grouped).filter(g => g !== '').sort()].filter(g => grouped[g]?.length > 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/50" />

      <div
        className="relative w-full sm:max-w-sm bg-card rounded-t-2xl sm:rounded-xl shadow-xl border overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Handle (mobile) */}
        <div className="sm:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>

        <div className="px-5 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              {mode === 'wines'
                ? <Wine className="h-5 w-5 text-primary" />
                : <Layers className="h-5 w-5 text-primary" />
              }
              <h3 className="font-semibold text-base">
                {mode === 'wines' ? 'Browse Wines by Cellar' : 'Select a Cellar'}
              </h3>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {mode === 'wines' && (
            <p className="text-xs text-muted-foreground mb-3">
              Select which cellars to show wines from, or browse the full catalog.
            </p>
          )}

          {profiles.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No cellars yet. Create one first.
            </p>
          ) : (
            <div className="space-y-1 max-h-72 overflow-y-auto">
              {groupKeys.map((groupKey) => {
                const items = grouped[groupKey] ?? [];
                const hasGroupName = groupKey !== '';
                const isCollapsed = collapsedGroups.has(groupKey);

                return (
                  <div key={groupKey}>
                    {hasGroupName && (
                      <button
                        type="button"
                        onClick={() => toggleGroup(groupKey)}
                        className="flex items-center gap-1.5 w-full text-left px-1 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {isCollapsed
                          ? <ChevronRight className="h-3.5 w-3.5" />
                          : <ChevronDown className="h-3.5 w-3.5" />
                        }
                        {groupKey}
                        <span className="font-normal normal-case tracking-normal">({items.length})</span>
                      </button>
                    )}
                    {!isCollapsed && items.map((p: Profile) => {
                      const isSelected = selected.has(p.id);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => toggleProfile(p.id)}
                          className={cn(
                            'w-full flex items-center justify-between px-4 py-3 rounded-lg border text-left transition-colors',
                            hasGroupName && 'ml-4 w-[calc(100%-1rem)]',
                            mode === 'cellars'
                              ? 'hover:bg-primary hover:text-primary-foreground hover:border-primary'
                              : isSelected
                                ? 'bg-primary/10 border-primary text-primary'
                                : 'hover:bg-accent border-transparent'
                          )}
                        >
                          <div className="min-w-0">
                            <p className="font-medium text-sm">{p.name}</p>
                            {p.description && (
                              <p className={cn('text-xs truncate', isSelected ? 'text-primary/70' : 'text-muted-foreground')}>
                                {p.description}
                              </p>
                            )}
                          </div>
                          {mode === 'wines' && isSelected && (
                            <Check className="h-4 w-4 shrink-0 ml-2 text-primary" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}

          {mode === 'wines' && (
            <div className="mt-4 flex flex-col gap-2 border-t pt-4">
              <button
                type="button"
                onClick={handleBrowseWines}
                disabled={selected.size === 0}
                className="w-full py-2.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-40 transition-colors"
              >
                {selected.size > 0
                  ? `Browse wines from ${selected.size} cellar${selected.size !== 1 ? 's' : ''}`
                  : 'Select a cellar above'}
              </button>
              <button
                type="button"
                onClick={handleBrowseAll}
                className="w-full py-2 rounded-md border text-sm hover:bg-accent transition-colors"
              >
                Browse full catalog
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
