/* ============================================================================
 * Proof — costing engine
 * Pure, testable formula registry. Adding a model = one pure function + one
 * registry entry; the UI reads the registry so models are pluggable.
 *
 * Golden rules from VISION.md:
 *  - GP is computed from the USER's cost (override), so margins stay private.
 *  - Modifiers (sundries, waste) apply to POUR COST, before any formula.
 *  - Dilution does NOT change cost — only final volume/ABV.
 *  - Two clean cost levels only: ingredient -> prep -> spec (no nested preps).
 * ========================================================================== */

// ---- Domain types ----------------------------------------------------------

export interface CatalogueIngredient {
  id: string;
  name: string;
  /** Reference price for the whole pack, used when the user sets no override. */
  referencePrice: number;
  /** Pack size the price refers to, in millilitres. */
  packSizeMl: number;
  abv?: number; // 0..1
}

export interface UserIngredientCost {
  ingredientId: string;
  /** The user's real supplier price for the pack. Overrides reference price. */
  userCost?: number;
  /** Optional override of pack size if the user buys a different format. */
  packSizeMl?: number;
}

export interface Prep {
  id: string;
  name: string;
  /** Final yield of the batch, in millilitres. */
  yieldMl: number;
  components: SpecComponent[];
}

/** A line in a spec's build OR a prep's build. */
export interface SpecComponent {
  ref: { kind: "ingredient"; id: string } | { kind: "prep"; id: string };
  amountMl: number;
  abv?: number; // 0..1, of this component as poured
}

export interface CostSettings {
  vatRate: number;       // default 0.20
  sundries: number;      // fixed £ per serve (garnish/ice/straw)
  wastePct: number;      // e.g. 0.05 for 5% spillage allowance
  targetGP: number;      // %, e.g. 75
  targetPourPct: number; // %, e.g. 20
  /** Round a computed net-of-price up to a menu-friendly figure. */
  roundingRule?: (price: number) => number;
}

export const DEFAULT_SETTINGS: CostSettings = {
  vatRate: 0.20,
  sundries: 0.20,
  wastePct: 0.05,
  targetGP: 75,
  targetPourPct: 20,
  roundingRule: (p) => Math.round(p * 2) / 2, // nearest £0.50
};

// ---- Cost-per-ml resolution ------------------------------------------------

/** cost_per_ml = user_cost / pack_size_ml, falling back to reference price. */
export function ingredientCostPerMl(
  cat: CatalogueIngredient,
  override?: UserIngredientCost,
): number {
  const pack = override?.packSizeMl ?? cat.packSizeMl;
  const price = override?.userCost ?? cat.referencePrice;
  if (!pack) return 0;
  return price / pack;
}

/** A prep rolls up: cost_per_ml = Σ(component costs) / yield_ml. */
export function prepCostPerMl(
  prep: Prep,
  resolve: (id: string) => number, // ingredient/prep -> cost_per_ml
): number {
  if (!prep.yieldMl) return 0;
  const total = prep.components.reduce(
    (sum, c) => sum + c.amountMl * resolve(refId(c)),
    0,
  );
  return total / prep.yieldMl;
}

function refId(c: SpecComponent): string {
  return c.ref.id;
}

// ---- Pour cost + modifiers -------------------------------------------------

/** Raw pour cost of a spec = Σ(component_ml × cost_per_ml). */
export function pourCost(
  components: SpecComponent[],
  resolveCostPerMl: (id: string) => number,
): number {
  return components.reduce(
    (sum, c) => sum + c.amountMl * resolveCostPerMl(refId(c)),
    0,
  );
}

/** Apply modifiers (waste, then sundries) — this is the `cost` all formulas use. */
export function modifiedPourCost(raw: number, s: CostSettings): number {
  return raw * (1 + s.wastePct) + s.sundries;
}

// ---- Formula registry ------------------------------------------------------

export interface FormulaInput {
  /** Modified pour cost (after waste + sundries). */
  cost: number;
  /** Gross menu price (VAT-inclusive). Optional for reverse models. */
  priceGross?: number;
  settings: CostSettings;
}

export interface FormulaResult {
  value: number;
  /** "percent" | "currency" | "multiple" — drives display formatting. */
  unit: "percent" | "currency" | "multiple";
}

export interface FormulaModel {
  id: string;
  label: string;
  /** True for models that OUTPUT a suggested price rather than read one. */
  reverse: boolean;
  compute: (i: FormulaInput) => FormulaResult;
}

