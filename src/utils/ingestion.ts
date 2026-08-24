import { UNITS } from './units';

/**
 * Paste a recipe → draft spec.
 *
 * Deliberately deterministic: no AI. A recipe line is a quantity, a unit and a
 * name, which a parser handles exactly and for free, offline, with no key and
 * no per-paste latency. CLAUDE.md permits AI *for* ingestion but does not
 * require it, and a wrong-but-confident LLM reading of "1 1/2 oz" is worse than
 * a parser that reports what it could not read.
 *
 * Nothing here writes to the database — it returns a draft for the UI to
 * confirm. Ingredient names are matched to the user's library at import time,
 * not here.
 */

export type DraftComponent = {
  /** Amount in the unit the user wrote, preserved for `original_amount`. */
  amount: number;
  unit: string;
  name: string;
  /** The line this came from, so the UI can show what it read. */
  source: string;
};

export type RecipeDraft = {
  name: string | null;
  method: string | null;
  glass: string | null;
  garnish: string | null;
  components: DraftComponent[];
  /** Lines that looked like ingredients but couldn't be parsed. */
  unparsed: string[];
};

const METHODS: Record<string, string> = {
  shake: 'shaken', shaken: 'shaken', shaking: 'shaken',
  stir: 'stirred', stirred: 'stirred', stirring: 'stirred',
  build: 'built', built: 'built',
  throw: 'thrown', thrown: 'thrown',
  blend: 'shaken', // closest dilution profile we model
};

const GLASSES = [
  'nick & nora', 'nick and nora', 'coupe', 'martini', 'rocks', 'old fashioned',
  'highball', 'collins', 'flute', 'wine', 'tiki', 'mug', 'julep', 'hurricane',
];

// Vulgar fractions appear constantly in scraped recipes.
const VULGAR: Record<string, number> = {
  '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3,
  '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875,
};

/** "1 1/2" | "1½" | "½" | "1.5" | "1" → number */
function parseAmount(raw: string): number | null {
  let s = raw.trim();
  let total = 0;

  // Leading whole number followed by a fraction: "1 1/2" or "1½".
  const mixed = s.match(/^(\d+)\s*(\d+\/\d+|[½¼¾⅓⅔⅛⅜⅝⅞])$/);
  if (mixed) {
    total = parseInt(mixed[1], 10);
    s = mixed[2];
  } else if (/^\d+\s+\d+\/\d+$/.test(s)) {
    const [w, f] = s.split(/\s+/);
    total = parseInt(w, 10);
    s = f;
  }

  if (VULGAR[s] != null) return total + VULGAR[s];
  if (/^\d+\/\d+$/.test(s)) {
    const [n, d] = s.split('/').map(Number);
    return d ? total + n / d : null;
  }
  const n = parseFloat(s);
  if (Number.isNaN(n)) return null;
  return total + n;
}

/** Longest-first so "tbsp" is never matched as "tsp"'s prefix, etc. */
const UNIT_WORDS = [...UNITS, 'ounce', 'ounces', 'oz.', 'dashes', 'drops', 'parts',
  'teaspoon', 'teaspoons', 'tablespoon', 'tablespoons', 'barspoons', 'cl.', 'ml.']
  .sort((a, b) => b.length - a.length);

const UNIT_ALIASES: Record<string, string> = {
  ounce: 'oz', ounces: 'oz', 'oz.': 'oz',
  dashes: 'dash', drops: 'drop', parts: 'part',
  teaspoon: 'tsp', teaspoons: 'tsp',
  tablespoon: 'tbsp', tablespoons: 'tbsp',
  barspoons: 'barspoon', 'cl.': 'cl', 'ml.': 'ml',
};

function normaliseUnit(u: string): string {
  const k = u.toLowerCase();
  return UNIT_ALIASES[k] ?? k;
}

/** Strip list bullets and trailing punctuation without touching the name. */
function clean(line: string): string {
  return line.replace(/^[\s\-*•·–—\d]*[.)]?\s*/, m => (/^\s*\d+[.)]\s*$/.test(m) ? '' : m.replace(/^[\s\-*•·–—]+/, '')))
    .replace(/\s+/g, ' ')
    .trim();
}

