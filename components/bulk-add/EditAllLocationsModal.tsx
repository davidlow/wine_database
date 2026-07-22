'use client';

import { useState, useCallback, useEffect } from 'react';
import { Save, Trash2, Loader2, RefreshCw, Folder, MapPin, X, AlertCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import {
  parsePathSegments, groupPathToString, resolvePathToGroupId, isDescendant,
} from '@/lib/location-utils';
import GroupPathCell from './GroupPathCell';
import type { LocationGroup, Location } from '@/types';

type LocType = 'standard' | 'aging' | 'daily';
type RowStatus = 'idle' | 'saving' | 'saved' | 'error';

interface EditRowOrig {
  name: string;
  groupPath: string;
  maxQty: string;
  locType: LocType;
}

interface EditRow {
  id: string;
  kind: 'location' | 'group';
  name: string;
  groupPath: string;
  maxQty: string;
  locType: LocType;
  status: RowStatus;
  errorMsg: string | null;
  fullPath: string;
  _orig: EditRowOrig;
}

function computeEditRows(groups: LocationGroup[], locations: Location[]): EditRow[] {
  const rows: EditRow[] = [];
  for (const g of groups) {
    const parentPath = groupPathToString(g.parent_id, groups);
    const selfPath = parentPath ? `${parentPath}/${g.name}` : g.name;
    rows.push({
      id: g.id, kind: 'group',
      name: g.name, groupPath: parentPath,
      maxQty: '', locType: 'standard',
      status: 'idle', errorMsg: null,
      fullPath: selfPath,
      _orig: { name: g.name, groupPath: parentPath, maxQty: '', locType: 'standard' },
    });
  }
  for (const l of locations) {
    const parentPath = groupPathToString(l.hierarchy_group_id ?? null, groups);
    const selfPath = parentPath ? `${parentPath}/${l.name}` : l.name;
    const locType = (l.location_type ?? 'standard') as LocType;
    const maxQty = l.max_capacity != null ? String(l.max_capacity) : '';
    rows.push({
      id: l.id, kind: 'location',
      name: l.name, groupPath: parentPath,
      maxQty, locType,
      status: 'idle', errorMsg: null,
      fullPath: selfPath,
      _orig: { name: l.name, groupPath: parentPath, maxQty, locType },
    });
  }
  rows.sort((a, b) => a.fullPath.toLowerCase().localeCompare(b.fullPath.toLowerCase()));
  return rows;
}

function isDirty(row: EditRow): boolean {
  return row.name !== row._orig.name
    || row.groupPath !== row._orig.groupPath
    || row.maxQty !== row._orig.maxQty
    || row.locType !== row._orig.locType;
}

const cellCls = 'w-full border rounded px-1.5 py-0.5 text-xs bg-background focus:outline-none focus:ring-1 focus:ring-ring';

export default function EditAllLocationsModal({
  open, onClose, profileId, onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  profileId: string;
  onSuccess: () => void;
}) {
  const [rows, setRows] = useState<EditRow[]>([]);
  const [groups, setGroups] = useState<LocationGroup[]>([]);
  const [allLocations, setAllLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(false);
  const [pendingDeletes, setPendingDeletes] = useState<Set<string>>(new Set());

  const loadData = useCallback(async () => {
    if (!profileId) return;
    setLoading(true);
    try {
      const [gRes, lRes] = await Promise.all([
        fetch(`/api/location-groups?profile_id=${profileId}`),
        fetch(`/api/locations?profile_id=${profileId}`),
      ]);
      const grps: LocationGroup[] = gRes.ok ? await gRes.json() : [];
      const locs: Location[] = lRes.ok ? await lRes.json() : [];
      setGroups(grps);
      setAllLocations(locs);
      setRows(computeEditRows(grps, locs));
      setPendingDeletes(new Set());
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  useEffect(() => { if (open) loadData(); }, [open, loadData]);

  const updateRow = (id: string, patch: Partial<EditRow>) =>
    setRows(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));

  const saveRow = async (row: EditRow) => {
    if (!row.name.trim()) return;

    // Validate group path (must exist — no auto-create in Edit All)
    const segments = parsePathSegments(row.groupPath);
    let resolvedParentId: string | null = null;
    if (segments.length > 0) {
      resolvedParentId = resolvePathToGroupId(segments, groups);
      if (resolvedParentId === null) {
        updateRow(row.id, { status: 'error', errorMsg: 'Path does not exist. Use Bulk Add to create new groups.' });
        return;
      }
    }

    // Cycle check for group reparent
    if (row.kind === 'group' && resolvedParentId !== null) {
      if (resolvedParentId === row.id || isDescendant(resolvedParentId, row.id, groups)) {
        updateRow(row.id, { status: 'error', errorMsg: 'Cannot move a group into its own descendant.' });
        return;
      }
    }

    updateRow(row.id, { status: 'saving', errorMsg: null });

    try {
      if (row.kind === 'group') {
        const patch: Record<string, unknown> = {};
        if (row.name.trim() !== row._orig.name) patch.name = row.name.trim();
        if (row.groupPath !== row._orig.groupPath) patch.parent_id = resolvedParentId;
        if (Object.keys(patch).length > 0) {
          const res = await fetch(`/api/location-groups/${row.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(patch),
          });
          if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error ?? 'Failed');
          const updated: LocationGroup = await res.json();
          setGroups(prev => prev.map(g => g.id === updated.id ? updated : g));
        }
      } else {
        const patch: Record<string, unknown> = {};
        if (row.name.trim() !== row._orig.name) patch.name = row.name.trim();
        if (row.groupPath !== row._orig.groupPath) patch.hierarchy_group_id = resolvedParentId;
        if (row.maxQty !== row._orig.maxQty) patch.max_capacity = row.maxQty ? (parseInt(row.maxQty, 10) || null) : null;
        if (row.locType !== row._orig.locType) patch.location_type = row.locType;
        if (Object.keys(patch).length > 0) {
          const res = await fetch(`/api/locations/${row.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(patch),
          });
          if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error ?? 'Failed');
        }
      }

      const newName = row.name.trim();
      const newFullPath = row.groupPath ? `${row.groupPath}/${newName}` : newName;
      const newOrig: EditRowOrig = { name: newName, groupPath: row.groupPath, maxQty: row.maxQty, locType: row.locType };

      setRows(prev => {
        const next = prev.map(r => r.id === row.id
          ? { ...r, name: newName, status: 'saved' as RowStatus, _orig: newOrig, fullPath: newFullPath }
          : r);
        return [...next].sort((a, b) => a.fullPath.toLowerCase().localeCompare(b.fullPath.toLowerCase()));
      });

      onSuccess();
      setTimeout(() => updateRow(row.id, { status: 'idle' }), 800);
    } catch (err) {
      updateRow(row.id, { status: 'error', errorMsg: err instanceof Error ? err.message : 'Save failed' });
    }
  };

  const deleteLocation = async (rowId: string) => {
    updateRow(rowId, { status: 'saving', errorMsg: null });
    try {
      const res = await fetch(`/api/locations/${rowId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error ?? 'Failed');
      setRows(prev => prev.filter(r => r.id !== rowId));
      setPendingDeletes(prev => { const n = new Set(prev); n.delete(rowId); return n; });
      onSuccess();
    } catch (err) {
      updateRow(rowId, { status: 'error', errorMsg: err instanceof Error ? err.message : 'Delete failed' });
      setPendingDeletes(prev => { const n = new Set(prev); n.delete(rowId); return n; });
    }
  };

  const deleteGroup = async (rowId: string) => {
    const group = groups.find(g => g.id === rowId);
    if (!group) return;
    const newParentId = group.parent_id;
    const childGroups = groups.filter(g => g.parent_id === rowId);
    const memberLocs = allLocations.filter(l => l.hierarchy_group_id === rowId);
    const total = childGroups.length + memberLocs.length;

    updateRow(rowId, { status: 'saving', errorMsg: total > 0 ? `Reparenting ${total} item(s)…` : null });

    try {
      for (const child of childGroups) {
        const res = await fetch(`/api/location-groups/${child.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ parent_id: newParentId }),
        });
        if (!res.ok) throw new Error(`Failed to reparent group "${child.name}"`);
      }
      for (const loc of memberLocs) {
        const res = await fetch(`/api/locations/${loc.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hierarchy_group_id: newParentId }),
        });
        if (!res.ok) throw new Error(`Failed to reparent location "${loc.name}"`);
      }
      const res = await fetch(`/api/location-groups/${rowId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error ?? 'Failed');
      setPendingDeletes(prev => { const n = new Set(prev); n.delete(rowId); return n; });
      onSuccess();
      await loadData();
    } catch (err) {
      updateRow(rowId, { status: 'error', errorMsg: err instanceof Error ? err.message : 'Delete failed' });
      setPendingDeletes(prev => { const n = new Set(prev); n.delete(rowId); return n; });
    }
  };

  const cancelDelete = (rowId: string) =>
    setPendingDeletes(prev => { const n = new Set(prev); n.delete(rowId); return n; });

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-[98vw] w-[98vw] sm:max-w-[98vw] sm:w-[98vw] max-h-[96vh] sm:max-h-[96vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-5 py-3 border-b shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle>Edit Locations &amp; Groups</DialogTitle>
            <button
              onClick={loadData}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs hover:bg-accent disabled:opacity-50 transition-colors"
            >
              {loading
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <RefreshCw className="h-3.5 w-3.5" />}
              Reload
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Group paths must already exist — use &quot;Bulk Add Locations&quot; to create new groups.
            Deleting a group moves its contents to its parent.
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground text-sm">
              No locations or groups yet. Use &quot;Bulk Add Locations&quot; to create some.
            </div>
          ) : (
            <table className="w-full text-xs border-collapse">
              <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10">
                <tr>
                  <th className="px-2 py-2 text-left text-muted-foreground font-medium w-6">#</th>
                  <th className="px-2 py-2 text-left text-muted-foreground font-medium w-24">Kind</th>
                  <th className="px-2 py-2 text-left text-muted-foreground font-medium min-w-[200px]">Group Path</th>
                  <th className="px-2 py-2 text-left text-muted-foreground font-medium min-w-[160px]">Name</th>
                  <th className="px-2 py-2 text-left text-muted-foreground font-medium w-20">Max Qty</th>
                  <th className="px-2 py-2 text-left text-muted-foreground font-medium w-28">Loc Type</th>
                  <th className="px-2 py-2 text-left text-muted-foreground font-medium w-32">Status</th>
                  <th className="px-2 py-2 text-left text-muted-foreground font-medium w-16">Save</th>
                  <th className="px-2 py-2 text-left text-muted-foreground font-medium w-32">Delete</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((row, i) => {
                  const isGroup = row.kind === 'group';
                  const isSaving = row.status === 'saving';
                  const dirty = isDirty(row);
                  const pending = pendingDeletes.has(row.id);
                  return (
                    <tr
                      key={row.id}
                      className={cn(
                        'hover:bg-muted/30',
                        isGroup && 'bg-amber-50/40 dark:bg-amber-900/10'
                      )}
                    >
                      <td className="px-2 py-1.5 text-muted-foreground">{i + 1}</td>

                      {/* Kind badge */}
                      <td className="px-2 py-1.5">
                        <span className={cn(
                          'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                          isGroup
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                            : 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
                        )}>
                          {isGroup ? <Folder className="h-3 w-3" /> : <MapPin className="h-3 w-3" />}
                          {isGroup ? 'Group' : 'Location'}
                        </span>
                      </td>

                      {/* Group Path */}
                      <td className="px-2 py-1.5">
                        <GroupPathCell
                          value={row.groupPath}
                          groups={groups}
                          onChange={v => updateRow(row.id, { groupPath: v })}
                          disabled={isSaving}
                          placeholder={isGroup ? 'Parent group (blank = root)' : 'Group/Subgroup'}
                        />
                      </td>

                      {/* Name */}
                      <td className="px-2 py-1.5">
                        <input
                          className={cellCls}
                          value={row.name}
                          disabled={isSaving}
                          onChange={e => updateRow(row.id, { name: e.target.value })}
                        />
                      </td>

                      {/* Max Qty */}
                      <td className="px-2 py-1.5">
                        <input
                          type="number"
                          className={cn(cellCls, isGroup && 'opacity-40 cursor-not-allowed')}
                          value={row.maxQty}
                          disabled={isGroup || isSaving}
                          onChange={e => updateRow(row.id, { maxQty: e.target.value })}
                          placeholder="∞"
                          min={1}
                        />
                      </td>

                      {/* Loc Type */}
                      <td className="px-2 py-1.5">
                        <select
                          className={cn(cellCls, isGroup && 'opacity-40 cursor-not-allowed')}
                          value={row.locType}
                          disabled={isGroup || isSaving}
                          onChange={e => updateRow(row.id, { locType: e.target.value as LocType })}
                        >
                          <option value="standard">Standard</option>
                          <option value="aging">Aging</option>
                          <option value="daily">Daily</option>
                        </select>
                      </td>

                      {/* Status */}
                      <td className="px-2 py-1.5">
                        {isSaving && (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                            {row.errorMsg && (
                              <span className="text-xs truncate max-w-[80px]">{row.errorMsg}</span>
                            )}
                          </div>
                        )}
                        {row.status === 'saved' && (
                          <span className="text-green-600 dark:text-green-400 text-xs font-medium">Saved ✓</span>
                        )}
                        {row.status === 'error' && (
                          <span
                            className="text-destructive flex items-center gap-1"
                            title={row.errorMsg ?? ''}
                          >
                            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate max-w-[80px] text-xs">{row.errorMsg}</span>
                          </span>
                        )}
                      </td>

                      {/* Save */}
                      <td className="px-2 py-1.5">
                        <button
                          onClick={() => saveRow(row)}
                          disabled={!dirty || isSaving || !row.name.trim()}
                          className="flex items-center gap-1 px-2 py-1 rounded border text-xs hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          <Save className="h-3 w-3" />
                          Save
                        </button>
                      </td>

                      {/* Delete */}
                      <td className="px-2 py-1.5">
                        {pending ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => isGroup ? deleteGroup(row.id) : deleteLocation(row.id)}
                              disabled={isSaving}
                              className="text-xs px-2 py-0.5 rounded bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50 transition-colors"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => cancelDelete(row.id)}
                              className="p-0.5 rounded border hover:bg-accent transition-colors"
                              title="Cancel delete"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setPendingDeletes(prev => new Set([...prev, row.id]))}
                            disabled={isSaving}
                            className="flex items-center gap-1 px-2 py-1 rounded border text-xs text-muted-foreground hover:text-destructive hover:border-destructive/50 disabled:opacity-40 transition-colors"
                          >
                            <Trash2 className="h-3 w-3" />
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
