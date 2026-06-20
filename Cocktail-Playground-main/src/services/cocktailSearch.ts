import { supabase } from './supabaseClient';
import type { Cocktail } from '../data/cocktailDB';

export async function searchCocktails(query: string, limit = 12): Promise<Cocktail[]> {
  if (!query.trim()) return [];

  const { data, error } = await supabase.rpc('search_cocktails', {
    query_text: query.trim(),
    match_count: limit,
  });

  if (error || !data) return [];

  return (data as any[]).map((row, _i) => ({
    name: row.name,
    method: row.method ?? 'Unknown',
    glass: row.glass ?? 'Unknown',
    keywords: row.keywords ?? [],
    description: row.description,
    standardIngredients: (row.ingredients ?? []).map((ing: any, idx: number) => ({
      label: ing.name,
      // Supabase schema has no type field; default first ingredient to spirit, rest to modifier
      type: idx === 0 ? 'spirit' : 'modifier',
      amount: [ing.amount, ing.unit].filter(Boolean).join(' '),
    })),
  }));
}
