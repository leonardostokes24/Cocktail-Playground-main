import type { Spec } from '../lib/supabase/queries';

/**
 * Ordinal for every non-root spec, numbered across its whole lineage tree in
 * creation order — the first twist off a root is 1, the next is 2, wherever it
 * hangs in the tree. Numbering per-parent instead would put several "Twist 1"
 * cards on one canvas, which is the ambiguity the number exists to remove.
 *
 * Roots get no number and are absent from the result.
 */

// Keyed on the specs array itself: the store replaces it on every change, so a
// hit means nothing has moved and all 100 nodes share one computation.
const cache = new WeakMap<Spec[], Record<string, number>>();

export function twistNumbers(specs: Spec[]): Record<string, number> {
  const hit = cache.get(specs);
  if (hit) return hit;

  const byId = new Map(specs.map(s => [s.id, s]));

  // Walk to the root. Guarded: a parent cycle here would otherwise hang the
  // canvas, and a corrupt row must not be able to do that.
  const rootOf = (spec: Spec): string => {
    const seen = new Set<string>([spec.id]);
    let cur = spec;
    while (cur.parent_spec_id) {
      const parent = byId.get(cur.parent_spec_id);
      if (!parent || seen.has(parent.id)) break;
      seen.add(parent.id);
      cur = parent;
    }
    return cur.id;
  };

  const groups = new Map<string, Spec[]>();
  for (const spec of specs) {
    if (!spec.parent_spec_id) continue;
    const root = rootOf(spec);
    const group = groups.get(root);
    if (group) group.push(spec);
    else groups.set(root, [spec]);
  }

  const result: Record<string, number> = {};
  for (const group of groups.values()) {
    // id breaks ties so numbering can't shuffle between renders when two specs
    // share a created_at.
    group.sort((a, b) =>
      a.created_at === b.created_at
        ? a.id.localeCompare(b.id)
        : a.created_at.localeCompare(b.created_at));
    group.forEach((spec, i) => { result[spec.id] = i + 1; });
  }

  cache.set(specs, result);
  return result;
}
