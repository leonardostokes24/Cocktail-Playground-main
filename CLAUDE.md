# CLAUDE.md — Proof

**The how.** Read `VISION.md` (the what/why) before writing any plan. Read `PLAN.md` for
current phase tasks. This file is the daily coding reference: architecture, rules, patterns,
tokens, hard constraints. If it isn't here, check VISION.md before inventing.

---

## One-line orientation
Proof is a cocktail R&D canvas and open network. Private lineage tree → publish to CC-BY
commons → cross-creator fork graph. The canvas is the workbench; `published_specs` is the
public record.

---

## Tech stack
| Layer | Choice |
|---|---|
| UI | React 18, TypeScript, Tailwind CSS |
| Canvas | React Flow |
| State | Zustand (`useProofStore`) |
| DB / Auth | Supabase (Postgres 15, RLS) |
| Hosting | Vercel |
| Export | `jspdf`, `xlsx` |
| Tests | Vitest (unit); especially `calculations.ts` |

Everything is **TypeScript**. No `.js` source files. `any` requires a comment explaining why.

---

## Directory map
```
src/
  components/
    canvas/          LineageCanvas.tsx, SpecNode.tsx
    spec/            SpecPanel.tsx, SpecFields.tsx, ComponentRow.tsx,
                     AddComponentForm.tsx, SpecMiniCanvas.tsx (optional future)
    radial/          RadialMenu.tsx, RadialRing.tsx, RadialSearch.tsx
    library/         IngredientLibrary.tsx, PrepLibrary.tsx,
                     CatalogueSearch.tsx
    common/          Glass.tsx (the glass wrapper component), GaugeBar.tsx,
                     StatusBadge.tsx
  store/
    useProofStore.ts         slices: ingredients, preps, specs, edges, ui
    selectors/
      costSelectors.ts       memoized pour cost, formula results, dilution
      canvasSelectors.ts     nodes/edges shaped for React Flow
  utils/
    calculations.ts          pure functions — costs, formula registry, dilution
    units.ts                 all conversions → ml
    formulaRegistry.ts       pluggable GP model registry
    export.ts                spec → PDF / Excel
    ingestion.ts             paste / OCR → spec (AI ingestion)
  lib/
    supabase/
      client.ts
      queries/
        ingredients.ts
        preps.ts
        specs.ts
        catalogue.ts
        published.ts
        venues.ts
  types/
    spec.ts, ingredient.ts, prep.ts, component.ts, venue.ts, published.ts
supabase/
  migrations/
    0001_proof_node_revamp.sql
    0002_proof_social_schema.sql
```

---

## Commands
```bash
npm run dev        # local dev server
npm run build      # Vercel production build
npm run lint       # ESLint (pre-commit hook enforces)
npm run test       # Vitest unit tests — must be green before merging
npm run typecheck  # tsc --noEmit
```

---

## Architecture — two layers, do not collapse them

### Outer layer: lineage canvas
- **One React Flow node type: `SpecNode`.** A whole drink version. Compact card.
- Edges = `parent_spec_id` (same-user private branch) OR `forked_from_published_id`
  (cross-user public fork). Both render on the canvas; style them differently.
- Branch action: clone parent's full `spec_components` into a new child, place nearby,
  draw the edge, open in SpecPanel.
- Persist `canvas_x` / `canvas_y` on drag end (debounced 300ms). Never lose layout.
- Guard against lineage cycles app-side on branch/move. SQL only blocks direct self-parent.

### Inner layer: spec editor (SpecPanel)
- A **side drawer / form**, NOT a nested canvas (method was ranked last — a recipe is a list).
- Keep SpecPanel's UI **fully decoupled from the data layer**: it reads/writes via store
  actions only, no direct Supabase calls. This allows the future mini-canvas swap (SpecMiniCanvas)
  without any schema or store changes.
- Shows: component list, method, sale price, glass, garnish, build text, full cost breakdown.

### State
- Zustand store owns all app state. React Flow reads nodes/edges from `canvasSelectors.ts`
  — never maintain a parallel node array; that's how stale-state bugs happen.
- Derived cost values live in **memoized selectors** (`costSelectors.ts`), not in component
  state. Update one ingredient price → every spec that uses it reflects the change instantly.

---

## Data model (migrations 0001 + 0002)

### Core tables (0001)
| Table | Key columns | Notes |
|---|---|---|
| `ingredients` | `user_id, name, type, abv, pack_size_ml, pack_cost, cost_per_ml` (generated) | Personal cost library |
| `preps` | `user_id, name, yield_ml, method` | Shared sub-recipes |
| `prep_components` | `prep_id, ingredient_id, amount_ml` | Ingredients only, no nested preps |
| `specs` | `user_id, name, parent_spec_id, method, sale_price, canvas_x/y` | One node = one version |
| `spec_components` | `spec_id, ingredient_id XOR prep_id, amount_ml` | XOR enforced by constraint |

