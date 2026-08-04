import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DILUTION_DEFAULTS } from '../utils/calculations';
import { DEFAULT_FORMULA_ID } from '../utils/formulaRegistry';
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
import {
  listCatalogueIngredients, searchCatalogueIngredients, importCatalogueIngredient,
  type CatalogueIngredient,
} from '../lib/supabase/catalogue';
import {
  listPublishedFeed, searchPublished, insertPublishedSpec, forkPublishedSpec,
  getSpecLineage,
  type PublishedSpec, type ComponentSnapshot, type LineageRow,
} from '../lib/supabase/published';

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
  // ── Bulk actions on a canvas selection ────────────────────────
  removeSpecs: (ids: string[]) => Promise<void>;
  duplicateSpecs: (ids: string[]) => Promise<void>;
  tidySpecs: (ids: string[]) => Promise<void>;
  publishSpecs: (ids: string[]) => Promise<void>;
  selectSpec: (id: string | null) => void;
  branchSpec: (parentId: string, position?: { x: number; y: number }) => Promise<Spec>;
  // Re-parent an existing spec under another (drag-to-attach). Cycle-guarded.
  attachBranch: (childId: string, parentId: string) => Promise<boolean>;

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

  // ── Costing settings (persisted locally; never hard-coded) ────
  vatRate: number;
  sundriesPerServe: number;
  wasteRate: number;
  targetGpPct: number | null;
  activeFormulaId: string;
  setVatRate: (rate: number) => void;
  setSundriesPerServe: (amount: number) => void;
  setWasteRate: (rate: number) => void;
  setTargetGpPct: (pct: number | null) => void;
  setActiveFormulaId: (id: string) => void;

  // ── Catalogue (world-readable, no auth required) ──────────────
  catalogueIngredients: CatalogueIngredient[];
  catalogueLoading: boolean;
  loadCatalogueIngredients: () => Promise<void>;
  searchCatalogueIngredients: (q: string, type?: string) => Promise<CatalogueIngredient[]>;
  importCatalogueIngredient: (catalogueId: string, packCost?: number | null, packSizeMl?: number) => Promise<Ingredient>;

  // ── Commons feed ──────────────────────────────────────────────
  publishedFeed: PublishedSpec[];
  publishedFeedLoading: boolean;
  publishedFeedLoaded: boolean;
  loadPublishedFeed: () => Promise<void>;
  searchPublishedFeed: (q: string) => Promise<void>;

  // ── Publish + fork ────────────────────────────────────────────
  publishSpec: (specId: string) => Promise<void>;
  forkPublished: (publishedId: string) => Promise<Spec>;

  // ── Lineage (always via the get_spec_lineage RPC ⚑) ───────────
  lineageByPublishedId: Record<string, LineageRow[]>;
  lineageLoadingId: string | null;
  loadLineage: (publishedId: string) => Promise<void>;
  // Fork several published specs onto the canvas at once, laid out on a grid.
  preloadPublished: (publishedIds: string[]) => Promise<void>;

  // ── Phase 3 stubs ─────────────────────────────────────────────
  preps: unknown[];
}

