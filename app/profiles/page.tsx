'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, Edit2, Trash2, Loader2, ArrowRight } from 'lucide-react';
import { useProfile } from '@/hooks/useProfile';

export default function ProfilesPage() {
  const { profiles, refresh } = useProfile();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), description: description.trim() || undefined }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed');
      setName('');
      setDescription('');
      setShowForm(false);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create profile');
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
      setError(err instanceof Error ? err.message : 'Failed to delete profile');
    } finally {
      setDeleteId(null);
    }
  };

  const inputCls = 'w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring';

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Profiles</h2>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Profile
        </button>
      </div>

      <p className="text-sm text-muted-foreground">
        Profiles represent different cellars (e.g., Home, Vacation Home). Each profile has its own inventory.
      </p>

      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleCreate} className="rounded-lg border bg-muted/30 p-4 space-y-3">
          <p className="text-sm font-medium">New Profile</p>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Profile Name *</label>
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Home, Vacation Home" required />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Description</label>
            <input className={inputCls} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description" />
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
            <button type="button" onClick={() => { setShowForm(false); setError(null); }} className="px-4 py-2 rounded-md border text-sm hover:bg-accent transition-colors">
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="space-y-2">
        {profiles.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No profiles yet. Create one above.</p>
        ) : (
          profiles.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-lg border bg-card px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{p.name}</p>
                {p.description && <p className="text-xs text-muted-foreground">{p.description}</p>}
              </div>
              <div className="flex items-center gap-1 shrink-0 ml-3">
                <Link href={`/profiles/${p.id}`} className="p-2 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
                  <ArrowRight className="h-4 w-4" />
                </Link>
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
          ))
        )}
      </div>
    </div>
  );
}