### Social tables (0002)
| Table | Key columns | Notes |
|---|---|---|
| `catalogue_ingredients` | `name, type, abv, default_pack_size_ml, reference_price, contributed_by` | World-readable; any authed user can contribute |
| `venues` | `name, slug, city, created_by` | Followable identity |
| `user_venues` | `user_id, venue_id, role (owner\|bartender\|guest)` | M:M with roles |
| `published_specs` | `creator_id, venue_id, forked_from_id, name, components_snapshot (JSONB), published_at` | **INSERT-ONLY. No updates ever.** |

### Key columns added to `specs` in 0002
```
visibility            text  'private' | 'published'   (default 'private')
venue_id              uuid  → venues.id
published_at          timestamptz
published_spec_id     uuid  → published_specs.id  (set once on publish)
forked_from_published_id uuid → published_specs.id  (cross-user fork origin)
```

### Cost resolution — two-level
```
ingredients.cost_per_ml  = pack_cost / pack_size_ml     ← user's personal price. ALWAYS used.
catalogue reference_price = cold-start seed only.        ← NEVER in any cost formula.
prep.cost_per_ml         = Σ(comp.amount_ml × ing.cost_per_ml) / yield_ml
spec.pour_cost           = Σ(comp.amount_ml × cost_per_ml)    ← from spec_costs view
```
`cost_per_ml` is a Postgres **generated column** on `ingredients`. Never recompute it in TS.

### published_specs is INSERT-ONLY
This is the immutability guarantee. No `UPDATE` RLS policy exists. A fork always has a
stable row to point at. **Never add an update policy, never patch published rows, never
work around this.** If a correction is needed, publish a new version and link it.

### RLS rules (summary)
- `ingredients / preps / specs / components`: own rows only (`user_id = auth.uid()`).
- `catalogue_ingredients`: authenticated read; contributor insert/update (unverified only).
- `venues`: authenticated read; owner CRUD.
- `published_specs`: authenticated read; creator insert; creator delete (app must check no
  forks exist before calling delete).
- `specs` RLS **does not expose published specs to other users** — they read `published_specs`.

---

## Cost engine & formula registry (`calculations.ts` + `formulaRegistry.ts`)

### Cost modifiers (applied to pour_cost before any formula)
```ts
modifiedCost = (pourCost + sundries) * (1 + wasteRate)
// sundries: fixed £ per serve (garnish, ice, straw)
// wasteRate: e.g. 0.05 for 5% spillage
// dilution does NOT affect cost — only volume and ABV
```

### Formula registry pattern
Adding a new costing model = one pure function + one registry entry. UI reads the registry;
never hardcode a formula into a component.

```ts
// formulaRegistry.ts
export interface CostFormula {
  id: string
  label: string
  unit: string
  compute: (cost: number, saleGross: number, vatRate: number) => number
  reverse?: (targetValue: number, cost: number, vatRate: number) => number
}

export const formulaRegistry: CostFormula[] = [
  {
    id: 'gp_ex_vat',
    label: 'GP %',
    unit: '%',
    compute: (cost, sale, vat) => {
      const net = sale / (1 + vat)
      return ((net - cost) / net) * 100
    },
    reverse: (targetGP, cost, vat) => (cost / (1 - targetGP / 100)) * (1 + vat)
  },
  {
    id: 'pour_cost_pct',
    label: 'Pour cost %',
    unit: '%',
    compute: (cost, sale, vat) => (cost / (sale / (1 + vat))) * 100
  },
  {
    id: 'cash_margin',
    label: 'Cash margin',
    unit: '£',
    compute: (cost, sale, vat) => sale / (1 + vat) - cost
  },
  {
    id: 'markup',
    label: 'Markup',
    unit: '×',
    compute: (cost, sale, vat) => (sale / (1 + vat)) / cost
  },
  // Target-price reverse models — use .reverse() fn
]
```

### GP is always calculated on the EX-VAT price
```ts
const net = salePrice / (1 + vatRate)  // vatRate default 0.20
const gp  = ((net - cost) / net) * 100
```
The old formula (on gross price) overstates GP by ~5 points. Do not regress.

### Dilution
```ts
const dilutionFactor: Record<string, number> = {
  shaken: 0.25, stirred: 0.22, built: 0.10, thrown: 0.18
}
finalVolume = liquidMl * (1 + dilutionFactor[method] ?? 0)
finalAbv    = Σ(vol_i * abv_i) / finalVolume
```
Factors are **user-editable** (live in settings, not hardcoded). Always read from store.

