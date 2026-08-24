import { describe, it, expect } from 'vitest';
import { placeChild, placeRoot, COL_PITCH, ROW_PITCH } from './layout';
import type { Spec } from '../lib/supabase/queries';

function spec(id: string, parent: string | null, x: number, y: number): Spec {
  return {
    id, user_id: 'u1', name: id, parent_spec_id: parent,
    forked_from_published_id: null, change_note: null, method: null, glass: null,
    garnish: null, build_text: null, sale_price: null, status: 'draft',
    visibility: 'private', group_id: null, published_recipe_id: null,
    canvas_x: x, canvas_y: y, created_at: '2026-01-01', updated_at: '2026-01-01',
  };
}

describe('placeChild', () => {
  const root = spec('root', null, 100, 100);

  it('puts an only child directly below its parent', () => {
    expect(placeChild([root], root)).toEqual({ x: 100, y: 100 + ROW_PITCH });
  });

  it('fans the second child sideways instead of stacking it on the first', () => {
    // The bug this replaces: both children got identical coordinates.
    const a = spec('a', 'root', 100, 350);
    const first = placeChild([root], root);
    const second = placeChild([root, a], root);
    expect(second.x).not.toBe(first.x);
    expect(second).toEqual({ x: 100 + COL_PITCH, y: 100 + ROW_PITCH });
  });

  it('keeps every sibling on the same row', () => {
    const kids: Spec[] = [];
    const placed: number[] = [];
    for (let i = 0; i < 4; i++) {
      const p = placeChild([root, ...kids], root);
      placed.push(p.x);
      expect(p.y).toBe(100 + ROW_PITCH);
      kids.push(spec(`k${i}`, 'root', p.x, p.y));
    }
    expect(new Set(placed).size).toBe(4);   // all distinct
  });

  it('steps around a node already sitting in the target slot', () => {
    // A cousin parked exactly where the first child would go.
    const cousin = spec('cousin', 'other', 100, 100 + ROW_PITCH);
    const p = placeChild([root, cousin], root);
    expect(p.x).toBeGreaterThan(100);
  });

  it('terminates instead of spinning when the row is crowded', () => {
    const crowd = Array.from({ length: 60 }, (_, i) =>
      spec(`c${i}`, 'other', 100 + i * COL_PITCH, 100 + ROW_PITCH));
    const p = placeChild([root, ...crowd], root);
    expect(Number.isFinite(p.x)).toBe(true);
  });
});

describe('placeRoot', () => {
  it('starts somewhere sensible on an empty canvas', () => {
    expect(placeRoot([])).toEqual({ x: 120, y: 120 });
  });

  it('puts a new root clear to the right, aligned to the top line', () => {
    const existing = [spec('a', null, 100, 200), spec('b', 'a', 100, 450)];
    const p = placeRoot(existing);
    expect(p.x).toBeGreaterThan(100 + COL_PITCH);
    expect(p.y).toBe(200);
  });
});

import { tidyTree } from './layout';

describe('tidyTree', () => {
  const tree = () => [
    spec('root', null, 500, 500),
    spec('a', 'root', 999, 999),
    spec('b', 'root', 10, 10),
    spec('gc', 'a', 300, 20),
  ];
  const ids = (ss: Spec[]) => ss.map(s => s.id);

  it('puts depth on the row axis — parent above its children', () => {
    const t = tree();
    const p = tidyTree(t, ids(t));
    expect(p.get('a')!.y).toBe(p.get('root')!.y + ROW_PITCH);
    expect(p.get('gc')!.y).toBe(p.get('root')!.y + ROW_PITCH * 2);
  });

  it('spreads siblings across columns without overlapping', () => {
    const t = tree();
    const p = tidyTree(t, ids(t));
    expect(p.get('a')!.x).not.toBe(p.get('b')!.x);
    expect(Math.abs(p.get('a')!.x - p.get('b')!.x)).toBeGreaterThanOrEqual(COL_PITCH);
  });

  it('centres a parent over the span its subtree occupies', () => {
    // root has two branches, so it sits between them, not on top of one.
    const t = tree();
    const p = tidyTree(t, ids(t));
    const kids = [p.get('a')!.x, p.get('b')!.x];
    expect(p.get('root')!.x).toBeCloseTo((Math.min(...kids) + Math.max(...kids)) / 2, 5);
  });

  it('keeps the cluster where it was rather than teleporting it', () => {
    const t = tree();
    const p = tidyTree(t, ids(t));
    const minX = Math.min(...[...p.values()].map(v => v.x));
    const minY = Math.min(...[...p.values()].map(v => v.y));
    expect(minX).toBe(10);   // smallest canvas_x in the set
    expect(minY).toBe(10);   // smallest canvas_y
  });

  it('treats a spec whose parent is outside the selection as a root', () => {
    const t = tree();
    const p = tidyTree(t, ['a', 'gc']);          // root and b not selected
    expect(p.size).toBe(2);
    expect(p.get('gc')!.y).toBe(p.get('a')!.y + ROW_PITCH);
  });

  it('separates unrelated families', () => {
    const t = [spec('r1', null, 0, 0), spec('x', 'r1', 0, 0), spec('r2', null, 0, 0)];
    const p = tidyTree(t, ids(t));
    expect(p.get('r2')!.x).toBeGreaterThan(p.get('r1')!.x);
  });

  it('is stable — tidying twice gives the same answer', () => {
    const t = tree();
    expect([...tidyTree(t, ids(t))]).toEqual([...tidyTree(t, ids(t))]);
  });

  it('terminates on a parent cycle', () => {
    const cyc = [spec('x', 'y', 0, 0), spec('y', 'x', 0, 0)];
    expect(() => tidyTree(cyc, ids(cyc))).not.toThrow();
  });

  it('returns nothing for an empty selection', () => {
    expect(tidyTree(tree(), []).size).toBe(0);
  });
});
