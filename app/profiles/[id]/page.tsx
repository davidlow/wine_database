'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Check, ChevronDown, ChevronRight, Edit2,
  Loader2, MapPin, PackagePlus, Plus, Share2, SkipForward, Trash2, Wrench, Wine, X,
} from 'lucide-react';
import type { CellarInventory, Location, LocationGroup, Profile, BottleTransaction } from '@/types';
import SharePanel from '@/components/SharePanel';
import { useProfile } from '@/hooks/useProfile';
import TransactionLog from '@/components/TransactionLog';
import { cn, drinkWindowStatus } from '@/lib/utils';

// Virtual locations are derived from inventory but have no locations-table record.
type DisplayLocation = Location & { virtual?: true };

// Hierarchy tree node used in the Locations tab.
interface HierarchyNode extends LocationGroup {
  children: HierarchyNode[];
  locations: DisplayLocation[];
  totalBottles: number;
  totalCap: number | null;
}

// ── Capacity bar ──────────────────────────────────────────────────────────────
function CapacityBar({ used, max }: { used: number; max: number }) {
  const pct = Math.min(100, Math.round((used / max) * 100));
  const avail = max - used;
  const color = avail === 0 ? 'bg-red-400' : avail <= 2 ? 'bg-amber-400' : 'bg-green-400';
  const textColor = avail === 0 ? 'text-red-600' : avail <= 2 ? 'text-amber-600' : 'text-muted-foreground';
  return (
    <div className="flex items-center gap-2 shrink-0">
      <span className={cn('text-xs tabular-nums', textColor)}>{used}/{max}</span>
      <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={cn('h-full rounded-full', color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ── Inline location edit form ─────────────────────────────────────────────────
interface EditFormProps {
  loc: DisplayLocation;
  existingGroups: string[];
  onSave: (data: { name: string; group_name: string; max_capacity: number | undefined; location_type: string }) => Promise<void>;
  onCancel: () => void;
}

function LocationEditForm({ loc, existingGroups, onSave, onCancel }: EditFormProps) {
  const [name, setName] = useState(loc.name);
  const [groupName, setGroupName] = useState(loc.group_name ?? '');
  const [maxCap, setMaxCap] = useState(loc.max_capacity != null ? String(loc.max_capacity) : '');
  const [locType, setLocType] = useState<string>(loc.location_type ?? 'standard');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    await onSave({
      name: name.trim(),
      group_name: groupName.trim(),
      max_capacity: maxCap ? parseInt(maxCap, 10) : undefined,
      location_type: locType,
    });
    setSaving(false);
  };

  return (
    <div className="px-4 py-3 bg-muted/20 border-t space-y-3" onClick={e => e.stopPropagation()}>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="text-xs font-medium text-muted-foreground">Location Name *</label>
          <input
            autoFocus
            className="mt-1 w-full px-3 py-1.5 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            value={name}
            onChange={e => setName(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Group (optional)</label>
          <input
            className="mt-1 w-full px-3 py-1.5 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            value={groupName}
            onChange={e => setGroupName(e.target.value)}
            placeholder="e.g. Stair Rack"
            list="group-suggestions"
          />
          {existingGroups.length > 0 && (
            <datalist id="group-suggestions">
              {existingGroups.map(g => <option key={g} value={g} />)}
            </datalist>
          )}
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Max Capacity</label>
          <input
            type="number"
            className="mt-1 w-full px-3 py-1.5 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            value={maxCap}
            onChange={e => setMaxCap(e.target.value)}
            placeholder="Unlimited"
            min={1}
          />
        </div>
        <div className="col-span-2">
          <label className="text-xs font-medium text-muted-foreground">Type</label>
          <div className="mt-1 flex gap-1">
            {(['standard', 'aging', 'daily'] as const).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setLocType(t)}
                className={cn(
                  'flex-1 py-1 rounded-md text-xs font-medium border transition-colors capitalize',
                  locType === t ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-accent text-muted-foreground'
                )}
              >
                {t === 'daily' ? 'Daily Drinkers' : t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {locType === 'aging' ? 'Excluded from recommendations and defragment.' :
             locType === 'daily' ? 'Diversity-first scoring; drink-soon wines preferred.' :
             'Normal clustering by variety, region, and producer.'}
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !name.trim()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
          Save
        </button>
        <button type="button" onClick={onCancel} className="px-3 py-1.5 rounded-md border text-xs hover:bg-accent transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Add location form ─────────────────────────────────────────────────────────
interface AddFormProps {
  profileId: string;
  existingGroups: string[];
  onCreated: (loc: Location) => void;
  onCancel: () => void;
}

function AddLocationForm({ profileId, existingGroups, onCreated, onCancel }: AddFormProps) {
  const [name, setName] = useState('');
  const [groupName, setGroupName] = useState('');
  const [maxCap, setMaxCap] = useState('');
  const [locType, setLocType] = useState<string>('standard');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile_id: profileId,
          name: name.trim(),
          group_name: groupName.trim() || undefined,
          max_capacity: maxCap ? parseInt(maxCap, 10) : undefined,
          location_type: locType,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed');
      const loc: Location = await res.json();
      onCreated(loc);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create location');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border bg-muted/20 p-4 space-y-3">
      <p className="text-sm font-medium">New Location</p>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="text-xs font-medium text-muted-foreground">Name *</label>
          <input
            autoFocus
            className="mt-1 w-full px-3 py-1.5 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Stair Rack 1"
            required
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Group</label>
          <input
            className="mt-1 w-full px-3 py-1.5 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            value={groupName}
            onChange={e => setGroupName(e.target.value)}
            placeholder="e.g. Stair Rack"
            list="add-group-suggestions"
          />
          {existingGroups.length > 0 && (
            <datalist id="add-group-suggestions">
              {existingGroups.map(g => <option key={g} value={g} />)}
            </datalist>
          )}
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Max Capacity</label>
          <input
            type="number"
            className="mt-1 w-full px-3 py-1.5 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            value={maxCap}
            onChange={e => setMaxCap(e.target.value)}
            placeholder="Unlimited"
            min={1}
          />
        </div>
        <div className="col-span-2">
          <label className="text-xs font-medium text-muted-foreground">Type</label>
          <div className="mt-1 flex gap-1">
            {(['standard', 'aging', 'daily'] as const).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setLocType(t)}
                className={cn(
                  'flex-1 py-1 rounded-md text-xs font-medium border transition-colors capitalize',
                  locType === t ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-accent text-muted-foreground'
                )}
              >
                {t === 'daily' ? 'Daily Drinkers' : t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={saving || !name.trim()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {saving && <Loader2 className="h-3 w-3 animate-spin" />}
          Add Location
        </button>
        <button type="button" onClick={onCancel} className="px-3 py-1.5 rounded-md border text-xs hover:bg-accent transition-colors">
          Cancel
        </button>
      </div>
    </form>
  );
}

// ── Register Missing Locations Wizard ────────────────────────────────────────
type WizardResult = { name: string; action: 'registered' | 'skipped' | 'failed' };

function RegisterMissingWizard({
  virtualLocations,
  profileId,
  onComplete,
  onCancel,
}: {
  virtualLocations: DisplayLocation[];
  profileId: string;
  onComplete: () => void;
  onCancel: () => void;
}) {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<WizardResult[]>([]);
  const [done, setDone] = useState(false);

  const current = virtualLocations[step];
  const total = virtualLocations.length;

  const advance = (result: WizardResult) => {
    const next = [...results, result];
    setResults(next);
    if (step + 1 >= total) {
      setDone(true);
    } else {
      setStep(s => s + 1);
      setError(null);
    }
  };

  const handleRegister = async () => {
    if (!current) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile_id: profileId, name: current.name }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Failed to register');
      }
      advance({ name: current.name, action: 'registered' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
      advance({ name: current.name, action: 'failed' });
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => {
    advance({ name: current.name, action: 'skipped' });
  };

  if (done) {
    const registered = results.filter(r => r.action === 'registered').length;
    const skipped = results.filter(r => r.action === 'skipped').length;
    const failed = results.filter(r => r.action === 'failed').length;
    return (
      <div className="bg-card rounded-xl border shadow-lg max-w-sm w-full p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Check className="h-5 w-5 text-green-600" />
          <h3 className="font-semibold text-base">Done</h3>
        </div>
        <div className="space-y-1.5">
          {results.map((r, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              {r.action === 'registered' && <Check className="h-3.5 w-3.5 text-green-600 shrink-0" />}
              {r.action === 'skipped' && <SkipForward className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
              {r.action === 'failed' && <X className="h-3.5 w-3.5 text-destructive shrink-0" />}
              <span className="truncate">{r.name}</span>
              <span className="text-xs text-muted-foreground ml-auto shrink-0">{r.action}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {registered} registered, {skipped} skipped{failed > 0 ? `, ${failed} failed` : ''}.
          {registered > 0 && ' Use the edit button on each location to add capacity and grouping.'}
        </p>
        <button
          onClick={onComplete}
          className="w-full px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          Close
        </button>
      </div>
    );
  }

  if (!current) return null;
  const bottleCount = current.current_quantity ?? 0;

  return (
    <div className="bg-card rounded-xl border shadow-lg max-w-sm w-full p-6 space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs text-muted-foreground font-medium">
            Location {step + 1} of {total}
          </p>
          <h3 className="font-semibold text-base mt-0.5">Register Missing Location?</h3>
        </div>
        <button onClick={onCancel} className="p-1 text-muted-foreground hover:text-foreground transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="rounded-lg bg-muted/50 border p-4 space-y-1">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-primary shrink-0" />
          <p className="font-medium text-sm">{current.name}</p>
        </div>
        <p className="text-xs text-muted-foreground pl-6">
          {bottleCount} bottle{bottleCount !== 1 ? 's' : ''} stored here
        </p>
      </div>

      <p className="text-sm text-muted-foreground">
        This location exists in your inventory but has no registered entry. Registering it lets you add
        capacity limits and grouping.
      </p>

      {error && (
        <p className="text-xs text-destructive bg-destructive/10 rounded px-3 py-2">{error}</p>
      )}

      <div className="flex gap-2">
        <button
          onClick={handleRegister}
          disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Register
        </button>
        <button
          onClick={handleSkip}
          disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 rounded-md border text-sm hover:bg-accent disabled:opacity-50 transition-colors"
        >
          <SkipForward className="h-4 w-4" />
          Skip
        </button>
        <button
          onClick={onCancel}
          disabled={saving}
          className="px-4 py-2 rounded-md border text-sm text-muted-foreground hover:bg-accent disabled:opacity-50 transition-colors"
        >
          Cancel All
        </button>
      </div>
    </div>
  );
}

// ── Hierarchy group section (recursive) ──────────────────────────────────────
function HierarchyNodeSection({ node, depth, collapsedGroups, onToggle, renderLocation }: {
  node: HierarchyNode;
  depth: number;
  collapsedGroups: Set<string>;
  onToggle: (id: string) => void;
  renderLocation: (loc: DisplayLocation) => React.ReactNode;
}) {
  const isCollapsed = collapsedGroups.has(node.id);
  const hasContent = node.children.length > 0 || node.locations.length > 0;
  return (
    <div className={depth > 0 ? 'pl-4' : ''}>
      <button
        onClick={() => { if (hasContent) onToggle(node.id); }}
        className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-muted/40 hover:bg-muted/70 transition-colors"
      >
        <div className="flex items-center gap-2">
          {hasContent
            ? isCollapsed
              ? <ChevronRight className="h-4 w-4 text-muted-foreground" />
              : <ChevronDown className="h-4 w-4 text-muted-foreground" />
            : <span className="w-4 inline-block" />
          }
          <span className="text-sm font-semibold">{node.name}</span>
          {node.locations.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {node.locations.length} location{node.locations.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {node.totalCap != null ? (
            <CapacityBar used={node.totalBottles} max={node.totalCap} />
          ) : (
            <span className="text-xs text-muted-foreground tabular-nums">{node.totalBottles} btl</span>
          )}
        </div>
      </button>
      {!isCollapsed && hasContent && (
        <div className="mt-1 space-y-1">
          {node.children.map(child => (
            <HierarchyNodeSection
              key={child.id}
              node={child}
              depth={depth + 1}
              collapsedGroups={collapsedGroups}
              onToggle={onToggle}
              renderLocation={renderLocation}
            />
          ))}
          {node.locations.length > 0 && (
            <div className={cn('space-y-1.5', node.children.length > 0 && 'pt-1')}>
              {node.locations.map(loc => renderLocation(loc))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Location link helper ──────────────────────────────────────────────────────
function LocationLink({ profileId, locationName, className }: { profileId: string; locationName: string; className?: string }) {
  if (!locationName) return <span className={cn('italic text-amber-600', className)}>Unlocated</span>;
  return (
    <Link
      href={`/profiles/${profileId}/location?name=${encodeURIComponent(locationName)}`}
      className={cn('hover:underline text-primary', className)}
      onClick={e => e.stopPropagation()}
    >
      {locationName}
    </Link>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ProfileDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { profiles } = useProfile();
  void profiles; // used by useProfile context
  const [profile, setProfile] = useState<Profile | null>(null);
  const [inventory, setInventory] = useState<CellarInventory[]>([]);
  const [registeredLocations, setRegisteredLocations] = useState<Location[]>([]);
  const [transactions, setTransactions] = useState<BottleTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'locations' | 'inventory' | 'unlocated' | 'transactions' | 'sharing'>('locations');
  const [selectedWineId, setSelectedWineId] = useState<string | null>(null);

  // Location management state
  const [showAddForm, setShowAddForm] = useState(false);
  const [showRegisterWizard, setShowRegisterWizard] = useState(false);
  const [editingLocId, setEditingLocId] = useState<string | null>(null);
  const [deleteLocId, setDeleteLocId] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [locError, setLocError] = useState<string | null>(null);
  const [locationGroups, setLocationGroups] = useState<LocationGroup[]>([]);
  const [collapsedHierarchyGroups, setCollapsedHierarchyGroups] = useState<Set<string>>(new Set());

  const loadAll = async () => {
    try {
      const [profileRes, inventoryRes, locRes, txRes, grpRes] = await Promise.all([
        fetch(`/api/profiles/${id}`),
        fetch(`/api/cellar?profile_id=${id}`),
        fetch(`/api/locations?profile_id=${id}`),
        fetch(`/api/transactions?profile_id=${id}`),
        fetch(`/api/location-groups?profile_id=${id}`),
      ]);
      if (profileRes.ok) setProfile(await profileRes.json());
      if (inventoryRes.ok) setInventory(await inventoryRes.json());
      if (locRes.ok) {
        const locs: Location[] = await locRes.json();
        setRegisteredLocations(locs);
        const groups = new Set(locs.map(l => l.group_name).filter(Boolean) as string[]);
        setExpandedGroups(groups);
      }
      if (grpRes.ok) setLocationGroups(await grpRes.json());
      if (txRes.ok) setTransactions(await txRes.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <div className="flex items-center justify-center h-64 text-sm text-muted-foreground">Loading…</div>;
  if (!profile) return <div className="px-4 py-6 text-sm text-muted-foreground">Cellar not found.</div>;

  const isOwner = profile.is_owner !== false;
  const canWrite = isOwner || profile.permission === 'write';

  // ── Merge formal + virtual locations ────────────────────────────────────────
  // Virtual = appears in inventory but has no locations-table entry.
  const registeredNames = new Set(registeredLocations.map(l => l.name));
  const inventoryLocNames = [...new Set(
    inventory.filter(i => i.location !== '').map(i => i.location)
  )].filter(name => !registeredNames.has(name));

  const virtualLocations: DisplayLocation[] = inventoryLocNames.map(name => ({
    id: `__virtual__${name}`,
    profile_id: id,
    name,
    virtual: true,
    current_quantity: inventory.filter(i => i.location === name).reduce((s, i) => s + i.quantity, 0),
    created_at: '',
    updated_at: '',
  }));

  const allLocations: DisplayLocation[] = [
    ...registeredLocations.map(loc => ({
      ...loc,
      current_quantity: inventory.filter(i => i.location === loc.name).reduce((s, i) => s + i.quantity, 0),
    })),
    ...virtualLocations,
  ].sort((a, b) => a.name.localeCompare(b.name));

  // ── Stats ───────────────────────────────────────────────────────────────────
  const totalBottles = inventory.reduce((s, i) => s + i.quantity, 0);
  const totalCapacity = registeredLocations
    .filter(l => l.max_capacity != null)
    .reduce((s, l) => s + (l.max_capacity ?? 0), 0);
  const unlocatedItems = inventory.filter(i => i.location === '');
  const unlocatedBottles = unlocatedItems.reduce((s, i) => s + i.quantity, 0);

  // Drink window summary across all inventory
  const yr = new Date().getFullYear();
  const pastPeakItems = inventory.filter(i => drinkWindowStatus(i.wine?.drink_from_year, i.wine?.drink_by_year) === 'past_peak');
  const tooYoungItems = inventory.filter(i => drinkWindowStatus(i.wine?.drink_from_year, i.wine?.drink_by_year) === 'too_young');
  const pastPeakBottles = pastPeakItems.reduce((s, i) => s + i.quantity, 0);
  const tooYoungBottles = tooYoungItems.reduce((s, i) => s + i.quantity, 0);
  void yr;

  const groupByWine = (items: CellarInventory[]) =>
    items.reduce<Record<string, CellarInventory[]>>((acc, item) => {
      acc[item.wine_id] = [...(acc[item.wine_id] ?? []), item];
      return acc;
    }, {});

  const byWine = groupByWine(inventory.filter(i => i.location !== ''));
  const byWineUnlocated = groupByWine(unlocatedItems);

  // ── Location grouping ───────────────────────────────────────────────────────
  const existingGroups = [...new Set(
    registeredLocations.map(l => l.group_name).filter(Boolean) as string[]
  )].sort();

  type LocGroup = { groupName: string | null; locations: DisplayLocation[]; totalCurrent: number; totalCapacity: number | null };
  const groups: LocGroup[] = [];
  const ungrouped: DisplayLocation[] = [];

  const groupMap = new Map<string, DisplayLocation[]>();
  for (const loc of allLocations) {
    if (loc.group_name) {
      const arr = groupMap.get(loc.group_name) ?? [];
      arr.push(loc);
      groupMap.set(loc.group_name, arr);
    } else {
      ungrouped.push(loc);
    }
  }

  for (const [gName, locs] of Array.from(groupMap.entries()).sort(([a], [b]) => a.localeCompare(b))) {
    const totalCurrent = locs.reduce((s, l) => s + (l.current_quantity ?? 0), 0);
    const allHaveCap = locs.every(l => l.max_capacity != null);
    const totalCapacity = allHaveCap ? locs.reduce((s, l) => s + (l.max_capacity ?? 0), 0) : null;
    groups.push({ groupName: gName, locations: locs, totalCurrent, totalCapacity });
  }
  if (ungrouped.length > 0) {
    groups.push({
      groupName: null,
      locations: ungrouped,
      totalCurrent: ungrouped.reduce((s, l) => s + (l.current_quantity ?? 0), 0),
      totalCapacity: null,
    });
  }

  // ── Location actions ────────────────────────────────────────────────────────
  const handleRegisterVirtual = async (loc: DisplayLocation) => {
    // Promotes a virtual location to a registered one (no metadata — user can edit after)
    try {
      const res = await fetch('/api/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile_id: id, name: loc.name }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed');
      setEditingLocId((await res.json()).id);
      await loadAll();
    } catch (err) {
      setLocError(err instanceof Error ? err.message : 'Failed to register location');
    }
  };

  const handleUpdateLocation = async (loc: DisplayLocation, data: { name: string; group_name: string; max_capacity: number | undefined; location_type: string }) => {
    setLocError(null);
    try {
      const res = await fetch(`/api/locations/${loc.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: data.name, group_name: data.group_name || null, max_capacity: data.max_capacity ?? null, notes: loc.notes, location_type: data.location_type }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed');
      setEditingLocId(null);
      await loadAll();
    } catch (err) {
      setLocError(err instanceof Error ? err.message : 'Failed to update location');
    }
  };

  const handleDeleteLocation = async (locId: string) => {
    setLocError(null);
    try {
      const res = await fetch(`/api/locations/${locId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed');
      setDeleteLocId(null);
      await loadAll();
    } catch (err) {
      setLocError(err instanceof Error ? err.message : 'Failed to delete location');
    }
  };

  const toggleGroup = (gName: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(gName)) next.delete(gName); else next.add(gName);
      return next;
    });
  };

  const toggleHierarchyGroup = (id: string) => {
    setCollapsedHierarchyGroups(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  function buildHierarchyTree(): HierarchyNode[] {
    const nodeMap = new Map<string, HierarchyNode>();
    for (const g of locationGroups) {
      nodeMap.set(g.id, { ...g, children: [], locations: [], totalBottles: 0, totalCap: 0 });
    }
    const roots: HierarchyNode[] = [];
    for (const g of locationGroups) {
      const node = nodeMap.get(g.id)!;
      if (g.parent_id && nodeMap.has(g.parent_id)) {
        nodeMap.get(g.parent_id)!.children.push(node);
      } else {
        roots.push(node);
      }
    }
    for (const loc of allLocations) {
      if (loc.hierarchy_group_id && nodeMap.has(loc.hierarchy_group_id)) {
        nodeMap.get(loc.hierarchy_group_id)!.locations.push(loc);
      }
    }
    function sortAndTotal(node: HierarchyNode): { bottles: number; cap: number | null } {
      node.children.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
      node.locations.sort((a, b) => a.name.localeCompare(b.name));
      node.children.forEach(c => sortAndTotal(c));
      const locBottles = node.locations.reduce((s, l) => s + (l.current_quantity ?? 0), 0);
      const childBottles = node.children.reduce((s, c) => s + c.totalBottles, 0);
      node.totalBottles = locBottles + childBottles;
      const locCap = node.locations.every(l => l.max_capacity != null)
        ? node.locations.reduce((s, l) => s + (l.max_capacity ?? 0), 0)
        : null;
      const childCap = node.children.every(c => c.totalCap != null)
        ? node.children.reduce((s, c) => s + (c.totalCap ?? 0), 0)
        : null;
      node.totalCap = locCap != null && childCap != null ? locCap + childCap : null;
      return { bottles: node.totalBottles, cap: node.totalCap };
    }
    roots.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
    roots.forEach(sortAndTotal);
    return roots;
  }

  const hierarchyTree = locationGroups.length > 0 ? buildHierarchyTree() : [];
  const hierarchyAssignedIds = new Set(allLocations.filter(l => l.hierarchy_group_id).map(l => l.id));
  const hierarchyUngrouped = allLocations.filter(l => !hierarchyAssignedIds.has(l.id));

  // ── Location row ────────────────────────────────────────────────────────────
  const currentYear = new Date().getFullYear();
  const LocationRow = ({ loc }: { loc: DisplayLocation }) => {
    const isVirtual = !!loc.virtual;
    const isEditing = editingLocId === loc.id;
    const isDeleting = deleteLocId === loc.id;
    const used = loc.current_quantity ?? 0;
    const locItems = inventory.filter(i => i.location === loc.name);
    const tooYoungCount = locItems.reduce((s, i) => {
      const from = i.wine?.drink_from_year;
      return s + (from != null && currentYear < from ? i.quantity : 0);
    }, 0);
    const expiredCount = locItems.reduce((s, i) => {
      const by = i.wine?.drink_by_year;
      return s + (by != null && currentYear > by ? i.quantity : 0);
    }, 0);

    return (
      <div className={cn('border rounded-lg bg-card overflow-hidden', isVirtual && 'border-dashed')}>
        <div className="flex items-center gap-3 px-4 py-3">
          <MapPin className={cn('h-3.5 w-3.5 shrink-0', isVirtual ? 'text-muted-foreground/50' : 'text-muted-foreground')} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Link
                href={`/profiles/${id}/location?name=${encodeURIComponent(loc.name)}`}
                className="text-sm font-medium hover:underline text-primary line-clamp-2 break-words"
              >
                {loc.name}
              </Link>
              {isVirtual && (
                <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">unregistered</span>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {loc.max_capacity == null && (
                <p className="text-xs text-muted-foreground">{used} bottle{used !== 1 ? 's' : ''}</p>
              )}
              {tooYoungCount > 0 && (
                <span className="text-xs text-blue-600">{tooYoungCount} too young</span>
              )}
              {expiredCount > 0 && (
                <span className="text-xs text-red-600">{expiredCount} past peak</span>
              )}
            </div>
          </div>
          {loc.max_capacity != null && (
            <CapacityBar used={used} max={loc.max_capacity} />
          )}
          {canWrite && (
            <div className="flex items-center gap-1 shrink-0">
              {isVirtual ? (
                <button
                  onClick={() => handleRegisterVirtual(loc)}
                  className="text-xs px-2 py-1 rounded border hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                  title="Add capacity tracking and grouping"
                >
                  Register
                </button>
              ) : isDeleting ? (
                <div className="flex items-center gap-1">
                  <button onClick={() => handleDeleteLocation(loc.id)} className="text-xs px-2 py-1 rounded bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Delete
                  </button>
                  <button onClick={() => setDeleteLocId(null)} className="text-xs px-2 py-1 rounded border hover:bg-accent">Cancel</button>
                </div>
              ) : (
                <>
                  <button
                    onClick={() => { setEditingLocId(isEditing ? null : loc.id); setDeleteLocId(null); }}
                    className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {isEditing ? <X className="h-3.5 w-3.5" /> : <Edit2 className="h-3.5 w-3.5" />}
                  </button>
                  <button
                    onClick={() => { setDeleteLocId(loc.id); setEditingLocId(null); }}
                    className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
            </div>
          )}
        </div>
        {isEditing && !isVirtual && (
          <LocationEditForm
            loc={loc}
            existingGroups={existingGroups}
            onSave={(data) => handleUpdateLocation(loc, data)}
            onCancel={() => setEditingLocId(null)}
          />
        )}
      </div>
    );
  };

  // ── Inventory tab content ───────────────────────────────────────────────────
  const InventoryTabContent = ({ viewMap, emptyLabel }: { viewMap: Record<string, CellarInventory[]>; emptyLabel: string }) => (
    <div className="space-y-3">
      {Object.keys(viewMap).length === 0 ? (
        <div className="text-center py-8 space-y-2">
          <Wine className="h-10 w-10 mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{emptyLabel}</p>
        </div>
      ) : (
        Object.entries(viewMap).map(([wineId, wineItems]) => {
          const wine = wineItems[0]?.wine;
          const total = wineItems.reduce((s, i) => s + i.quantity, 0);
          return (
            <div key={wineId} className="rounded-lg border bg-card overflow-hidden">
              <div
                className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => setSelectedWineId(selectedWineId === wineId ? null : wineId)}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{wine?.name ?? 'Unknown Wine'}</p>
                  {wine?.producer && <p className="text-xs text-muted-foreground">{wine.producer}</p>}
                </div>
                <span className="text-sm font-semibold ml-3 shrink-0">{total} btl</span>
              </div>
              {selectedWineId === wineId && (
                <div className="border-t px-4 py-3 space-y-2">
                  {wineItems.map(item => (
                    <div key={item.id} className="flex items-center gap-2 text-sm">
                      <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="flex-1">
                        <LocationLink profileId={id} locationName={item.location} className="text-sm" />
                      </span>
                      <span className="font-medium">{item.quantity}</span>
                    </div>
                  ))}
                  <Link href={`/wines/${wineId}`} className="text-xs text-primary hover:underline">
                    View wine & manage bottles →
                  </Link>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/profiles" className="text-muted-foreground hover:text-foreground" title="Switch Cellar">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-bold">{profile.name}</h2>
          {profile.description && <p className="text-sm text-muted-foreground">{profile.description}</p>}
        </div>
        <Link
          href="/profiles"
          className="text-xs text-muted-foreground hover:text-foreground border rounded px-2 py-1 hover:bg-accent transition-colors shrink-0"
        >
          Switch Cellar
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border bg-card px-4 py-3 text-center">
          <p className="text-2xl font-bold tabular-nums">
            {totalCapacity > 0 ? `${totalBottles}/${totalCapacity}` : totalBottles}
          </p>
          <p className="text-xs text-muted-foreground">Bottles{totalCapacity > 0 ? ' / Cap.' : ''}</p>
        </div>
        <div className="rounded-lg border bg-card px-4 py-3 text-center">
          <p className="text-2xl font-bold">{allLocations.length}</p>
          <p className="text-xs text-muted-foreground">Locations</p>
        </div>
        <button
          onClick={() => setActiveTab('unlocated')}
          className={cn('rounded-lg border px-4 py-3 text-center transition-colors',
            unlocatedBottles > 0 ? 'bg-amber-50 border-amber-200 hover:bg-amber-100' : 'bg-card hover:bg-muted/50'
          )}
        >
          <p className={cn('text-2xl font-bold', unlocatedBottles > 0 && 'text-amber-700')}>{unlocatedBottles}</p>
          <p className="text-xs text-muted-foreground">Unlocated</p>
        </button>
      </div>

      {/* Past peak alert — scrollable wine cards */}
      {pastPeakItems.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-red-700">
            <Wine className="h-3.5 w-3.5" />
            Past Peak
            <span className="font-normal">({pastPeakBottles} bottle{pastPeakBottles !== 1 ? 's' : ''})</span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {pastPeakItems.map((item, i) => (
              <Link
                key={`${item.wine_id}-${item.location}-${i}`}
                href={`/wines/${item.wine_id}`}
                className="shrink-0 rounded-md border bg-white/80 px-3 py-2 text-xs min-w-[140px] max-w-[180px] hover:bg-white transition-colors"
              >
                <p className="font-medium leading-tight line-clamp-2">{item.wine?.name ?? 'Unknown Wine'}</p>
                {item.wine?.vintage_year && <p className="text-muted-foreground mt-0.5">{item.wine.vintage_year}</p>}
                <p className="text-muted-foreground truncate mt-0.5">{item.location || 'Unlocated'}</p>
                {item.wine?.drink_by_year && (
                  <p className="text-red-600 mt-0.5">By {item.wine.drink_by_year}</p>
                )}
                <p className="text-muted-foreground mt-0.5">{item.quantity}×</p>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="space-y-4">
        {!isOwner && (
          <div className="rounded-md border px-3 py-2 text-xs text-muted-foreground bg-muted/30 flex items-center gap-2">
            <Share2 className="h-3.5 w-3.5 shrink-0" />
            {canWrite ? 'You have read & write access to this cellar.' : 'You have read-only access to this cellar.'}
          </div>
        )}
        <div className="flex gap-0 border-b overflow-x-auto">
          {(['locations', 'inventory', 'unlocated', 'transactions', ...(isOwner ? ['sharing'] : [])] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as typeof activeTab)}
              className={cn(
                'px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-1.5 whitespace-nowrap',
                activeTab === tab ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              {tab === 'locations' && 'Locations'}
              {tab === 'inventory' && 'Inventory'}
              {tab === 'unlocated' && (
                <>
                  Unlocated
                  {unlocatedBottles > 0 && (
                    <span className="text-xs bg-amber-100 text-amber-700 rounded-full px-1.5 py-0.5 font-semibold">
                      {unlocatedBottles}
                    </span>
                  )}
                </>
              )}
              {tab === 'transactions' && 'History'}
              {tab === 'sharing' && (
                <span className="flex items-center gap-1.5">
                  <Share2 className="h-3.5 w-3.5" />
                  Sharing
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Locations tab ── */}
        {activeTab === 'locations' && (
          <div className="space-y-4">
            {locError && (
              <div className="rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
                {locError}
              </div>
            )}

            {allLocations.length === 0 && !showAddForm && (
              <div className="text-center py-8 space-y-2">
                <MapPin className="h-10 w-10 mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No locations yet. Add a bottle to a location, or create one below.</p>
              </div>
            )}

            {virtualLocations.length > 0 && (
              <div className="flex items-start justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  Dashed locations come from your inventory.{canWrite && <> Click <strong>Register</strong> on individual locations, or use <strong>Fix Missing</strong> to register them all at once.</>}
                </p>
                {canWrite && (
                  <button
                    onClick={() => setShowRegisterWizard(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-100 text-amber-800 border border-amber-300 text-xs font-medium hover:bg-amber-200 transition-colors shrink-0"
                  >
                    <Wrench className="h-3.5 w-3.5" />
                    Fix Missing ({virtualLocations.length})
                  </button>
                )}
              </div>
            )}

            {/* Drink window alerts */}
            {(pastPeakBottles > 0 || tooYoungBottles > 0) && (
              <div className="flex gap-2 flex-wrap">
                {pastPeakBottles > 0 && (
                  <div className="flex-1 min-w-[130px] rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                    <p className="text-xs font-semibold text-red-700">Past Peak</p>
                    <p className="text-lg font-bold text-red-800">{pastPeakBottles}</p>
                    <p className="text-xs text-red-600">bottle{pastPeakBottles !== 1 ? 's' : ''} past ideal window</p>
                    <p className="text-xs text-red-500 mt-0.5">{new Set(pastPeakItems.map(i => i.wine_id)).size} wines</p>
                  </div>
                )}
                {tooYoungBottles > 0 && (
                  <div className="flex-1 min-w-[130px] rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
                    <p className="text-xs font-semibold text-blue-700">Too Young</p>
                    <p className="text-lg font-bold text-blue-800">{tooYoungBottles}</p>
                    <p className="text-xs text-blue-600">bottle{tooYoungBottles !== 1 ? 's' : ''} not ready yet</p>
                    <p className="text-xs text-blue-500 mt-0.5">{new Set(tooYoungItems.map(i => i.wine_id)).size} wines</p>
                  </div>
                )}
              </div>
            )}

            {/* Location list — hierarchy view when groups exist, group_name fallback otherwise */}
            {hierarchyTree.length > 0 ? (
              <div className="space-y-1">
                {hierarchyTree.map(node => (
                  <HierarchyNodeSection
                    key={node.id}
                    node={node}
                    depth={0}
                    collapsedGroups={collapsedHierarchyGroups}
                    onToggle={toggleHierarchyGroup}
                    renderLocation={(loc) => <LocationRow key={loc.id} loc={loc} />}
                  />
                ))}
                {hierarchyUngrouped.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <p className="text-xs text-muted-foreground px-1">Ungrouped</p>
                    {hierarchyUngrouped.map(loc => <LocationRow key={loc.id} loc={loc} />)}
                  </div>
                )}
              </div>
            ) : (
              groups.map(group => {
                const isNamed = group.groupName !== null;
                const isExpanded = !isNamed || expandedGroups.has(group.groupName!);
                return (
                  <div key={group.groupName ?? '__ungrouped__'} className="space-y-1.5">
                    {isNamed && (
                      <button
                        onClick={() => toggleGroup(group.groupName!)}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-muted/40 hover:bg-muted/70 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          {isExpanded
                            ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          }
                          <span className="text-sm font-semibold">{group.groupName}</span>
                          <span className="text-xs text-muted-foreground">
                            {group.locations.length} location{group.locations.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {group.totalCapacity != null ? (
                            <CapacityBar used={group.totalCurrent} max={group.totalCapacity} />
                          ) : (
                            <span className="text-xs text-muted-foreground">{group.totalCurrent} btl</span>
                          )}
                        </div>
                      </button>
                    )}
                    {isExpanded && (
                      <div className={cn('space-y-1.5', isNamed && 'pl-4')}>
                        {group.locations.map(loc => (
                          <LocationRow key={loc.id} loc={loc} />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}

            {/* Add / Bulk actions */}
            {canWrite && (showAddForm ? (
              <AddLocationForm
                profileId={id}
                existingGroups={existingGroups}
                onCreated={async () => { setShowAddForm(false); await loadAll(); }}
                onCancel={() => setShowAddForm(false)}
              />
            ) : (
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => setShowAddForm(true)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-md border text-sm hover:bg-accent transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Add Location
                </button>
                <Link
                  href="/scanner/bulk"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-md border text-sm hover:bg-accent transition-colors"
                >
                  <PackagePlus className="h-4 w-4" />
                  Bulk Scan
                </Link>
              </div>
            ))}
          </div>
        )}

        {/* ── Inventory tab ── */}
        {activeTab === 'inventory' && (
          <InventoryTabContent viewMap={byWine} emptyLabel="No located bottles. Add some via the scanner." />
        )}

        {/* ── Unlocated tab ── */}
        {activeTab === 'unlocated' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {unlocatedBottles === 0
                  ? 'All bottles have been assigned a location.'
                  : `${unlocatedBottles} bottle${unlocatedBottles !== 1 ? 's' : ''} need${unlocatedBottles === 1 ? 's' : ''} a location.`}
              </p>
              {canWrite && (
                <Link href="/scanner/bulk" className="flex items-center gap-1.5 text-xs text-primary hover:underline">
                  <PackagePlus className="h-3.5 w-3.5" />
                  Bulk Scan
                </Link>
              )}
            </div>
            <InventoryTabContent viewMap={byWineUnlocated} emptyLabel="No unlocated bottles." />
          </div>
        )}

        {/* ── Transactions tab ── */}
        {activeTab === 'transactions' && (
          <div className="rounded-lg border bg-card px-4 py-2">
            <TransactionLog transactions={transactions} />
          </div>
        )}

        {/* ── Sharing tab ── */}
        {activeTab === 'sharing' && isOwner && (
          <SharePanel profileId={id} />
        )}
      </div>

      {/* ── Register Missing Locations wizard modal ── */}
      {showRegisterWizard && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) setShowRegisterWizard(false); }}
        >
          <RegisterMissingWizard
            virtualLocations={virtualLocations}
            profileId={id}
            onComplete={async () => { setShowRegisterWizard(false); await loadAll(); }}
            onCancel={() => setShowRegisterWizard(false)}
          />
        </div>
      )}
    </div>
  );
}
