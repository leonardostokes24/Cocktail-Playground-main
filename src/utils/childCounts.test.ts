import { describe, it, expect } from 'vitest';
import { childCounts, detachedBy } from './childCounts';
import type { Spec } from '../lib/supabase/queries';

function spec(id: string, parent: string | null): Spec {
  return {
    id, user_id: 'u1', name: id,
    parent_spec_id: parent,
    forked_from_published_id: null,
    change_note: null, method: null, glass: null, garnish: null,
    build_text: null, sale_price: null, status: 'draft', visibility: 'private',
    published_recipe_id: null, canvas_x: 0, canvas_y: 0,
    created_at: '2026-01-01', updated_at: '2026-01-01',
  };
}

describe('childCounts', () => {
  it('counts only direct children, not descendants', () => {
    // root → a → grandchild. root has one child, not two.
    const counts = childCounts([
      spec('root', null),
      spec('a', 'root'),
      spec('grandchild', 'a'),
    ]);
    expect(counts.root).toBe(1);
    expect(counts.a).toBe(1);
  });

  it('counts several children of one parent', () => {
    const counts = childCounts([
      spec('root', null), spec('a', 'root'), spec('b', 'root'), spec('c', 'root'),
    ]);
    expect(counts.root).toBe(3);
  });

  it('omits specs with no children', () => {
    const counts = childCounts([spec('lonely', null)]);
    expect(counts.lonely).toBeUndefined();
  });

  it('returns the identical object for the same array (memoised)', () => {
    const specs = [spec('root', null), spec('a', 'root')];
    expect(childCounts(specs)).toBe(childCounts(specs));
  });
});

describe('detachedBy', () => {
  const tree = [
    spec('root', null),
    spec('a', 'root'),
    spec('b', 'root'),
    spec('grandchild', 'a'),
  ];

  it('counts the children a delete would strand', () => {
    expect(detachedBy(tree, ['root'])).toBe(2);
  });

  it("doesn't count a child that is being deleted alongside its parent", () => {
    // Deleting root AND b: `b` dies, so it can't be stranded. Only `a` is.
    expect(detachedBy(tree, ['root', 'b'])).toBe(1);
  });

  it('strands a grandchild when its parent is deleted too', () => {
    // Deleting root AND a strands b (parent root) and grandchild (parent a).
    expect(detachedBy(tree, ['root', 'a'])).toBe(2);
  });

  it('counts a grandchild stranded by deleting its own parent', () => {
    expect(detachedBy(tree, ['a'])).toBe(1);
  });

  it('is zero when the whole subtree goes at once', () => {
    expect(detachedBy(tree, ['root', 'a', 'b', 'grandchild'])).toBe(0);
  });

  it('is zero for an empty selection', () => {
    expect(detachedBy(tree, [])).toBe(0);
  });
});
