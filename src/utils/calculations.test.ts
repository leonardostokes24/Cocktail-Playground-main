import Decimal from 'decimal.js';
import { describe, it, expect } from 'vitest';
import { dilutionFactor, finalVolume, finalAbv, exVat, gp, applyModifiers, computeSpecCosts } from './calculations';
import { toMl, fromMl } from './units';

describe('dilutionFactor', () => {
  it('returns defaults for each method', () => {
    expect(dilutionFactor('shaken')).toBe(0.25);
    expect(dilutionFactor('stirred')).toBe(0.22);
    expect(dilutionFactor('built')).toBe(0.10);
    expect(dilutionFactor('thrown')).toBe(0.18);
  });
  it('returns 0 for unknown method', () => {
    expect(dilutionFactor('blended')).toBe(0);
    expect(dilutionFactor('')).toBe(0);
  });
  it('applies overrides over defaults', () => {
    expect(dilutionFactor('shaken', { shaken: 0.30 })).toBe(0.30);
    expect(dilutionFactor('stirred', { shaken: 0.30 })).toBe(0.22);
  });
});

describe('finalVolume', () => {
  it('adds dilution water', () => {
    expect(finalVolume(100, 'shaken')).toBe(125);
    expect(finalVolume(100, 'stirred')).toBeCloseTo(122);
    expect(finalVolume(100, 'built')).toBeCloseTo(110);
  });
  it('zero liquid yields zero', () => {
    expect(finalVolume(0, 'shaken')).toBe(0);
  });
  it('unknown method adds no water', () => {
    expect(finalVolume(100, 'blended')).toBe(100);
  });
});

describe('finalAbv', () => {
  it('dilutes ABV proportionally to added water', () => {
    // 100ml pre-dilution at 40% → 125ml final → 40*100/125 = 32%
    expect(finalAbv(40, 100, 'shaken')).toBeCloseTo(32);
  });
  it('returns 0 when liquid volume is 0', () => {
    expect(finalAbv(40, 0, 'shaken')).toBe(0);
  });
  it('zero ABV spirit stays zero', () => {
    expect(finalAbv(0, 100, 'shaken')).toBe(0);
  });
  it('no-dilution method preserves ABV', () => {
    expect(finalAbv(40, 100, 'blended')).toBeCloseTo(40);
  });
});

describe('exVat', () => {
  it('strips 20% VAT', () => {
    expect(exVat(12)).toBeCloseTo(10);
    expect(exVat(6)).toBeCloseTo(5);
    expect(exVat(0)).toBe(0);
  });
  it('supports custom VAT rates', () => {
    expect(exVat(11, 0.10)).toBeCloseTo(10);
    expect(exVat(12, 0)).toBe(12);
  });
});

describe('gp', () => {
  it('calculates GP on ex-VAT price', () => {
    // sale £12 inc-VAT → £10 ex-VAT. pour cost £2. GP = (10-2)/10*100 = 80%
    expect(gp(2, 12)).toBeCloseTo(80);
  });
  it('handles zero sale price — returns 0', () => {
    expect(gp(2, 0)).toBe(0);
  });
  it('negative GP when pour cost exceeds ex-VAT price', () => {
    // sale £6 → £5 ex-VAT, pour cost £8 → GP = (5-8)/5*100 = -60%
    expect(gp(8, 6)).toBeCloseTo(-60);
  });
  it('100% GP on zero pour cost', () => {
    expect(gp(0, 12)).toBeCloseTo(100);
  });
  it('float safety — no NaN on tiny values', () => {
    expect(Number.isFinite(gp(0.123456, 1.5))).toBe(true);
  });
});

describe('toMl', () => {
  it('converts oz', () => { expect(toMl(1, 'oz')).toBeCloseTo(29.5735); });
  it('converts cl', () => { expect(toMl(5, 'cl')).toBe(50); });
  it('converts dash', () => { expect(toMl(2, 'dash')).toBeCloseTo(1.2); });
  it('converts tsp', () => { expect(toMl(1, 'tsp')).toBe(5); });
  it('ml passthrough', () => { expect(toMl(30, 'ml')).toBe(30); });
  it('unknown unit treated as ml (factor 1)', () => { expect(toMl(10, 'glug')).toBe(10); });
  it('case insensitive', () => { expect(toMl(1, 'OZ')).toBeCloseTo(29.5735); });
});

describe('fromMl', () => {
  it('converts back to oz', () => { expect(fromMl(29.5735, 'oz')).toBeCloseTo(1); });
  it('converts back to cl', () => { expect(fromMl(50, 'cl')).toBe(5); });
});

describe('applyModifiers', () => {
  it('applies sundries then waste %, in that order', () => {
    // pourCost 2 + sundries 0.30 = 2.30, then *1.05 waste = 2.415
    const result = applyModifiers(new Decimal(2), 0.30, 0.05);
    expect(result.toNumber()).toBeCloseTo(2.415);
  });
  it('zero modifiers leave cost untouched', () => {
    expect(applyModifiers(new Decimal(2), 0, 0).toNumber()).toBe(2);
  });
  it('accepts a pg-numeric string for sundries without precision loss', () => {
    const result = applyModifiers(new Decimal('0.1'), '0.2', 0);
    expect(result.toString()).toBe('0.3'); // would be 0.30000000000000004 under plain float math
  });
});

