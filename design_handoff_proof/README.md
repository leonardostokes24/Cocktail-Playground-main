# Handoff: Proof — chroma-glass lineage canvas, smart radial & spec panel

## Overview
**Proof** is an open network for cocktail R&D. A bartender invents on a **private lineage canvas** (branch a riff off any spec and the lineage shows how the idea evolved), **costs it honestly** as they go, and **publishes** worthy drinks to a **CC-BY commons** where anyone can **fork** them — with the cross-creator fork lineage preserved forever. The one asset nobody else has is that **cross-creator fork lineage**; it is the moat and must never be compromised.

This handoff specs three UI moments plus the shared visual foundation and the costing engine:

- **2a — Lineage canvas** — the graph of SpecNodes and the fork edges between them (the moat, made visible).
- **2b — Smart radial menu** — the primary creation gesture; context-aware ring + type-ahead.
- **2c — Spec panel + costing** — the inner recipe editor and the full GP/cost breakdown.
- **Chroma-glass foundation** — the design system: glass material, edge dispersion, type, gauges (`tokens.css`).
- **Costing engine** — pure, testable formula registry (`costing.ts`).

> Source of truth for product intent: the project's `VISION.md`. Where this README and VISION.md ever disagree, VISION.md wins. This document translates that vision into build-ready design + interaction spec.

## About the design files
The files in `reference/` are a **design reference built in HTML** — a prototype showing intended look and behavior, **not production code to copy line-for-line**. Your job is to **recreate these designs in a real codebase using its established patterns and libraries.**

There is **no existing app to build into** — this is a **fresh scaffold**. Recommended stack (matches the vision's architecture notes and the team's prior repo): **React + TypeScript + Vite**, **React Flow (@xyflow/react)** for the node/edge canvas, **Zustand** for app state, plain **CSS custom properties** for the chroma-glass tokens (Tailwind optional for utility layout, but the glass material is easier as real CSS — see `tokens.css`). You may substitute equivalents, but keep: a proper graph library for the canvas (do **not** hand-roll node dragging/edges), a store that lets React Flow own node/edge state to avoid re-render lag, and pure functions for all costing.

## Fidelity
**High-fidelity for the visual system, intent-level for behavior.** Colors, typography, the glass material, edge-dispersion values, and the costing math are **exact** — use them verbatim (`tokens.css`, `costing.ts`). Layout measurements in the prototype are a **faithful guide**, not a pixel contract: reproduce the proportions, hierarchy, and feel, and make sensible engineering calls on exact spacing, breakpoints, and component APIs. Every screen below ends with **acceptance criteria** — treat those as the definition of done.

## The chroma-glass identity (read this first — it is load-bearing)
A **glass UI** with a **whisper of chromatic aberration** — not a prism, not flat glassmorphism. Glass is the aesthetic; color appears only where light would actually disperse: the **edges**. **Restraint is the whole point — if the chroma is the first thing you notice, it's too loud.** Two dials to tune down if ever in doubt: edge-dispersion opacity and the title fringe — always err fainter. Keep motion to a slow, faint sheen and **respect `prefers-reduced-motion`**.

All values below are in `tokens.css` as ready-to-use custom properties and utility classes.

### Ground & light blooms
- **Ground:** `#0C0B14`.
- **Blooms** (soft blurred light behind the glass, so it has something to refract) — three radial gradients at low opacity, heavily blurred:
  - indigo `#3a3380`, teal `#1d5f72`, plum `#5a2a66`, each ~`0.3–0.5` alpha, `filter: blur(30px)`.
  - They exist **only** to give the glass something to bend. Keep them quiet.

### Glass material (canvas nodes, toolbar, dock, radial chips)
- **Fill:** `linear-gradient(168deg, rgba(255,255,255,.085), rgba(255,255,255,.025))`
- **Backdrop:** `backdrop-filter: blur(24px) saturate(135%)`
- **Border:** `1px solid rgba(255,255,255,.14)`
- **Top light (inset):** `inset 0 1px 0 rgba(255,255,255,.22)`
- **Edge dispersion (the signature):** faint cyan on one vertical edge, magenta on the other —
  `inset 1.2px 0 0 rgba(120,225,255,.42)` (cyan, left) + `inset -1.2px 0 0 rgba(255,135,210,.36)` (magenta, right). This is the **only** chroma on the card.