const netOf = (priceGross: number, vatRate: number) => priceGross / (1 + vatRate);

export const FORMULAS: Record<string, FormulaModel> = {
  gpExVat: {
    id: "gpExVat",
    label: "GP % (ex-VAT)",
    reverse: false,
    compute: ({ cost, priceGross = 0, settings }) => {
      const net = netOf(priceGross, settings.vatRate);
      return { value: net ? ((net - cost) / net) * 100 : 0, unit: "percent" };
    },
  },
  pourCostPct: {
    id: "pourCostPct",
    label: "Pour cost %",
    reverse: false,
    compute: ({ cost, priceGross = 0, settings }) => {
      const net = netOf(priceGross, settings.vatRate);
      return { value: net ? (cost / net) * 100 : 0, unit: "percent" };
    },
  },
  cashMargin: {
    id: "cashMargin",
    label: "Cash margin",
    reverse: false,
    compute: ({ cost, priceGross = 0, settings }) => {
      const net = netOf(priceGross, settings.vatRate);
      return { value: net - cost, unit: "currency" };
    },
  },
  markup: {
    id: "markup",
    label: "Markup ×",
    reverse: false,
    compute: ({ cost, priceGross = 0, settings }) => {
      const net = netOf(priceGross, settings.vatRate);
      return { value: cost ? net / cost : 0, unit: "multiple" };
    },
  },
  targetGpPrice: {
    id: "targetGpPrice",
    label: "Target-GP price",
    reverse: true,
    compute: ({ cost, settings }) => {
      const net = cost / (1 - settings.targetGP / 100);
      const gross = net * (1 + settings.vatRate);
      return { value: (settings.roundingRule ?? ((p) => p))(gross), unit: "currency" };
    },
  },
  targetPourPrice: {
    id: "targetPourPrice",
    label: "Target pour-cost price",
    reverse: true,
    compute: ({ cost, settings }) => {
      const net = cost / (settings.targetPourPct / 100);
      const gross = net * (1 + settings.vatRate);
      return { value: (settings.roundingRule ?? ((p) => p))(gross), unit: "currency" };
    },
  },
};

/** The default headline shown on canvas nodes. */
export const DEFAULT_HEADLINE = "gpExVat";

// ---- Volume & ABV (dilution affects these, NOT cost) -----------------------

/** Final volume after stir/shake dilution. dilutionPct e.g. 0.25 for +25%. */
export function finalVolumeMl(components: SpecComponent[], dilutionPct: number): number {
  const spirits = components.reduce((s, c) => s + c.amountMl, 0);
  return spirits * (1 + dilutionPct);
}

/** Final ABV (0..1): weighted alcohol volume ÷ final volume. */
export function finalAbv(components: SpecComponent[], dilutionPct: number): number {
  const alcoholMl = components.reduce((s, c) => s + c.amountMl * (c.abv ?? 0), 0);
  const vol = finalVolumeMl(components, dilutionPct);
  return vol ? alcoholMl / vol : 0;
}

// ---- Convenience: full readout for a spec ----------------------------------

export interface SpecReadout {
  pourCost: number;
  cost: number; // modified
  volumeMl: number;
  abv: number;
  results: Record<string, FormulaResult>;
  headline: FormulaResult;
}

export function computeSpecReadout(opts: {
  components: SpecComponent[];
  resolveCostPerMl: (id: string) => number;
  priceGross?: number;
  dilutionPct?: number;
  settings?: CostSettings;
  headlineId?: string;
}): SpecReadout {
  const settings = opts.settings ?? DEFAULT_SETTINGS;
  const dilution = opts.dilutionPct ?? 0;
  const raw = pourCost(opts.components, opts.resolveCostPerMl);
  const cost = modifiedPourCost(raw, settings);
  const input: FormulaInput = { cost, priceGross: opts.priceGross, settings };
  const results: Record<string, FormulaResult> = {};
  for (const key of Object.keys(FORMULAS)) results[key] = FORMULAS[key].compute(input);
  const headlineId = opts.headlineId ?? DEFAULT_HEADLINE;
  return {
    pourCost: raw,
    cost,
    volumeMl: finalVolumeMl(opts.components, dilution),
    abv: finalAbv(opts.components, dilution),
    results,
    headline: results[headlineId],
  };
}
