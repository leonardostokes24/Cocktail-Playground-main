/**
 * generate-iba-seed.ts
 * Fetches the rasmusab/iba-cocktails dataset (sourced from iba-world.com)
 * and outputs supabase/seed.sql with:
 *   1. IBA Official system user in auth.users
 *   2. catalogue_ingredients (unique ingredients across all IBA cocktails)
 *   3. published_specs (all IBA cocktails with components_snapshot JSONB)
 *
 * Run: npx tsx scripts/generate-iba-seed.ts
 * Output is committed to supabase/seed.sql for repeatable seeding.
 */

import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { config as loadEnv } from 'dotenv';

// Load service-role credentials for --push mode (never committed).
loadEnv({ path: join(process.cwd(), '.env.local') });

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = join(__dirname, '../supabase/seed.sql');

// Fixed UUID for IBA Official system user — stable across all environments.
// Also serves as the namespace for deterministic (uuidv5) content ids so that
// re-generating / re-pushing the seed is idempotent (same ids every run).
const IBA_USER_ID = '00000000-0000-4000-a000-000000000001';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://ycapgvrnvipgfiglzzmg.supabase.co';

// RFC 4122 v5 UUID (SHA-1, namespaced) — deterministic id from a string.
function uuidv5(name: string, namespace = IBA_USER_ID): string {
  const ns = Buffer.from(namespace.replace(/-/g, ''), 'hex');
  const bytes = createHash('sha1').update(ns).update(name, 'utf8').digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50; // version 5
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC 4122 variant
  const h = Buffer.from(bytes).toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

// ── Type mappings ─────────────────────────────────────────────────────────────
// Maps normalised ingredient names (lowercase) to a catalogue type.
// This covers all ingredients that appear across the IBA list.

const TYPE_MAP: Record<string, string> = {
  // spirits
  'gin': 'spirit', 'london dry gin': 'spirit', 'sloe gin': 'spirit',
  'vodka': 'spirit', 'white rum': 'spirit', 'light rum': 'spirit',
  'dark rum': 'spirit', 'añejo rum': 'spirit', 'anejo rum': 'spirit',
  'aged rum': 'spirit', 'gold rum': 'spirit', 'overproof rum': 'spirit',
  'bourbon': 'spirit', 'rye whiskey': 'spirit', 'scotch whisky': 'spirit',
  'blended scotch whisky': 'spirit', 'blended whisky': 'spirit',
  'irish whiskey': 'spirit', 'cognac': 'spirit', 'brandy': 'spirit',
  'calvados': 'spirit', 'blanco tequila': 'spirit', 'silver tequila': 'spirit',
  'reposado tequila': 'spirit', 'mezcal': 'spirit', 'pisco': 'spirit',
  'absinthe': 'spirit', 'aquavit': 'spirit', 'cachaça': 'spirit',
  'cachaça ': 'spirit', 'grappa': 'spirit', 'armagnac': 'spirit',
  'champagne': 'spirit', 'prosecco': 'spirit', 'sparkling wine': 'spirit',
  'white wine': 'spirit', 'red wine': 'spirit',
  // modifiers / liqueurs
  'sweet red vermouth': 'modifier', 'sweet vermouth': 'modifier',
  'dry vermouth': 'modifier', 'bianco vermouth': 'modifier',
  'campari': 'modifier', 'aperol': 'modifier',
  'cointreau': 'modifier', 'triple sec': 'modifier',
  'blue curaçao': 'modifier', 'orange curaçao': 'modifier', 'curaçao': 'modifier',
  'maraschino liqueur': 'modifier', 'maraschino': 'modifier',
  'crème de cacao': 'modifier', 'dark crème de cacao': 'modifier',
  'crème de menthe': 'modifier', 'green crème de menthe': 'modifier',
  'white crème de menthe': 'modifier', 'crème de cassis': 'modifier',
  'crème de violette': 'modifier', 'crème de mûre': 'modifier',
  'coffee liqueur': 'modifier', 'kahlúa': 'modifier',
  'amaretto': 'modifier', 'disaronno': 'modifier',
  'drambuie': 'modifier', 'frangelico': 'modifier',
  'galliano': 'modifier', "grand marnier": 'modifier',
  'lillet blanc': 'modifier', 'lillet rosé': 'modifier',
  'st-germain': 'modifier', 'elderflower liqueur': 'modifier',
  'peach schnapps': 'modifier', 'peach liqueur': 'modifier',
  'raspberry liqueur': 'modifier', 'strawberry liqueur': 'modifier',
  'cherry liqueur': 'modifier', 'cherry brandy': 'modifier',
  'heering cherry liqueur': 'modifier',
  'chartreuse': 'modifier', 'green chartreuse': 'modifier',
  'yellow chartreuse': 'modifier',
  'midori': 'modifier', 'melon liqueur': 'modifier',
  'baileys irish cream': 'modifier', 'irish cream liqueur': 'modifier',
  'kahlúa coffee liqueur': 'modifier',
  'banana liqueur': 'modifier', 'crème de banane': 'modifier',
  'anisette': 'modifier', 'pastis': 'modifier', 'sambuca': 'modifier',
  'amer picon': 'modifier', 'apricot brandy': 'modifier', 'apricot liqueur': 'modifier',
  'golden rum': 'spirit', 'spiced rum': 'spirit',
  // IBA web JSON name variants
  'bitter campari': 'modifier', 'bourbon whiskey': 'spirit',
  'rye whiskey or bourbon': 'spirit', 'bourbon or rye whiskey': 'spirit',
  '100% agave tequila': 'spirit', 'tequila 100% agave': 'spirit',
  'tequila agave 100% reposado': 'spirit', 'tequila': 'spirit',
  'rum': 'spirit', 'white cuban ron': 'spirit', 'cuban aguardiente': 'spirit',
  'amber jamaican rum': 'spirit', 'golden jamaican rum': 'spirit',
  'aged tequila': 'spirit', 'chilled champagne': 'spirit', 'brut champagne or prosecco': 'spirit',
  'cognac or brandy': 'spirit', 'rye whisky': 'spirit',
  'amaro nonino': 'modifier',
  'pernod': 'modifier', 'curacao': 'modifier', 'orange curacao': 'modifier',
  'violet liqueur': 'modifier',
  'crème de mure': 'modifier', 'apricot eau de vie': 'modifier',
  'chamomile cordial': 'sweetener', 'orgeat syrup': 'sweetener',
  'passion fruit purée': 'sweetener', 'passion fruit puree': 'sweetener',
  'powdered sugar': 'sweetener', 'superfine sugar': 'sweetener',
  'white cane sugar': 'sweetener', 'sugar cube': 'sweetener',
  'sugar cane juice': 'sweetener', 'raw honey': 'sweetener',
  // brand/regional spirit variants
  'dry gin': 'spirit', 'old tom gin': 'spirit', 'plymouth gin': 'spirit',
  'demerara rum': 'spirit', 'jamaican rum': 'spirit', 'jamaican dark rum': 'spirit',
  'jamaica overproof white rum': 'spirit', 'goslings rum': 'spirit',
  'martinique molasses rhum': 'spirit', 'gold puerto rican rum': 'spirit',
  'blended aged rum': 'spirit', 'aged blended rum': 'spirit',
  'espadin mezcal': 'spirit', 'lagavulin 16 y whisky': 'spirit',
  'dry white wine': 'spirit', 'red tawny port wine': 'spirit',
  'white smooth grappa': 'spirit',
  // modifier brand variants
  'bénédictine': 'modifier', 'benedictine': 'modifier',
  'dom bénédictine': 'modifier', 'dom benedictine': 'modifier',
  'fernet branca': 'modifier', 'maraschino luxardo': 'modifier',
  'creme de cassis': 'modifier',
  'elderflower cordial': 'modifier',
  // sweetener variants
  'grenadine syrup': 'sweetener', 'honey mix': 'sweetener',
  'monin honey syrup': 'sweetener', 'freshly squeezed lime juice': 'citrus',
  'mint leaves': 'other', 'fresh mint': 'other', 'fresh mint sprigs': 'other',
  'white peach puree': 'other', 'pink grapefruit soda': 'other',
  'smirnoff vodka': 'spirit', 'vodka citron': 'spirit', 'vodka vanilla': 'spirit',
  // citrus
  'fresh lemon juice': 'citrus', 'lemon juice': 'citrus',
  'fresh lime juice': 'citrus', 'lime juice': 'citrus',
  'fresh orange juice': 'citrus', 'orange juice': 'citrus',
  'fresh grapefruit juice': 'citrus', 'grapefruit juice': 'citrus',
  'pineapple juice': 'citrus', 'fresh pineapple juice': 'citrus',
  'cranberry juice': 'other', 'tomato juice': 'other',
  'coconut cream': 'other', 'coconut milk': 'other',
  'heavy cream': 'other', 'cream': 'other', 'milk': 'other',
  'egg white': 'other', 'egg yolk': 'other', 'whole egg': 'other',
  'soda water': 'other', 'sparkling water': 'other',
  'cola': 'other', 'ginger beer': 'other', 'ginger ale': 'other',
  'tonic water': 'other',
  // sweeteners
  'simple syrup': 'sweetener', 'gomme syrup': 'sweetener', 'sugar syrup': 'sweetener',
  'grenadine': 'sweetener', 'honey syrup': 'sweetener', 'honey': 'sweetener',
  'agave syrup': 'sweetener', 'agave nectar': 'sweetener',
  'cane sugar': 'sweetener', 'sugar': 'sweetener', 'brown sugar': 'sweetener',
  'demerara syrup': 'sweetener', 'raspberry syrup': 'sweetener',
  'orgeat': 'sweetener', 'almond syrup': 'sweetener',
  'passion fruit syrup': 'sweetener', 'falernum': 'sweetener',
  'ginger syrup': 'sweetener',
  // bitters
  'angostura bitters': 'bitters', 'angostura aromatic bitters': 'bitters',
  'peychaud\'s bitters': 'bitters', 'peychaud bitters': 'bitters',
  'orange bitters': 'bitters', 'mole bitters': 'bitters',
  'aromatic bitters': 'bitters', 'chocolate bitters': 'bitters',
  'celery bitters': 'bitters',
};

// ── Reference prices (advisory, GBP ex-VAT) ───────────────────────────────────
const REF_PRICES: Record<string, { price: number; packMl: number; abv: number }> = {
  // spirits 70cl unless noted
  'gin': { price: 14.00, packMl: 700, abv: 40 },
  'london dry gin': { price: 14.00, packMl: 700, abv: 40 },
  'sloe gin': { price: 16.00, packMl: 700, abv: 26 },
  'vodka': { price: 11.00, packMl: 700, abv: 40 },
  'white rum': { price: 12.00, packMl: 700, abv: 40 },
  'light rum': { price: 12.00, packMl: 700, abv: 40 },
  'dark rum': { price: 13.00, packMl: 700, abv: 40 },
  'aged rum': { price: 16.00, packMl: 700, abv: 40 },
  'gold rum': { price: 13.00, packMl: 700, abv: 40 },
  'añejo rum': { price: 18.00, packMl: 700, abv: 40 },
  'overproof rum': { price: 14.00, packMl: 700, abv: 57 },
  'bourbon': { price: 16.00, packMl: 700, abv: 40 },
  'rye whiskey': { price: 19.00, packMl: 700, abv: 45 },
  'scotch whisky': { price: 18.00, packMl: 700, abv: 40 },
  'blended scotch whisky': { price: 16.00, packMl: 700, abv: 40 },
  'irish whiskey': { price: 16.00, packMl: 700, abv: 40 },
  'cognac': { price: 22.00, packMl: 700, abv: 40 },
  'brandy': { price: 14.00, packMl: 700, abv: 40 },
  'calvados': { price: 22.00, packMl: 700, abv: 40 },
  'blanco tequila': { price: 18.00, packMl: 700, abv: 38 },
  'silver tequila': { price: 18.00, packMl: 700, abv: 38 },
  'reposado tequila': { price: 22.00, packMl: 700, abv: 38 },
  'mezcal': { price: 28.00, packMl: 700, abv: 40 },
  'pisco': { price: 20.00, packMl: 700, abv: 40 },
  'absinthe': { price: 25.00, packMl: 700, abv: 55 },
  'aquavit': { price: 20.00, packMl: 700, abv: 40 },
  'cachaça': { price: 14.00, packMl: 700, abv: 40 },
  'champagne': { price: 22.00, packMl: 750, abv: 12 },
  'prosecco': { price: 9.00, packMl: 750, abv: 11 },
  'sparkling wine': { price: 9.00, packMl: 750, abv: 11 },
  // modifiers 70-75cl
  'sweet red vermouth': { price: 10.00, packMl: 750, abv: 16 },
  'sweet vermouth': { price: 10.00, packMl: 750, abv: 16 },
  'dry vermouth': { price: 9.00, packMl: 750, abv: 18 },
  'bianco vermouth': { price: 10.00, packMl: 750, abv: 15 },
  'campari': { price: 14.00, packMl: 700, abv: 25 },
  'aperol': { price: 12.00, packMl: 700, abv: 11 },
  'cointreau': { price: 22.00, packMl: 700, abv: 40 },
  'triple sec': { price: 9.00, packMl: 700, abv: 30 },
  'curaçao': { price: 12.00, packMl: 700, abv: 30 },
  'blue curaçao': { price: 10.00, packMl: 700, abv: 21 },
  'maraschino liqueur': { price: 18.00, packMl: 700, abv: 32 },
  'crème de cacao': { price: 11.00, packMl: 700, abv: 20 },
  'dark crème de cacao': { price: 11.00, packMl: 700, abv: 20 },
  'crème de menthe': { price: 11.00, packMl: 700, abv: 20 },
  'crème de cassis': { price: 12.00, packMl: 700, abv: 15 },
  'crème de violette': { price: 18.00, packMl: 700, abv: 16 },
  'crème de mûre': { price: 14.00, packMl: 700, abv: 20 },
  'coffee liqueur': { price: 13.00, packMl: 700, abv: 20 },
  'amaretto': { price: 14.00, packMl: 700, abv: 28 },
  'drambuie': { price: 18.00, packMl: 700, abv: 40 },
  'frangelico': { price: 16.00, packMl: 700, abv: 20 },
  'galliano': { price: 18.00, packMl: 700, abv: 43 },
  "grand marnier": { price: 22.00, packMl: 700, abv: 40 },
  'lillet blanc': { price: 14.00, packMl: 750, abv: 17 },
  'st-germain': { price: 22.00, packMl: 700, abv: 20 },
  'elderflower liqueur': { price: 18.00, packMl: 700, abv: 20 },
  'peach schnapps': { price: 10.00, packMl: 700, abv: 18 },
  'cherry liqueur': { price: 14.00, packMl: 700, abv: 24 },
  'heering cherry liqueur': { price: 18.00, packMl: 700, abv: 24 },
  'green chartreuse': { price: 34.00, packMl: 700, abv: 55 },
  'yellow chartreuse': { price: 30.00, packMl: 700, abv: 40 },
  'midori': { price: 14.00, packMl: 700, abv: 20 },
  'banana liqueur': { price: 10.00, packMl: 700, abv: 20 },
  'apricot brandy': { price: 14.00, packMl: 700, abv: 30 },
  'apricot liqueur': { price: 14.00, packMl: 700, abv: 25 },
  'irish cream liqueur': { price: 14.00, packMl: 700, abv: 17 },
  'pastis': { price: 16.00, packMl: 700, abv: 45 },
  'sambuca': { price: 14.00, packMl: 700, abv: 38 },
  // citrus (per 200ml bottle)
  'fresh lemon juice': { price: 1.50, packMl: 200, abv: 0 },
  'lemon juice': { price: 1.50, packMl: 200, abv: 0 },
  'fresh lime juice': { price: 1.80, packMl: 200, abv: 0 },
  'lime juice': { price: 1.80, packMl: 200, abv: 0 },
  'fresh orange juice': { price: 1.20, packMl: 300, abv: 0 },
  'orange juice': { price: 1.20, packMl: 300, abv: 0 },
  'fresh grapefruit juice': { price: 1.80, packMl: 300, abv: 0 },
  'grapefruit juice': { price: 1.80, packMl: 300, abv: 0 },
  'pineapple juice': { price: 1.50, packMl: 1000, abv: 0 },
  // sweeteners
  'simple syrup': { price: 2.50, packMl: 500, abv: 0 },
  'gomme syrup': { price: 3.50, packMl: 500, abv: 0 },
  'sugar syrup': { price: 2.50, packMl: 500, abv: 0 },
  'grenadine': { price: 7.00, packMl: 700, abv: 0 },
  'honey syrup': { price: 4.00, packMl: 300, abv: 0 },
  'agave syrup': { price: 4.00, packMl: 300, abv: 0 },
  'orgeat': { price: 8.00, packMl: 500, abv: 0 },
  'falernum': { price: 12.00, packMl: 700, abv: 11 },
  'raspberry syrup': { price: 5.00, packMl: 500, abv: 0 },
  // bitters (per 10cl)
  'angostura bitters': { price: 8.00, packMl: 100, abv: 45 },
  'peychaud\'s bitters': { price: 10.00, packMl: 100, abv: 35 },
  'orange bitters': { price: 9.00, packMl: 100, abv: 28 },
  // other
  'cranberry juice': { price: 2.00, packMl: 1000, abv: 0 },
  'coconut cream': { price: 2.50, packMl: 400, abv: 0 },
  'heavy cream': { price: 1.80, packMl: 500, abv: 0 },
  'cream': { price: 1.80, packMl: 500, abv: 0 },
  'soda water': { price: 1.00, packMl: 1000, abv: 0 },
  'ginger beer': { price: 1.50, packMl: 330, abv: 0 },
  'cola': { price: 1.00, packMl: 330, abv: 0 },
  'tonic water': { price: 1.00, packMl: 200, abv: 0 },
  'egg white': { price: 0.30, packMl: 30, abv: 0 },
};

// ── Canonical display names (normalise IBA dataset inconsistencies) ────────────
const CANONICAL_NAME: Record<string, string> = {
  'cachaça ': 'Cachaça',
  'cachaca': 'Cachaça',
  'light rum': 'White Rum',
  'gold rum': 'Golden Rum',
  'blanco tequila': 'Blanco Tequila',
  'silver tequila': 'Blanco Tequila',
  'sweet vermouth': 'Sweet Red Vermouth',
  'peychaud bitters': "Peychaud's Bitters",
  'lemon juice': 'Fresh Lemon Juice',
  'lime juice': 'Fresh Lime Juice',
  'orange juice': 'Fresh Orange Juice',
  'grapefruit juice': 'Fresh Grapefruit Juice',
  'sugar syrup': 'Gomme Syrup',
  'honey': 'Honey Syrup',
  'agave nectar': 'Agave Syrup',
  'brown sugar': 'Demerara Syrup',
};

function escape(s: string): string {
  return s.replace(/'/g, "''");
}

function normalise(name: string): string {
  return name.toLowerCase().trim();
}

function getType(name: string): string {
  const n = normalise(name);
  // Try exact match, then ASCII-folded match (handles é/è/ê variants from JSON encoding)
  return TYPE_MAP[n] ?? TYPE_MAP[n.normalize('NFD').replace(/[̀-ͯ]/g, '')] ?? 'other';
}

function getRef(name: string): { price: number; packMl: number; abv: number } {
  const n = normalise(name);
  return REF_PRICES[n] ?? { price: 5.00, packMl: 700, abv: 0 };
}

function getCanonical(name: string): string {
  const n = normalise(name);
  return CANONICAL_NAME[n] ?? name.trim();
}

// ── Unit conversion to ml ─────────────────────────────────────────────────────
function toMl(quantity: number, unit: string): number {
  switch (unit.toLowerCase().trim()) {
    case 'ml':   return quantity;
    case 'cl':   return quantity * 10;
    case 'oz':   return quantity * 29.5735;
    case 'dash': return quantity * 0.625;
    case 'tsp':  return quantity * 5;
    case 'tbsp': return quantity * 15;
    case 'shot': return quantity * 44;
    case 'part': return quantity * 30;
    default:     return quantity;
  }
}

// ── Infer method from preparation text ────────────────────────────────────────
function inferMethod(prep: string, category?: string): string {
  const p = prep.toLowerCase();
  if (p.includes('blend')) return 'blended';
  if (p.includes('shake') || p.includes('shak')) return 'shaken';
  if (p.includes('stir')) return 'stirred';
  if (p.includes('build') || p.includes('pour directly') || (p.includes('pour all') && !p.includes('shaker'))) return 'built';
  if (p.includes('layer') || p.includes('float')) return 'built';
  if (category?.toLowerCase().includes('unforgettable')) return 'stirred';
  return 'built';
}

// ── IBA dataset types (iba-cocktails-web.json schema) ─────────────────────────
interface IBAIngredient {
  ingredient: string;
  quantity?: string | number;
  unit?: string;
  note?: string | null;
  direction?: string;
}

interface IBACocktail {
  name: string;
  ingredients: IBAIngredient[];
  garnish?: string;
  method?: string;
  glass?: string;
  category?: string;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.error('Fetching IBA cocktails dataset…');

  const url = 'https://raw.githubusercontent.com/rasmusab/iba-cocktails/main/iba-web/iba-cocktails-web.json';
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch dataset: ${res.status} ${res.statusText}`);

  const cocktails: IBACocktail[] = await res.json();
  console.error(`Fetched ${cocktails.length} cocktails.`);

  // ── Deduplicate catalogue ingredients ─────────────────────────────────────
  const catalogueMap = new Map<string, {
    id: string; canonicalName: string; type: string;
    abv: number; packMl: number; refPrice: number;
  }>();

  for (const cocktail of cocktails) {
    for (const ing of cocktail.ingredients) {
      const canonical = getCanonical(ing.ingredient);
      const key = normalise(canonical);
      if (!catalogueMap.has(key)) {
        const ref = getRef(ing.ingredient);
        catalogueMap.set(key, {
          id: uuidv5(`catalogue:${key}`),
          canonicalName: canonical,
          type: getType(ing.ingredient),
          abv: ref.abv,
          packMl: ref.packMl,
          refPrice: ref.price,
        });
      }
    }
  }
  console.error(`Unique catalogue ingredients: ${catalogueMap.size}`);

  // ── Build SQL ─────────────────────────────────────────────────────────────
  const lines: string[] = [];

  lines.push('-- =============================================================================');
  lines.push('-- Proof — IBA Official seed data');
  lines.push(`-- Generated ${new Date().toISOString().slice(0, 10)} from rasmusab/iba-cocktails (sourced from iba-world.com)`);
  lines.push('-- Run AFTER migrations 0001 + 0002 + 0003 are applied.');
  lines.push('-- Usage: supabase db seed');
  lines.push('-- =============================================================================');
  lines.push('');
  lines.push('begin;');
  lines.push('');

  // 1. IBA system user
  lines.push('-- ── IBA Official system user ─────────────────────────────────────────────────');
  lines.push(`insert into auth.users (id, email, encrypted_password, email_confirmed_at,`);
  lines.push(`  raw_user_meta_data, created_at, updated_at, role, aud)`);
  lines.push(`values (`);
  lines.push(`  '${IBA_USER_ID}',`);
  lines.push(`  'iba-official@proof.app',`);
  lines.push(`  '$2a$10$IBAOfficialSystemUserDoNotSignInToThisAccountXXXXXXXXX',`);
  lines.push(`  now(),`);
  lines.push(`  '{"full_name": "IBA Official", "is_system": true}'::jsonb,`);
  lines.push(`  now(), now(), 'authenticated', 'authenticated'`);
  lines.push(`) on conflict (id) do nothing;`);
  lines.push('');

  // 2. Catalogue ingredients
  lines.push('-- ── Community catalogue (IBA canonical ingredient list) ─────────────────────');
  lines.push(`insert into catalogue_ingredients`);
  lines.push(`  (id, name, type, abv, default_pack_size_ml, reference_price, contributed_by, verified)`);
  lines.push(`values`);

  const catEntries = [...catalogueMap.values()];
  catEntries.forEach((ing, i) => {
    const comma = i < catEntries.length - 1 ? ',' : '';
    lines.push(
      `  ('${ing.id}', '${escape(ing.canonicalName)}', '${ing.type}', ${ing.abv}, ${ing.packMl}, ${ing.refPrice}, null, true)${comma}`
    );
  });
  lines.push(`on conflict do nothing;`);
  lines.push('');

  // 3. Published specs
  lines.push(`-- ── IBA Official cocktails (${cocktails.length} published specs) ────────────────────────────`);
  lines.push(`insert into published_specs`);
  lines.push(`  (id, creator_id, name, method, glass, garnish, build_text,`);
  lines.push(`   components_snapshot, forked_from_id, spec_id)`);
  lines.push(`values`);

  const specRows: string[] = [];
  const published: PubRow[] = [];

  for (const cocktail of cocktails) {
    const specId = uuidv5(`iba:${cocktail.name}`);

    const garnish = cocktail.garnish ?? '';
    const methodText = cocktail.method ?? '';
    const method = inferMethod(methodText, cocktail.category);

    // Build components_snapshot — uses `quantity` field (not `amount`) per web JSON schema
    const components = cocktail.ingredients
      .filter(ing => ing.ingredient && ing.ingredient.trim())
      .map(ing => {
        const canonical = getCanonical(ing.ingredient);
        const key = normalise(canonical);
        const catEntry = catalogueMap.get(key);
        const rawQty = ing.quantity ?? 0;
        const qty = parseFloat(String(rawQty).replace(/[^0-9.]/g, '')) || 0;
        const unit = ing.unit ?? 'ml';
        const amountMl = Math.round(toMl(qty, unit) * 100) / 100;
        return {
          name: canonical,
          amount_ml: amountMl,
          original_amount: qty,
          original_unit: unit,
          type: getType(ing.ingredient),
          catalogue_id: catEntry?.id ?? null,
          abv: catEntry?.abv ?? 0,
          cost_per_ml_at_publish: null,
          note: ing.note ?? null,
        };
      })
      .filter(c => c.amount_ml > 0);

    const snapshot = JSON.stringify(components);

    specRows.push(
      `  ('${specId}', '${IBA_USER_ID}', '${escape(cocktail.name)}', ` +
      `'${escape(method)}', '${escape(cocktail.glass ?? '')}', ` +
      `'${escape(garnish)}', '${escape(methodText)}', ` +
      `'${escape(snapshot)}'::jsonb, null, null)`
    );

    published.push({
      id: specId,
      name: cocktail.name,
      method,
      glass: cocktail.glass ?? '',
      garnish,
      build_text: methodText,
      components,
    });
  }

  lines.push(specRows.join(',\n'));
  lines.push(`on conflict do nothing;`);
  lines.push('');
  lines.push('commit;');
  lines.push('');
  lines.push(`-- Seed complete: ${catEntries.length} catalogue ingredients + ${cocktails.length} published specs`);

  const sql = lines.join('\n');
  writeFileSync(OUT_PATH, sql, 'utf8');
  console.error(`Written to ${OUT_PATH}`);

  if (process.argv.includes('--push')) {
    await pushToDb(catEntries, published);
  }
}

// ── Structured published row (feeds both SQL render and the DB push) ───────────
interface PubRow {
  id: string;
  name: string;
  method: string;
  glass: string;
  garnish: string;
  build_text: string;
  components: unknown[];
}

type CatEntry = {
  id: string; canonicalName: string; type: string;
  abv: number; packMl: number; refPrice: number;
};

// ── Idempotent push to the live database via the service-role admin client ─────
// published_specs is append-only (0003 trigger blocks UPDATE), so both upserts
// use ignoreDuplicates → INSERT ... ON CONFLICT DO NOTHING. Deterministic ids
// make re-runs safe no-ops for rows that already exist.
async function pushToDb(catEntries: CatEntry[], published: PubRow[]) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not set. Add it to .env.local (never commit it) and re-run with --push.'
    );
  }

  const admin = createClient(SUPABASE_URL, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1. Ensure the IBA Official system user exists; reuse it if already present.
  const email = 'iba-official@proof.app';
  let creatorId: string | undefined;
  for (let page = 1; page <= 25 && !creatorId; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    // listUsers' destructured union widens data.users to never[]; narrow explicitly.
    const users = data.users as Array<{ id: string; email?: string }>;
    creatorId = users.find(u => u.email === email)?.id;
    if (users.length < 200) break;
  }
  if (!creatorId) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { full_name: 'IBA Official', is_system: true },
    });
    if (error) throw error;
    creatorId = data.user!.id;
    console.error(`Created IBA Official system user: ${creatorId}`);
  } else {
    console.error(`Reusing IBA Official system user: ${creatorId}`);
  }

  // 2. Catalogue ingredients (insert-if-absent).
  const catRows = catEntries.map(c => ({
    id: c.id,
    name: c.canonicalName,
    type: c.type,
    abv: c.abv,
    default_pack_size_ml: c.packMl,
    reference_price: c.refPrice,
    contributed_by: null,
    verified: true,
  }));
  const catRes = await admin
    .from('catalogue_ingredients')
    .upsert(catRows, { onConflict: 'id', ignoreDuplicates: true });
  if (catRes.error) throw catRes.error;
  console.error(`Catalogue: ${catRows.length} rows pushed (existing ids skipped).`);

  // 3. Published specs (append-only insert-if-absent).
  const pubRows = published.map(p => ({
    id: p.id,
    creator_id: creatorId,
    name: p.name,
    method: p.method,
    glass: p.glass,
    garnish: p.garnish,
    build_text: p.build_text,
    components_snapshot: p.components,
    forked_from_id: null,
    spec_id: null,
  }));
  const pubRes = await admin
    .from('published_specs')
    .upsert(pubRows, { onConflict: 'id', ignoreDuplicates: true });
  if (pubRes.error) throw pubRes.error;
  console.error(`Published specs: ${pubRows.length} rows pushed (existing ids skipped).`);
  console.error('Push complete.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
