'use client';

import { useEffect, useState } from 'react';
import { Loader2, Trash2, UserPlus } from 'lucide-react';
import type { CellarShare } from '@/types';

interface Props {
  profileId: string;
}

export default function SharePanel({ profileId }: Props) {
  const [shares, setShares] = useState<CellarShare[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [permission, setPermission] = useState<'read' | 'write'>('read');
  const [saving, setSaving] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      const res = await fetch(`/api/profiles/${profileId}/shares`);
      if (res.ok) setShares(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [profileId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleShare = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/profiles/${profileId}/shares`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), permission }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to share');
      setEmail('');
      setShares(prev => [...prev, data]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to share');
    } finally {
      setSaving(false);
    }
  };

  const handleRevoke = async (shareId: string) => {
    setRevoking(shareId);
    try {
      await fetch(`/api/profiles/${profileId}/shares/${shareId}`, { method: 'DELETE' });
      setShares(prev => prev.filter(s => s.id !== shareId));
    } finally {
      setRevoking(null);
    }
  };

  const inputCls = 'px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring';

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold mb-1">Share this cellar</h3>
        <p className="text-xs text-muted-foreground mb-3">
          Enter the email address of someone who already has an account. They will see this cellar in their cellar list.
        </p>

        <form onSubmit={handleShare} className="flex flex-col sm:flex-row gap-2">
          <input
            type="email"
            className={`${inputCls} flex-1`}
            placeholder="user@example.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
          <select
            className={`${inputCls} w-full sm:w-auto`}
            value={permission}
            onChange={e => setPermission(e.target.value as 'read' | 'write')}
          >
            <option value="read">Read only</option>
            <option value="write">Read &amp; write</option>
          </select>
          <button
            type="submit"
            disabled={saving || !email.trim()}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors shrink-0"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            Share
          </button>
        </form>

        {error && (
          <p className="mt-2 text-xs text-destructive bg-destructive/10 rounded px-3 py-2">{error}</p>
        )}
      </div>

      <div>
        <h3 className="text-sm font-semibold mb-2">People with access</h3>
        {loading ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : shares.length === 0 ? (
          <p className="text-xs text-muted-foreground">Not shared with anyone yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {shares.map(s => (
              <li key={s.id} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 bg-card">
                <div className="min-w-0">
                  <p className="text-sm truncate">{s.shared_with_email}</p>
                  <span className={`text-xs font-medium ${s.permission === 'write' ? 'text-amber-600' : 'text-muted-foreground'}`}>
                    {s.permission === 'write' ? 'Read & write' : 'Read only'}
                  </span>
                </div>
                <button
                  onClick={() => handleRevoke(s.id)}
                  disabled={revoking === s.id}
                  className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                  title="Revoke access"
                >
                  {revoking === s.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
