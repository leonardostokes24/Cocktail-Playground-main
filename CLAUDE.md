# CLAUDE.md — Proof

**The how.** Read `VISION.md` first (what/why), `PLAN.md` for current tasks. This is the daily
coding reference. Research-validated rules are marked ⚑ — they exist because the official docs
or industry data say so, not preference. Do not relax them.

---
## Commit to Github
Commit to Github every major chnage 

## One-line orientation
Private React Flow lineage canvas → ex-VAT GP costing → publish immutable snapshots to a CC-BY
commons → cross-creator forks with permanent attribution. `published_specs`/`spec_versions` is
the public record; the canvas is the private workbench.

## Tech stack
React 18 + TypeScript · React Flow · Zustand · Tailwind · Supabase (Postgres 15, RLS) · Vercel
· decimal.js · jspdf/xlsx · Vitest. **100% TypeScript.** `any` needs a justifying comment.

## Commands
`npm run dev` · `build` · `lint` · `test` (must be green) · `typecheck` (tsc --noEmit, must be 0)

## Directory map
```
src/
  components/
    canvas/    LineageCanvas.tsx, SpecNode.tsx
    spec/      SpecPanel.tsx, SpecFields.tsx, ComponentRow.tsx, AddComponentForm.tsx
    radial/    RadialMenu.tsx, RadialRing.tsx, RadialSearch.tsx, ContextMenuFallback.tsx
    library/   IngredientLibrary.tsx, PrepLibrary.tsx, CatalogueSearch.tsx
    common/    Glass.tsx, GaugeBar.tsx, StatusBadge.tsx
  store/       useProofStore.ts + selectors/ (costSelectors.ts, canvasSelectors.ts)
  utils/       calculations.ts, formulaRegistry.ts, units.ts, money.ts, export.ts, ingestion.ts
  lib/supabase/  client.ts + queries/ (ingredients, preps, specs, catalogue, published, venues)
  types/       spec.ts, ingredient.ts, prep.ts, component.ts, venue.ts, published.ts
supabase/migrations/  0001…, 0002…, 0003_research_hardening.sql
```

---

## React Flow — performance rules ⚑
React Flow uses Zustand internally; Zustand is the mandated state layer. These rules come from
the official performance guide and independent audits — violating them is how canvases die:

- **Memoize `SpecNode` with `React.memo`**; define it outside any parent component. Memoize
  every handler passed to nodes with `useCallback`.
- **Never subscribe a component to the whole nodes array** when it needs a slice. Use Zustand
  selectors with **`useShallow`**. Store derived state (e.g. `selectedNodeIds`) separately.
- **Enable `onlyRenderVisibleElements`** on the canvas (virtualization) — required, not optional.
- React Flow is a **renderer, not a state owner**. Nodes/edges come from `canvasSelectors.ts`.
  Never `setNodes` with a freshly-mapped array on every render (re-mounts canvas, kills drag).
- Debounce `onNodeDragStop` position writes (300ms).
- Keep node CSS light: the glass treatment lives on the card, but avoid animating
  `backdrop-filter` or stacking heavy shadows per node.
- Defer heavy per-node computation (`useDeferredValue` if cost recalc ever janks drag).
- **Benchmark gate: 60fps at 100+ nodes.** If it drops, virtualize/simplify before features.

## Two layers — do not collapse
- **Outer:** one node type, `SpecNode`. Edges: same-user branch (`parent_spec_id`) vs
  cross-user fork (`forked_from_published_id`) — style them differently (solid vs dashed).
  App-side cycle guard on branch/move.
- **Inner:** `SpecPanel`, a side drawer/form. UI fully decoupled from data (store actions
  only, zero direct Supabase calls) so a mini-canvas can swap in later.

---

## Money — precision rules ⚑
JS floats are unsafe for money (`0.1+0.2 ≠ 0.3`). Non-negotiable:
- All money math in **decimal.js** via `utils/money.ts` helpers. Every operand a `Decimal`.
- Postgres columns are `numeric`. **The pg driver returns `numeric` as strings** — never
  `Number()` / `parseFloat()` them; feed strings straight into `new Decimal()`.
- Round only at display time (`toDecimalPlaces(2)`); multiply before dividing.

