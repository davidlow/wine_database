'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, Edit2, Trash2, Loader2, ArrowRight, Check, X, ChevronDown, ChevronRight } from 'lucide-react';
import { useProfile } from '@/hooks/useProfile';
import { cn } from '@/lib/utils';
import type { Profile } from '@/types';

interface EditState {
  id: string;
  name: string;
  description: string;
  group_name: string;
}

export default function ProfilesPage() {
  const { profiles, refresh } = useProfile();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [groupName, setGroupName] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          group_name: groupName.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed');
      setName('');
      setDescription('');
      setGroupName('');
      setShowForm(false);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create cellar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/profiles/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete cellar');
    } finally {
      setDeleteId(null);
    }
  };

  const startEdit = (p: Profile) => {
    setEditState({
      id: p.id,
      name: p.name,
      description: p.description ?? '',
      group_name: p.group_name ?? '',
    });
    setError(null);
  };

  const cancelEdit = () => {
    setEditState(null);
    setError(null);
  };

  const handleSaveEdit = async () => {
    if (!editState || !editState.name.trim()) return;
    setEditSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/profiles/${editState.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editState.name.trim(),
          description: editState.description.trim() || undefined,
          group_name: editState.group_name.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed');
      setEditState(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update cellar');
    } finally {
      setEditSaving(false);
    }
  };

  const toggleGroup = (g: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(g)) next.delete(g); else next.add(g);
      return next;
    });
  };

  const inputCls = 'w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring';

  // Group profiles: keyed by group_name (empty string = ungrouped)
  const grouped = profiles.reduce<Record<string, Profile[]>>((acc, p) => {
    const g = p.group_name ?? '';
    if (!acc[g]) acc[g] = [];
    acc[g].push(p);
    return acc;
  }, {});

  // Render ungrouped first, then named groups alphabetically
  const groupKeys = [
    '',
    ...Object.keys(grouped).filter(g => g !== '').sort(),
  ].filter(g => grouped[g]?.length > 0);

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Cellars</h2>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Cellar
        </button>
      </div>

      <p className="text-sm text-muted-foreground">
        Each cellar has its own inventory and storage locations (e.g., Home, Vacation Home). Use groups to organise cellars (e.g., separate test cellars from real ones).
      </p>

      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleCreate} className="rounded-lg border bg-muted/30 p-4 space-y-3">
          <p className="text-sm font-medium">New Cellar</p>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Cellar Name *</label>
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Home, Vacation Home" required />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Description</label>
            <input className={inputCls} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Group</label>
            <input className={inputCls} value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="e.g. Testing, Production (optional)" />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Create
            </button>
            <button type="button" onClick={() => { setShowForm(false); setError(null); setName(''); setDescription(''); setGroupName(''); }} className="px-4 py-2 rounded-md border text-sm hover:bg-accent transition-colors">
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="space-y-4">
        {profiles.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No cellars yet. Create one above.</p>
        ) : (
          groupKeys.map((groupKey) => {
            const items = grouped[groupKey] ?? [];
            const isCollapsed = collapsedGroups.has(groupKey);
            const hasGroupName = groupKey !== '';
            return (
              <div key={groupKey}>
                {hasGroupName && (
                  <button
                    type="button"
                    onClick={() => toggleGroup(groupKey)}
                    className="flex items-center gap-2 w-full text-left mb-2"
                  >
                    {isCollapsed
                      ? <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      : <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    }
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{groupKey}</span>
                    <span className="text-xs text-muted-foreground">({items.length})</span>
                  </button>
                )}
                {!isCollapsed && (
                  <div className="space-y-2">
                    {items.map((p) => {
                      const isEditing = editState?.id === p.id;
                      return (
                        <div key={p.id} className={cn('rounded-lg border bg-card', isEditing && 'border-primary/40')}>
                          {isEditing ? (
                            <div className="p-4 space-y-3">
                              <p className="text-sm font-medium">Edit Cellar</p>
                              <div>
                                <label className="text-xs text-muted-foreground mb-1 block">Name *</label>
                                <input
                                  className={inputCls}
                                  value={editState.name}
                                  onChange={(e) => setEditState(s => s ? { ...s, name: e.target.value } : s)}
                                  required
                                  autoFocus
                                />
                              </div>
                              <div>
                                <label className="text-xs text-muted-foreground mb-1 block">Description</label>
                                <input
                                  className={inputCls}
                                  value={editState.description}
                                  onChange={(e) => setEditState(s => s ? { ...s, description: e.target.value } : s)}
                                  placeholder="Optional description"
                                />
                              </div>
                              <div>
                                <label className="text-xs text-muted-foreground mb-1 block">Group</label>
                                <input
                                  className={inputCls}
                                  value={editState.group_name}
                                  onChange={(e) => setEditState(s => s ? { ...s, group_name: e.target.value } : s)}
                                  placeholder="e.g. Testing, Production (optional)"
                                />
                              </div>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={handleSaveEdit}
                                  disabled={editSaving || !editState.name.trim()}
                                  className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors"
                                >
                                  {editSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                                  Save
                                </button>
                                <button
                                  type="button"
                                  onClick={cancelEdit}
                                  className="flex items-center gap-2 px-3 py-1.5 rounded-md border text-sm hover:bg-accent transition-colors"
                                >
                                  <X className="h-3.5 w-3.5" />
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between px-4 py-3">
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm">{p.name}</p>
                                {p.description && <p className="text-xs text-muted-foreground">{p.description}</p>}
                                {p.group_name && !hasGroupName && (
                                  <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{p.group_name}</span>
                                )}
                              </div>
                              <div className="flex items-center gap-1 shrink-0 ml-3">
                                <Link href={`/profiles/${p.id}`} className="p-2 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
                                  <ArrowRight className="h-4 w-4" />
                                </Link>
                                <button
                                  onClick={() => startEdit(p)}
                                  className="p-2 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                                  title="Edit cellar"
                                >
                                  <Edit2 className="h-4 w-4" />
                                </button>
                                {deleteId === p.id ? (
                                  <div className="flex items-center gap-1">
                                    <button onClick={() => handleDelete(p.id)} className="text-xs px-2 py-1 rounded bg-destructive text-destructive-foreground">Delete</button>
                                    <button onClick={() => setDeleteId(null)} className="text-xs px-2 py-1 rounded border hover:bg-accent">Cancel</button>
                                  </div>
                                ) : (
                                  <button onClick={() => setDeleteId(p.id)} className="p-2 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
