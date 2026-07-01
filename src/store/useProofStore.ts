import { create } from 'zustand';
import { DILUTION_DEFAULTS } from '../utils/calculations';
import {
  listIngredients, insertIngredient, updateIngredient, deleteIngredient,
  listSpecs, insertSpec, updateSpec, deleteSpec,
  listSpecComponents, insertSpecComponent, updateSpecComponent, deleteSpecComponent,
  listAllSpecComponents,
  listSpecCosts,
  type Ingredient, type IngredientInput,
  type Spec, type SpecInput,
  type SpecComponent, type SpecComponentInput,
  type SpecCostRow,
} from '../lib/supabase/queries';

function groupBySpecId(components: SpecComponent[]): Record<string, SpecComponent[]> {
  const map: Record<string, SpecComponent[]> = {};
  for (const c of components) {
    (map[c.spec_id] ??= []).push(c);
  }
  return map;
}

// Returns true if making `childId` a child of `targetParentId` would create a cycle.
export function wouldCreateCycle(specs: Spec[], childId: string, targetParentId: string): boolean {
  const specMap = new Map(specs.map((s) => [s.id, s]));
  let current: string | null = targetParentId;
  const seen = new Set<string>();
  while (current) {
    if (current === childId) return true;
    if (seen.has(current)) return true;
    seen.add(current);
    current = specMap.get(current)?.parent_spec_id ?? null;
  }
  return false;
}

interface ProofState {
  // ── Ingredients ──────────────────────────────────────────────
  ingredients: Ingredient[];
  ingredientsLoading: boolean;
  ingredientsError: string | null;
  loadIngredients: () => Promise<void>;
  addIngredient: (input: IngredientInput) => Promise<void>;
  editIngredient: (id: string, input: Partial<IngredientInput>) => Promise<void>;
  removeIngredient: (id: string) => Promise<void>;

  // ── Specs ─────────────────────────────────────────────────────
  specs: Spec[];
  specsLoading: boolean;
  specsError: string | null;
  selectedSpecId: string | null;
  loadSpecs: () => Promise<void>;
  createSpec: (input: SpecInput) => Promise<Spec>;
  editSpec: (id: string, input: Partial<SpecInput>) => Promise<void>;
  removeSpec: (id: string) => Promise<void>;
  selectSpec: (id: string | null) => void;
  branchSpec: (parentId: string) => Promise<void>;

  // ── Spec Cost Map (from spec_costs view) ─────────────────────
  specCostMap: Record<string, SpecCostRow>;
  loadSpecCosts: () => Promise<void>;

  // ── Spec Components ───────────────────────────────────────────
  specComponents: SpecComponent[];
  componentsLoading: boolean;
  loadSpecComponents: (specId: string) => Promise<void>;
  addComponent: (input: SpecComponentInput) => Promise<void>;
  editComponent: (id: string, input: Partial<Pick<SpecComponentInput, 'amount_ml' | 'original_amount' | 'original_unit' | 'position'>>) => Promise<void>;
  removeComponent: (id: string) => Promise<void>;

  // ── Spec Components Map (all specs, for canvas cards) ──────────
  specComponentsMap: Record<string, SpecComponent[]>;
  loadAllSpecComponents: () => Promise<void>;

  // ── Dilution overrides ────────────────────────────────────────
  dilutionOverrides: Record<string, number>;
  setDilutionOverride: (method: string, factor: number) => void;
  resetDilutionOverrides: () => void;

  // ── Phase 3 stubs ─────────────────────────────────────────────
  preps: unknown[];
}