- **Drop shadow:** `0 26px 52px -22px rgba(0,0,0,.8)` (soften/reduce for smaller chrome).
- **Radius:** 18px for nodes, 15px toolbar, 12–13px chips/dock.

### The spec panel is calmer than the canvas
So you're not editing "through frost," the SpecPanel (2c) is **more opaque and less dispersed** than canvas nodes:
- Fill `linear-gradient(168deg, rgba(22,20,34,.86), rgba(16,15,26,.82))`, edge dispersion reduced to `rgba(120,225,255,.30)` / `rgba(255,135,210,.26)`.

### Typography
- **Display:** `Bricolage Grotesque` — cocktail names, wordmark. 600–700, tight letter-spacing (`-0.01em` to `-0.02em`).
- **UI:** `Inter Tight` — labels, meta, buttons. 400–600.
- **Data / gauges:** `JetBrains Mono` — all numbers (GP, ABV, ml, prices, zoom).
- **Aberration on display type only** — a sub-pixel fringe, felt not seen:
  `text-shadow: -.4px 0 rgba(120,225,255,.42), .4px 0 rgba(255,135,210,.36);` Apply to Bricolage headings; never to body/UI text.

### Accent & text colors
- **Cyan (primary accent / positive):** `#7FE6FF`; lighter text `#bfeeff` / `#eaf9ff`.
- **Magenta (publish / commons-outbound):** `#ff87d2`; lighter `#ffb3e2` / `#ffd6f0`.
- **Text:** primary `#f4f2fb`; secondary `rgba(230,228,245,.55)`; muted `rgba(230,228,245,.40)`.
- **Ingredient type dots** (from the domain model): spirit `#e0b64a` (amber), modifier/liqueur `#c86ab0` (orchid), citrus `#facc15` (yellow), sweetener `#60a5fa` (blue), bitters `#d24a3a` (red). Use as a 6px dot on component rows and as node accent when relevant.

### Gauges (clean, no glow)
- **GP ring:** a conic gauge — `conic-gradient(#7FE6FF 0 <gp>%, rgba(255,255,255,.09) <gp>% 100%)` as a 50px disc, with a `rgba(12,11,20,.9)` inner disc (39px) holding the mono numeral + a cyan unit label (`GP%`).
- **Readouts (ABV, volume):** white `JetBrains Mono` numeral + faint cyan `#7FE6FF` unit. **No glow anywhere.**

### Lineage edges
- Thin **1.6px** stroke, `linear-gradient` **cyan→magenta** (`#7FE6FF` @ .55 → `#ff87d2` @ .5). Reduced opacity, no neon. Smooth bezier from a parent node's right handle to a child's left handle. In React Flow, implement as a custom edge with an SVG `linearGradient` stroke.

---

## Screen 2a — Lineage canvas
**Purpose.** The home surface: see how drinks relate and evolve; branch, cost, publish from here. This screen makes the moat (cross-creator fork lineage) visible and glanceable.

**Layout.**
- Full-bleed `#0C0B14` ground with three blurred blooms (see tokens).
- **Top toolbar** — a full-width floating glass bar (inset ~20px, height ~52px): left = **Proof** wordmark (Bricolage, with aberration) + a `Canvas / Commons` segmented toggle; right = **costing-model selector** ("Model · GP% ex-VAT ▾") + user avatar (gradient disc, indigo→plum).
- **Node graph** — SpecNodes positioned left→right by generation. A root/classic on the left; its forks one column right; descendants a further column right. Edges connect parent→child.
- **Zoom dock** — bottom-center floating glass pill: `−  100%  +  | Fit lineage`.
- **Minimap** optional (the prior repo had one; fine to defer).

