import Decimal from 'decimal.js';

// All money math happens in Decimal. Postgres `numeric` columns arrive over
// supabase-js as strings — Decimal accepts those directly, so callers never
// need to `Number()` a pg numeric before doing arithmetic on it.
export type Money = Decimal;

export function toMoney(value: number | string | null | undefined): Decimal {
  if (value == null || value === '') return new Decimal(0);
  return new Decimal(value);
}

// Round only at display time — never mid-calculation.
export function roundMoney(value: Decimal, dp = 2): Decimal {
  return value.toDecimalPlaces(dp, Decimal.ROUND_HALF_UP);
}

export function formatMoney(value: Decimal, dp = 2): string {
  return roundMoney(value, dp).toFixed(dp);
}
