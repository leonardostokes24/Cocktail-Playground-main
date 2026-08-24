import { describe, it, expect } from 'vitest';
import { buildExportRows, exportFilename, toCsv } from './export';
import type { Spec, SpecComponent } from '../lib/supabase/queries';
import type { SpecCosts } from './calculations';

function spec(over: Partial<Spec> = {}): Spec {
  return {
    id: 's1', user_id: 'u1', name: 'Old Fashioned', parent_spec_id: null,
    forked_from_published_id: null, change_note: null, method: 'stirred', glass: 'rocks',
    garnish: null, build_text: null, sale_price: null, status: 'draft', visibility: 'private',
    published_recipe_id: null, canvas_x: 0, canvas_y: 0,
    created_at: '2026-01-01', updated_at: '2026-01-01', ...over,
  };
}

function comp(over: Partial<SpecComponent> = {}): SpecComponent {
  return {
    id: 'c1', user_id: 'u1', spec_id: 's1', ingredient_id: 'i1', prep_id: null,
    amount_ml: 50, original_amount: 50, original_unit: 'ml', position: 0,
    ingredients: { name: 'Bourbon', type: 'spirit', abv: 40, cost_per_ml: 0.05 }, ...over,
  };
}

const costs: SpecCosts = {
  pourCost: 2.5, modifiedCost: 2.75, liquidVolumeMl: 60, preDilutionAbv: 33,
  finalVolumeMl: 73, finalAbvPct: 27.1, gpPct: 72.5, unpricedCount: 0, fullyPriced: true,
};

describe('buildExportRows', () => {
  it('orders rows by position, not array order', () => {
    const p = buildExportRows(spec(), [
      comp({ id: 'b', position: 1, ingredients: { name: 'Sugar', type: 'sweetener', abv: 0, cost_per_ml: 0.01 } }),
      comp({ id: 'a', position: 0 }),
    ], null);
    expect(p.rows.map(r => r.component)).toEqual(['Bourbon', 'Sugar']);
  });

  it('leaves an unpriced component blank rather than zero', () => {
    // Zero would read as "free"; blank reads as "not priced yet".
    const p = buildExportRows(spec(), [
      comp({ ingredients: { name: 'Mystery', type: 'other', abv: 0, cost_per_ml: null as unknown as number } }),
    ], null);
    expect(p.rows[0].costPerMl).toBe('');
    expect(p.rows[0].lineCost).toBe('');
  });

  it('computes line cost as cost_per_ml × amount', () => {
    const p = buildExportRows(spec(), [comp({ amount_ml: 50 })], null);
    expect(p.rows[0].lineCost).toBe('2.5');
  });

  it('names a prep component from the prep join', () => {
    const p = buildExportRows(spec(), [
      comp({ ingredient_id: null, prep_id: 'p1', ingredients: null,
             preps: { name: 'Oleo Saccharum', cost_per_ml: 0.02, abv: 0 } }),
    ], null);
    expect(p.rows[0].component).toBe('Oleo Saccharum');
    expect(p.rows[0].type).toBe('prep');
  });

  it('shows the unit the user entered, not just ml', () => {
    const p = buildExportRows(spec(), [comp({ original_amount: 2, original_unit: 'oz', amount_ml: 60 })], null);
    expect(p.rows[0].amount).toBe('2 oz');
    expect(p.rows[0].amountMl).toBe(60);
  });

  it('derives net of VAT from the gross sale price', () => {
    const p = buildExportRows(spec({ sale_price: 12 }), [comp()], costs, { vatRate: 0.2 });
    const net = p.summary.find(([l]) => l === 'Net of VAT');
    expect(net?.[1]).toBe('10');
  });

  it('omits money entirely when the spec is not fully priced', () => {
    const p = buildExportRows(spec({ sale_price: 12 }), [comp()],
      { ...costs, fullyPriced: false, unpricedCount: 1 });
    expect(p.summary.some(([l]) => l === 'Pour cost')).toBe(false);
    expect(p.unpricedNote).toMatch(/1 component has no price/);
  });
});

describe('exportFilename', () => {
  it('slugifies the spec name', () => {
    expect(exportFilename(spec({ name: 'Old Fashioned #2!' }), 'pdf')).toBe('old-fashioned-2.pdf');
  });
  it('falls back when a name has nothing usable', () => {
    expect(exportFilename(spec({ name: '///' }), 'csv')).toBe('spec.csv');
  });
});

describe('toCsv', () => {
  it('quotes cells containing commas or quotes', () => {
    const csv = toCsv(buildExportRows(spec(), [
      comp({ ingredients: { name: 'Rye, 100 "proof"', type: 'spirit', abv: 50, cost_per_ml: 0.05 } }),
    ], null));
    expect(csv).toContain('"Rye, 100 ""proof"""');
  });

  it('neutralises a leading = so a cell cannot execute as a formula', () => {
    const csv = toCsv(buildExportRows(spec(), [
      comp({ ingredients: { name: '=SUM(A1:A9)', type: 'other', abv: 0, cost_per_ml: 0.01 } }),
    ], null));
    expect(csv).toContain("'=SUM(A1:A9)");
  });
});
