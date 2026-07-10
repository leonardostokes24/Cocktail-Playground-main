import { describe, it, expect } from 'vitest';
import { toMoney, roundMoney, formatMoney } from './money';

describe('toMoney', () => {
  it('accepts numbers', () => {
    expect(toMoney(1.5).toNumber()).toBe(1.5);
  });
  it('accepts pg-numeric strings without precision loss', () => {
    // Postgres numeric columns arrive over supabase-js as strings.
    expect(toMoney('0.03333333').toString()).toBe('0.03333333');
  });
  it('treats null/undefined/empty as zero', () => {
    expect(toMoney(null).toNumber()).toBe(0);
    expect(toMoney(undefined).toNumber()).toBe(0);
    expect(toMoney('').toNumber()).toBe(0);
  });
  it('avoids float round-trip drift that plain numbers hit', () => {
    // 0.1 + 0.2 !== 0.3 in IEEE754 float math; Decimal must not reproduce that.
    const sum = toMoney('0.1').plus(toMoney('0.2'));
    expect(sum.toString()).toBe('0.3');
  });
});

describe('roundMoney / formatMoney', () => {
  it('rounds half up at 2dp', () => {
    expect(formatMoney(toMoney('1.005'))).toBe('1.01');
  });
  it('does not round until formatted', () => {
    const precise = toMoney('1.23456789');
    expect(roundMoney(precise, 4).toString()).toBe('1.2346');
    expect(precise.toString()).toBe('1.23456789'); // original untouched
  });
});
