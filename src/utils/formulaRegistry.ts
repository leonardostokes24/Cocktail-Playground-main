import Decimal from 'decimal.js';
import { toMoney } from './money';

// Adding a new costing model = one pure function + one registry entry.
// UI reads the registry; never hardcode a formula into a component.
export interface CostFormula {
  id: string;
  label: string;
  unit: string;
  compute: (cost: number, saleGross: number, vatRate: number) => number;
  reverse?: (targetValue: number, cost: number, vatRate: number) => number;
}

function net(saleGross: number, vatRate: number): Decimal {
  return toMoney(saleGross).div(1 + vatRate);
}

export const formulaRegistry: CostFormula[] = [
  {
    id: 'gp_ex_vat',
    label: 'GP %',
    unit: '%',
    // GP is always calculated on the ex-VAT price — the UK on-trade standard.
    compute: (cost, saleGross, vatRate) => {
      const n = net(saleGross, vatRate);
      if (n.lte(0)) return 0;
      return n.minus(toMoney(cost)).div(n).times(100).toNumber();
    },
    reverse: (targetGpPct, cost, vatRate) => {
      const denom = new Decimal(1).minus(new Decimal(targetGpPct).div(100));
      if (denom.lte(0)) return 0;
      return toMoney(cost).div(denom).times(1 + vatRate).toNumber();
    },
  },
  {
    id: 'pour_cost_pct',
    label: 'Pour cost %',
    unit: '%',
    compute: (cost, saleGross, vatRate) => {
      const n = net(saleGross, vatRate);
      if (n.lte(0)) return 0;
      return toMoney(cost).div(n).times(100).toNumber();
    },
  },
  {
    id: 'cash_margin',
    label: 'Cash margin',
    unit: '£',
    compute: (cost, saleGross, vatRate) => {
      const n = net(saleGross, vatRate);
      return n.minus(toMoney(cost)).toNumber();
    },
  },
  {
    id: 'markup',
    label: 'Markup',
    unit: '×',
    compute: (cost, saleGross, vatRate) => {
      const c = toMoney(cost);
      if (c.lte(0)) return 0;
      return net(saleGross, vatRate).div(c).toNumber();
    },
  },
  {
    id: 'target_gp_price',
    label: 'Target price (GP%)',
    unit: '£',
    // Reverse of gp_ex_vat: given a target GP% and a cost, what gross price hits it.
    compute: (cost, targetGpPct, vatRate) => {
      const denom = new Decimal(1).minus(new Decimal(targetGpPct).div(100));
      if (denom.lte(0)) return 0;
      return toMoney(cost).div(denom).times(1 + vatRate).toNumber();
    },
  },
  {
    id: 'target_pour_cost_price',
    label: 'Target price (pour cost %)',
    unit: '£',
    // Reverse of pour_cost_pct: given a target pour-cost% and a cost, what gross price hits it.
    compute: (cost, targetPourCostPct, vatRate) => {
      const pct = new Decimal(targetPourCostPct);
      if (pct.lte(0)) return 0;
      return toMoney(cost).div(pct.div(100)).times(1 + vatRate).toNumber();
    },
  },
];

export function getFormula(id: string): CostFormula {
  const formula = formulaRegistry.find((f) => f.id === id);
  if (!formula) throw new Error(`Unknown formula id: ${id}`);
  return formula;
}

export const DEFAULT_FORMULA_ID = 'gp_ex_vat';

const TARGET_PRICE_FORMULA_IDS = new Set(['target_gp_price', 'target_pour_cost_price']);

// Most formulas' 2nd arg is the current gross sale price. The two target_*
// formulas are reversed: their 2nd arg is a target %, not a price. GP% and
// pour-cost% are complements of the same net revenue (they sum to 100), so a
// pour-cost target derives directly from a GP target.
export function formulaSecondArg(
  formula: CostFormula,
  salePrice: number | null,
  targetGpPct: number | null
): number | null {
  if (!TARGET_PRICE_FORMULA_IDS.has(formula.id)) return salePrice;
  if (targetGpPct == null) return null;
  return formula.id === 'target_gp_price' ? targetGpPct : 100 - targetGpPct;
}