function parseComponentLine(line: string): DraftComponent | null {
  const text = clean(line);
  if (!text) return null;

  const unitPattern = UNIT_WORDS.map(u => u.replace('.', '\\.')).join('|');
  // amount, optional space, unit, then the name.
  const re = new RegExp(`^(\\d+\\s*\\d*\\/?\\d*\\s*[½¼¾⅓⅔⅛⅜⅝⅞]?|[½¼¾⅓⅔⅛⅜⅝⅞])\\s*(${unitPattern})\\b\\.?\\s+(.+)$`, 'i');
  const m = text.match(re);
  if (m) {
    const amount = parseAmount(m[1]);
    const name = m[3].replace(/[.,;]+$/, '').trim();
    if (amount != null && amount > 0 && name) {
      return { amount, unit: normaliseUnit(m[2]), name, source: text };
    }
    return null;
  }

  // "2 Angostura" with no unit at all — treat a bare count as dashes only when
  // the name suggests bitters, otherwise we'd invent a unit the user never wrote.
  const bare = text.match(/^(\d+(?:\.\d+)?)\s+(.+)$/);
  if (bare && /bitters|angostura|peychaud/i.test(bare[2])) {
    const amount = parseAmount(bare[1]);
    if (amount != null && amount > 0) {
      return { amount, unit: 'dash', name: bare[2].replace(/[.,;]+$/, '').trim(), source: text };
    }
  }
  return null;
}

function looksLikeIngredient(line: string): boolean {
  return /^\s*[\d½¼¾⅓⅔⅛⅜⅝⅞]/.test(clean(line));
}

export function parseRecipe(input: string): RecipeDraft {
  const lines = input.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const draft: RecipeDraft = {
    name: null, method: null, glass: null, garnish: null,
    components: [], unparsed: [],
  };

  for (const line of lines) {
    const lower = line.toLowerCase();

    // Explicit "Garnish: ..." wins over any other reading of the line.
    const garnishMatch = line.match(/^garnish\s*[:\-–]\s*(.+)$/i);
    if (garnishMatch) { draft.garnish = garnishMatch[1].replace(/[.]+$/, '').trim(); continue; }

    const glassMatch = line.match(/^glass(?:ware)?\s*[:\-–]\s*(.+)$/i);
    if (glassMatch) { draft.glass = glassMatch[1].replace(/[.]+$/, '').trim(); continue; }

    const methodMatch = line.match(/^method\s*[:\-–]\s*(.+)$/i);
    if (methodMatch) {
      const key = methodMatch[1].trim().toLowerCase().split(/\s+/)[0];
      draft.method = METHODS[key] ?? methodMatch[1].trim();
      continue;
    }

    const parsed = parseComponentLine(line);
    if (parsed) { draft.components.push(parsed); continue; }

    if (looksLikeIngredient(line)) { draft.unparsed.push(clean(line)); continue; }

    // Title before prose-mining, or a drink called "Old Fashioned" gets eaten by
    // the glassware list and never gets a name.
    const hasMethodVerb = Object.keys(METHODS).some(w => new RegExp(`\\b${w}\\b`, 'i').test(lower));
    // A bare glass name is NOT excluded here: several drinks are named after
    // their glass ("Old Fashioned"), and a first line before any ingredient is
    // far more likely the title than glassware, which is normally written
    // "Rocks glass" or "Glass: rocks" and appears after the build.
    if (draft.name == null && draft.components.length === 0 && !hasMethodVerb) {
      draft.name = clean(line).replace(/[.]+$/, '');
      continue;
    }

    // Prose: mine instruction lines for method, glass and garnish.
    if (hasMethodVerb) {
      for (const [word, method] of Object.entries(METHODS)) {
        if (new RegExp(`\\b${word}\\b`, 'i').test(lower)) { draft.method ??= method; break; }
      }
    }
    for (const g of GLASSES) {
      if (lower.includes(g)) {
        draft.glass ??= g === 'nick and nora' ? 'Nick & Nora' : g.replace(/\b\w/g, c => c.toUpperCase());
        break;
      }
    }
    const garnishProse = line.match(/\bgarnish(?:ed)?\s+with\s+(.+)/i);
    if (garnishProse) draft.garnish ??= garnishProse[1].replace(/[.]+$/, '').trim();
  }

  return draft;
}
