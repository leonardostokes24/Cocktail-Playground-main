import { supabase } from './client';

// ── Helpers ───────────────────────────────────────────────────────────────────

async function currentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  return user;
}

// ── Ingredients ───────────────────────────────────────────────────────────────

export type Ingredient = {
  id: string;
  user_id: string;
  name: string;
  type: string | null;
  abv: number;
  pack_size_ml: number;
  pack_cost: number;
  cost_per_ml: number;
  created_at: string;
  updated_at: string;
};

export type IngredientInput = {
  name: string;
  type: string | null;
  abv: number;
  pack_size_ml: number;
  pack_cost: number;
};

export async function listIngredients(): Promise<Ingredient[]> {
  const user = await currentUser();
  const { data, error } = await supabase
    .from('ingredients')
    .select('*')
    .eq('user_id', user.id)
    .order('name');
  if (error) throw error;
  return data as Ingredient[];
}

export async function insertIngredient(input: IngredientInput): Promise<Ingredient> {
  const user = await currentUser();
  const { data, error } = await supabase
    .from('ingredients')
    .insert({ ...input, user_id: user.id })
    .select()
    .single();
  if (error) throw error;
  return data as Ingredient;
}

export async function updateIngredient(id: string, input: Partial<IngredientInput>): Promise<Ingredient> {
  const { data, error } = await supabase
    .from('ingredients').update(input).eq('id', id).select().single();
  if (error) throw error;
  return data as Ingredient;
}

export async function deleteIngredient(id: string): Promise<void> {
  const { error } = await supabase.from('ingredients').delete().eq('id', id);
  if (error) throw error;
}

// ── Specs ─────────────────────────────────────────────────────────────────────

export type Spec = {
  id: string;
  user_id: string;
  name: string;
  parent_spec_id: string | null;
  change_note: string | null;
  method: string | null;
  glass: string | null;
  garnish: string | null;
  build_text: string | null;
  sale_price: number | null;
  status: 'draft' | 'published';
  published_recipe_id: string | null;
  canvas_x: number;
  canvas_y: number;
  created_at: string;
  updated_at: string;
};

export type SpecInput = {
  name: string;
  parent_spec_id?: string | null;
  change_note?: string | null;
  method?: string | null;
  glass?: string | null;
  garnish?: string | null;
  build_text?: string | null;
  sale_price?: number | null;
  canvas_x?: number;
  canvas_y?: number;
};

export async function listSpecs(): Promise<Spec[]> {
  const user = await currentUser();
  const { data, error } = await supabase
    .from('specs')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as Spec[];
}

export async function insertSpec(input: SpecInput): Promise<Spec> {
  const user = await currentUser();
  const { data, error } = await supabase
    .from('specs')
    .insert({ ...input, user_id: user.id })
    .select()
    .single();
  if (error) throw error;
  return data as Spec;
}

export async function updateSpec(id: string, input: Partial<SpecInput>): Promise<Spec> {
  const { data, error } = await supabase
    .from('specs').update(input).eq('id', id).select().single();
  if (error) throw error;
  return data as Spec;
}

export async function deleteSpec(id: string): Promise<void> {
  const { error } = await supabase.from('specs').delete().eq('id', id);
  if (error) throw error;
}

// ── Spec Components ───────────────────────────────────────────────────────────

export type SpecComponent = {
  id: string;
  user_id: string;
  spec_id: string;
  ingredient_id: string | null;
  prep_id: string | null;
  amount_ml: number;
  original_amount: number | null;
  original_unit: string | null;
  position: number;
  // joined
  ingredients?: Pick<Ingredient, 'name' | 'type' | 'abv' | 'cost_per_ml'> | null;
};

export type SpecComponentInput = {
  spec_id: string;
  ingredient_id?: string | null;
  prep_id?: string | null;
  amount_ml: number;
  original_amount?: number | null;
  original_unit?: string | null;
  position?: number;
};

export async function listSpecComponents(specId: string): Promise<SpecComponent[]> {
  const { data, error } = await supabase
    .from('spec_components')
    .select('*, ingredients(name, type, abv, cost_per_ml)')
    .eq('spec_id', specId)
    .order('position');
  if (error) throw error;
  return data as SpecComponent[];
}

export async function listAllSpecComponents(): Promise<SpecComponent[]> {
  const user = await currentUser();
  const { data, error } = await supabase
    .from('spec_components')
    .select('*, ingredients(name, type, abv, cost_per_ml)')
    .eq('user_id', user.id)
    .order('position');
  if (error) throw error;
  return data as SpecComponent[];
}

export async function insertSpecComponent(input: SpecComponentInput): Promise<SpecComponent> {
  const user = await currentUser();
  const { data, error } = await supabase
    .from('spec_components')
    .insert({ ...input, user_id: user.id })
    .select('*, ingredients(name, type, abv, cost_per_ml)')
    .single();
  if (error) throw error;
  return data as SpecComponent;
}

export async function updateSpecComponent(
  id: string,
  input: Partial<Pick<SpecComponentInput, 'amount_ml' | 'original_amount' | 'original_unit' | 'position'>>
): Promise<SpecComponent> {
  const { data, error } = await supabase
    .from('spec_components')
    .update(input)
    .eq('id', id)
    .select('*, ingredients(name, type, abv, cost_per_ml)')
    .single();
  if (error) throw error;
  return data as SpecComponent;
}

export async function deleteSpecComponent(id: string): Promise<void> {
  const { error } = await supabase.from('spec_components').delete().eq('id', id);
  if (error) throw error;
}

// ── Spec Cost Rollup (view) ───────────────────────────────────────────────────

export type SpecCostRow = {
  spec_id: string;
  user_id: string;
  sale_price: number | null;
  pour_cost: number;
  liquid_volume_ml: number;
  pre_dilution_abv: number;
};

export async function listSpecCosts(): Promise<SpecCostRow[]> {
  const user = await currentUser();
  const { data, error } = await supabase
    .from('spec_costs')
    .select('*')
    .eq('user_id', user.id);
  if (error) throw error;
  return data as SpecCostRow[];
}