**SpecNode component (glass card, ~232px wide).** Contents top→bottom:
1. **Name** (Bricolage 21px, aberration) + one-line **descriptor** (Inter Tight 10px, muted) — e.g. "Stirred · Rocks · 3 parts" for a root, or "Fork · swapped gin → bourbon" / "Descendant · +2 dash mole bitters" for lineage.
2. **Root badge** on the classic: `◈ ROOT` in a cyan hairline pill. (Forks/descendants omit it.)
3. **Gauge row:** GP conic ring (50px) + stacked ABV% and volume(ml) mono readouts.
4. **Footer** (hairline top border): **attribution** — creator avatar + `Creator · Venue` (venue muted) — and a right-aligned **state chip**: `● Commons` (cyan dot) if published, or `🔒 Private` (lock icon, muted) if not. Attribution is **data, not text**: creator + venue travel with the spec.

**Example data shown in the prototype (use as seed/fixtures):**
- **Negroni** (ROOT, Classic · IBA, Commons) — GP 78, ABV 28%, 90 ml.
  - → **Boulevardier** (Fork · gin→bourbon, Aki · Kiyori, Commons) — GP 74, 30%, 95 ml.
    - → **Left Hand** (Descendant · +mole bitters, Remy · Attaboy, Commons) — GP 69, 29%, 96 ml.
  - → **Agavoni** (Fork · reposado + mezcal float, Marco · Sother, **Private**) — GP 71, 27%, 88 ml.
  - → **White Negroni** (Fork · Suze + Lillet, Sana · Dram, Commons) — GP 81, 26%, 92 ml.

**Interactions & acceptance criteria.**
- **Pan/zoom** the canvas; **Fit lineage** frames all connected nodes. Touch: pinch-zoom + one-finger pan.
- **Drag a node** to reposition — it must **never snap back**; selecting a node must **never rebuild the whole node array** (let React Flow own node/edge state; keep app state in the store separate).
- **Right-click / long-press a node** opens the **smart radial** (2b) at the cursor.
- The **costing-model selector** changes the **headline** number on **every node at once** (see costing engine); switching must re-render all headlines effectively instantly.
- Published vs private is visually unambiguous at a glance.
- **Chroma stays a whisper** — the edge dispersion should not read as a colored border at normal zoom.

---

## Screen 2b — Smart radial menu
**Purpose.** The primary way you touch the app. Radial-first creation means a spec and its first three ingredients with **no traditional form**. Friction is the enemy.

**Invocation.** Right-click / long-press / hotkey. Opens **at the cursor**. Touch: long-press then **drag-to-segment, release to select**. Fully keyboard navigable. **Never blocks on a modal.**

**Anatomy (as prototyped).**
- A faint circular **ring backdrop** (~290px, hairline border, subtle radial darken + slight blur) centered on the invocation point; the underlying node/canvas dims behind it (~0.5 opacity).
- **Centre = type-ahead** — a small glass pill with a live caret. Typing **filters the ring** *and* **searches the ingredient library + the published cocktail DB at once**. Caption under it: "search · type to filter ring".
- **6 segments** on a ~118px radius, evenly spaced (60° apart), each a small glass chip with an icon + label.

**Context-aware ring — the segment set changes by target:**
- **Empty canvas** → New spec (blank) · Search library (fork a published cocktail) · Quick-ingest (paste/drop a recipe) · New prep.
- **On a spec node** (the state drawn in the prototype) → **Branch** (riff: copy + link) · **Add** component (opens ingredient/prep search sub-ring) · **Open** recipe · **Duplicate** · **Publish / Unpublish** · **Delete**.
- **On a component** (panel / mini-canvas) → Edit amount · Swap ingredient (search) · Convert to prep · Remove.

**Segment styling.** Most chips are neutral glass. Emphasize by meaning, not decoration:
- **Branch** → cyan-tinted chip (`rgba(127,230,255,.16)` fill, `rgba(127,230,255,.34)` border, `#eaf9ff` label) — branching is the core verb.
- **Publish** → magenta-tinted chip (`rgba(255,135,210,.14)` fill, `rgba(255,135,210,.32)` border, `#ffd6f0` label).
- **Delete** → neutral chip with red-tinted icon/label (`rgba(255,150,150,.9)`).
- **Category sub-rings** for ingredients: spirit · modifier · citrus · sweetener · bitters · prep · syrup · other (the old eight-category wheel, reborn inside the new model). Recently/frequently used surface first.

