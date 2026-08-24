import { describe, it, expect } from 'vitest';
import { twistNumbers } from './twistNumbers';
import type { Spec } from '../lib/supabase/queries';

function spec(id: string, parent: string | null, createdAt: string): Spec {
  return {
    id,
    user_id: 'u1',
    name: id,
    parent_spec_id: parent,
    forked_from_published_id: null,
    change_note: null,
    method: null,
    glass: null,
    garnish: null,
    build_text: null,
    sale_price: null,
    status: 'draft', visibility: 'private', group_id: null,
    published_recipe_id: null,
    canvas_x: 0,
    canvas_y: 0,
    created_at: createdAt,
    updated_at: createdAt,
  };
}

describe('twistNumbers', () => {
  it('leaves roots unnumbered', () => {
    const nums = twistNumbers([spec('root', null, '2026-01-01')]);
    expect(nums.root).toBeUndefined();
  });

  it('numbers descendants in creation order', () => {
    const nums = twistNumbers([
      spec('root', null, '2026-01-01'),
      spec('b', 'root', '2026-01-03'),
      spec('a', 'root', '2026-01-02'),
    ]);
    expect(nums.a).toBe(1);
    expect(nums.b).toBe(2);
  });

  it('numbers across the tree, not per parent — no duplicate ordinals', () => {
    // root → a → grandchild, and root → b. All three are twists of one root.
    const nums = twistNumbers([
      spec('root', null, '2026-01-01'),
      spec('a', 'root', '2026-01-02'),
      spec('b', 'root', '2026-01-03'),
      spec('grandchild', 'a', '2026-01-04'),
    ]);
    expect([nums.a, nums.b, nums.grandchild]).toEqual([1, 2, 3]);
  });

  it('numbers each lineage tree independently', () => {
    const nums = twistNumbers([
      spec('root1', null, '2026-01-01'),
      spec('root2', null, '2026-01-01'),
      spec('a', 'root1', '2026-01-02'),
      spec('c', 'root2', '2026-01-03'),
    ]);
    expect(nums.a).toBe(1);
    expect(nums.c).toBe(1);
  });

  it('breaks created_at ties by id so numbering is stable', () => {
    const specs = [
      spec('root', null, '2026-01-01'),
      spec('zeta', 'root', '2026-01-02'),
      spec('alpha', 'root', '2026-01-02'),
    ];
    expect(twistNumbers(specs).alpha).toBe(1);
    // A fresh array (cache miss) must produce the same answer.
    expect(twistNumbers([...specs]).alpha).toBe(1);
  });

  it('terminates on a parent cycle instead of hanging the canvas', () => {
    const nums = twistNumbers([
      spec('x', 'y', '2026-01-01'),
      spec('y', 'x', '2026-01-02'),
    ]);
    expect(Object.keys(nums)).toHaveLength(2);
  });

  it('treats a spec whose parent is missing as its own tree', () => {
    const nums = twistNumbers([spec('orphan', 'gone', '2026-01-01')]);
    expect(nums.orphan).toBe(1);
  });

  it('returns the identical object for the same array (memoised)', () => {
    const specs = [spec('root', null, '2026-01-01'), spec('a', 'root', '2026-01-02')];
    expect(twistNumbers(specs)).toBe(twistNumbers(specs));
  });
});
