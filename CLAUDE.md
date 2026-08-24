# CLAUDE.md — Proof

**The how.** Read `VISION.md` first (what and why), `PLAN.md` for what's next. This is the
daily coding reference. Rules marked ⚑ are research- or schema-backed and must not be relaxed;
everything else is convention. If a ⚑ rule blocks a task, say so — don't route around it.

Rewritten 2026-08-24. The previous version described a radial menu and a glass identity that
no longer exist.

---

## Commit
Commit every meaningful change. Never commit to `master` directly; branch, then PR.

## One-line orientation
Private React Flow lineage canvas → ex-VAT GP costing → publish immutable snapshots to a
CC-BY commons → cross-creator forks with permanent attribution. `published_specs` /
`spec_versions` is the public record; the canvas is the private workbench.

## Tech stack
React 19 + TypeScript · React Flow (`@xyflow/react`) · Zustand · Vite 6 · Supabase
(Postgres 15, RLS) · Vercel · decimal.js · jspdf · Vitest. **100% TypeScript**; `any` needs a
justifying comment.

## Commands
`npm run dev` (port 3000) · `build` · `lint` (= `tsc --noEmit`, must be 0) · `test`
(must be green). There is no ESLint — `lint` and typecheck are the same command.

## Directory map
```
src/
  components/
    canvas/    LineageCanvas · SpecNode · SelectionMenu · GroupLayer · CommonsPanel
    spec/      SpecPanel · SpecFields · ComponentRow · RecipeBuilder · SettingsPanel
    library/   IngredientLibrary · PrepLibrary · CatalogueSearch · IngestPanel · VenuePanel
    common/    Glass · clampLines · typeDot
  store/       useProofStore.ts
  utils/       calculations · formulaRegistry · money · units · layout · groups ·
               twistNumbers · childCounts · export · ingestion
  lib/supabase/  client · queries · preps · catalogue · published · venues
supabase/migrations/  0001 … 0007   ·   supabase/tests/immutability.sql
```

---

## Money — precision rules ⚑
JS floats are unsafe for money (`0.1 + 0.2 ≠ 0.3`).
- All money math in **decimal.js** via `utils/money.ts`. Every operand a `Decimal`.
- Postgres `numeric` **arrives as a string** from the pg driver. Never `Number()` or
  `parseFloat()` it — feed the string straight into `new Decimal()`.
- Round at display only (`toDecimalPlaces(2)`); multiply before dividing.
- **Unpriced is not zero.** A component with no price exports blank and costs nothing; zero
  would read as free.

## Cost engine & formula registry
```
cost_per_ml(ingredient) = pack_cost / pack_size_ml        ← the user's OWN price, always
catalogue reference_price = a suggestion, shown as prose  ← never in any formula ⚑
prep cost_per_ml = Σ(components) / yield_ml
pour_cost   = Σ(amount_ml × cost_per_ml)
modifiedCost = (pour_cost + sundries£) × (1 + wasteRate)   // waste default .05
net = salePrice / (1 + vatRate)                            // vatRate is a SETTING ⚑
GP% = (net − modifiedCost) / net × 100                     // UK standard: ex-VAT, always
```
- The registry (`formulaRegistry.ts`) owns every model: `gp_ex_vat` (default) ·
  `pour_cost_pct` · `cash_margin` · `markup` · `target_gp_price` · `target_pour_cost_price`.
  **A formula never appears hard-coded in a component** ⚑ — the UI reads the registry.
- **GP targets are user-set, never asserted** ⚑. Show realised vs target; no editorialising.
- Dilution `{shaken .25, stirred .22, built .10, thrown .18}` affects volume, ABV and batch
  water — **never cost**.
- Units normalise to ml on write (`units.ts`); `original_unit` is advisory, kept for
  round-tripping what the user typed.
- `referencePrice.test.ts` enforces the ⚑ above structurally: `reference_price` may not appear
  outside the catalogue query module and its own UI. Don't widen the allowlist — reword.

---

## Supabase & data rules ⚑
- **RLS deny-by-default on every public-schema table.** Authenticated session for every query.
  No service-role key client-side. Query helpers live in `lib/supabase/`, never in components.
