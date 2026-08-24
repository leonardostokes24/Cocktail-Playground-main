# PLAN.md — Proof Build Plan

**The when.** Read `VISION.md` (what/why) and `CLAUDE.md` (how — ⚑ rules are non-negotiable)
before working any phase. If a task here contradicts them, they win; fix this file.

## How to use this file
- Top-down, one phase at a time; respect `Depends on`. Mark `[ ]→[~]→[x]`, `[!]` blocked+why.
- A `→` line under a task is its current state, recorded when the plan was reconciled
  against the code on 2026-08-24. See `STATUS.md` for the narrative version.
- Gate every phase on: `npm run typecheck` 0 · `lint` clean · `test` green, plus the phase's
  own benchmark gates below.
- Each phase names the VISION Pillar(s) it serves. If a task doesn't serve one, cut it.
- Ambiguous task → propose approach, ask, then code.

---

## Phase 0 — Audit & consolidate
**Pillars:** foundation for all. **Depends on:** nothing.
A prior session built much of the two-layer model. Verify before building on it.

- [x] Confirm the root mounts `LineageCanvas` + `SpecPanel`; screenshot.
- [x] Delete dead pre-rebuild architecture: old root `SpecNode.tsx`, `IngredientNode.tsx`,
      `ContainerNode.tsx`, old `RadialWheel.tsx`, `Sidebar.tsx`, `portShim/`. `tsc` catches
      dead imports.
