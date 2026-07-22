'use client';

import { useState, useEffect, useRef } from 'react';
import { Plus, Save, Trash2, Loader2, AlertCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { parsePathSegments } from '@/lib/location-utils';
import GroupPathCell from './GroupPathCell';
import type { LocationGroup } from '@/types';

type LocType = 'standard' | 'aging' | 'daily';
type RowStatus = 'idle' | 'saving' | 'saved' | 'error';

interface AddRow {
  id: string;
  rowType: 'location' | 'group';
  groupPath: string;
  name: string;
  maxQty: string;
  locType: LocType;
  status: RowStatus;
  errorMsg: string | null;
}

let _ctr = 0;
function uid() { return `alr${++_ctr}`; }
function blankRow(): AddRow {
  return { id: uid(), rowType: 'location', groupPath: '', name: '', maxQty: '', locType: 'standard', status: 'idle', errorMsg: null };
}

const inp = 'w-full border rounded px-1.5 py-0.5 text-xs bg-background focus:outline-none focus:ring-1 focus:ring-ring';

export default function BulkAddLocationsModal({
  open, onClose, profileId, groups, onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  profileId: string;
  groups: LocationGroup[];
  onSuccess: () => void;
}) {
  const [rows, setRows] = useState<AddRow[]>([blankRow(), blankRow(), blankRow()]);
  const [localGroups, setLocalGroups] = useState<LocationGroup[]>(groups);
  const sessionCache = useRef<Map<string, LocationGroup>>(new Map());
  const localGroupsRef = useRef<LocationGroup[]>(groups);

  // Reset when modal opens
  useEffect(() => {
    if (open) {
      setRows([blankRow(), blankRow(), blankRow()]);
      sessionCache.current = new Map();
      localGroupsRef.current = groups;
      setLocalGroups(groups);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync incoming groups (preserve session-created ones)
  useEffect(() => {
    const merged = [
      ...groups,
      ...Array.from(sessionCache.current.values()).filter(g => !groups.find(eg => eg.id === g.id)),
    ];
    localGroupsRef.current = merged;
    setLocalGroups(merged);
  }, [groups]);

  const updateRow = (id: string, patch: Partial<AddRow>) =>
    setRows(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));

  // Resolve or auto-create a slash-path, returns terminal group ID or null (root)
  const resolveOrCreatePath = async (pathStr: string): Promise<string | null> => {
    const segments = parsePathSegments(pathStr);
    if (segments.length === 0) return null;

    let currentParentId: string | null = null;
    const allGroups = [...localGroupsRef.current];

    for (const segment of segments) {
      const childrenHere = allGroups.filter(g => g.parent_id === currentParentId);
      const match = childrenHere.find(g => g.name.trim().toLowerCase() === segment.trim().toLowerCase());
      if (match) {
        currentParentId = match.id;
      } else {
        const res = await fetch('/api/location-groups', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            profile_id: profileId,
            name: segment.trim(),
            parent_id: currentParentId,
            sort_order: childrenHere.length,
          }),
        });
        if (!res.ok) {
          const err = await res.json() as { error?: string };
          throw new Error(err.error ?? 'Failed to create group');
        }
        const ng: LocationGroup = await res.json();
        sessionCache.current.set(ng.id, ng);
        allGroups.push(ng);
        localGroupsRef.current = [...localGroupsRef.current, ng];
        setLocalGroups(prev => [...prev.filter(g => g.id !== ng.id), ng]);
        currentParentId = ng.id;
      }
    }
    return currentParentId;
  };

  const saveOne = async (row: AddRow) => {
    if (!row.name.trim()) return;
    updateRow(row.id, { status: 'saving', errorMsg: null });
    try {
      const groupId = await resolveOrCreatePath(row.groupPath);

      if (row.rowType === 'group') {
        const res = await fetch('/api/location-groups', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            profile_id: profileId,
            name: row.name.trim(),
            parent_id: groupId,
            sort_order: 0,
          }),
        });
        if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error ?? 'Failed');
        const ng: LocationGroup = await res.json();
        sessionCache.current.set(ng.id, ng);
        localGroupsRef.current = [...localGroupsRef.current.filter(g => g.id !== ng.id), ng];
        setLocalGroups(prev => [...prev.filter(g => g.id !== ng.id), ng]);
      } else {
        const createRes = await fetch('/api/locations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            profile_id: profileId,
            name: row.name.trim(),
            max_capacity: row.maxQty ? (parseInt(row.maxQty, 10) || undefined) : undefined,
            location_type: row.locType,
          }),
        });
        if (!createRes.ok) throw new Error(((await createRes.json()) as { error?: string }).error ?? 'Failed');
        const newLoc = (await createRes.json()) as { id: string };
        if (groupId) {
          await fetch(`/api/locations/${newLoc.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ hierarchy_group_id: groupId }),
          });
        }
      }

      updateRow(row.id, { status: 'saved' });
      onSuccess();
    } catch (err) {
      updateRow(row.id, { status: 'error', errorMsg: err instanceof Error ? err.message : 'Save failed' });
    }
  };

  const handleSaveAll = async () => {
    const toSave = rows.filter(r => r.name.trim() && r.status !== 'saving' && r.status !== 'saved');
    for (const row of toSave) {
      await saveOne(row);
    }
  };

  const visibleRows = rows.filter(r => r.status !== 'saved');
  const saveableCount = rows.filter(r => r.name.trim() && r.status !== 'saving' && r.status !== 'saved').length;

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-[98vw] w-[98vw] sm:max-w-[98vw] sm:w-[98vw] max-h-[96vh] sm:max-h-[96vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-5 py-3 border-b shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle>Bulk Add Locations</DialogTitle>
            <button
              onClick={handleSaveAll}
              disabled={saveableCount === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              <Save className="h-3.5 w-3.5" />
              Save All
              {saveableCount > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-white/20 text-xs tabular-nums">
                  {saveableCount}
                </span>
              )}
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Use <code className="bg-muted px-1 rounded">Group/Subgroup</code> paths to set hierarchy. Missing groups are created automatically. Spaces allowed; leading/trailing slashes optional.
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          <table className="w-full text-xs border-collapse">
            <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10">
              <tr>
                <th className="px-2 py-2 text-left text-muted-foreground font-medium w-6">#</th>
                <th className="px-2 py-2 text-left text-muted-foreground font-medium w-28">Type</th>
                <th className="px-2 py-2 text-left text-muted-foreground font-medium min-w-[200px]">Group Path</th>
                <th className="px-2 py-2 text-left text-muted-foreground font-medium min-w-[160px]">Name *</th>
                <th className="px-2 py-2 text-left text-muted-foreground font-medium w-20">Max Qty</th>
                <th className="px-2 py-2 text-left text-muted-foreground font-medium w-28">Loc Type</th>
                <th className="px-2 py-2 text-left text-muted-foreground font-medium w-28">Status</th>
                <th className="px-2 py-2 text-left text-muted-foreground font-medium w-16">Save</th>
                <th className="px-2 py-2 w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {visibleRows.map((row, i) => {
                const isGroup = row.rowType === 'group';
                const isSaving = row.status === 'saving';
                return (
                  <tr
                    key={row.id}
                    className={cn(
                      'hover:bg-muted/30',
                      isGroup && 'bg-amber-50/50 dark:bg-amber-900/10'
                    )}
                  >
                    <td className="px-2 py-1.5 text-muted-foreground">{i + 1}</td>

                    {/* Type toggle */}
                    <td className="px-2 py-1.5">
                      <button
                        onClick={() => updateRow(row.id, { rowType: isGroup ? 'location' : 'group' })}
                        disabled={isSaving}
                        className={cn(
                          'text-xs px-2 py-0.5 rounded-full font-medium transition-colors',
                          isGroup
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                            : 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
                        )}
                      >
                        {isGroup ? '📁 Group' : '📍 Location'}
                      </button>
                    </td>

                    {/* Group Path */}
                    <td className="px-2 py-1.5">
                      <GroupPathCell
                        value={row.groupPath}
                        groups={localGroups}
                        onChange={v => updateRow(row.id, { groupPath: v })}
                        disabled={isSaving}
                        placeholder={isGroup ? 'Parent group (blank = root)' : 'Group/Subgroup'}
                      />
                    </td>

                    {/* Name */}
                    <td className="px-2 py-1.5">
                      <input
                        className={inp}
                        value={row.name}
                        disabled={isSaving}
                        onChange={e => updateRow(row.id, { name: e.target.value })}
                        placeholder={isGroup ? 'Group name' : 'Location name'}
                        onKeyDown={e => { if (e.key === 'Enter' && row.name.trim()) saveOne(row); }}
                      />
                    </td>

                    {/* Max Qty */}
                    <td className="px-2 py-1.5">
                      <input
                        type="number"
                        className={cn(inp, isGroup && 'opacity-40 cursor-not-allowed')}
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
                        className={cn(inp, isGroup && 'opacity-40 cursor-not-allowed')}
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
                      {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                      {row.status === 'error' && (
                        <span
                          className="text-destructive flex items-center gap-1"
                          title={row.errorMsg ?? ''}
                        >
                          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate max-w-[80px]">{row.errorMsg}</span>
                        </span>
                      )}
                    </td>

                    {/* Save */}
                    <td className="px-2 py-1.5">
                      <button
                        onClick={() => saveOne(row)}
                        disabled={!row.name.trim() || isSaving}
                        className="flex items-center gap-1 px-2 py-1 rounded border text-xs hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        {isSaving
                          ? <Loader2 className="h-3 w-3 animate-spin" />
                          : <Save className="h-3 w-3" />}
                        Save
                      </button>
                    </td>

                    {/* Remove row */}
                    <td className="px-2 py-1.5">
                      <button
                        onClick={() => setRows(prev => {
                          const n = prev.filter(r => r.id !== row.id);
                          return n.length ? n : [blankRow()];
                        })}
                        className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        title="Remove row"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {visibleRows.length === 0 && (
            <div className="text-center py-10 text-muted-foreground text-sm">
              All rows saved. Click &quot;+ Add row&quot; to continue.
            </div>
          )}
        </div>

        <div className="px-5 py-2.5 border-t shrink-0 flex items-center justify-between">
          <button
            onClick={() => setRows(prev => [...prev, blankRow()])}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Add row
          </button>
          <span className="text-xs text-muted-foreground">
            {visibleRows.length} row{visibleRows.length !== 1 ? 's' : ''}
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
