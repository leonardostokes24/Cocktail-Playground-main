import type { Spec } from '../lib/supabase/queries';

/**
 * How many specs hang directly off each spec.
 *
 * This exists for the delete confirmation. `specs.parent_spec_id` is
 * ON DELETE SET NULL, so deleting a spec does not delete its twists — it
 * detaches them, and each becomes a root. That is destructive to the lineage
 * without destroying any row, which makes it exactly the kind of thing a
 * confirmation has to say out loud.
 */

// Keyed on the specs array itself: the store replaces it on every change, so a
// hit means nothing has moved and all 100 nodes share one computation.
const cache = new WeakMap<Spec[], Record<string, number>>();

export function childCounts(specs: Spec[]): Record<string, number> {
  const hit = cache.get(specs);
  if (hit) return hit;

  const result: Record<string, number> = {};
  for (const spec of specs) {
    const parent = spec.parent_spec_id;
    if (!parent) continue;
    result[parent] = (result[parent] ?? 0) + 1;
  }

  cache.set(specs, result);
  return result;
}

/**
 * How many twists would be left detached by deleting `ids` together.
 *
 * Not simply the sum of each spec's child count: a child selected alongside its
 * parent is deleted too, so it never becomes an orphan root. Only children that
 * survive the delete count.
 */
export function detachedBy(specs: Spec[], ids: string[]): number {
  if (!ids.length) return 0;
  const doomed = new Set(ids);
  let n = 0;
  for (const spec of specs) {
    if (doomed.has(spec.id)) continue;                       // dies with them
    if (spec.parent_spec_id && doomed.has(spec.parent_spec_id)) n++;
  }
  return n;
}
