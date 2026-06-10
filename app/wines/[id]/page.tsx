'use client';

import { useEffect, useState, use, type ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, Edit, Trash2, Copy, MapPin, Calendar, DollarSign, Percent, GlassWater, Loader2, NotebookPen, X, UtensilsCrossed, Plus } from 'lucide-react';
import { useProfile } from '@/hooks/useProfile';
import type { Wine, CellarInventory, BottleTransaction, WineNote, WineFoodPairing } from '@/types';
import BottleManager from '@/components/BottleManager';
import TransactionLog from '@/components/TransactionLog';
import { cn, wineTypeLabel, wineTypeColor, wineTypeBorderColor, formatPrice, formatDate } from '@/lib/utils';

export default function WineDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { profiles } = useProfile();
  const [wine, setWine] = useState<Wine | null>(null);
  const [inventory, setInventory] = useState<CellarInventory[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState<'inventory' | 'transactions' | 'notes' | 'pairings'>('inventory');
  const [transactions, setTransactions] = useState<BottleTransaction[]>([]);
  const [notes, setNotes] = useState<WineNote[]>([]);
  const [noteText, setNoteText] = useState('');
  const [noteTastedAt, setNoteTastedAt] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [pairings, setPairings] = useState<WineFoodPairing[]>([]);
  const [newPairing, setNewPairing] = useState('');
  const [addingPairing, setAddingPairing] = useState(false);

  const loadInventory = async () => {
    if (!profiles.length) return;
    const results = await Promise.all(
      profiles.map(async (p) => {
        const res = await fetch(`/api/cellar?wine_id=${id}&profile_id=${p.id}`);
        const items: CellarInventory[] = res.ok ? await res.json() : [];
        return items.map((item) => ({ ...item, profile: p }));
      })
    );
    setInventory(results.flat());
  };

  const loadTransactions = async () => {
    if (!profiles.length) return;
    const txArrays = await Promise.all(
      profiles.map(async (p) => {
        const res = await fetch(`/api/transactions?profile_id=${p.id}`);
        const items: BottleTransaction[] = res.ok ? await res.json() : [];
        return items.filter((t) => t.wine_id === id);
      })
    );
    // Merge and sort descending by created_at
    const merged = txArrays.flat().sort((a, b) => b.created_at.localeCompare(a.created_at));
    setTransactions(merged);
  };

  const loadPairings = async () => {
    const res = await fetch(`/api/wines/${id}/pairings`);
    if (res.ok) setPairings(await res.json());
  };

  const handleAddPairing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPairing.trim()) return;
    setAddingPairing(true);
    try {
      const res = await fetch(`/api/wines/${id}/pairings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ food: newPairing.trim() }),
      });
      if (res.ok) { setNewPairing(''); await loadPairings(); }
    } finally {
      setAddingPairing(false);
    }
  };

  const handleDeletePairing = async (pairingId: string) => {
    await fetch(`/api/wines/${id}/pairings`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pairingId }),
    });
    await loadPairings();
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/wines/${id}`);
        if (res.ok) setWine(await res.json());
        await Promise.all([loadInventory(), loadTransactions(), loadNotes(), loadPairings()]);
      } finally {
        setLoading(false);
      }
    };
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, profiles.length]);

  const loadNotes = async () => {
    const res = await fetch(`/api/wines/${id}/notes`);
    if (res.ok) setNotes(await res.json());
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteText.trim()) return;
    setAddingNote(true);
    try {
      const res = await fetch(`/api/wines/${id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: noteText.trim(), tasted_at: noteTastedAt || undefined }),
      });
      if (res.ok) {
        setNoteText('');
        setNoteTastedAt('');
        await loadNotes();
      }
    } finally {
      setAddingNote(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    await fetch(`/api/wines/${id}/notes/${noteId}`, { method: 'DELETE' });
    await loadNotes();
  };

  const handleDelete = async () => {
    const res = await fetch(`/api/wines/${id}`, { method: 'DELETE' });
    if (res.ok) window.location.href = '/wines';
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-sm text-muted-foreground">Loading…</div>;
  if (!wine) return <div className="px-4 py-6 text-sm text-muted-foreground">Wine not found.</div>;

  const totalBottles = inventory.reduce((s, i) => s + i.quantity, 0);

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/wines" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h2 className="text-lg font-bold truncate">{wine.name}</h2>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/wines/${id}/edit`} className="p-2 rounded-md hover:bg-accent transition-colors text-muted-foreground hover:text-foreground" title="Edit wine">
            <Edit className="h-4 w-4" />
          </Link>
          <Link href={`/wines/new?copy_from=${id}`} className="p-2 rounded-md hover:bg-accent transition-colors text-muted-foreground hover:text-foreground" title="Duplicate wine">
            <Copy className="h-4 w-4" />
          </Link>
          {deleteConfirm ? (
            <div className="flex items-center gap-1">
              <button onClick={handleDelete} className="text-xs px-2 py-1 rounded bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</button>
              <button onClick={() => setDeleteConfirm(false)} className="text-xs px-2 py-1 rounded border hover:bg-accent">Cancel</button>
            </div>
          ) : (
            <button onClick={() => setDeleteConfirm(true)} className="p-2 rounded-md hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive">
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Wine info */}
      <div className="rounded-lg border bg-card overflow-hidden">
        {(wine.label_image || wine.image_url) && (
          <div className="flex justify-center bg-muted px-4 pt-4 pb-2">
            {wine.label_image ? (
              <img
                src={`data:image/webp;base64,${wine.label_image}`}
                alt={wine.name}
                className={cn('h-40 w-auto rounded object-contain ring-4', wineTypeBorderColor(wine.wine_type))}
              />
            ) : (
              <div className={cn('relative h-40 w-28 rounded overflow-hidden ring-4', wineTypeBorderColor(wine.wine_type))}>
                <Image src={wine.image_url!} alt={wine.name} fill className="object-contain" />
              </div>
            )}
          </div>
        )}
        <div className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-bold text-lg">{wine.name}</h3>
              {wine.producer && <p className="text-sm text-muted-foreground">{wine.producer}</p>}
            </div>
            {wine.wine_type && (
              <span className={cn('shrink-0 text-xs px-2 py-1 rounded-full font-medium', wineTypeColor(wine.wine_type))}>
                {wineTypeLabel(wine.wine_type)}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {wine.vintage_year && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Calendar className="h-3.5 w-3.5 shrink-0" />
                <span>{wine.vintage_year}</span>
              </div>
            )}
            {wine.variety && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <span className="text-base">🍇</span>
                <span>{wine.variety}</span>
              </div>
            )}
            {(wine.region || wine.country) && (
              <div className="flex items-center gap-1.5 text-muted-foreground col-span-2">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span>{[wine.appellation, wine.region, wine.country].filter(Boolean).join(', ')}</span>
              </div>
            )}
            {wine.average_price != null && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <DollarSign className="h-3.5 w-3.5 shrink-0" />
                <span>{formatPrice(wine.average_price)}</span>
              </div>
            )}
            {wine.alcohol_content != null && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Percent className="h-3.5 w-3.5 shrink-0" />
                <span>{wine.alcohol_content}% ABV</span>
              </div>
            )}
            {(wine.drink_from_year != null || wine.drink_by_year != null) && (() => {
              const year = new Date().getFullYear();
              const from = wine.drink_from_year;
              const by = wine.drink_by_year;
              const tooYoung = from != null && year < from;
              const expired = by != null && year > by;
              return (
                <div className={cn('flex items-center gap-1.5 col-span-2',
                  tooYoung ? 'text-blue-600' : expired ? 'text-red-600' : 'text-green-600'
                )}>
                  <GlassWater className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    {from != null && by != null ? `Drink ${from}–${by}` :
                     from != null ? `Ready from ${from}` :
                     by != null ? `Drink by ${by}` : ''}
                    {tooYoung ? ' · Too young' : expired ? ' · Past peak' : ' · In window'}
                  </span>
                </div>
              );
            })()}
          </div>

          {wine.description && (
            <p className="text-sm text-muted-foreground border-t pt-3">{wine.description}</p>
          )}

          {/* Structural profile */}
          {(wine.acidity != null || wine.tannin != null || wine.sweetness != null || wine.body != null || wine.alcohol != null) && (
            <div className="border-t pt-3 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Structural Profile</p>
              {([
                { label: 'Acidity', value: wine.acidity, lo: 'Flat', hi: 'Tart' },
                { label: 'Tannin', value: wine.tannin, lo: 'Silky', hi: 'Grippy' },
                { label: 'Sweetness', value: wine.sweetness, lo: 'Dry', hi: 'Sweet' },
                { label: 'Body', value: wine.body, lo: 'Light', hi: 'Full' },
                { label: 'Alcohol', value: wine.alcohol, lo: 'Low', hi: 'High' },
              ]).filter(r => r.value != null).map(({ label, value, lo, hi }) => (
                <div key={label} className="flex items-center gap-2 text-xs">
                  <span className="w-16 text-muted-foreground shrink-0">{label}</span>
                  <span className="w-6 text-[10px] text-muted-foreground text-right shrink-0">{lo}</span>
                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full"
                      style={{ width: `${((value ?? 0) / 5) * 100}%` }}
                    />
                  </div>
                  <span className="w-6 text-[10px] text-muted-foreground shrink-0">{hi}</span>
                  <span className="w-3 font-semibold text-right">{value}</span>
                </div>
              ))}
              {wine.fruit_profile && (
                <p className="text-xs text-muted-foreground mt-1">🍇 {wine.fruit_profile}</p>
              )}
            </div>
          )}

          {wine.barcode && (
            <p className="text-xs text-muted-foreground">Barcode: {wine.barcode}</p>
          )}

          <div className="border-t pt-3">
            <span className={cn('text-sm font-medium px-2 py-1 rounded',
              totalBottles > 0 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'
            )}>
              {totalBottles} {totalBottles === 1 ? 'bottle' : 'bottles'} in cellar
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="space-y-3">
        <div className="flex gap-1 border-b overflow-x-auto">
          {([
            { key: 'inventory', label: 'Inventory' },
            { key: 'pairings', label: `Pairings${pairings.length > 0 ? ` (${pairings.length})` : ''}`, icon: <UtensilsCrossed className="h-3.5 w-3.5" /> },
            { key: 'notes', label: `Notes${notes.length > 0 ? ` (${notes.length})` : ''}`, icon: <NotebookPen className="h-3.5 w-3.5" /> },
            { key: 'transactions', label: 'Transactions' },
          ] as { key: typeof activeTab; label: string; icon?: ReactNode }[]).map(({ key, label, icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={cn('px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap flex items-center gap-1.5',
                activeTab === key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>

        {activeTab === 'inventory' && (
          <BottleManager
            wineId={id}
            profiles={profiles}
            inventory={inventory}
            onRefresh={loadInventory}
            suggestedPrice={wine.average_price}
          />
        )}

        {activeTab === 'pairings' && (
          <div className="space-y-4">
            {/* Existing pairings */}
            {pairings.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {pairings.map((p) => (
                  <div
                    key={p.id}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border',
                      p.source === 'gemini' ? 'bg-purple-50 border-purple-200 text-purple-800' : 'bg-accent border-border'
                    )}
                  >
                    <UtensilsCrossed className="h-3 w-3 shrink-0" />
                    <span>{p.food}</span>
                    <button
                      onClick={() => handleDeletePairing(p.id)}
                      className="ml-0.5 text-muted-foreground hover:text-destructive transition-colors"
                      title="Remove pairing"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No food pairings yet. Add your first below.</p>
            )}

            {/* Add pairing */}
            <form onSubmit={handleAddPairing} className="flex gap-2">
              <input
                value={newPairing}
                onChange={(e) => setNewPairing(e.target.value)}
                placeholder="e.g. grilled steak, mushroom risotto…"
                className="flex-1 px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                type="submit"
                disabled={!newPairing.trim() || addingPairing}
                className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors shrink-0"
              >
                {addingPairing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Add
              </button>
            </form>
            {pairings.some(p => p.source === 'gemini') && (
              <p className="text-xs text-muted-foreground">Purple chips were suggested by Gemini AI.</p>
            )}
          </div>
        )}

        {activeTab === 'notes' && (
          <div className="space-y-4">
            {/* Add note form */}
            <form onSubmit={handleAddNote} className="rounded-lg border bg-card p-4 space-y-3">
              <p className="text-sm font-medium flex items-center gap-1.5">
                <NotebookPen className="h-4 w-4 text-primary" />
                Add Tasting Note
              </p>
              <textarea
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                placeholder="Describe aromas, palate, finish, food pairings…"
                rows={3}
                className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground">Tasted on (optional)</label>
                  <input
                    type="date"
                    value={noteTastedAt}
                    onChange={e => setNoteTastedAt(e.target.value)}
                    className="mt-1 w-full px-2 py-1 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!noteText.trim() || addingNote}
                  className="flex items-center gap-1.5 px-4 py-2 mt-5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {addingNote ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Save Note
                </button>
              </div>
            </form>

            {/* Notes list */}
            {notes.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                No tasting notes yet. Add your first note above.
              </div>
            ) : (
              <div className="space-y-3">
                {notes.map(n => (
                  <div key={n.id} className="rounded-lg border bg-card px-4 py-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-xs text-muted-foreground">
                        {n.tasted_at
                          ? `Tasted ${formatDate(n.tasted_at)}`
                          : `Added ${formatDate(n.created_at)}`}
                      </div>
                      <button
                        onClick={() => handleDeleteNote(n.id)}
                        className="p-1 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                        title="Delete note"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{n.note}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'transactions' && (
          <div className="rounded-lg border bg-card px-4 py-2">
            <TransactionLog transactions={transactions} />
          </div>
        )}
      </div>
    </div>
  );
}