export const useProofStore = create<ProofState>()((set, get) => ({
  // ── Ingredients ──────────────────────────────────────────────
  ingredients: [],
  ingredientsLoading: false,
  ingredientsError: null,

  loadIngredients: async () => {
    set({ ingredientsLoading: true, ingredientsError: null });
    try {
      set({ ingredients: await listIngredients(), ingredientsLoading: false });
    } catch (err: unknown) {
      set({ ingredientsError: err instanceof Error ? err.message : 'Load failed', ingredientsLoading: false });
    }
  },
  addIngredient: async (input) => {
    const i = await insertIngredient(input);
    set((s) => ({ ingredients: [...s.ingredients, i].sort((a, b) => a.name.localeCompare(b.name)) }));
  },
  editIngredient: async (id, input) => {
    const updated = await updateIngredient(id, input);
    set((s) => ({ ingredients: s.ingredients.map((i) => (i.id === id ? updated : i)) }));
  },
  removeIngredient: async (id) => {
    await deleteIngredient(id);
    set((s) => ({ ingredients: s.ingredients.filter((i) => i.id !== id) }));
  },

  // ── Specs ─────────────────────────────────────────────────────
  specs: [],
  specsLoading: false,
  specsError: null,
  selectedSpecId: null,

  loadSpecs: async () => {
    set({ specsLoading: true, specsError: null });
    try {
      set({ specs: await listSpecs(), specsLoading: false });
    } catch (err: unknown) {
      set({ specsError: err instanceof Error ? err.message : 'Load failed', specsLoading: false });
    }
  },
  createSpec: async (input) => {
    const spec = await insertSpec(input);
    set((s) => ({ specs: [spec, ...s.specs] }));
    return spec;
  },
  editSpec: async (id, input) => {
    const updated = await updateSpec(id, input);
    set((s) => ({ specs: s.specs.map((sp) => (sp.id === id ? updated : sp)) }));
  },
  removeSpec: async (id) => {
    await deleteSpec(id);
    set((s) => {
      const { [id]: _removed, ...specComponentsMap } = s.specComponentsMap;
      return {
        specs: s.specs.filter((sp) => sp.id !== id),
        selectedSpecId: s.selectedSpecId === id ? null : s.selectedSpecId,
        specComponents: s.selectedSpecId === id ? [] : s.specComponents,
        specComponentsMap,
      };
    });
  },
  selectSpec: (id) => {
    set({ selectedSpecId: id, specComponents: [] });
    if (id) get().loadSpecComponents(id);
  },
  branchSpec: async (parentId) => {
    const { specs } = get();
    const parent = specs.find((s) => s.id === parentId);
    if (!parent) throw new Error('Parent spec not found');

    const parentComponents = await listSpecComponents(parentId);

    const child = await insertSpec({
      name: `${parent.name} (riff)`,
      parent_spec_id: parentId,
      change_note: '',
      method: parent.method,
      glass: parent.glass,
      garnish: parent.garnish,
      build_text: parent.build_text,
      sale_price: parent.sale_price,
      canvas_x: parent.canvas_x + 280,
      canvas_y: parent.canvas_y + 140,
    });

    const childComponents: SpecComponent[] = [];
    for (const comp of parentComponents) {
      childComponents.push(await insertSpecComponent({
        spec_id: child.id,
        ingredient_id: comp.ingredient_id,
        prep_id: comp.prep_id,
        amount_ml: comp.amount_ml,
        original_amount: comp.original_amount,
        original_unit: comp.original_unit,
        position: comp.position,
      }));
    }

    set((s) => ({
      specs: [...s.specs, child],
      specComponentsMap: { ...s.specComponentsMap, [child.id]: childComponents },
    }));
    get().selectSpec(child.id);
  },

  // ── Spec Cost Map ─────────────────────────────────────────────
  specCostMap: {},
  loadSpecCosts: async () => {
    try {
      const rows = await listSpecCosts();
      const map: Record<string, SpecCostRow> = {};
      for (const r of rows) map[r.spec_id] = r;
      set({ specCostMap: map });
    } catch {
      // non-fatal — canvas nodes just show no cost data
    }
  },

  // ── Spec Components ───────────────────────────────────────────
  specComponents: [],
  componentsLoading: false,

  loadSpecComponents: async (specId) => {
    set({ componentsLoading: true });
    try {
      set({ specComponents: await listSpecComponents(specId), componentsLoading: false });
    } catch {
      set({ componentsLoading: false });
    }
  },
  addComponent: async (input) => {
    const comp = await insertSpecComponent(input);
    set((s) => ({
      specComponents: [...s.specComponents, comp],
      specComponentsMap: {
        ...s.specComponentsMap,
        [comp.spec_id]: [...(s.specComponentsMap[comp.spec_id] ?? []), comp],
      },
    }));
  },
  editComponent: async (id, input) => {
    const updated = await updateSpecComponent(id, input);
    set((s) => ({
      specComponents: s.specComponents.map((c) => (c.id === id ? updated : c)),
      specComponentsMap: {
        ...s.specComponentsMap,
        [updated.spec_id]: (s.specComponentsMap[updated.spec_id] ?? []).map((c) => (c.id === id ? updated : c)),
      },
    }));
  },
  removeComponent: async (id) => {
    const existing = get().specComponents.find((c) => c.id === id)
      ?? Object.values(get().specComponentsMap).flat().find((c) => c.id === id);
    await deleteSpecComponent(id);
    set((s) => ({
      specComponents: s.specComponents.filter((c) => c.id !== id),
      specComponentsMap: existing
        ? {
            ...s.specComponentsMap,
            [existing.spec_id]: (s.specComponentsMap[existing.spec_id] ?? []).filter((c) => c.id !== id),
          }
        : s.specComponentsMap,
    }));
  },

  // ── Spec Components Map ─────────────────────────────────────────
  specComponentsMap: {},
  loadAllSpecComponents: async () => {
    try {
      set({ specComponentsMap: groupBySpecId(await listAllSpecComponents()) });
    } catch {
      // non-fatal — canvas cards just show no component list
    }
  },

  // ── Dilution overrides ────────────────────────────────────────
  dilutionOverrides: {},
  setDilutionOverride: (method, factor) =>
    set((s) => ({ dilutionOverrides: { ...s.dilutionOverrides, [method]: factor } })),
  resetDilutionOverrides: () => set({ dilutionOverrides: {} }),

  // ── Stubs ─────────────────────────────────────────────────────
  preps: [],
}));

export type { Ingredient, IngredientInput, Spec, SpecInput, SpecComponent, SpecComponentInput, SpecCostRow };
export { DILUTION_DEFAULTS };