- **UPDATE policies silently no-op without a matching SELECT policy** — always pair them.
- Use `SECURITY DEFINER` helpers for cross-user or recursive permission checks
  (`is_venue_owner()` is the pattern) — avoids recursive-policy 500s.
- **Lineage = adjacency list + recursive CTE.** `parent_id`-style columns, `WITH RECURSIVE`,
  PG15 `CYCLE … SET … USING` for loop safety. No ltree, no materialised paths.
- **Cross-user lineage MUST go through `get_spec_lineage()`** ⚑ (0003). Plain RLS reads
  truncate ancestry to the caller's own rows and public lineage silently breaks.
- **`published_specs` is append-only, enforced by trigger** ⚑ (0003). New version = new row.
  The single permitted mutation is `spec_id` → NULL when a creator deletes their spec (0006),
  so the snapshot survives and forks keep their ancestry. `supabase/tests/immutability.sql`
  proves both halves and rolls back; run it with `psql "$DATABASE_URL" -f`.
- Search: generated `tsvector` + GIN, queried with `websearch_to_tsquery`
  (`.textSearch(col, q, { type: 'websearch' })`).
- Cost views keep `security_invoker = true`.

### Delete semantics — the thing that bites
`specs.parent_spec_id` is **ON DELETE SET NULL**. Deleting a spec does **not** delete its
twists — it detaches them and each becomes a root. Every delete path must say so before it
acts (`childCounts.ts` / `detachedBy`). Deleting a whole family strands nothing, because every
child goes with its parent.

## Data model quick reference
0001: `ingredients` (generated `cost_per_ml`) · `preps` (+ `yield_ml`) · `prep_components`
(**ingredients only — nesting is scheduled, not built**) · `specs` (one node = one version;
`parent_spec_id` = private branch) · `spec_components` (ingredient XOR prep).
0002: `catalogue_ingredients` · `venues` + `user_venues` · `published_specs` (immutable
snapshots; `forked_from_id` = cross-creator lineage; `components_snapshot` JSONB); specs gain
`visibility`, `venue_id`, `published_spec_id`, `forked_from_published_id`.
0003–0007: immutability trigger, lineage RPC, weighted FTS, feed view security, optional
pricing, spec back-ref clear, unpriced prep costs.

---

## React Flow — performance rules ⚑
React Flow uses Zustand internally; Zustand is the state layer. These come from the official
performance guide — violating them is how canvases die.

- **Memoise `SpecNode` with `React.memo`**, defined outside any parent. Every handler passed
  to a node goes through `useCallback`.
- **Never subscribe a component to the whole nodes array** when it needs a slice. Prefer a
  selector returning a **primitive** — `Object.is` then stops spurious re-renders. Derived
  maps (`twistNumbers`, `childCounts`, `groupsOf`) are memoised on the specs array itself in a
  `WeakMap`, so 100 nodes share one computation per change.
- **`onlyRenderVisibleElements` stays on.** Consequence: a node placed outside the viewport
  does not render until you fit — an edge to nowhere is virtualisation, not a bug.
- React Flow is a **renderer, not a state owner**. Never `setNodes` with a freshly mapped array
  every render — it re-mounts the canvas and kills drag.
- Debounce `onNodeDragStop` position writes (300ms).
- **Never animate `transform` on `.react-flow__node`** — React Flow positions nodes with an
  inline transform and a CSS animation clobbers it, killing drag. Entrance is opacity-only.
- **Benchmark gate: 60fps at 100+ nodes.** Never measured. Measure before adding canvas
  features, not after.

## Two layers — do not collapse
- **Outer:** one node type, `SpecNode`. Edges: same-user branch (`parent_spec_id`) vs
  cross-user fork (`forked_from_published_id`) — solid ink vs dashed crimson. Cycle guard on
  branch and move.
- **Inner:** `SpecPanel`, a side drawer. UI fully decoupled from data — store actions only,
  zero direct Supabase calls.
- **No new node types** ⚑. Anything that looks like a node but isn't a spec is a derived
  overlay: `GroupLayer` is the pattern — inside React Flow's stacking context, deriving from
  lineage, owning no data.

---

## The capture menu ⚑
One menu. Summoned, not permanent.

