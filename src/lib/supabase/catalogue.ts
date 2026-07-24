import { supabase } from './client';
import type { Ingredient } from './queries';

export type CatalogueIngredient = {
  id: string;
  name: string;
  type: string;
  abv: number;
  default_pack_size_ml: number;
  reference_price: number;
  verified: boolean;
  contributed_by: string | null;
};

export async function listCatalogueIngredients(): Promise<CatalogueIngredient[]> {
  const { data, error } = await supabase
    .from('catalogue_ingredients')
    .select('id, name, type, abv, default_pack_size_ml, reference_price, verified, contributed_by')
    .order('name');
  if (error) throw error;
  return data as CatalogueIngredient[];
}

export async function searchCatalogueIngredients(
  q: string,
  type?: string
): Promise<CatalogueIngredient[]> {
  let query = supabase
    .from('catalogue_ingredients')
    .select('id, name, type, abv, default_pack_size_ml, reference_price, verified, contributed_by');

  if (q.trim()) {
    // Prefix-match on name for autocomplete responsiveness, fall back to ilike
    query = query.ilike('name', `%${q}%`);
  }
  if (type) {
    query = query.eq('type', type);
  }
  const { data, error } = await query.order('name').limit(30);
  if (error) throw error;
  return data as CatalogueIngredient[];
}

// Find-or-create the user's own ingredient row for a catalogue entry.
// Pricing is optional: omit packCost (or pass null) to add it unpriced — the
// generated cost_per_ml stays null until the user sets a price later. Idempotent
// by catalogue_id, so using the same catalogue ingredient twice reuses one row
// (never overwrites an existing price).
export async function importCatalogueIngredient(
  catalogueId: string,
  packCost?: number | null,
  packSizeMlOverride?: number
): Promise<Ingredient> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: existing } = await supabase
    .from('ingredients')
    .select('*')
    .eq('user_id', user.id)
    .eq('catalogue_id', catalogueId)
    .maybeSingle();
  if (existing) return existing as Ingredient;

  const { data: cat, error: catErr } = await supabase
    .from('catalogue_ingredients')
    .select('name, type, abv, default_pack_size_ml')
    .eq('id', catalogueId)
    .single();
  if (catErr) throw catErr;

  const packSizeMl = packSizeMlOverride ?? cat.default_pack_size_ml;

  const { data, error } = await supabase
    .from('ingredients')
    .insert({
      user_id: user.id,
      name: cat.name,
      type: cat.type,
      abv: cat.abv,
      pack_size_ml: packSizeMl,
      pack_cost: packCost ?? null,
      catalogue_id: catalogueId,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Ingredient;
}