## Cost engine & formula registry
```
cost_per_ml(ingredient) = pack_cost / pack_size_ml     ← user's OWN price, always
catalogue reference_price = cold-start seed ONLY        ← never in any formula ⚑
prep cost_per_ml = Σ(components) / yield_ml
pour_cost = Σ(amount_ml × cost_per_ml)
modifiedCost = (pour_cost + sundries£) × (1 + wasteRate)   // waste default .05, range .05–.20
net = salePrice / (1 + vatRate)                             // vatRate SETTING, default 0.20 ⚑
GP% = (net − modifiedCost) / net × 100                      // UK standard: EX-VAT, always
```
- Formula registry (`formulaRegistry.ts`): `gp_ex_vat` (default) · `pour_cost_pct` ·
  `cash_margin` · `markup` · `target_gp_price` (reverse) · `target_pour_cost_price` (reverse).
  Interface: `{ id, label, unit, compute(cost, saleGross, vatRate), reverse? }`. UI reads the
  registry — a formula never appears hard-coded in a component.
- **GP targets are user-set, never asserted** ⚑ — pricing guides say 70–80%, measured pub wet
  GP is 49–58%. Show realized vs user target; no editorializing.
- Dilution: `{shaken:.25, stirred:.22, built:.10, thrown:.18}` user-editable defaults; affects
  volume/ABV/batch water only, **never cost**. Batch view exposes the water line.
- Units: everything normalises to ml on write (`units.ts`); `original_unit` advisory only.

---

## Supabase & data rules ⚑
- **RLS deny-by-default on every public-schema table.** Authenticated session for every query;
  no service-role key client-side. Query helpers in `lib/supabase/queries/` — none in components.
- **UPDATE policies silently no-op without a matching SELECT policy** — always pair them.
- Use `SECURITY DEFINER` helper functions for cross-user or recursive permission checks
  (avoids recursive-policy 500s and per-row subquery cost). `is_venue_owner()` exists; follow
  the pattern.
- **Lineage = adjacency list + recursive CTE.** `parent_id`-style columns traversed with
  `WITH RECURSIVE`, using PG15 `CYCLE ... SET ... USING` for loop safety. No ltree, no
  materialized paths.
- **Cross-user lineage MUST be read via the `get_spec_lineage()` SECURITY DEFINER RPC**
  (migration 0003). Plain RLS reads truncate lineage to the caller's own rows — public
  ancestry silently breaks. Never traverse lineage client-side over the specs table.
- **`published_specs` is append-only, enforced by trigger** (0003), not just absent policies.
  Never add an UPDATE path, never patch a published row. New version = new row.
- Search: generated `tsvector` + GIN, query with `websearch_to_tsquery`
  (`.textSearch(col, q, { type: 'websearch' })`); `setweight` name='A' over body='B'.
  Generated columns can't see other tables — cross-table search vectors use triggers.
- Cost views keep `security_invoker = true`.

## Data model quick reference
0001: `ingredients` (user cost lib, generated `cost_per_ml`) · `preps` (+yield) ·
`prep_components` (ingredients only — no nesting) · `specs` (one node = one version;
`parent_spec_id` = private branch) · `spec_components` (ingredient XOR prep).
0002: `catalogue_ingredients` (shared, world-readable, `reference_price` advisory) · `venues` +
`user_venues` (M:M, roles) · `published_specs` (immutable snapshots; `forked_from_id` =
cross-creator lineage; `components_snapshot` JSONB) · specs gain `visibility`, `venue_id`,
`published_spec_id`, `forked_from_published_id`.
0003: immutability trigger, lineage RPC, weighted FTS.

---

## Radial menu rules ⚑
Radial menus are measurably faster with practice but **harder to learn** — design for both:
- **Max 6–8 segments per ring** (accuracy ceiling). More = sub-rings.
- **Anchor on the touched object.** Long-press 300ms → drag-to-segment → release (touch);
  right-click (desktop); hotkey (keyboard). Account for the finger obscuring the menu
  (offset/partial-arc on touch).
- **Ship `ContextMenuFallback.tsx`** — a conventional context menu with identical actions, plus
  first-run onboarding hints. New users must never be stranded.
- Fully keyboard navigable; inline confirm segment for destructive actions; never a modal.
- Context rings: empty canvas → New spec · Search commons · Quick-ingest · New prep.
  Spec node → Branch · Add component (8-category ingredient sub-ring matching
  `catalogue_ingredients.type`) · Open · Duplicate · Publish · Delete.
  Component → Edit amount · Swap · Convert to prep · Remove.
- Centre type-ahead: debounced 200ms, searches own ingredients + catalogue + commons; recents
  first (`ui.recentIngredients`).

---