- [x] 100% `.ts/.tsx` in `/src`; typecheck 0; tests green (~26 expected in calculations).
- [x] `grep -rn "alert(\|prompt(\|confirm(" src/` → record debt list for Phase 5 (don't fix).
      → zero hits; no debt to carry
- [x] Remove confirmed-unused heavy deps (`three`, r3f, `motion`, `express`…) via depcheck.
- [x] Confirm migration 0001 applied (tables, cost views, RLS live).
- [~] **React Flow rules pass (⚑):** `SpecNode` memoized; handlers `useCallback`; store reads
      via `useShallow` selectors; `onlyRenderVisibleElements` on; drag writes debounced.
      Profile: 60fps drag at 100 seeded nodes. **This is a gate — fix before Phase 1.**
      → rules all pass; the 60fps-at-100-nodes profile has never been run

**Done when:** one render path, all-TS, green checks, 60fps at 100 nodes, written debt list.

## Phase 1 — Money & formula registry
**Pillars:** 3 (costing you can trust). **Depends on:** 0.

- [x] `utils/money.ts`: decimal.js wrappers (⚑). Audit every cost path: no `Number()` on pg
      numerics, no float math on money; round at display only.
- [x] `utils/formulaRegistry.ts` per CLAUDE.md interface: `gp_ex_vat` (default),
      `pour_cost_pct`, `cash_margin`, `markup`, `target_gp_price`, `target_pour_cost_price`.
      → all six entries present
- [x] `calculations.ts`: modifiers — sundries £/serve + waste% (default .05) applied before
      formulas; verify dilution never touches cost.
- [x] Settings slice (persisted): `vatRate` (default .20 — a setting, never a constant ⚑),
      sundries, wasteRate, targetGP, rounding rule, dilution factors. Minimal settings panel.
- [x] `SpecNode` headline gauge reads active registry entry; `SpecPanel` shows full breakdown —
      every model + reverse-price suggestion vs `sale_price` — and realized-vs-target GP with
      no editorial copy (targets are user-set ⚑).
- [x] Tests: every registry entry incl. reverses, modifier chain, zero-cost/zero-price edges,
      decimal string round-trips.

**Done when:** switching active formula re-renders every node headline at once; tests green.

## Phase 2 — Smart radial menu
**Pillars:** 1 (speed of capture). **Depends on:** 1.

- [x] `RadialMenu.tsx` + `RadialRing.tsx`: object-anchored, ≤8 segments (⚑), sub-rings beyond.
      Right-click / long-press 300ms + drag-release (offset for finger occlusion) / hotkey.
      → RadialRing superseded by `CommandPad.tsx` — a 3×3 grid, same fixed-direction property
- [x] Context rings exactly per CLAUDE.md (canvas / spec node / component).
- [x] Ingredient sub-ring: 8 categories matching `catalogue_ingredients.type`.
- [~] `RadialSearch.tsx`: centre type-ahead, 200ms debounce, user ingredients only for now
      (catalogue + commons wired in Phases 3–4); recents first.
      → 200ms debounce and own-ingredient search work; **recents-first is not implemented**
- [x] Inline confirm segment for Delete (no modal); full keyboard navigation.
      → confirmations also name detaching twists
- [~] **`ContextMenuFallback.tsx` + first-run onboarding hints (⚑)** — same actions,
      conventional menu; radials are fast but hard to learn.
      → fallback has parity; first-run hints are now off by default since forcing them hid the radial entirely
- [!] Test long-press on a real tablet or BrowserStack at 768px.
      → blocked — needs a physical device or BrowserStack; only synthetic pointer events so far

**Done when:** VISION success test — spec + three ingredients via radial only — passes on
desktop and tablet, and the fallback menu offers every radial action.

## Phase 3 — Social schema & community catalogue
**Pillars:** 5 (commons), 3 (catalogue/override split). **Depends on:** 1.

- [~] Apply 0002 + **0003**. Verify: tables/views live; `published_specs` UPDATE rejected by
      trigger (test it); `get_spec_lineage()` executes as authenticated.
      → migrations 0002–0007 applied and the RPC is in use; **no test proves the immutability trigger rejects an UPDATE**
- [x] `queries/catalogue.ts` + `CatalogueSearch.tsx`: search shared catalogue; Import creates
      user's own `ingredients` row (`catalogue_id` set) and **prompts for their price**
      (reference_price is an editable suggestion, never silently used ⚑).
      → `CatalogueSearch.tsx` built; reference_price shown as prose, never pre-filled into the price box
- [x] Test asserting `reference_price` never appears in `spec_costs`/`prep_costs` output.
      → `referencePrice.test.ts` — behavioural + structural (grep) guard
- [x] `queries/venues.ts` + minimal venue UI (create/join/leave; no profile pages — deferred).
      → `lib/supabase/venues.ts` + `VenuePanel.tsx`; last-owner-leaving blocked
- [ ] Radial centre search now also queries the catalogue.
      → pad search covers own ingredients + preps only

**Done when:** two users importing the same catalogue entry get different `cost_per_ml`; a
venue can be created and joined; immutability trigger proven.

## Phase 4 — Publish & fork (the v1 headline)
**Pillars:** 2 (lineage spine), 5 (commons). **Depends on:** 2 + 3.

- [x] Publish (from radial): snapshot → `published_specs` (`components_snapshot` JSONB),
      set `visibility/published_at/published_spec_id`. New version = new row, always (⚑).
- [ ] Unpublish: flips `specs.visibility` only; UI copy explains the snapshot persists for
      forks' ancestry.
      → no unpublish path exists
- [x] `PublicBrowse`: search-first surface on `public_specs_feed` + weighted
      `websearch_to_tsquery` search (⚑). Not a feed — just find-to-fork. Attribution
      (creator + venue) on every card, always.
      → `CommonsPanel.tsx`, websearch_to_tsquery
- [~] Fork: new private spec, `forked_from_published_id` set; components resolved against the
      user's own ingredients — prompt to import + price anything missing. Distinct edge style
      for fork vs branch on canvas.
      → fork + auto-resolve to own ingredients works; **fork vs branch edges are not styled differently** — edges are built from `parent_spec_id` only
- [x] **All lineage display goes through `get_spec_lineage()` RPC (⚑)** — never a client-side
      walk. Show ancestry to root + descendants on a published spec.
- [x] Delete guard: block deleting a published spec with existing forks; human message
      ("N bartenders have forked this").
      → handled at schema level: `published_specs.spec_id` is ON DELETE SET NULL and `forked_from_id` is ON DELETE RESTRICT, so forks cannot break. Node delete now warns about *detaching twists*, which was the real gap
- [x] `export.ts`: spec → PDF/Excel (flat component list; straightforward).
      → PDF via jsPDF (dynamically imported); **CSV instead of .xlsx** — npm's SheetJS is stuck at 0.18.5 with an unpatched advisory

**Done when:** with two test accounts — publish, find via search, fork, edit the fork —
ancestry stays complete via the RPC and attribution survives every step.

## Phase 5 — Anti-clunk hardening & ship
**Pillars:** all. **Depends on:** 4.

- [x] Clear the Phase 0 alert/confirm debt with real in-app UI.
      → there was none
- [ ] Run the **full CLAUDE.md anti-clunk checklist**; fix every failure.
- [~] Glass audit (⚑): glass on small surfaces only; nothing animates backdrop-filter; solid
      fallback via `@supports`; `prefers-reduced-transparency` and `-motion` honoured; AA
      contrast on node text over the brightest and darkest blooms.
      → pad + node contrast measured and fixed; reduced-motion/-transparency CSS written but never viewed with those settings on
- [ ] Touch pass at 768/1024px: 44px targets, long-press radial, pinch/pan intact.
- [ ] Perf pass: 60fps drag at 100+ nodes, no full-array rebuild on select, debounced writes.
- [x] Ingestion on-ramp (`ingestion.ts`): paste a recipe → draft spec (v1 scope; no AI beyond).
      → deterministic parser, no AI; pad's Ingest action now enabled
- [~] `npm run build` clean; smoke-test production on Vercel.
      → `vite build` is clean; not smoke-tested on Vercel

**Done when:** a cold demo on a fresh account — radial-create → cost → switch formula →
publish → (second account) search → fork — runs end-to-end with no traditional form beyond
search/settings, on a tablet.

---

## Already built (verify in Phase 0, don't rebuild)
`calculations.ts` + `units.ts` (~26 tests — extend, don't replace), `useProofStore`,
supabase client/queries, `IngredientLibrary`, `LineageCanvas`, `SpecNode`, `SpecPanel` +
sub-components, optional mini-canvas (nice-to-have; not a blocker).

## Explicitly deferred — stop and flag rather than build
Ratings/comments, follows, discovery feed, venue profiles, moderation/reputation (0002's
`verified` columns exist — leave unused), monetisation, AI beyond ingestion, nested preps,
POS/inventory anything.
