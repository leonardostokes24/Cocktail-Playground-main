import { describe, it, expect } from 'vitest';
import { groupsOf } from './groups';
import type { Spec } from '../lib/supabase/queries';

function spec(id: string, parent: string | null, name = id): Spec {
  return {
    id, user_id: 'u1', name, parent_spec_id: parent,
    forked_from_published_id: null, change_note: null, method: null, glass: null,
    garnish: null, build_text: null, sale_price: null, status: 'draft',
    visibility: 'private', group_id: null, published_recipe_id: null, canvas_x: 0, canvas_y: 0,
    created_at: '2026-01-01', updated_at: '2026-01-01',
  };
}

describe('groupsOf', () => {
  it('gathers a root and everything under it', () => {
    const g = groupsOf([spec('root', null, 'Negroni'), spec('a', 'root'), spec('gc', 'a')]);
    expect(g).toHaveLength(1);
    expect(g[0].name).toBe('Negroni');
    expect(g[0].specIds.sort()).toEqual(['a', 'gc', 'root']);
  });

  it('keeps separate trees separate', () => {
    const g = groupsOf([
      spec('r1', null), spec('a', 'r1'),
      spec('r2', null), spec('b', 'r2'),
    ]);
    expect(g).toHaveLength(2);
  });

  it('ignores a lone spec — a hull around one card says nothing', () => {
    expect(groupsOf([spec('lonely', null)])).toEqual([]);
  });

  it('splits when a root is deleted, with no stored state to repair', () => {
    const before = groupsOf([spec('root', null), spec('a', 'root'), spec('b', 'root')]);
    expect(before).toHaveLength(1);
    // Deleting root detaches a and b into roots (ON DELETE SET NULL).
    const after = groupsOf([spec('a', null), spec('b', null)]);
    expect(after).toEqual([]);
  });

  it('terminates on a parent cycle', () => {
    const g = groupsOf([spec('x', 'y'), spec('y', 'x')]);
    expect(Array.isArray(g)).toBe(true);
  });

  it('returns the identical array for the same input (memoised)', () => {
    const specs = [spec('root', null), spec('a', 'root')];
    expect(groupsOf(specs)).toBe(groupsOf(specs));
  });
});
