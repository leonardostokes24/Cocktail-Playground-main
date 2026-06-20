import { supabase } from './supabaseClient';

export interface AppIngredient {
  id: string;
  label: string;
  category: string;
  emoji: string;
  color: string;
}

export type IngredientsByCategory = Record<string, AppIngredient[]>;

// Maps DB category → the ingredient node type used on the canvas
export const CATEGORY_TO_TYPE: Record<string, string> = {
  spirits:    'spirit',
  liqueurs:   'modifier',
  vermouth:   'modifier',
  amari:      'modifier',
  citrus:     'citrus',
  sweeteners: 'sweetener',
  bitters:    'bitters',
};

export async function fetchIngredients(): Promise<IngredientsByCategory> {
  const { data, error } = await supabase
    .from('ingredients')
    .select('id, label, category, emoji, color')
    .order('label');

  if (error || !data) return {};

  return data.reduce<IngredientsByCategory>((acc, ing) => {
    if (!acc[ing.category]) acc[ing.category] = [];
    acc[ing.category].push(ing);
    return acc;
  }, {});
}
