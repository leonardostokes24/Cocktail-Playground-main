import { supabase } from './client';

// A prep is a batched sub-recipe (syrup, cordial, infusion) measured in ml.
// prep_components holds ingredients ONLY — preps never nest (⚑).
export type Prep = {
  id: string;
  user_id: string;
  name: string;
  yield_ml: number;
  method: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type PrepInput = {
  name: string;
  yield_ml: number;
  method?: string | null;
  notes?: string | null;
};

export type PrepComponent = {
  id: string;
  user_id: string;
  prep_id: string;
  ingredient_id: string;
  amount_ml: number;
  original_amount: number | null;
  original_unit: string | null;
  position: number;
  // joined
  ingredients?: { name: string; type: string | null; abv: number; cost_per_ml: number | null } | null;
};

export type PrepComponentInput = {
  prep_id: string;
  ingredient_id: string;
  amount_ml: number;
  original_amount?: number | null;
  original_unit?: string | null;
  position?: number;
};

// Row from the prep_costs view. cost_per_ml is the rollup the cost engine wants;
// unpriced_count > 0 means it is incomplete — the prep is unpriced, not cheap.
export type PrepCostRow = {
  prep_id: string;
  user_id: string;
  yield_ml: number;
  batch_cost: number;
  cost_per_ml: number;
  abv: number;
  unpriced_count: number;
  component_count: number;
};

async function currentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  return user;
}

// ── Preps ─────────────────────────────────────────────────────────────────────

export async function listPreps(): Promise<Prep[]> {
  const user = await currentUser();
  const { data, error } = await supabase
    .from('preps')
    .select('*')
    .eq('user_id', user.id)
    .order('name');
  if (error) throw error;
  return data as Prep[];
}

export async function insertPrep(input: PrepInput): Promise<Prep> {
  const user = await currentUser();
  const { data, error } = await supabase
    .from('preps')
    .insert({ ...input, user_id: user.id })
    .select()
    .single();
  if (error) throw error;
  return data as Prep;
}

export async function updatePrep(id: string, input: Partial<PrepInput>): Promise<Prep> {
  const { data, error } = await supabase
    .from('preps').update(input).eq('id', id).select().single();
  if (error) throw error;
  return data as Prep;
}

export async function deletePrep(id: string): Promise<void> {
  const { error } = await supabase.from('preps').delete().eq('id', id);
  if (error) throw error;
}

// ── Prep components ───────────────────────────────────────────────────────────

export async function listPrepComponents(prepId: string): Promise<PrepComponent[]> {
  const { data, error } = await supabase
    .from('prep_components')
    .select('*, ingredients(name, type, abv, cost_per_ml)')
    .eq('prep_id', prepId)
    .order('position');
  if (error) throw error;
  return data as PrepComponent[];
}

export async function insertPrepComponent(input: PrepComponentInput): Promise<PrepComponent> {
  const user = await currentUser();
  const { data, error } = await supabase
    .from('prep_components')
    .insert({ ...input, user_id: user.id })
    .select('*, ingredients(name, type, abv, cost_per_ml)')
    .single();
  if (error) throw error;
  return data as PrepComponent;
}

export async function updatePrepComponent(
  id: string,
  input: Partial<Pick<PrepComponentInput, 'amount_ml' | 'original_amount' | 'original_unit' | 'position'>>
): Promise<PrepComponent> {
  const { data, error } = await supabase
    .from('prep_components')
    .update(input)
    .eq('id', id)
    .select('*, ingredients(name, type, abv, cost_per_ml)')
    .single();
  if (error) throw error;
  return data as PrepComponent;
}

export async function deletePrepComponent(id: string): Promise<void> {
  const { error } = await supabase.from('prep_components').delete().eq('id', id);
  if (error) throw error;
}

// ── Costs ─────────────────────────────────────────────────────────────────────

// Always read the rollup from the view (security_invoker) — never recompute the
// batch cost client-side.
export async function listPrepCosts(): Promise<PrepCostRow[]> {
  const user = await currentUser();
  const { data, error } = await supabase
    .from('prep_costs')
    .select('*')
    .eq('user_id', user.id);
  if (error) throw error;
  return data as PrepCostRow[];
}