- **Right-click or `⌘K`** opens it at the pointer; escape, a click outside, or a completed
  action closes it. Long-press is the touch route.
- It **names its target** and never covers it — it sits beside the node and flips side rather
  than overlapping.
- The field **acts or searches**: typing filters the actions, keep typing and it searches
  ingredients — your library first with recents on top, then catalogue entries, imported
  **unpriced**. Actions win ties, so `del` deletes rather than finding a Delicata.
- **Inline confirm for anything destructive**, naming the consequence. Never a modal.
- **`alert()` / `prompt()` / `confirm()` are banned** ⚑.
- A cell that can't work is rendered inert and marked, or removed. Never drawn as live.

## Visual identity — paper, ink, one crimson ⚑
Source: Claude Design "Proof New UI", artboard 8a. Settled in `VISION.md`.

- **Flat card stock, never glass.** No blur anywhere. Depth is a hard offset shadow.
- **Zero radius on every surface.** Structure comes from hairline rules and a mono index.
- **One live colour.** Crimson marks forks, publishing and destruction. Selection inverts a
  header to ink. Nothing else is coloured.
- **Newsreader** carries names and labels; **JetBrains Mono** carries every number, index and
  hint. No third face.
- **Text must pass WCAG AA** against `--card`, not `--paper`. Measure it; don't assume.

```css
:root{
  --paper:#eae7de; --card:#f2f0ea; --ink:#1a1a17;
  --ink-72:rgba(26,26,23,.72); --ink-45:rgba(26,26,23,.45);
  --rule:rgba(26,26,23,.16); --rule-strong:rgba(26,26,23,.30); --rule-faint:rgba(26,26,23,.12);
  --accent:#c22a06; --on-ink:#f2f0ea;
  --lift:3px 3px 0 rgba(26,26,23,.18); --lift-lg:6px 8px 0 rgba(26,26,23,.16);
  --font-display:"Newsreader",Georgia,serif; --font-mono:"JetBrains Mono",ui-monospace,monospace;
}
```

## Touch & tablet
Equal first-class target. **44×44px minimum**, tested at 768 and 1024. React Flow's pinch and
pan stay untouched. No hover-dependent UI — anything revealed on hover must be permanently
visible under `@media (hover: none)`, and inert (`pointer-events: none`) while hidden, or an
invisible target eats clicks.

## Commons & licensing
- Publishing snapshots the whole spec (`components_snapshot` JSONB) — self-contained,
  resolvable without joins, immutable.
- **Attribution is data**: `creator_id` and `venue_id` travel with every published row and
  render on every card ⚑.
- CC-BY covers prose and photos. **The spec itself is uncopyrightable** — never imply Proof
  grants recipe ownership, only credit. No IP-enforcement features, ever.
- Unpublish hides from discovery; the snapshot persists because forks depend on it.

---

## Hard DO NOT
| DO NOT | Why |
|---|---|
| Update or patch a `published_specs` row | Trigger rejects it; lineage immutability ⚑ |
| Traverse cross-user lineage without the RPC | RLS silently truncates ancestry ⚑ |
| Use JS `number` / `Number()` for money | Float error; pg returns numeric as string ⚑ |
| Put `reference_price` in a cost formula | The user's own pack_cost is the only source ⚑ |
| Hard-code VAT, GP targets or a formula in a component | Settings + registry only ⚑ |
| Subscribe a component to the whole nodes array | Re-render storm ⚑ |
| Add a React Flow node type | Use the derived-overlay pattern ⚑ |
| Reintroduce glass, gradients or radius on a surface | Superseded by the paper system ⚑ |
| `alert()` / `prompt()` / `confirm()` | Anti-clunk ⚑ |
| Ship a control that doesn't work | Inert-and-marked, or removed |

## Before calling anything done
- [ ] `lint` 0 · `test` green · `build` clean
- [ ] A spec + 3 ingredients through the menu alone, no form
- [ ] Cost updates per keystroke; switching formula re-renders every node at once
- [ ] `grep -rn "alert(\|prompt(\|confirm(" src/` → zero
- [ ] AA contrast measured on any new surface
- [ ] Every destructive path names its consequence
- [ ] Verified in the running app, not just typechecked — and say plainly what you did not verify
