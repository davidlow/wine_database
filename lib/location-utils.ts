import type { LocationGroup } from '@/types';

export function parsePathSegments(raw: string): string[] {
  return raw.split('/').map(s => s.trim()).filter(Boolean);
}

export function groupPathToString(groupId: string | null, groups: LocationGroup[]): string {
  if (!groupId) return '';
  const groupMap = new Map(groups.map(g => [g.id, g]));
  const visited = new Set<string>();
  const ancestors: string[] = [];
  let cursor: string | null = groupId;
  while (cursor && !visited.has(cursor)) {
    visited.add(cursor);
    const g = groupMap.get(cursor);
    if (!g) break;
    ancestors.push(g.name);
    cursor = g.parent_id;
  }
  return ancestors.reverse().join('/');
}

export function resolvePathToGroupId(segments: string[], groups: LocationGroup[]): string | null {
  if (segments.length === 0) return null;
  const childrenOf = new Map<string | null, LocationGroup[]>();
  for (const g of groups) {
    const key = g.parent_id;
    if (!childrenOf.has(key)) childrenOf.set(key, []);
    childrenOf.get(key)!.push(g);
  }
  let currentParentId: string | null = null;
  for (const segment of segments) {
    const candidates: LocationGroup[] = childrenOf.get(currentParentId) ?? [];
    const match = candidates.find(g => g.name.trim().toLowerCase() === segment.trim().toLowerCase());
    if (!match) return null;
    currentParentId = match.id;
  }
  return currentParentId;
}

export function getPathSuggestions(inputPath: string, groups: LocationGroup[]): string[] {
  const childrenOf = new Map<string | null, LocationGroup[]>();
  for (const g of groups) {
    const key = g.parent_id;
    if (!childrenOf.has(key)) childrenOf.set(key, []);
    childrenOf.get(key)!.push(g);
  }

  const parts = inputPath.split('/');
  let prefixSegments: string[];
  let activeFragment: string;

  if (inputPath.endsWith('/')) {
    prefixSegments = parts.slice(0, -1).map(s => s.trim()).filter(Boolean);
    activeFragment = '';
  } else {
    prefixSegments = parts.slice(0, -1).map(s => s.trim()).filter(Boolean);
    activeFragment = (parts[parts.length - 1] ?? '').trim();
  }

  let prefixGroupId: string | null = null;
  if (prefixSegments.length > 0) {
    prefixGroupId = resolvePathToGroupId(prefixSegments, groups);
    if (prefixGroupId === null) return [];
  }

  const candidates = childrenOf.get(prefixGroupId) ?? [];
  const filtered = candidates.filter(g =>
    g.name.toLowerCase().startsWith(activeFragment.toLowerCase())
  );

  const prefixStr = prefixSegments.join('/');
  return filtered.map(g => prefixStr ? `${prefixStr}/${g.name}` : g.name);
}

export function isDescendant(candidateAncestorId: string, targetId: string, groups: LocationGroup[]): boolean {
  const groupMap = new Map(groups.map(g => [g.id, g]));
  const visited = new Set<string>();
  let cursor: string | null = candidateAncestorId;
  while (cursor && !visited.has(cursor)) {
    if (cursor === targetId) return true;
    visited.add(cursor);
    const g = groupMap.get(cursor);
    if (!g) break;
    cursor = g.parent_id;
  }
  return false;
}
