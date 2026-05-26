'use client';

import { useState } from 'react';
import { Plus, Minus, Loader2, MapPin } from 'lucide-react';
import type { CellarInventory, Profile } from '@/types';
import { formatPrice, formatDate } from '@/lib/utils';

interface Props {
  wineId: string;
  profiles: Profile[];
  inventory: CellarInventory[];
  onRefresh: () => void;
}

interface AddForm {
  profile_id: string;
  location: string;
  quantity: number;
  purchase_price: string;
  purchase_date: string;
}

export default function BottleManager({ wineId, profiles, inventory, onRefresh }: Props) {
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState<AddForm>({
    profile_id: profiles[0]?.id ?? '',
    location: '',
    quantity: 1,
    purchase_price: '',
    purchase_date: '',
  });
  const [addLoading, setAddLoading] = useState(false);
  const [removeLoading, setRemoveLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.location.trim()) { setError('Location is required'); return; }
    if (!addForm.profile_id) { setError('Profile is required'); return; }

    setError(null);
    setAddLoading(true);
    try {
      const res = await fetch('/api/cellar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wine_id: wineId,
          profile_id: addForm.profile_id,
          location: addForm.location.trim(),
          quantity: addForm.quantity,
          purchase_price: addForm.purchase_price ? Number(addForm.purchase_price) : undefined,
          purchase_date: addForm.purchase_date || undefined,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setShowAdd(false);
      setAddForm({ profile_id: profiles[0]?.id ?? '', location: '', quantity: 1, purchase_price: '', purchase_date: '' });
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add bottles');
    } finally {
      setAddLoading(false);
    }
  };

  const handleRemove = async (item: CellarInventory, qty: number) => {
    setRemoveLoading(item.id);
    try {
      const res = await fetch(`/api/cellar/${item.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: qty }),
      });
      if (!res.ok) throw new Error(await res.text());
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove bottle');
    } finally {
      setRemoveLoading(null);
    }
  };

  const inputCls = 'w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Cellar Inventory</h3>
        <button
          onClick={() => setShowAdd((v) => !v)}
          className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Bottles
        </button>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {showAdd && (
        <form onSubmit={handleAdd} className="rounded-md border bg-muted/30 p-4 space-y-3">
          <p className="text-sm font-medium">Add Bottles to Cellar</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Profile *</label>
              <select
                className={inputCls}
                value={addForm.profile_id}
                onChange={(e) => setAddForm((p) => ({ ...p, profile_id: e.target.value }))}
                required
              >
                {profiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Quantity</label>
              <input
                type="number"
                className={inputCls}
                value={addForm.quantity}
                onChange={(e) => setAddForm((p) => ({ ...p, quantity: Math.max(1, Number(e.target.value)) }))}
                min={1}
                required
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs text-muted-foreground mb-1 block">Location in Cellar *</label>
              <input
                className={inputCls}
                value={addForm.location}
                onChange={(e) => setAddForm((p) => ({ ...p, location: e.target.value }))}
                placeholder="e.g. Rack A, Row 2, Slot 3"
                required
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Purchase Price ($)</label>
              <input
                type="number"
                className={inputCls}
                value={addForm.purchase_price}
                onChange={(e) => setAddForm((p) => ({ ...p, purchase_price: e.target.value }))}
                placeholder="0.00"
                min={0}
                step={0.01}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Purchase Date</label>
              <input
                type="date"
                className={inputCls}
                value={addForm.purchase_date}
                onChange={(e) => setAddForm((p) => ({ ...p, purchase_date: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={addLoading}
              className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {addLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Add
            </button>
            <button
              type="button"
              onClick={() => { setShowAdd(false); setError(null); }}
              className="px-4 py-2 rounded-md border text-sm hover:bg-accent transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {inventory.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">No bottles in cellar. Add some above.</p>
      ) : (
        <div className="space-y-2">
          {inventory.map((item) => {
            const profile = profiles.find((p) => p.id === item.profile_id);
            return (
              <div key={item.id} className="flex items-center gap-3 rounded-md border bg-card p-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate">{item.location}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    {profile && <span className="font-medium text-foreground">{profile.name}</span>}
                    {item.purchase_price != null && <span>{formatPrice(item.purchase_price)}</span>}
                    {item.purchase_date && <span>{formatDate(item.purchase_date)}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-semibold w-8 text-center">{item.quantity}</span>
                  <button
                    onClick={() => handleRemove(item, 1)}
                    disabled={removeLoading === item.id || item.quantity === 0}
                    title="Remove 1 bottle"
                    className="h-7 w-7 rounded-md border flex items-center justify-center hover:bg-destructive/10 hover:border-destructive hover:text-destructive disabled:opacity-40 transition-colors"
                  >
                    {removeLoading === item.id
                      ? <Loader2 className="h-3 w-3 animate-spin" />
                      : <Minus className="h-3 w-3" />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
