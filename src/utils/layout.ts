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