**Interactions & acceptance criteria.**
- Open at cursor; aim with mouse-move or arrow keys; **release / Enter** to select; `Esc` closes.
- **Touch parity:** long-press opens, drag to the segment, release to fire; the active segment highlights under the finger.
- **Success test (must pass):** create a spec and add three ingredients using **only the radial** — no typing into any form field beyond the search box.
- Type-ahead returns ingredient AND published-cocktail hits in one list; recents first.
- No `alert`/`prompt`/`confirm` anywhere in the flow.

---

## Screen 2c — Spec panel + costing
**Purpose.** The inner recipe editor: edit the build, watch GP/ABV/volume update live, and read the full cost breakdown through the user's chosen formula.

**Layout (a calmer, more opaque glass panel — see foundation).**
- **Header** (hairline bottom border): cocktail **name** (Bricolage 26px, aberration) + descriptor line ("Stirred · Rocks · big cube · orange twist"); a close `✕` button top-right. Below, a **3-up gauge strip**: `GP · ex-VAT` (74%), `ABV` (30%), `VOLUME` (95 ml) — each a small glass tile, mono numeral + cyan unit.
- **Build list** — section label "BUILD"; one row per component: colored **type dot** + ingredient name (Inter Tight) on the left, **amount** (JetBrains Mono, e.g. `30 ml`) right-aligned. Rows separated by hairlines. A cyan **"+ Add component · via radial"** affordance at the bottom.
- **Costing block** — a darker inset card (`rgba(0,0,0,.28)`), label "COSTING" with a right-aligned line "pour £1.42 · +£0.20 sundries". Then one row per formula model, mono values right-aligned:
  - **GP %** `74.1%` — tagged **`headline`** (cyan pill) = the active model.
  - **Pour cost %** `25.9%`
  - **Cash margin** `£4.63`
  - **Markup ×** `3.86×`
  - **Target-GP price (75%)** `£8.00`
  - (Also available: Target pour-cost price.)
- **Footer actions** (pinned bottom): **Branch** (neutral glass) + **Publish to commons** (the one emphasized button — cyan↔magenta glass gradient, `rgba(255,135,210,.2)`→`rgba(127,230,255,.16)`).

**What shows where (canvas vs panel).** The **canvas node** shows only the chosen headline readout + ABV + volume (one glanceable number set). The **panel** shows the **full** breakdown — pour cost, each modifier, every model's result, and the reverse-priced suggestion vs the set menu price.

**Interactions & acceptance criteria.**
- Editing an amount, swapping/adding/removing a component **recomputes GP/cost/ABV/volume effectively instantly**.
- Changing the **active model** updates the headline tag here and the headline number on every canvas node.
- **Branch** creates a linked copy (new node + lineage edge on the canvas). **Publish** flips visibility to public and makes the drink findable in search and forkable from the radial; **Unpublish** reverses.
- Panel is **calmer/more opaque** than canvas nodes (legibility while editing). Touch targets ≥ 44px.

---

## Costing engine (`costing.ts`)
Ship costing as a **registry of pure functions** — adding a model = adding one function + a registry entry; the UI reads the registry so models are pluggable. `costing.ts` in this bundle is a ready-to-adapt implementation. Keep it pure and unit-tested.

**Cost flow.**
1. Each ingredient carries a price in two parts: a shared **community catalogue** (canonical ingredient + a **reference** price) and a **per-user cost override** (their real supplier price). `cost_per_ml = user_cost ÷ pack_size_ml`, falling back to the reference price when no override is set. **GP is computed from the user's cost so margins stay private.**
2. **Preps roll up:** a prep's `cost_per_ml = Σ(component costs) ÷ yield_ml`. (No nested preps this generation — keep rollup to two clean levels.)
3. **Pour cost** of a spec = `Σ(component_ml × cost_per_ml)`.
4. **Cost modifiers** applied to pour cost before any formula: **sundries** (fixed £/serve for garnish/ice/straw), **waste** (`× (1 + waste%)`). **Dilution does not change cost** — it only affects final volume and ABV.