export const useProofStore = create<ProofState>()(persist((set, get) => ({
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
    await get().removeSpecs([id]);
  },
  removeSpecs: async (ids) => {
    if (!ids.length) return;
    for (const id of ids) await deleteSpec(id);

    const gone = new Set(ids);
    set((s) => {
      const specComponentsMap = { ...s.specComponentsMap };
      for (const id of ids) delete specComponentsMap[id];
      const selectionRemoved = s.selectedSpecId != null && gone.has(s.selectedSpecId);
      return {
        // specs.parent_spec_id is ON DELETE SET NULL, so surviving children of a
        // deleted spec become roots — mirror that locally or the canvas would draw
        // an edge from a node that no longer exists.
        specs: s.specs
          .filter((sp) => !gone.has(sp.id))
          .map((sp) => (sp.parent_spec_id && gone.has(sp.parent_spec_id) ? { ...sp, parent_spec_id: null } : sp)),
        selectedSpecId: selectionRemoved ? null : s.selectedSpecId,
        specComponents: selectionRemoved ? [] : s.specComponents,
        specComponentsMap,
      };
    });
  },
  duplicateSpecs: async (ids) => {
    for (const id of ids) {
      const source = get().specs.find((s) => s.id === id);
      if (!source) continue;
      const sourceComponents = await listSpecComponents(id);

      // A copy is an independent spec — no parent, so it starts its own lineage.
      const copy = await insertSpec({
        name: `${source.name} (copy)`,
        method: source.method,
        glass: source.glass,
        garnish: source.garnish,
        build_text: source.build_text,
        sale_price: source.sale_price,
        canvas_x: source.canvas_x + 40,
        canvas_y: source.canvas_y + 40,
      });

      const copied: SpecComponent[] = [];
      for (const c of sourceComponents) {
        copied.push(await insertSpecComponent({
          spec_id: copy.id,
          ingredient_id: c.ingredient_id,
          prep_id: c.prep_id,
          amount_ml: c.amount_ml,
          original_amount: c.original_amount,
          original_unit: c.original_unit,
          position: c.position,
        }));
      }

      set((s) => ({
        specs: [...s.specs, copy],
        specComponentsMap: { ...s.specComponentsMap, [copy.id]: copied },
      }));
    }
  },
  tidySpecs: async (ids) => {
    const chosen = get().specs.filter((s) => ids.includes(s.id));
    if (!chosen.length) return;

    // Keep the cluster where it is, then lay it out in reading order.
    const originX = Math.min(...chosen.map((s) => s.canvas_x));
    const originY = Math.min(...chosen.map((s) => s.canvas_y));
    const perRow = Math.ceil(Math.sqrt(chosen.length));
    const ordered = [...chosen].sort((a, b) => (a.canvas_y - b.canvas_y) || (a.canvas_x - b.canvas_x));

    for (let i = 0; i < ordered.length; i++) {
      await get().editSpec(ordered[i].id, {
        canvas_x: originX + (i % perRow) * 300,
        canvas_y: originY + Math.floor(i / perRow) * 300,
      });
    }
  },
  publishSpecs: async (ids) => {
    for (const id of ids) {
      const spec = get().specs.find((s) => s.id === id);
      if (!spec || spec.status === 'published') continue; // published rows are immutable
      await get().publishSpec(id);
    }
  },
  selectSpec: (id) => {
    set({ selectedSpecId: id, specComponents: [] });
    if (id) get().loadSpecComponents(id);
  },
  branchSpec: async (parentId, position) => {
    const { specs } = get();
    const parent = specs.find((s) => s.id === parentId);
    if (!parent) throw new Error('Parent spec not found');

    const parentComponents = await listSpecComponents(parentId);

    const child = await insertSpec({
      name: `${parent.name} (twist)`,
      parent_spec_id: parentId,
      change_note: '',
      method: parent.method,
      glass: parent.glass,
      garnish: parent.garnish,
      build_text: parent.build_text,
      sale_price: parent.sale_price,
      canvas_x: position ? position.x : parent.canvas_x + 300,
      // Nodes are as tall as their recipe, so offset a twist generously to clear the parent.
      canvas_y: position ? position.y : parent.canvas_y + 220,
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
    return child;
  },
  attachBranch: async (childId, parentId) => {
    if (childId === parentId) return false;
    if (wouldCreateCycle(get().specs, childId, parentId)) return false;
    await get().editSpec(childId, { parent_spec_id: parentId });
    return true;
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

  // ── Costing settings ────────────────────────────────────────────
  vatRate: 0.20,
  sundriesPerServe: 0,
  wasteRate: 0.05,
  targetGpPct: null,
  activeFormulaId: DEFAULT_FORMULA_ID,
  setVatRate: (rate) => set({ vatRate: rate }),
  setSundriesPerServe: (amount) => set({ sundriesPerServe: amount }),
  setWasteRate: (rate) => set({ wasteRate: rate }),
  setTargetGpPct: (pct) => set({ targetGpPct: pct }),
  setActiveFormulaId: (id) => set({ activeFormulaId: id }),

  // ── Catalogue ─────────────────────────────────────────────────
  catalogueIngredients: [],
  catalogueLoading: false,
  loadCatalogueIngredients: async () => {
    if (get().catalogueIngredients.length > 0) return; // already loaded
    set({ catalogueLoading: true });
    try {
      set({ catalogueIngredients: await listCatalogueIngredients(), catalogueLoading: false });
    } catch {
      set({ catalogueLoading: false });
    }
  },
  searchCatalogueIngredients: async (q, type) => {
    return searchCatalogueIngredients(q, type);
  },
  importCatalogueIngredient: async (catalogueId, packCost, packSizeMl) => {
    const ing = await importCatalogueIngredient(catalogueId, packCost, packSizeMl);
    // find-or-create may return an existing row — upsert into the list, don't duplicate.
    set((s) => ({
      ingredients: [...s.ingredients.filter((i) => i.id !== ing.id), ing]
        .sort((a, b) => a.name.localeCompare(b.name)),
    }));
    return ing;
  },

  // ── Commons feed ──────────────────────────────────────────────
  publishedFeed: [],
  publishedFeedLoading: false,
  publishedFeedLoaded: false,
  loadPublishedFeed: async () => {
    set({ publishedFeedLoading: true });
    try {
      set({ publishedFeed: await listPublishedFeed(50, 0), publishedFeedLoading: false, publishedFeedLoaded: true });
    } catch {
      set({ publishedFeedLoading: false });
    }
  },
  searchPublishedFeed: async (q) => {
    set({ publishedFeedLoading: true });
    try {
      set({ publishedFeed: await searchPublished(q), publishedFeedLoading: false });
    } catch {
      set({ publishedFeedLoading: false });
    }
  },

  // ── Publish + fork ────────────────────────────────────────────
  publishSpec: async (specId) => {
    const { specs, specComponentsMap, vatRate } = get();
    const spec = specs.find((s) => s.id === specId);
    if (!spec) throw new Error('Spec not found');

    const components = specComponentsMap[specId] ?? [];
    const snapshot: ComponentSnapshot[] = components.map((c) => ({
      name: c.ingredients?.name ?? 'Unknown',
      amount_ml: c.amount_ml,
      original_amount: c.original_amount ?? c.amount_ml,
      original_unit: c.original_unit ?? 'ml',
      type: c.ingredients?.type ?? 'other',
      catalogue_id: null,
      abv: c.ingredients?.abv ?? 0,
      cost_per_ml_at_publish: c.ingredients?.cost_per_ml ?? null,
    }));

    await insertPublishedSpec({
      specId,
      name: spec.name,
      method: spec.method,
      glass: spec.glass,
      garnish: spec.garnish,
      buildText: spec.build_text,
      changeNote: spec.change_note,
      componentsSnapshot: snapshot,
      // Carry cross-user lineage forward: if this spec was forked from a published
      // one, the new published row must point back at it so get_spec_lineage() can
      // traverse the full ancestry. Originals stay null.
      forkedFromId: spec.forked_from_published_id ?? null,
      venueId: null,
    });

    // Mark spec as published in local state
    await get().editSpec(specId, { status: 'published' });
  },
  forkPublished: async (publishedId) => {
    const { newSpecId, componentsSnapshot } = await forkPublishedSpec(publishedId);

    // Re-fetch the new spec row.
    const updatedSpecs = await listSpecs().catch(() => get().specs);
    const newSpec = updatedSpecs.find((s) => s.id === newSpecId);
    if (!newSpec) throw new Error('Forked spec not found after insert');

    // Resolve each snapshot component to one of the user's own ingredients — unpriced
    // by default, since pricing is optional. catalogue_id gives an exact match;
    // otherwise fall back to a name match, else create a new unpriced ingredient.
    const resolveIngredientId = async (cs: ComponentSnapshot): Promise<string> => {
      if (cs.catalogue_id) return (await get().importCatalogueIngredient(cs.catalogue_id)).id;
      const existing = get().ingredients.find((i) => i.name.toLowerCase() === cs.name.toLowerCase());
      if (existing) return existing.id;
      const created = await insertIngredient({
        name: cs.name, type: cs.type ?? null, abv: cs.abv ?? 0, pack_size_ml: 700, pack_cost: null,
      });
      set((s) => ({ ingredients: [...s.ingredients, created].sort((a, b) => a.name.localeCompare(b.name)) }));
      return created.id;
    };

    // Insert real, editable components (replacing the old display-only placeholders).
    const realComponents: SpecComponent[] = [];
    let position = 0;
    for (const cs of componentsSnapshot) {
      const ingredientId = await resolveIngredientId(cs);
      realComponents.push(await insertSpecComponent({
        spec_id: newSpecId,
        ingredient_id: ingredientId,
        amount_ml: cs.amount_ml,
        original_amount: cs.original_amount,
        original_unit: cs.original_unit,
        position: position++,
      }));
    }

    set((s) => ({
      specs: [newSpec, ...s.specs],
      specComponentsMap: { ...s.specComponentsMap, [newSpecId]: realComponents },
    }));
    get().selectSpec(newSpecId);
    return newSpec;
  },
  lineageByPublishedId: {},
  lineageLoadingId: null,
  loadLineage: async (publishedId) => {
    if (get().lineageByPublishedId[publishedId]) return; // cached
    set({ lineageLoadingId: publishedId });
    try {
      const rows = await getSpecLineage(publishedId);
      set((s) => ({
        lineageByPublishedId: { ...s.lineageByPublishedId, [publishedId]: rows },
        lineageLoadingId: null,
      }));
    } catch {
      set({ lineageLoadingId: null });
    }
  },
  preloadPublished: async (publishedIds) => {
    // Lay forked specs out on a grid to the right of any existing specs.
    const baseX = get().specs.length ? Math.max(...get().specs.map((s) => s.canvas_x)) + 320 : 100;
    let i = 0;
    for (const id of publishedIds) {
      const spec = await get().forkPublished(id);
      await get().editSpec(spec.id, { canvas_x: baseX + (i % 4) * 300, canvas_y: 120 + Math.floor(i / 4) * 260 });
      i++;
    }
    get().selectSpec(null); // don't leave the last one's panel open after a batch add
  },

  // ── Stubs ─────────────────────────────────────────────────────
  preps: [],
}),
{
  name: 'proof-settings',
  partialize: (s) => ({
    dilutionOverrides: s.dilutionOverrides,
    vatRate: s.vatRate,
    sundriesPerServe: s.sundriesPerServe,
    wasteRate: s.wasteRate,
    targetGpPct: s.targetGpPct,
    activeFormulaId: s.activeFormulaId,
  }),
}
));

export type { Ingredient, IngredientInput, Spec, SpecInput, SpecComponent, SpecComponentInput, SpecCostRow };
export type { CatalogueIngredient, PublishedSpec, ComponentSnapshot, LineageRow };
export { DILUTION_DEFAULTS };
