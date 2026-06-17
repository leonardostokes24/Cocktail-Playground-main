const BASE = 'https://www.thecocktaildb.com/api/json/v1/1';

function ozToMl(measure: string): string {
  if (!measure.toLowerCase().includes('oz')) return measure;

  // Strip "oz" and any trailing whitespace
  const raw = measure.toLowerCase().replace('oz', '').trim();

  // Parse mixed numbers like "1 1/2", simple fractions like "3/4", or whole/decimal numbers
  let value = 0;
  const mixedMatch = raw.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  const fractionMatch = raw.match(/^(\d+)\/(\d+)$/);
  const decimalMatch = raw.match(/^(\d*\.?\d+)$/);

  if (mixedMatch) {
    value = parseInt(mixedMatch[1]) + parseInt(mixedMatch[2]) / parseInt(mixedMatch[3]);
  } else if (fractionMatch) {
    value = parseInt(fractionMatch[1]) / parseInt(fractionMatch[2]);
  } else if (decimalMatch) {
    value = parseFloat(decimalMatch[1]);
  } else {
    return measure; // unrecognised format — leave as-is
  }

  const ml = Math.round(value * 30 * 2) / 2; // round to nearest 0.5
  return `${ml} ml`;
}

export interface CDBRecipe {
  name: string;
  method: string;
  glass: string;
  standardIngredients: { label: string; type: string; amount: string }[];
}

function parseDrink(drink: Record<string, string>): CDBRecipe {
  const ingredients: CDBRecipe['standardIngredients'] = [];
  for (let i = 1; i <= 15; i++) {
    const name = drink[`strIngredient${i}`];
    const measure = drink[`strMeasure${i}`];
    if (!name?.trim()) break;
    const canvasLabel = CDB_TO_CANVAS_MAP[name.trim()] ?? name.trim();
    ingredients.push({
      label: canvasLabel,
      amount: ozToMl((measure || '').trim()) || 'to taste',
      type: inferType(canvasLabel),
    });
  }
  const cat = (drink.strCategory || '').toLowerCase();
  const method = cat.includes('shot') ? 'Layered'
    : cat.includes('punch') || cat.includes('beer') ? 'Built'
    : 'Shaken';

  return { name: drink.strDrink, method, glass: drink.strGlass, standardIngredients: ingredients };
}

export async function searchByName(query: string): Promise<CDBRecipe[]> {
  if (!query.trim()) return [];
  const res = await fetch(`${BASE}/search.php?s=${encodeURIComponent(query)}`);
  const data = await res.json();
  return (data.drinks || []).map(parseDrink);
}

async function fetchById(id: string): Promise<CDBRecipe | null> {
  const res = await fetch(`${BASE}/lookup.php?i=${id}`);
  const data = await res.json();
  const drink = data.drinks?.[0];
  return drink ? parseDrink(drink) : null;
}

// CocktailDB name → canvas sidebar label (reverse of INGREDIENT_MAP)
const CDB_TO_CANVAS_MAP: Record<string, string> = {
  // Spirits
  'Gin': 'London Dry Gin',
  'Tequila': 'Blanco Tequila',
  'Rum': 'Light Rum',
  'White rum': 'Light Rum',
  'Light rum': 'Light Rum',
  'Dark rum': 'Dark Rum',
  'Gold rum': 'Dark Rum',
  'Aged rum': 'Dark Rum',
  'Overproof rum': 'Overproof Rum',
  'Blended whiskey': 'Bourbon',
  'Blended Whiskey': 'Bourbon',
  'Rye whiskey': 'Rye Whiskey',
  'Scotch': 'Scotch',
  'Blended scotch': 'Scotch',
  'Irish whiskey': 'Irish Whiskey',
  'Cognac': 'Cognac',
  'Brandy': 'Brandy / Pisco',
  'Pisco': 'Brandy / Pisco',
  'Cachaca': 'Cachaça',
  'Cachaça': 'Cachaça',
  'Applejack': 'Applejack',
  'Calvados': 'Applejack',
  // Sweeteners
  'Sugar syrup': 'Simple Syrup',
  'Simple syrup': 'Simple Syrup',
  'Gomme syrup': 'Simple Syrup',
  'Honey': 'Honey Syrup',
  'Agave syrup': 'Agave Nectar',
  'Grenadine': 'Grenadine',
  'Orgeat': 'Orgeat',
  'Maple syrup': 'Maple Syrup',
  // Citrus & juice
  'Lemon juice': 'Lemon Juice',
  'Lime juice': 'Lime Juice',
  'Orange juice': 'Orange Juice',
  'Grapefruit juice': 'Grapefruit',
  'Pineapple juice': 'Pineapple',
  'Cranberry juice': 'Cranberry',
  // Bitters
  'Angostura Bitters': 'Aromatic Bitters',
  'Peychaud Bitters': "Peychaud's",
  'Orange bitters': 'Orange Bitters',
  // Liqueurs & modifiers
  'Triple sec': 'Triple Sec',
  'Maraschino Liqueur': 'Maraschino',
  'Elderflower liqueur': 'Elderflower',
  'Coffee liqueur': 'Coffee Liqueur',
  'Green Chartreuse': 'Green Chartreuse',
  'Yellow Chartreuse': 'Yellow Chartreuse',
  'Bianco Vermouth': 'Blanc Vermouth',
};

