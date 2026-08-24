import type { Spec } from '../lib/supabase/queries';

/**
 * Vertical lineage layout.
 *
 * Lineage runs top-to-bottom: a child sits below its parent, siblings fan out
 * sideways. Node width is fixed at 232px, so the sideways axis is the easy one;
 * height varies with the recipe, which is why ROW_PITCH is generous rather than
 * measured. Measured row pitch is a later step.
 */

export const NODE_W = 232;
export const COL_PITCH = 260;   // 232 card + 28 gutter
export const ROW_PITCH = 250;

/** Two nodes are considered clashing if their cards would visibly overlap. */
function clashes(ax: number, ay: number, bx: number, by: number): boolean {
  return Math.abs(ax - bx) < COL_PITCH - 8 && Math.abs(ay - by) < 170;
}

/**
 * Where a new child of `parent` should go.
 *
 * The first child sits directly under its parent so a single-child chain reads
 * as a straight spine; later siblings fan right. If that slot is already taken —
 * by a cousin, or by a node the user dragged there — it steps right until it
 * finds clear space rather than stacking invisibly on top of something.
 *
 * Before this, every child of a parent got the same offset with no sibling
 * term, so two twists off one root landed on identical coordinates and the
 * second completely hid the first.
 */
export function placeChild(specs: Spec[], parent: Spec): { x: number; y: number } {
  const siblingCount = specs.filter(s => s.parent_spec_id === parent.id).length;
  const y = parent.canvas_y + ROW_PITCH;

  let x = parent.canvas_x + siblingCount * COL_PITCH;

  // Bounded: a pathological canvas must not spin here.
  for (let guard = 0; guard < 200; guard++) {
    const occupied = specs.some(s => clashes(x, y, s.canvas_x, s.canvas_y));
    if (!occupied) break;
    x += COL_PITCH;
  }
  return { x, y };
}

/** Where a brand-new root should go: to the right of everything, same top line. */
export function placeRoot(specs: Spec[]): { x: number; y: number } {
  if (!specs.length) return { x: 120, y: 120 };
  const maxX = Math.max(...specs.map(s => s.canvas_x));
  const minY = Math.min(...specs.map(s => s.canvas_y));
  return { x: maxX + COL_PITCH + 60, y: minY };
}

/**
 * Lay a set of specs out as a vertical lineage tree.
 *
 * Depth becomes the row, siblings spread across columns, and a parent is
 * centred over the span its subtree occupies. Replaces a √n grid, which moved
 * nodes but destroyed the one thing the canvas is for — you could not read
 * which drink came from which.
 *
 * Pure: returns coordinates, writes nothing. A spec whose parent isn't in the
 * set is treated as a root, so tidying a selection doesn't drag in its cousins.
 */
export function tidyTree(specs: Spec[], ids: string[]): Map<string, { x: number; y: number }> {
  const inSet = new Set(ids);
  const chosen = specs.filter(s => inSet.has(s.id));
  const out = new Map<string, { x: number; y: number }>();
  if (!chosen.length) return out;

  const byId = new Map(chosen.map(s => [s.id, s]));
  const children = new Map<string, Spec[]>();
  const roots: Spec[] = [];

  // Stable ordering, so tidying twice gives the same answer.
  const ordered = [...chosen].sort((a, b) =>
    a.created_at === b.created_at ? a.id.localeCompare(b.id) : a.created_at.localeCompare(b.created_at));

  for (const s of ordered) {
    const parent = s.parent_spec_id && byId.has(s.parent_spec_id) ? s.parent_spec_id : null;
    if (!parent) { roots.push(s); continue; }
    const bucket = children.get(parent);
    if (bucket) bucket.push(s); else children.set(parent, [s]);
  }

  // Width of a subtree in columns. Cycle-guarded: a corrupt parent chain must
  // not recurse forever.
  const widthCache = new Map<string, number>();
  const width = (id: string, seen: Set<string>): number => {
    if (widthCache.has(id)) return widthCache.get(id)!;
    if (seen.has(id)) return 1;
    seen.add(id);
    const kids = children.get(id) ?? [];
    const w = kids.length ? kids.reduce((sum, k) => sum + width(k.id, seen), 0) : 1;
    widthCache.set(id, w);
    return w;
  };

  const place = (id: string, depth: number, startCol: number, seen: Set<string>) => {
    if (seen.has(id)) return;
    seen.add(id);
    const kids = children.get(id) ?? [];
    const w = width(id, new Set());
    // Centre the parent over its own span.
    out.set(id, { x: startCol * COL_PITCH + ((w - 1) * COL_PITCH) / 2, y: depth * ROW_PITCH });
    let col = startCol;
    for (const kid of kids) {
      place(kid.id, depth + 1, col, seen);
      col += width(kid.id, new Set());
    }
  };

  const seen = new Set<string>();
  let col = 0;
  for (const root of roots) {
    place(root.id, 0, col, seen);
    col += width(root.id, new Set()) + 1;   // a blank column between families
  }

  // Anchor the whole layout where the cluster already was, so Tidy straightens
  // the tree without teleporting it across the canvas.
  const originX = Math.min(...chosen.map(s => s.canvas_x));
  const originY = Math.min(...chosen.map(s => s.canvas_y));
  for (const [id, p] of out) out.set(id, { x: originX + p.x, y: originY + p.y });
  return out;
}
