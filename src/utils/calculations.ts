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

export function exVat(salePrice: number, vatRate = 0.20): number {
  return salePrice / (1 + vatRate);
}

export function gp(pourCost: number, salePriceIncVat: number, vatRate = 0.20): number {
  const net = exVat(salePriceIncVat, vatRate);
  if (net <= 0) return 0;
  return ((net - pourCost) / net) * 100;
}

export type SpecCosts = {
  pourCost: number;
  liquidVolumeMl: number;
  preDilutionAbv: number;
  finalVolumeMl: number;
  finalAbvPct: number;
  gpPct: number | null;
};

export function computeSpecCosts(
  method: string | null,
  salePrice: number | null,
  components: Array<{
    amount_ml: number;
    ingredients?: { cost_per_ml: number; abv: number } | null;
    preps?: { cost_per_ml: number; abv: number } | null;
  }>,
  dilutionOverrides: Record<string, number> = {}
): SpecCosts {
  let pourCost = 0;
  let liquidMl = 0;
  let weightedAbv = 0;

  for (const c of components) {
    const ref = c.ingredients ?? c.preps;
    const cpm = Number(ref?.cost_per_ml ?? 0);
    const abv = Number(ref?.abv ?? 0);
    pourCost += c.amount_ml * cpm;
    liquidMl += c.amount_ml;
    weightedAbv += c.amount_ml * abv;
  }

  const preDilutionAbv = liquidMl > 0 ? weightedAbv / liquidMl : 0;
  const m = method ?? 'built';
  const finalVolumeMl = finalVolume(liquidMl, m, dilutionOverrides);
  const finalAbvPct = finalAbv(preDilutionAbv, liquidMl, m, dilutionOverrides);
  const gpPct = salePrice != null && salePrice > 0 ? gp(pourCost, salePrice) : null;

  return { pourCost, liquidVolumeMl: liquidMl, preDilutionAbv, finalVolumeMl, finalAbvPct, gpPct };
}