**Formula library** (let `net = price_gross ÷ (1 + vatRate)`, `vatRate` default `0.20`, `cost` = modified pour cost):

| Model | Math | Use |
|---|---|---|
| **GP % (ex-VAT)** | `(net − cost) / net × 100` | UK on-trade standard. **Default headline.** |
| **Pour cost %** | `cost / net × 100` | US COGS view (= 100 − GP%). |
| **Cash margin** | `net − cost` (£) | Profit per serve. |
| **Markup ×** | `net / cost` | "We sell at N× cost." |
| **Target-GP price** | `net = cost / (1 − targetGP/100)`, then `× (1+vat)`, round to menu price | Reverse: price for a target GP. |
| **Target pour-cost price** | `net = cost / (targetPour/100)`, then `× (1+vat)` | Reverse, pour-cost target. |

Users set **targets** (target GP%, rounding rule) and **modifiers** (vatRate, sundries, waste%) in settings; persist per venue where relevant.

---

## State management (suggested)
Keep React Flow as the owner of `nodes`/`edges`; keep domain state in a Zustand store so selection/drag don't rebuild the graph.
- **Entities** (normalized): `ingredients`, `preps`, `specs`, `components`. A published, flattened read model (`cocktails`) powers search/commons.
- **Per spec:** `id`, `name`, `descriptor`, `method`, `glass`, `components[]`, `visibility: 'private' | 'public'`, `forked_from` (nullable), `creatorId`, `venueId`, plus an **immutable published snapshot** when public (so a fork's ancestry can never break).
- **Costing settings:** `vatRate`, `sundries`, `wastePct`, `targetGP`, `roundingRule`, `activeModel`.
- **UI:** `radial` (`open`, `x`, `y`, `context: 'canvas' | 'node' | 'component'`, `query`), `selectedSpecId`, `panelOpen`, `zoom`.
- **Derived (memoized/pure):** per-spec `pourCost`, `abv`, `volume`, and every formula result via `costing.ts`.

**Data-model growth to not paint into a corner** (don't build all now, but don't block): ingredients split into shared catalogue + per-user override; specs get a visibility flag + immutable published snapshot + `forked_from` + **cross-user** lineage; attribution (creator+venue, CC-BY) carried on published versions; `users ↔ venues` many-to-many with roles.

---

## Global acceptance signals (anti-clunk — a build isn't done until these hold)
- New spec + first ingredient in **≤ 3 interactions** via the radial.
- GP / cost readout updates **effectively instantly** on edit.
- Switching the active costing model re-renders **every node's headline at once**.
- The radial is **context-correct** on canvas, node, and component.
- **No `alert` / `prompt` / `confirm` anywhere** — real in-app surfaces only.
- Dragging a node **never snaps back**; selection **never rebuilds** the whole node array.
- Publishing a spec makes it **findable in search and forkable** from the radial.
- A forked drink **preserves attribution and its full ancestry to the root** — the chain never breaks, even after the parent is edited.
- Runs **desktop + tablet** with **true touch parity** (every interaction has a touch path; targets ≥ 44px).
- **Chroma is a whisper**, not the first thing you notice. Respect `prefers-reduced-motion`.

## Non-goals (resist scope creep)
Not a POS/till; no live stock/inventory. No real-time co-editing (collaboration is async via forking). No AI beyond ingestion (no creative collaborator/auto-riffs). No nested preps this generation. No native apps (responsive web only). No monetisation now.

## Files in this bundle
- `README.md` — this document (self-sufficient spec).
- `tokens.css` — drop-in chroma-glass design tokens + glass/gauge/aberration utility classes.
- `costing.ts` — pure, testable formula registry (cost flow + all six models).
- `reference/Proof-prototype.html` — the HTML design reference. Open in a browser. **The relevant design is the "Proof — chroma-glass" turn (`#2a`, `#2b`, `#2c`).** The earlier "slate / speakeasy / light" turn in the same file **predates the vision and is superseded — ignore it.**
- `reference/support.js` — runtime needed only so the prototype renders; not part of the design.
- `reference/screenshots/` — rendered captures of each screen: `2a-lineage-canvas.png`, `2b-smart-radial.png`, `2c-spec-panel.png`.