## Visual identity — paper, ink, one crimson ⚑
Source: Claude Design project "Proof New UI", artboard **8a**. This replaced the
chroma-glass system wholesale — if you find `backdrop-filter`, a gradient fill or a
border-radius on a surface, it is a leftover, not the style.

- **Flat card stock, never glass.** No blur anywhere. Depth is a hard offset shadow
  (`--lift`, `3px 3px 0`) and nothing else.
- **Zero radius on every surface.** Nodes, panels, bars, buttons.
- **Structure comes from hairline rules and a mono index**, not from depth or colour.
  A node's header strip carries its lineage number and its role (`01 root`,
  `02 selected`, `03 fork`) — that numbering encodes real position, so it stays.
- **One live colour.** Crimson `--accent` marks forks, publishing and destruction.
  Nothing else is coloured. Selection is stated by inverting a header to ink.
- **Type does the work.** Newsreader carries drink names and every label; JetBrains
  Mono carries every number, index and hint. No third face.
- **Text on paper must still pass WCAG AA** — check against `--card`, not `--paper`.

```css
:root {
  --paper:#eae7de; --card:#f2f0ea; --ink:#1a1a17;
  --ink-72:rgba(26,26,23,.72); --ink-45:rgba(26,26,23,.45);
  --rule:rgba(26,26,23,.16); --rule-strong:rgba(26,26,23,.30); --rule-faint:rgba(26,26,23,.12);
  --accent:#c22a06; --on-ink:#f2f0ea;
  --lift:3px 3px 0 rgba(26,26,23,.18); --lift-lg:6px 8px 0 rgba(26,26,23,.16);
  --font-display:"Newsreader",Georgia,serif; --font-mono:"JetBrains Mono",ui-monospace,monospace;
}
```

**Lineage runs top to bottom.** Handles are Top (target) / Bottom (source); edges are
orthogonal step routing with `borderRadius: 0`, solid ink for a same-user branch and
dashed crimson for a cross-user fork. Placement is `utils/layout.ts` — never inline.

**The menu is tethered, not summoned.** One panel, always on screen, acting on whatever
is selected; it never covers its own target and flips side rather than overlapping.
Clicking a node selects it — it does **not** open the spec panel. "Open recipe" does.

## Touch & tablet
Equal first-class target. 44×44px minimum tap targets; test at 768/1024px; React Flow's
built-in pinch/pan untouched; no hover-dependent UI.

---

## Commons & licensing rules
- Publishing snapshots the full spec (`components_snapshot` JSONB) — self-contained, resolvable
  without joins, immutable.
- **Attribution is data** (creator_id + venue_id travel with every published row and render on
  every card). CC-BY covers user prose/photos; the spec itself is uncopyrightable — never
  imply Proof grants recipe *ownership*, only credit. No IP-enforcement features, ever.
- Unpublish hides from discovery; the snapshot row persists (forks depend on it). Deleting a
  published spec is blocked app-side if forks reference it, with a human message.

## Hard DO NOT list
| DO NOT | Why |
|---|---|
| Update/patch `published_specs` rows | Trigger will reject; lineage immutability ⚑ |
| Traverse cross-user lineage without the RPC | RLS silently truncates ancestry ⚑ |
| Use JS `number` / `Number()` for money | Float errors; pg returns numeric as string ⚑ |
| Put `reference_price` in a cost formula | User's own pack_cost is always the source |
| Hard-code VAT, GP targets, or any formula in a component | Settings + registry only ⚑ |
| Subscribe components to the whole nodes array | Re-render storm ⚑ |
| Reintroduce glass, gradients or border-radius on a surface | Superseded by the paper system ⚑ |
| `alert()` / `prompt()` / `confirm()` | Anti-clunk |
| Add node types, nest preps, build deferred social UI, add AI beyond ingestion | Scope |

## Anti-clunk checklist (run before any phase is "done")
- [ ] Spec + 3 ingredients via radial only · [ ] fallback context menu works
- [ ] Cost updates per keystroke; formula switch re-renders all nodes at once
- [ ] 60fps drag at 100 nodes (React profiler) · [ ] no full-array rebuild on select
- [ ] `grep -rn "alert(\|prompt(\|confirm(" src/` → zero hits
- [ ] Long-press radial verified on a real tablet/BrowserStack at 768px
- [ ] Publish → visible in feed → forkable; fork ancestry traceable to root via RPC
- [ ] AA contrast on paper (check against `--card`); reduced-motion honoured
- [ ] `typecheck` 0 · `test` green
