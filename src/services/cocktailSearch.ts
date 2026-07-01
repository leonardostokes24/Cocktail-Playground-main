import { supabase } from './supabaseClient';
import type { Cocktail } from '../data/cocktailDB';
import { CATEGORY_TO_TYPE } from './ingredientsService';

function rowToCocktail(row: any): Cocktail {
  return {
    name: row.name,
    method: row.method ?? 'Unknown',
    glass: row.glass ?? 'Unknown',
    keywords: row.keywords ?? [],
    description: row.description,
    standardIngredients: (row.ingredients ?? []).map((ing: any, idx: number) => ({
      label: ing.label ?? ing.name,
      // New format stores category; old format stores type; oldest has neither
      type: ing.type
        ?? (ing.category ? CATEGORY_TO_TYPE[ing.category] : undefined)
        ?? (idx === 0 ? 'spirit' : 'modifier'),
      amount: [ing.amount, ing.unit].filter(Boolean).join(' '),
    })),
  };
}

// Name-based search used by the radial wheel recipe panel.
export async function searchCocktails(query: string, limit = 12): Promise<Cocktail[]> {
  if (!query.trim()) return [];
  const { data, error } = await supabase
    .from('cocktails')
    .select('name, method, glass, keywords, ingredients, description')
    .ilike('name', `%${query.trim()}%`)
    .limit(limit);
  if (error || !data) return [];
  return data.map(rowToCocktail);
}

// Ingredient-based auto-matcher used by SpecNode logic.
// Returns the first library cocktail whose entire ingredient list is covered
// by the supplied ingredient names (case-insensitive partial match).
export async function matchCocktailByIngredients(
  ingredientNames: string[]
): Promise<Cocktail | null> {
  if (ingredientNames.length < 2) return null;

  // Fetch a candidate set using the first ingredient word as a name hint,
  // then fall back to a wider scan if that returns nothing.
  const firstWord = ingredientNames[0].split(' ')[0];
  const { data: narrow } = await supabase
    .from('cocktails')
    .select('name, method, glass, keywords, ingredients, description')
    .ilike('name', `%${firstWord}%`)
    .limit(50);

  const { data: wide } = await supabase
    .from('cocktails')
    .select('name, method, glass, keywords, ingredients, description')
    .limit(100);

  const candidates = [...(narrow ?? []), ...(wide ?? [])];
  const seen = new Set<string>();
  const specLower = ingredientNames.map(n => n.toLowerCase());

  for (const row of candidates) {
    if (seen.has(row.name)) continue;
    seen.add(row.name);

    const recipeIngs: string[] = (row.ingredients ?? []).map((i: any) =>
      (i.name as string).toLowerCase()
    );
    if (recipeIngs.length === 0 || recipeIngs.length > ingredientNames.length + 1) continue;

    const allMatch = recipeIngs.every(ri =>
      specLower.some(si => si.includes(ri) || ri.includes(si))
    );
    if (allMatch) return rowToCocktail(row);
  }

  return null;
}
