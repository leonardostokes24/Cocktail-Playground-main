import { describe, it, expect } from 'vitest';
import { dilutionFactor, finalVolume, finalAbv, exVat, gp } from './calculations';
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