describe('computeSpecCosts — modifier chain and dilution/cost independence', () => {
  const components = [
    { amount_ml: 50, ingredients: { cost_per_ml: '0.04', abv: 40 } }, // pg numeric arrives as string
  ];

  it('GP is computed off the modified cost, not the raw pour cost', () => {
    // pourCost = 50 * 0.04 = 2. With sundries 0.30 + waste 5%: modifiedCost = 2.415
    const withMods = computeSpecCosts('built', 12, components, {}, { sundriesPerServe: 0.30, wasteRate: 0.05 });
    const withoutMods = computeSpecCosts('built', 12, components, {}, { sundriesPerServe: 0, wasteRate: 0 });
    expect(withMods.pourCost).toBeCloseTo(2);
    expect(withMods.modifiedCost).toBeCloseTo(2.415);
    expect(withMods.gpPct).not.toBeCloseTo(withoutMods.gpPct!);
    expect(gp(2.415, 12)).toBeCloseTo(withMods.gpPct!);
  });

  it('dilution changes volume/ABV but never the cost figures', () => {
    const shaken = computeSpecCosts('shaken', 12, components, {}, { sundriesPerServe: 0.30, wasteRate: 0.05 });
    const built = computeSpecCosts('built', 12, components, {}, { sundriesPerServe: 0.30, wasteRate: 0.05 });
    expect(shaken.pourCost).toBe(built.pourCost);
    expect(shaken.modifiedCost).toBe(built.modifiedCost);
    expect(shaken.finalVolumeMl).not.toBe(built.finalVolumeMl);
  });

  it('zero-cost edge: no components yields zero cost, not NaN', () => {
    const costs = computeSpecCosts('built', 12, [], {}, { sundriesPerServe: 0, wasteRate: 0.05 });
    expect(costs.pourCost).toBe(0);
    expect(costs.modifiedCost).toBe(0);
  });

  it('null sale price yields null GP rather than throwing', () => {
    const costs = computeSpecCosts('built', null, components, {});
    expect(costs.gpPct).toBeNull();
  });
});

describe('computeSpecCosts — optional pricing (unpriced components)', () => {
  it('a fully priced spec reports fullyPriced and a GP', () => {
    const costs = computeSpecCosts('built', 12, [{ amount_ml: 50, ingredients: { cost_per_ml: '0.04', abv: 40 } }], {});
    expect(costs.unpricedCount).toBe(0);
    expect(costs.fullyPriced).toBe(true);
    expect(costs.gpPct).not.toBeNull();
  });

  it('a null cost_per_ml counts as unpriced and suppresses GP even with a sale price', () => {
    const costs = computeSpecCosts('built', 12, [{ amount_ml: 50, ingredients: { cost_per_ml: null, abv: 40 } }], {});
    expect(costs.unpricedCount).toBe(1);
    expect(costs.fullyPriced).toBe(false);
    expect(costs.gpPct).toBeNull();
  });

  it('a mix of priced and unpriced sums only the priced cost and stays not-fully-priced', () => {
    const costs = computeSpecCosts('built', 12, [
      { amount_ml: 50, ingredients: { cost_per_ml: '0.04', abv: 40 } }, // 2.00
      { amount_ml: 20, ingredients: { cost_per_ml: null, abv: 0 } },    // unpriced → 0
    ], {});
    expect(costs.pourCost).toBeCloseTo(2);
    expect(costs.unpricedCount).toBe(1);
    expect(costs.fullyPriced).toBe(false);
    expect(costs.gpPct).toBeNull();
  });

  it('a legitimate zero price is priced (not unpriced) and still yields a GP', () => {
    const costs = computeSpecCosts('built', 12, [{ amount_ml: 50, ingredients: { cost_per_ml: 0, abv: 0 } }], {});
    expect(costs.unpricedCount).toBe(0);
    expect(costs.fullyPriced).toBe(true);
    expect(costs.gpPct).not.toBeNull();
  });

  it('an empty spec is not "fully priced" (nothing to price)', () => {
    const costs = computeSpecCosts('built', 12, [], {});
    expect(costs.fullyPriced).toBe(false);
    expect(costs.gpPct).toBeNull();
  });
});

describe('computeSpecCosts — prep components', () => {
  it('costs a prep line from the prep rollup, same as an ingredient', () => {
    // A prep at 0.001111/ml (£1.00 batch / 900ml), poured 20ml → 0.02222
    const costs = computeSpecCosts('stirred', 10, [
      { amount_ml: 20, preps: { cost_per_ml: '0.0011111111', abv: 0 } },
    ], {});
    expect(costs.pourCost).toBeCloseTo(0.0222, 4);
    expect(costs.fullyPriced).toBe(true);
  });

  it('a prep holding unpriced ingredients makes the spec unpriced, not cheap', () => {
    // The store passes cost_per_ml: null when prep_costs.unpriced_count > 0 (⚑ 0007),
    // otherwise a partial rollup would understate the drink's cost.
    const costs = computeSpecCosts('stirred', 10, [
      { amount_ml: 50, ingredients: { cost_per_ml: '0.04', abv: 40 } },
      { amount_ml: 20, preps: { cost_per_ml: null, abv: 0 } },
    ], {});
    expect(costs.unpricedCount).toBe(1);
    expect(costs.fullyPriced).toBe(false);
    expect(costs.gpPct).toBeNull();
  });

  it('mixes ingredient and prep lines in one pour cost', () => {
    const costs = computeSpecCosts('stirred', 10, [
      { amount_ml: 50, ingredients: { cost_per_ml: '0.04', abv: 40 } }, // 2.00
      { amount_ml: 20, preps: { cost_per_ml: '0.005', abv: 0 } },       // 0.10
    ], {});
    expect(costs.pourCost).toBeCloseTo(2.1);
    expect(costs.liquidVolumeMl).toBe(70);
    expect(costs.fullyPriced).toBe(true);
  });
});
