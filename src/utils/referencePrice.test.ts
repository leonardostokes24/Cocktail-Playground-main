import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { computeSpecCosts } from './calculations';
import type { SpecComponent } from '../lib/supabase/queries';

/**
 * ⚑ CLAUDE.md: catalogue `reference_price` is a cold-start seed ONLY and must
 * never appear in any cost formula. Two guards — one behavioural, one
 * structural, because the behavioural one alone can't catch a future import.
 */

function comp(over: Partial<SpecComponent> = {}): SpecComponent {
  return {
    id: 'c1', user_id: 'u1', spec_id: 's1', ingredient_id: 'i1', prep_id: null,
    amount_ml: 50, original_amount: 50, original_unit: 'ml', position: 0,
    ingredients: { name: 'Gin', type: 'spirit', abv: 40, cost_per_ml: null as unknown as number },
    ...over,
  };
}

describe('reference_price never reaches a cost', () => {
  it('an ingredient with no cost_per_ml stays unpriced, whatever the catalogue says', () => {
    // If reference_price ever leaked into costing, this would come out priced.
    const costs = computeSpecCosts('stirred', 12, [comp()], {}, { sundriesPerServe: 0, wasteRate: 0.05 });
    expect(costs.fullyPriced).toBe(false);
    expect(costs.unpricedCount).toBe(1);
    expect(costs.pourCost).toBe(0);
  });

  it('is not referenced anywhere in the cost engine or the store', () => {
    const roots = ['src/utils', 'src/store'];
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) { walk(full); continue; }
        if (!/\.tsx?$/.test(entry) || entry.endsWith('.test.ts')) continue;
        if (readFileSync(full, 'utf8').includes('reference_price')) offenders.push(full);
      }
    };
    roots.forEach(walk);
    expect(offenders).toEqual([]);
  });
});

describe('catalogue queries may read reference_price, but only to display it', () => {
  it('keeps it confined to the catalogue query module and its UI', () => {
    const allowed = ['src/lib/supabase/catalogue.ts', 'src/components/library/CatalogueSearch.tsx'];
    const found: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) { walk(full); continue; }
        if (!/\.tsx?$/.test(entry) || entry.endsWith('.test.ts')) continue;
        if (readFileSync(full, 'utf8').includes('reference_price')) found.push(full.replace(/\\/g, '/'));
      }
    };
    walk('src');
    expect(found.sort()).toEqual(allowed.sort());
  });
});
