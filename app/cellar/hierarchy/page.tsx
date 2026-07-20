'use client';

import { useState, useEffect, useCallback } from 'react';
import { useProfile } from '@/hooks/useProfile';
import {
  FolderTree, ChevronDown, ChevronRight as ChevronRightIcon, Plus,
  Pencil, Trash2, Loader2, X, Check, FolderOpen, Folder, MapPin,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Location, LocationGroup } from '@/types';

interface GroupWithChildren extends LocationGroup {
  children: GroupWithChildren[];
  locations: Location[];
}

function buildTree(groups: LocationGroup[], locations: Location[]): GroupWithChildren[] {
  const nodeMap = new Map<string, GroupWithChildren>();
  for (const g of groups) {
    nodeMap.set(g.id, { ...g, children: [], locations: [] });
  }
  const roots: GroupWithChildren[] = [];
  for (const g of groups) {
    const node = nodeMap.get(g.id)!;
    if (g.parent_id && nodeMap.has(g.parent_id)) {
      nodeMap.get(g.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  for (const loc of locations) {
    if (loc.hierarchy_group_id && nodeMap.has(loc.hierarchy_group_id)) {
      nodeMap.get(loc.hierarchy_group_id)!.locations.push(loc);
    }
  }
  // Sort children and locations by sort_order then name
  function sortNode(node: GroupWithChildren) {
    node.children.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
    node.locations.sort((a, b) => a.name.localeCompare(b.name));
    node.children.forEach(sortNode);
  }
  roots.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
  roots.forEach(sortNode);
  return roots;
}

function GroupNode({
  node,
  depth,
  groups,
  unassignedLocations,
  profileId,
  onRefresh,
}: {
  node: GroupWithChildren;
  depth: number;
  groups: LocationGroup[];
  unassignedLocations: Location[];
  profileId: string;
  onRefresh: () => void;
}) {
  const [open, setOpen] = useState(true);
  const [renaming, setRenaming] = useState(false);
  const [renameName, setRenameName] = useState(node.name);
  const [addingSubgroup, setAddingSubgroup] = useState(false);
  const [subgroupName, setSubgroupName] = useState('');
  const [assigning, setAssigning] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const indent = depth * 16;

  const handleRename = async () => {
    if (!renameName.trim() || renameName === node.name) { setRenaming(false); return; }
    setSaving(true);
    try {
      await fetch(`/api/location-groups/${node.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: renameName.trim() }),
      });
      onRefresh();
    } finally {
      setSaving(false);
      setRenaming(false);
    }
  };

  const handleAddSubgroup = async () => {
    if (!subgroupName.trim()) return;
    setSaving(true);
    try {
      await fetch('/api/location-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile_id: profileId, name: subgroupName.trim(), parent_id: node.id, sort_order: node.children.length }),
      });
      setSubgroupName('');
      setAddingSubgroup(false);
      onRefresh();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      await fetch(`/api/location-groups/${node.id}`, { method: 'DELETE' });
      onRefresh();
    } finally {
      setSaving(false);
      setConfirmDelete(false);
    }
  };

  const handleAssignLocation = async (locId: string) => {
    if (!locId) return;
    setAssigning(locId);
    try {
      await fetch(`/api/locations/${locId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hierarchy_group_id: node.id }),
      });
      onRefresh();
    } finally {
      setAssigning('');
    }
  };

  const handleRemoveLocation = async (locId: string) => {
    try {
      await fetch(`/api/locations/${locId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hierarchy_group_id: null }),
      });
      onRefresh();
    } catch {}
  };

  const hasContent = node.children.length > 0 || node.locations.length > 0;

  return (
    <div>
      {/* Group header */}
      <div
        className="flex items-center gap-1.5 py-1.5 pr-2 rounded-md hover:bg-accent/40 group transition-colors"
        style={{ paddingLeft: `${indent + 8}px` }}
      >
        <button
          onClick={() => setOpen(o => !o)}
          className="shrink-0 text-muted-foreground hover:text-foreground"
        >
          {hasContent
            ? open
              ? <ChevronDown className="h-3.5 w-3.5" />
              : <ChevronRightIcon className="h-3.5 w-3.5" />
            : <span className="w-3.5 inline-block" />
          }
        </button>
        {open ? (
          <FolderOpen className="h-4 w-4 text-primary/70 shrink-0" />
        ) : (
          <Folder className="h-4 w-4 text-primary/70 shrink-0" />
        )}

        {renaming ? (
          <div className="flex items-center gap-1 flex-1">
            <input
              autoFocus
              value={renameName}
              onChange={e => setRenameName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setRenaming(false); }}
              className="flex-1 rounded border bg-background px-2 py-0.5 text-sm"
            />
            <button onClick={handleRename} disabled={saving} className="text-primary hover:text-primary/80 disabled:opacity-50">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            </button>
            <button onClick={() => setRenaming(false)} className="text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <>
            <span className="flex-1 text-sm font-medium truncate">{node.name}</span>
            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 shrink-0">
              <button
                onClick={() => { setRenaming(true); setRenameName(node.name); }}
                className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
                title="Rename"
              >
                <Pencil className="h-3 w-3" />
              </button>
              <button
                onClick={() => setAddingSubgroup(v => !v)}
                className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
                title="Add subgroup"
              >
                <Plus className="h-3 w-3" />
              </button>
              {confirmDelete ? (
                <>
                  <button onClick={handleDelete} disabled={saving} className="p-1 rounded bg-destructive/10 text-destructive hover:bg-destructive/20 text-xs px-1.5">
                    {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Delete?'}
                  </button>
                  <button onClick={() => setConfirmDelete(false)} className="p-1 rounded hover:bg-accent text-muted-foreground">
                    <X className="h-3 w-3" />
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-destructive"
                  title="Delete group"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* Expanded content */}
      {open && (
        <div>
          {/* Member locations */}
          {node.locations.map(loc => (
            <div
              key={loc.id}
              className="flex items-center gap-1.5 py-1 pr-2 text-sm text-muted-foreground hover:bg-accent/30 rounded-md group transition-colors"
              style={{ paddingLeft: `${indent + 28}px` }}
            >
              <MapPin className="h-3 w-3 shrink-0 text-primary/50" />
              <span className="flex-1 truncate">{loc.name}</span>
              <button
                onClick={() => handleRemoveLocation(loc.id)}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-accent text-muted-foreground hover:text-destructive"
                title="Remove from group"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}

          {/* Add-location selector */}
          {unassignedLocations.length > 0 && (
            <div style={{ paddingLeft: `${indent + 28}px` }} className="py-1 pr-2">
              <select
                value=""
                onChange={e => handleAssignLocation(e.target.value)}
                disabled={!!assigning}
                className="rounded border bg-background px-2 py-0.5 text-xs text-muted-foreground w-full max-w-[200px] cursor-pointer"
              >
                <option value="">Add location…</option>
                {unassignedLocations.map(l => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Add-subgroup input */}
          {addingSubgroup && (
            <div
              className="flex items-center gap-1 py-1 pr-2"
              style={{ paddingLeft: `${indent + 28}px` }}
            >
              <Plus className="h-3 w-3 text-muted-foreground shrink-0" />
              <input
                autoFocus
                value={subgroupName}
                onChange={e => setSubgroupName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAddSubgroup(); if (e.key === 'Escape') setAddingSubgroup(false); }}
                placeholder="Subgroup name…"
                className="flex-1 rounded border bg-background px-2 py-0.5 text-sm"
              />
              <button onClick={handleAddSubgroup} disabled={saving || !subgroupName.trim()} className="text-primary disabled:opacity-40">
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              </button>
              <button onClick={() => setAddingSubgroup(false)} className="text-muted-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Recursive children */}
          {node.children.map(child => (
            <GroupNode
              key={child.id}
              node={child}
              depth={depth + 1}
              groups={groups}
              unassignedLocations={unassignedLocations}
              profileId={profileId}
              onRefresh={onRefresh}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function HierarchyPage() {
  const { activeProfile } = useProfile();
  const profileId = activeProfile?.id;

  const [groups, setGroups] = useState<LocationGroup[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [newGroupName, setNewGroupName] = useState('');
  const [addingRoot, setAddingRoot] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!profileId) return;
    try {
      const [gRes, lRes] = await Promise.all([
        fetch(`/api/location-groups?profile_id=${profileId}`),
        fetch(`/api/locations?profile_id=${profileId}`),
      ]);
      if (gRes.ok) setGroups(await gRes.json());
      if (lRes.ok) setLocations(await lRes.json());
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  useEffect(() => { load(); }, [load]);

  const tree = buildTree(groups, locations);
  const assignedLocIds = new Set(
    locations.filter(l => l.hierarchy_group_id).map(l => l.id)
  );
  const unassignedLocations = locations.filter(l => !assignedLocIds.has(l.id));

  const handleAddRootGroup = async () => {
    if (!newGroupName.trim() || !profileId) return;
    setSaving(true);
    try {
      await fetch('/api/location-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile_id: profileId, name: newGroupName.trim(), parent_id: null, sort_order: groups.filter(g => !g.parent_id).length }),
      });
      setNewGroupName('');
      setAddingRoot(false);
      load();
    } finally {
      setSaving(false);
    }
  };

  const handleAssignUnassigned = async (locId: string, groupId: string) => {
    if (!groupId) return;
    await fetch(`/api/locations/${locId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hierarchy_group_id: groupId }),
    });
    load();
  };

  if (!profileId) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Select a cellar profile to manage proximity groups.
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <FolderTree className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-xl font-bold">Proximity Groups</h1>
          <p className="text-sm text-muted-foreground">
            Group nearby locations into a hierarchy — used for walk-order optimization.
          </p>
        </div>
      </div>

      {/* How it works callout */}
      <div className="rounded-md bg-muted/60 px-4 py-3 text-xs text-muted-foreground space-y-1">
        <p className="font-medium text-foreground">How proximity works</p>
        <p>
          Locations in the same group are treated as adjacent. The further up the tree you must travel
          to find a common ancestor, the farther apart two locations are considered.
        </p>
        <p>
          Example: Rack A-1 and A-2 are in <em>Bay A-Left</em> → siblings (distance 2).
          Bay A-Left and Bay A-Right are in <em>Section A</em> → cousins (distance 4).
          Section A and Section B share only the root → far apart.
        </p>
      </div>

      {/* Tree editor */}
      <div className="rounded-lg border">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <span className="text-sm font-semibold">Groups</span>
          <button
            onClick={() => setAddingRoot(v => !v)}
            className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            New Group
          </button>
        </div>

        {/* Add root group input */}
        {addingRoot && (
          <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/30">
            <Folder className="h-4 w-4 text-primary/60 shrink-0" />
            <input
              autoFocus
              value={newGroupName}
              onChange={e => setNewGroupName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAddRootGroup(); if (e.key === 'Escape') setAddingRoot(false); }}
              placeholder="Group name…"
              className="flex-1 rounded border bg-background px-2 py-1 text-sm"
            />
            <button onClick={handleAddRootGroup} disabled={saving || !newGroupName.trim()} className="text-primary disabled:opacity-40">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            </button>
            <button onClick={() => setAddingRoot(false)} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="px-2 py-2">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : tree.length === 0 && !addingRoot ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No groups yet. Create a group to start organizing your locations.
            </p>
          ) : (
            tree.map(node => (
              <GroupNode
                key={node.id}
                node={node}
                depth={0}
                groups={groups}
                unassignedLocations={unassignedLocations}
                profileId={profileId}
                onRefresh={load}
              />
            ))
          )}
        </div>
      </div>

      {/* Unassigned locations */}
      {unassignedLocations.length > 0 && (
        <div className="rounded-lg border">
          <div className="px-4 py-3 border-b">
            <span className="text-sm font-semibold text-muted-foreground">Unassigned Locations</span>
          </div>
          <div className="px-4 py-2 space-y-1">
            {unassignedLocations.map(loc => (
              <div key={loc.id} className="flex items-center gap-2 py-1">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
                <span className="text-sm flex-1 truncate">{loc.name}</span>
                {groups.length > 0 && (
                  <select
                    defaultValue=""
                    onChange={e => handleAssignUnassigned(loc.id, e.target.value)}
                    className={cn(
                      'rounded border bg-background px-2 py-0.5 text-xs text-muted-foreground cursor-pointer'
                    )}
                  >
                    <option value="">Assign to group…</option>
                    {groups.map(g => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
