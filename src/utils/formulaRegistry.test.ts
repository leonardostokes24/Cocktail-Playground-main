import { describe, it, expect } from 'vitest';
import { formulaRegistry, getFormula, formulaSecondArg, DEFAULT_FORMULA_ID } from './formulaRegistry';

const get = (id: string) => getFormula(id);

describe('registry shape', () => {
  it('has exactly the six CLAUDE.md-specified formulas', () => {
    expect(formulaRegistry.map((f) => f.id).sort()).toEqual([
      'cash_margin', 'gp_ex_vat', 'markup', 'pour_cost_pct',
      'target_gp_price', 'target_pour_cost_price',
    ]);
  });
  it('defaults to gp_ex_vat', () => {
    expect(DEFAULT_FORMULA_ID).toBe('gp_ex_vat');
  });
  it('throws for an unknown id', () => {
    expect(() => getFormula('nonexistent')).toThrow();
  });
});

describe('gp_ex_vat', () => {
  const f = get('gp_ex_vat');
  it('matches the worked CLAUDE.md example: £2 cost, £12 inc-VAT sale → 80%', () => {
    expect(f.compute(2, 12, 0.20)).toBeCloseTo(80);
  });
  it('reverse recovers the sale price that produces a target GP%', () => {
    expect(f.reverse!(80, 2, 0.20)).toBeCloseTo(12);
  });
  it('zero-cost edge: 100% GP', () => {
    expect(f.compute(0, 12, 0.20)).toBeCloseTo(100);
  });
  it('zero-price edge: returns 0, not NaN/Infinity', () => {
    expect(f.compute(2, 0, 0.20)).toBe(0);
  });
  it('reverse at 100% target is undefined-safe: returns 0 not Infinity', () => {
    expect(f.reverse!(100, 2, 0.20)).toBe(0);
  });
});

describe('pour_cost_pct', () => {
  const f = get('pour_cost_pct');
  it('is the US complement view: £2 cost, £12 inc-VAT sale → 20%', () => {
    expect(f.compute(2, 12, 0.20)).toBeCloseTo(20);
  });
  it('zero-price edge: returns 0', () => {
    expect(f.compute(2, 0, 0.20)).toBe(0);
  });
});

describe('cash_margin', () => {
  const f = get('cash_margin');
  it('net minus cost: £2 cost, £12 inc-VAT sale → £8', () => {
    expect(f.compute(2, 12, 0.20)).toBeCloseTo(8);
  });
  it('goes negative when cost exceeds net price (no artificial floor)', () => {
    expect(f.compute(8, 6, 0.20)).toBeCloseTo(-3);
  });
});

describe('markup', () => {
  const f = get('markup');
  it('net divided by cost: £2 cost, £12 inc-VAT sale → 5x', () => {
    expect(f.compute(2, 12, 0.20)).toBeCloseTo(5);
  });
  it('zero-cost edge: returns 0, not Infinity', () => {
    expect(f.compute(0, 12, 0.20)).toBe(0);
  });
});

describe('target_gp_price', () => {
  const f = get('target_gp_price');
  it('agrees with gp_ex_vat.reverse for the same target', () => {
    const gpExVat = get('gp_ex_vat');
    expect(f.compute(2, 80, 0.20)).toBeCloseTo(gpExVat.reverse!(80, 2, 0.20));
  });
  it('zero-cost/zero-target edges never throw or produce Infinity', () => {
    expect(Number.isFinite(f.compute(2, 100, 0.20))).toBe(true);
    expect(f.compute(2, 100, 0.20)).toBe(0);
  });
});

describe('target_pour_cost_price', () => {
  const f = get('target_pour_cost_price');
  it('a 20% pour-cost target is the complement of an 80% GP target — same price', () => {
    const targetGp = get('target_gp_price');
    expect(f.compute(2, 20, 0.20)).toBeCloseTo(targetGp.compute(2, 80, 0.20));
  });
  it('zero target edge: returns 0', () => {
    expect(f.compute(2, 0, 0.20)).toBe(0);
  });
});

describe('formulaSecondArg', () => {
  it('forward formulas take the current sale price', () => {
    expect(formulaSecondArg(get('gp_ex_vat'), 12, 80)).toBe(12);
    expect(formulaSecondArg(get('cash_margin'), 12, null)).toBe(12);
  });
  it('target_gp_price takes the target GP% directly', () => {
    expect(formulaSecondArg(get('target_gp_price'), 12, 80)).toBe(80);
  });
  it('target_pour_cost_price takes 100 minus the target GP% (the complement)', () => {
    expect(formulaSecondArg(get('target_pour_cost_price'), 12, 80)).toBe(20);
  });
  it('target formulas return null when no target is set, regardless of sale price', () => {
    expect(formulaSecondArg(get('target_gp_price'), 12, null)).toBeNull();
    expect(formulaSecondArg(get('target_pour_cost_price'), 12, null)).toBeNull();
  });
});