### Unit conversion
Everything **normalises to ml on write**. `units.ts` provides `toMl(amount, unit): number`.
`original_amount` + `original_unit` are stored for authoring round-trips only.

---

## Radial menu system (`/src/components/radial/`)

The primary creation surface. **Not a nice-to-have — it's Pillar 1.**

### Invocation
- Desktop: right-click anywhere on canvas or a node.
- Tablet/touch: long-press (300ms), then drag to segment, release to select.
- Keyboard: configurable hotkey (default `Space` on canvas focus).

### Context rings (what the ring shows depends on what was invoked on)
```
Empty canvas  → New spec · Search library (fork) · Quick-ingest · New prep
Spec node     → Branch / Riff · Add component → sub-ring · Open recipe ·
                Duplicate · Publish/Unpublish · Delete
Component     → Edit amount · Swap ingredient · Convert to prep · Remove
```

### Sub-ring: ingredient categories
Eight segments: spirit · modifier · citrus · sweetener · bitters · prep · syrup · other.
Selecting a category filters the type-ahead to that type. This is the old category wheel,
reborn inside the new model — keep the category IDs consistent with `catalogue_ingredients.type`.

### Type-ahead at centre
Searches `ingredients` (user's own) AND `catalogue_ingredients` AND `published_specs` in
parallel with debounced queries (200ms). Results populate the ring dynamically. Recently and
frequently used surface first (track in Zustand `ui.recentIngredients`).

### Rules
- The radial never opens a blocking modal. If a confirmation is needed (delete), it shows an
  inline confirm segment on the ring itself.
- Fully keyboard-navigable (arrow keys cycle segments, Enter selects, Escape closes).
- **Success criterion: spec + three ingredients with no form field interaction beyond search.**

---

## Visual identity — glass, with a chromatic whisper

A glass UI with subtle chromatic aberration. The colour is a *whisper* at the edges only.
**If the chroma is the first thing you notice, it's too loud.**
Reference mock: `proof-glass-refined.html` (NOT the louder first-pass mock).

### CSS tokens
```css
:root {
  /* Ground */
  --bg: #0C0B14;

  /* Light blooms (quiet — they exist so glass has something to refract) */
  --bloom-indigo: rgba(58, 51, 128, 0.30);
  --bloom-teal:   rgba(29, 95, 114, 0.28);
  --bloom-plum:   rgba(90, 42, 102, 0.22);

  /* Glass material */
  --glass-fill:   linear-gradient(168deg, rgba(255,255,255,.085), rgba(255,255,255,.025));
  --glass-border: rgba(255, 255, 255, 0.14);
  --glass-blur:   blur(24px) saturate(135%);

  /* Edge dispersion — THE only chroma on a card */
  --edge-cyan:    rgba(120, 225, 255, 0.42);
  --edge-magenta: rgba(255, 135, 210, 0.36);
  --edge-top:     rgba(255, 255, 255, 0.22);

  /* Type aberration — sub-pixel, felt not seen */
  --aberration: -.4px 0 rgba(120,225,255,.42), .4px 0 rgba(255,135,210,.36);

  /* Gauge accent */
  --cyan: #7FE6FF;

  /* UI ink */
  --ink:  #EEF0FA;
  --mute: #9296B4;
}
```

### Glass component (`Glass.tsx`)
Encapsulate the glass material as a reusable component so the aesthetic is consistent and
tuneable in one place.
```tsx
// box-shadow: inset 1px 0 0 var(--edge-cyan),
//             inset -1px 0 0 var(--edge-magenta),
//             inset 0 1px 0 var(--edge-top),
//             0 28px 56px -28px rgba(0,0,0,.85)
```

### Type
| Role | Font | Weight |
|---|---|---|
| Display / name | Bricolage Grotesque | 700 |
| UI labels, body | Inter Tight | 400, 500 |
| Gauges, amounts | JetBrains Mono | 400, 500 |

Apply `text-shadow: var(--aberration)` to display type only (spec name, brand). Nowhere else.

### Hierarchy of calm
1. Canvas nodes: glass material, edge dispersion, slow sheen animation.
2. SpecPanel: **more opaque** (`rgba(255,255,255,.10)` fill, no sheen) — you're editing, not browsing.
3. Radial menu: semi-transparent, no sheen — it's transient chrome.
4. System chrome (topbar, sidebar): flat dark — let the nodes breathe.

### Motion
- Hover lift: `translateY(-4px)`, `transition: 0.4s cubic-bezier(.2,.7,.2,1)`.
- Sheen sweep: 9s ease-in-out, `background-size: 240%` sweep. Only on canvas nodes.
- **Always** respect `prefers-reduced-motion: reduce` — disable sheen and transitions.

### SpecNode card anatomy
```
┌──────────────────────────────────────┐  ← 1px border (--glass-border)
│ lineage hint        status badge     │  ← 10.5px Inter Tight, --mute
│                                      │  ← edge-cyan left / edge-magenta right
│ Spec Name                            │  ← Bricolage 700 27px + aberration
│ METHOD · GLASS                       │  ← 11px Inter Tight uppercase --mute
│                                      │
│ Component Name              45 ml    │  ← 13px Inter / 11.5px JetBrains Mono
│ Another component           20 ml    │
│ ...                                  │
│ ─────────────────────────────────────│
│  GP 78%    │  ABV 18.4%  │  96ml     │  ← JetBrains Mono 500, --cyan units
└──────────────────────────────────────┘
```

---

## React & React Flow rules
- Functional components + hooks only. No class components.
- **One node type: `SpecNode`.** Old IngredientNode / ProcessNode / GlasswareNode are deleted.
- All node/edge data lives in Zustand. React Flow is a **renderer**, not a state owner.
  Use `useNodesState` / `useEdgesState` driven by selectors, not local component state.
- Debounce position updates on `onNodeDragStop` (300ms) before writing to Supabase.
- Never call `setNodes` with a freshly-mapped array on every render — that causes the
  whole canvas to re-mount and kills drag state.
- Component line limit: ~150 lines. If longer, extract and explain why in a comment.
- `SpecPanel` is swappable: UI only talks to store actions, zero direct Supabase calls.

---

## Supabase & data rules
- Every query uses the **authenticated user's session**. No service-role key on the client.
- RLS is the security layer. Never bypass it with a direct table scan.
- Cost rollup views (`prep_costs`, `spec_costs`, `spec_component_costs`) have
  `security_invoker = true` — the caller's RLS applies. Don't change this.
- Write helpers in `src/lib/supabase/queries/` — no raw Supabase calls in components.
- `published_specs` is **insert-only**. Never add an update query for it. Never.
- Numeric money values: `numeric` in Postgres, not `float`. `BigDecimal`-style in TS if
  precision matters (use `decimal.js`). Never `Math.round` a cost.
- All volumes write as **ml** (`units.ts`). Original unit is advisory only.
- Use Supabase Edge Functions only for genuinely heavy work (large PDF exports, batch jobs).
  Client-side is fine for single-spec exports.

---

## Touch & tablet rules
Desktop and tablet are **equal, first-class targets**. Not an afterthought.
- Minimum tap target: 44×44px.
- Radial menu: long-press (300ms) + drag-to-segment + release. No hover-dependent UI.
- Avoid fixed sidebars that consume too much viewport on a 768px tablet.
- Test layouts at 768px and 1024px, not just 1440px.
- Canvas pan/zoom: React Flow's built-in touch gestures (pinch-zoom, two-finger pan).
  Do not override these.

---

## Hard DO NOT list
Read this before shipping any PR.

| DO NOT | Why |
|---|---|
| Add an UPDATE policy on `published_specs` | Breaks immutable lineage guarantee |
| Use `alert()`, `prompt()`, `confirm()` | Kills the "fast and tactile" feel |
| Hardcode a GP formula in a component | Breaks the pluggable formula registry |
| Use `float` / `number` for money | Floating-point errors in cost display |
| Call Supabase directly from a component | Bypasses the query abstraction layer |
| Let React Flow own node state | Causes stale-state and drag-reset bugs |
| Add another canvas node type | The two-layer model is one node type only |
| Nest preps inside preps | Recursive cost cycles; explicitly out of scope |
| Use `catalogue.reference_price` in cost formula | User's pack_cost is always the source |
| Build discovery feed / follow / ratings UI | Deferred — schema-aware but don't build yet |
| Add any AI feature beyond ingestion | Out of scope for v1 |
| Ignore `prefers-reduced-motion` | Accessibility + respect for bar-floor use |

---

## Anti-clunk checklist
Before marking any phase done, verify:
- [ ] New spec + first ingredient in ≤ 3 radial interactions (no form beyond search).
- [ ] GP / cost readout updates on every keystroke in SpecPanel — no stale values.
- [ ] Switching the active formula model re-renders **all** canvas node headlines at once.
- [ ] Radial is context-correct on: empty canvas, spec node, component row.
- [ ] No `alert` / `prompt` / `confirm` anywhere in the codebase (`grep -r "window.alert\|window.prompt\|window.confirm"`).
- [ ] Dragging a node does not snap back on release.
- [ ] Selecting a node does not rebuild the full nodes array.
- [ ] Touch: long-press radial works on a real tablet (or BrowserStack).
- [ ] Published spec: appears in `public_specs_feed` view, forkable from radial.
- [ ] Forked spec: `forked_from_published_id` is set, ancestry traceable to root.
- [ ] `npm run typecheck` exits 0.
- [ ] `npm run test` exits 0.