function inferType(label: string): string {
  const l = label.toLowerCase();
  if (/gin|vodka|rum|tequila|mezcal|whiskey|whisky|bourbon|scotch|cognac|brandy|pisco|cacha[cç]a|applejack|calvados/.test(l)) return 'spirit';
  if (/bitters|tincture/.test(l)) return 'bitters';
  if (/\bjuice\b|lemon|lime|grapefruit|pineapple|cranberry/.test(l)) return 'citrus';
  if (/syrup|honey|sugar|agave|orgeat|grenadine|maple/.test(l)) return 'sweetener';
  return 'modifier';
}

// Map canvas ingredient labels to CocktailDB-compatible names
const INGREDIENT_MAP: Record<string, string> = {
  'London Dry Gin': 'Gin',
  'Old Tom Gin': 'Gin',
  'Blanco Tequila': 'Tequila',
  'Reposado Tequila': 'Tequila',
  'Light Rum': 'Light rum',
  'Dark Rum': 'Dark rum',
  'Overproof Rum': 'Rum',
  'Brandy / Pisco': 'Brandy',
  'Aromatic Bitters': 'Angostura Bitters',
  "Peychaud's": 'Peychaud Bitters',
  'Simple Syrup': 'Sugar syrup',
  'Rich Simple': 'Sugar syrup',
  'Demerara Syrup': 'Sugar syrup',
  'Honey Syrup': 'Honey',
  'Agave Nectar': 'Agave syrup',
  'Lemon Juice': 'Lemon juice',
  'Lime Juice': 'Lime juice',
  'Orange Juice': 'Orange juice',
  'Triple Sec': 'Triple sec',
  'Maraschino': 'Maraschino Liqueur',
  'Elderflower': 'Elderflower liqueur',
  'Coffee Liqueur': 'Coffee liqueur',
  'Green Chartreuse': 'Green Chartreuse',
  'Yellow Chartreuse': 'Yellow Chartreuse',
  'Sweet Vermouth': 'Sweet Vermouth',
  'Dry Vermouth': 'Dry Vermouth',
  'Blanc Vermouth': 'Bianco Vermouth',
  'Irish Whiskey': 'Irish whiskey',
  'Rye Whiskey': 'Rye whiskey',
};

function normalize(name: string): string {
  return INGREDIENT_MAP[name] || name;
}

// Spirits get the best filter results from CocktailDB
const SPIRIT_KEYWORDS = ['Bourbon', 'Gin', 'Vodka', 'Rum', 'Tequila', 'Whiskey', 'Scotch', 'Cognac', 'Mezcal', 'Brandy', 'Pisco', 'Cachaça', 'Applejack'];

// Score how well a recipe's ingredient list matches the canvas ingredients
function scoreMatch(canvasIngredients: string[], recipe: CDBRecipe): number {
  const normalize = (s: string) =>
    s.toLowerCase().replace(/\s*(juice|syrup|bitters|liqueur)\s*/g, '').trim();
  const canvas = canvasIngredients.map(normalize);
  const recipeIngs = recipe.standardIngredients.map(i => normalize(i.label));
  let hits = 0;
  for (const cv of canvas) {
    if (recipeIngs.some(ri => ri.includes(cv) || cv.includes(ri))) hits++;
  }
  return hits / Math.max(canvas.length, recipeIngs.length);
}

export async function matchFromIngredients(canvasIngredients: string[]): Promise<CDBRecipe | null> {
  if (canvasIngredients.length < 2) return null;
  const spirit = canvasIngredients.find(ing => SPIRIT_KEYWORDS.some(k => ing.toLowerCase().includes(k.toLowerCase())));
  const target = normalize(spirit || canvasIngredients[0]);

  const res = await fetch(`${BASE}/filter.php?i=${encodeURIComponent(target)}`);
  const data = await res.json();
  if (!data.drinks) return null;

  const ids: string[] = data.drinks.slice(0, 6).map((d: Record<string, string>) => d.idDrink);
  const recipes = (await Promise.all(ids.map(fetchById))).filter((r): r is CDBRecipe => r !== null);

  let best: CDBRecipe | null = null;
  let bestScore = 0.4; // minimum threshold for a valid match
  for (const recipe of recipes) {
    const score = scoreMatch(canvasIngredients, recipe);
    if (score > bestScore) { bestScore = score; best = recipe; }
  }
  return best;
}

export async function suggestByIngredients(ingredients: string[]): Promise<CDBRecipe[]> {
  const spirit = ingredients.find(ing => SPIRIT_KEYWORDS.some(k => ing.includes(k)));
  const target = normalize(spirit || ingredients[0]);

  const res = await fetch(`${BASE}/filter.php?i=${encodeURIComponent(target)}`);
  const data = await res.json();
  const ids: string[] = (data.drinks || []).slice(0, 8).map((d: Record<string, string>) => d.idDrink);

  const recipes = await Promise.all(ids.map(fetchById));
  return recipes.filter((r): r is CDBRecipe => r !== null);
}
