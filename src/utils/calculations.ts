import Decimal from 'decimal.js';
import { toMoney } from './money';

export const DILUTION_DEFAULTS: Record<string, number> = {
  shaken: 0.25,
  stirred: 0.22,
  built: 0.10,
  thrown: 0.18,
};

export const METHODS = Object.keys(DILUTION_DEFAULTS);

export function dilutionFactor(
  method: string,
  overrides: Record<string, number> = {}
): number {
  return overrides[method] ?? DILUTION_DEFAULTS[method] ?? 0;
}

export function finalVolume(
  liquidMl: number,
  method: string,
  overrides: Record<string, number> = {}
): number {
  return liquidMl * (1 + dilutionFactor(method, overrides));
}

export function finalAbv(
  preDilutionAbv: number,
  liquidMl: number,
  method: string,
  overrides: Record<string, number> = {}
): number {
  const fv = finalVolume(liquidMl, method, overrides);
  if (fv === 0) return 0;
  return (preDilutionAbv * liquidMl) / fv;
}

export function exVat(salePrice: number | string | null | undefined, vatRate = 0.20): number {
  return toMoney(salePrice).div(1 + vatRate).toNumber();
}

export function gp(
  pourCost: number | string | null | undefined,
  salePriceIncVat: number | string | null | undefined,
  vatRate = 0.20
): number {
  const net = toMoney(salePriceIncVat).div(1 + vatRate);
  if (net.lte(0)) return 0;
  const cost = toMoney(pourCost);
  return net.minus(cost).div(net).times(100).toNumber();
}

// Cost modifiers — applied to pour cost before any formula ever sees it.
// Sundries: fixed £ per serve (garnish, ice, straw). Waste: % of (pourCost + sundries).
// Dilution never touches cost — it only affects volume/ABV, computed separately.
export function applyModifiers(
  pourCost: Decimal,
  sundriesPerServe: number | string = 0,
  wasteRate = 0
): Decimal {
  return pourCost.plus(toMoney(sundriesPerServe)).times(1 + wasteRate);
}

export type CostModifiers = {
  sundriesPerServe: number | string;
  wasteRate: number;
};

export type SpecCosts = {
  pourCost: number;
  modifiedCost: number;
  liquidVolumeMl: number;
  preDilutionAbv: number;
  finalVolumeMl: number;
  finalAbvPct: number;
  gpPct: number | null;
};

export function computeSpecCosts(
  method: string | null,
  salePrice: number | string | null,
  components: Array<{
    amount_ml: number;
    ingredients?: { cost_per_ml: number | string; abv: number } | null;
    preps?: { cost_per_ml: number | string; abv: number } | null;
  }>,
  dilutionOverrides: Record<string, number> = {},
  modifiers: CostModifiers = { sundriesPerServe: 0, wasteRate: 0 }
): SpecCosts {
  let pourCost = new Decimal(0);
  let liquidMl = 0;
  let weightedAbv = 0;

  for (const c of components) {
    const ref = c.ingredients ?? c.preps;
    const cpm = toMoney(ref?.cost_per_ml);
    const abv = Number(ref?.abv ?? 0);
    pourCost = pourCost.plus(cpm.times(c.amount_ml));
    liquidMl += c.amount_ml;
    weightedAbv += c.amount_ml * abv;
  }

  const modifiedCost = applyModifiers(pourCost, modifiers.sundriesPerServe, modifiers.wasteRate);

  const preDilutionAbv = liquidMl > 0 ? weightedAbv / liquidMl : 0;
  const m = method ?? 'built';
  const finalVolumeMl = finalVolume(liquidMl, m, dilutionOverrides);
  const finalAbvPct = finalAbv(preDilutionAbv, liquidMl, m, dilutionOverrides);
  const gpPct = salePrice != null && Number(salePrice) > 0 ? gp(modifiedCost.toNumber(), salePrice) : null;

  return {
    pourCost: pourCost.toNumber(),
    modifiedCost: modifiedCost.toNumber(),
    liquidVolumeMl: liquidMl,
    preDilutionAbv,
    finalVolumeMl,
    finalAbvPct,
    gpPct,
  };
}
