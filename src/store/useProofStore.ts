import { create } from 'zustand';
import type { RecipeDraft } from '../utils/ingestion';
import { toMl } from '../utils/units';
import { placeChild, placeRoot, tidyTree } from '../utils/layout';
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
  listPreps, insertPrep, updatePrep, deletePrep,
  listPrepComponents, insertPrepComponent, updatePrepComponent, deletePrepComponent,
  listPrepCosts,
  type Prep, type PrepInput, type PrepComponent, type PrepComponentInput, type PrepCostRow,
} from '../lib/supabase/preps';
import {
  listPublishedFeed, searchPublished, insertPublishedSpec, forkPublishedSpec, listForkSources,
  getSpecLineage,
  type PublishedSpec, type ComponentSnapshot, type LineageRow,
  type ForkSource,
} from '../lib/supabase/published';

// A prep component's join only carries the prep's name — cost lives in the
// prep_costs view, which PostgREST can't embed through a FK. Fill it in here.
// A prep with unpriced ingredients reports cost_per_ml as null so the cost
// engine marks the line unpriced rather than misleadingly cheap (⚑ 0005/0007).
function enrichPrep(c: SpecComponent, costs: Record<string, PrepCostRow>): SpecComponent {
  if (!c.prep_id) return c;
  const cost = costs[c.prep_id];
  return {
    ...c,
    preps: {
      name: c.preps?.name ?? 'Prep',
      cost_per_ml: !cost || cost.unpriced_count > 0 ? null : Number(cost.cost_per_ml),
      abv: cost ? Number(cost.abv) : 0,
    },
  };
}

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
  /** Bumped whenever the store re-positions nodes, so the canvas knows to take
   *  stored coordinates instead of the live ones it normally preserves. */
  layoutNonce: number;
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
  /** ⚑ Radial rule: recents first. Ingredient ids, most recent first, capped. */
  recentIngredientIds: string[];
  noteRecentIngredient: (ingredientId: string) => void;
  /** Paste-a-recipe on-ramp: draft -> real spec + components. */
  ingestRecipe: (draft: RecipeDraft, at?: { x: number; y: number }) => Promise<Spec>;
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
  /**
   * Hide a spec from discovery. The published snapshot is NOT deleted — forks
   * depend on it for their ancestry, and published_specs is append-only.
   */
  unpublishSpec: (specId: string) => Promise<void>;
  forkPublished: (publishedId: string) => Promise<Spec>;

  // ── Lineage (always via the get_spec_lineage RPC ⚑) ───────────
  lineageByPublishedId: Record<string, LineageRow[]>;
  lineageLoadingId: string | null;
  loadLineage: (publishedId: string) => Promise<void>;
  /** published_id -> the snapshot a spec was forked from, for fork edges + badges. */
  forkSources: Record<string, ForkSource>;
  loadForkSources: () => Promise<void>;
  // Fork several published specs onto the canvas at once, laid out on a grid.
  preloadPublished: (publishedIds: string[]) => Promise<void>;

  // ── Preps (batched sub-recipes) ───────────────────────────────
  preps: Prep[];
  prepsLoading: boolean;
  prepComponentsMap: Record<string, PrepComponent[]>;
  prepCosts: Record<string, PrepCostRow>;
  loadPreps: () => Promise<void>;
  loadPrepCosts: () => Promise<void>;
  addPrep: (input: PrepInput) => Promise<Prep>;
  editPrep: (id: string, input: Partial<PrepInput>) => Promise<void>;
  removePrep: (id: string) => Promise<void>;
  loadPrepComponents: (prepId: string) => Promise<void>;
  addPrepComponent: (input: PrepComponentInput) => Promise<void>;
  editPrepComponent: (
    id: string,
    input: Partial<Pick<PrepComponentInput, 'amount_ml' | 'original_amount' | 'original_unit' | 'position'>>
  ) => Promise<void>;
  removePrepComponent: (prepId: string, id: string) => Promise<void>;

  // Drag-reorder writes many positions at once (editComponent patches one).
  reorderComponents: (specId: string, orderedIds: string[]) => Promise<void>;
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
  layoutNonce: 0,
  tidySpecs: async (ids) => {
    // No selection means the whole canvas. Requiring a marquee-select before you
    // may straighten the tree is friction for nothing.
    const target = ids.length ? ids : get().specs.map((s) => s.id);
    const placed = tidyTree(get().specs, target);
    if (!placed.size) return;

    for (const [id, at] of placed) {
      await get().editSpec(id, { canvas_x: at.x, canvas_y: at.y });
    }
    set((st) => ({ layoutNonce: st.layoutNonce + 1 }));
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

    const slot = position ? { x: position.x, y: position.y } : placeChild(get().specs, parent);
    const child = await insertSpec({
      name: `${parent.name} (twist)`,
      parent_spec_id: parentId,
      change_note: '',
      method: parent.method,
      glass: parent.glass,
      garnish: parent.garnish,
      build_text: parent.build_text,
      sale_price: parent.sale_price,
      // Drag-to-empty supplies its own point; otherwise place below the parent
      // with siblings fanned sideways (see utils/layout).
      canvas_x: position ? position.x : slot.x,
      canvas_y: position ? position.y : slot.y,
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
      const comps = await listSpecComponents(specId);
      set((s) => {
        const enriched = comps.map((c) => enrichPrep(c, s.prepCosts));
        return {
          specComponents: enriched,
          // Keep the map in step — the builder reads specComponentsMap[specId],
          // so filling only the flat list left it showing stale data.
          specComponentsMap: { ...s.specComponentsMap, [specId]: enriched },
          componentsLoading: false,
        };
      });
    } catch {
      set({ componentsLoading: false });
    }
  },
  recentIngredientIds: [],
  noteRecentIngredient: (ingredientId) => {
    set((s) => ({
      recentIngredientIds: [ingredientId, ...s.recentIngredientIds.filter((i) => i !== ingredientId)].slice(0, 12),
    }));
  },
  addComponent: async (input) => {
    if (input.ingredient_id) get().noteRecentIngredient(input.ingredient_id);
    const comp = await insertSpecComponent(input);
    set((s) => ({
      specComponents: [...s.specComponents, comp],
      specComponentsMap: {
        ...s.specComponentsMap,
        [comp.spec_id]: [...(s.specComponentsMap[comp.spec_id] ?? []), comp],
      },
    }));
  },

  ingestRecipe: async (draft, at) => {
    const spec = await get().createSpec({
      name: draft.name?.trim() || 'Pasted recipe',
      method: draft.method,
      glass: draft.glass,
      garnish: draft.garnish,
      canvas_x: at?.x ?? placeRoot(get().specs).x,
      canvas_y: at?.y ?? placeRoot(get().specs).y,
    });

    // Match names against the user's own library first. Anything unknown is
    // created unpriced — pricing is optional, and inventing a cost here would
    // put a number the user never entered into their GP.
    for (const [i, c] of draft.components.entries()) {
      const existing = get().ingredients.find(
        (ing) => ing.name.toLowerCase() === c.name.toLowerCase(),
      );
      let ingredientId = existing?.id;
      if (!ingredientId) {
        await get().addIngredient({ name: c.name, type: null, abv: 0, pack_size_ml: 700, pack_cost: null });
        ingredientId = get().ingredients.find(
          (ing) => ing.name.toLowerCase() === c.name.toLowerCase(),
        )?.id;
      }
      if (!ingredientId) continue;

      await get().addComponent({
        spec_id: spec.id,
        ingredient_id: ingredientId,
        prep_id: null,
        amount_ml: toMl(c.amount, c.unit),
        original_amount: c.amount,
        original_unit: c.unit,
        position: i,
      });
    }

    await get().loadAllSpecComponents();
    return spec;
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
      const all = await listAllSpecComponents();
      set((s) => ({ specComponentsMap: groupBySpecId(all.map((c) => enrichPrep(c, s.prepCosts))) }));
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
  unpublishSpec: async (specId) => {
    // Only specs.visibility/status move. published_specs is append-only and the
    // snapshot must survive: every fork's ancestry resolves through it.
    await get().editSpec(specId, { status: 'draft', visibility: 'private' });
    await get().loadPublishedFeed();
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
    // The new spec introduces a fork source the canvas hasn't resolved yet —
    // without this the node shows the generic fallback and its dashed edge
    // never appears until the next full reload.
    await get().loadForkSources();
    return newSpec;
  },
  forkSources: {},
  loadForkSources: async () => {
    const ids = [...new Set(
      get().specs.map((s) => s.forked_from_published_id).filter((v): v is string => !!v),
    )];
    if (!ids.length) { set({ forkSources: {} }); return; }
    const rows = await listForkSources(ids);
    set({ forkSources: Object.fromEntries(rows.map((r) => [r.id, r])) });
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

  // ── Preps ─────────────────────────────────────────────────────
  preps: [],
  prepsLoading: false,
  prepComponentsMap: {},
  prepCosts: {},

  loadPreps: async () => {
    set({ prepsLoading: true });
    try {
      set({ preps: await listPreps(), prepsLoading: false });
      await get().loadPrepCosts();
    } catch {
      set({ prepsLoading: false });
    }
  },
  loadPrepCosts: async () => {
    try {
      const rows = await listPrepCosts();
      const byId: Record<string, PrepCostRow> = {};
      for (const r of rows) byId[r.prep_id] = r;
      set({ prepCosts: byId });
      // Costs feed the prep half of every spec component — refresh the joins.
      set((s) => ({
        specComponentsMap: Object.fromEntries(
          Object.entries(s.specComponentsMap).map(([id, comps]) => [id, comps.map((c) => enrichPrep(c, byId))])
        ),
        specComponents: s.specComponents.map((c) => enrichPrep(c, byId)),
      }));
    } catch {
      // non-fatal — prep-based lines just read as unpriced
    }
  },
  addPrep: async (input) => {
    const prep = await insertPrep(input);
    set((s) => ({ preps: [...s.preps, prep].sort((a, b) => a.name.localeCompare(b.name)) }));
    await get().loadPrepCosts();
    return prep;
  },
  editPrep: async (id, input) => {
    const updated = await updatePrep(id, input);
    set((s) => ({ preps: s.preps.map((p) => (p.id === id ? updated : p)) }));
    await get().loadPrepCosts(); // yield_ml changes the whole rollup
  },
  removePrep: async (id) => {
    await deletePrep(id);
    set((s) => {
      const { [id]: _gone, ...prepComponentsMap } = s.prepComponentsMap;
      return { preps: s.preps.filter((p) => p.id !== id), prepComponentsMap };
    });
  },
  loadPrepComponents: async (prepId) => {
    try {
      const comps = await listPrepComponents(prepId);
      set((s) => ({ prepComponentsMap: { ...s.prepComponentsMap, [prepId]: comps } }));
    } catch {
      // non-fatal
    }
  },
  addPrepComponent: async (input) => {
    const comp = await insertPrepComponent(input);
    set((s) => ({
      prepComponentsMap: {
        ...s.prepComponentsMap,
        [input.prep_id]: [...(s.prepComponentsMap[input.prep_id] ?? []), comp],
      },
    }));
    await get().loadPrepCosts();
  },
  editPrepComponent: async (id, input) => {
    const updated = await updatePrepComponent(id, input);
    set((s) => ({
      prepComponentsMap: Object.fromEntries(
        Object.entries(s.prepComponentsMap).map(([pid, comps]) => [
          pid, comps.map((c) => (c.id === id ? updated : c)),
        ])
      ),
    }));
    await get().loadPrepCosts();
  },
  removePrepComponent: async (prepId, id) => {
    await deletePrepComponent(id);
    set((s) => ({
      prepComponentsMap: {
        ...s.prepComponentsMap,
        [prepId]: (s.prepComponentsMap[prepId] ?? []).filter((c) => c.id !== id),
      },
    }));
    await get().loadPrepCosts();
  },

  reorderComponents: async (specId, orderedIds) => {
    // Optimistic: reflect the new order immediately so dragging feels instant,
    // then persist a dense 0..n-1 sequence.
    set((s) => {
      const byId = new Map((s.specComponentsMap[specId] ?? []).map((c) => [c.id, c]));
      const reordered = orderedIds
        .map((id, i) => { const c = byId.get(id); return c ? { ...c, position: i } : null; })
        .filter(Boolean) as SpecComponent[];
      if (reordered.length !== orderedIds.length) return {};
      return {
        specComponentsMap: { ...s.specComponentsMap, [specId]: reordered },
        specComponents: s.selectedSpecId === specId ? reordered : s.specComponents,
      };
    });
    for (let i = 0; i < orderedIds.length; i++) {
      await updateSpecComponent(orderedIds[i], { position: i });
    }
  },
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
export type { Prep, PrepInput, PrepComponent, PrepComponentInput, PrepCostRow };
export { DILUTION_DEFAULTS };
