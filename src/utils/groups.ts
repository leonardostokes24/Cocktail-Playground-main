import type { Spec } from '../lib/supabase/queries';

/**
 * Automatic lineage groups.
 *
 * A group is a root spec plus everything descending from it — derived, never
 * stored. ⚑ CLAUDE.md forbids adding node types, so a group is not a React Flow
 * node: it owns no data, cannot be dragged, and is drawn as a hull behind the
 * cards. Deleting a root splits its group into several, which is correct and
 * needs no migration precisely because nothing was persisted.
 */

export type Group = {
  /** Derived groups key on their root spec; manual groups on their group row. */
  rootId: string;
  name: string;
  specIds: string[];
  kind: 'lineage' | 'manual';
};

const cache = new WeakMap<Spec[], Group[]>();

/** Walk to the root. Cycle-guarded: a corrupt parent row must not hang the canvas. */
function rootOf(spec: Spec, byId: Map<string, Spec>): Spec {
  const seen = new Set<string>([spec.id]);
  let cur = spec;
  while (cur.parent_spec_id) {
    const parent = byId.get(cur.parent_spec_id);
    if (!parent || seen.has(parent.id)) break;
    seen.add(parent.id);
    cur = parent;
  }
  return cur;
}

/**
 * Manual groups: sets the user gathered on purpose (migration 0008).
 *
 * Unlike a lineage group, a manual group of one is still a group — somebody
 * said so — so the single-member rule doesn't apply here.
 */
export function manualGroupsOf(
  specs: Spec[],
  groups: { id: string; name: string }[],
): Group[] {
  if (!groups.length) return [];
  const members = new Map<string, string[]>();
  for (const spec of specs) {
    if (!spec.group_id) continue;
    const bucket = members.get(spec.group_id);
    if (bucket) bucket.push(spec.id);
    else members.set(spec.group_id, [spec.id]);
  }
  return groups
    .filter(g => members.has(g.id))
    .map(g => ({ rootId: g.id, name: g.name, specIds: members.get(g.id)!, kind: 'manual' as const }));
}

export function groupsOf(specs: Spec[]): Group[] {
  const hit = cache.get(specs);
  if (hit) return hit;

  const byId = new Map(specs.map(s => [s.id, s]));
  const buckets = new Map<string, string[]>();

  for (const spec of specs) {
    const root = rootOf(spec, byId);
    const bucket = buckets.get(root.id);
    if (bucket) bucket.push(spec.id);
    else buckets.set(root.id, [spec.id]);
  }

  const result: Group[] = [];
  for (const [rootId, specIds] of buckets) {
    // A lone spec is not a group — a hull around one card says nothing.
    if (specIds.length < 2) continue;
    result.push({ rootId, name: byId.get(rootId)?.name ?? 'Lineage', specIds, kind: 'lineage' });
  }

  cache.set(specs, result);
  return result;
}
