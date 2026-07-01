# VISION.md — Proof

The north star for the app. **Claude Code: read this before writing any plan.** Every phase,
task, or feature must ladder up to a goal here. If a proposed task doesn't serve one of the
Pillars below, cut it or justify it. This file is the *what & why*; `CLAUDE.md` is the *how*
(standards); `PLAN.md` is the *when* (current phase tasks). When you write a new plan, state
which Pillar(s) each phase serves.

---

## The end goal (one paragraph)
Proof is an **open network for cocktail R&D**, for the wider trade. You invent on a **private
canvas** — branch a riff off any spec and the lineage shows how an idea evolved — and **cost it
honestly** as you go. You build everything through **fast, context-aware radial menus**, never
wading through forms. When a drink is worth sharing you **publish it to a public commons**
(CC-BY): anyone can **fork** it, and the lineage is preserved **forever, across creators** — a
drink carries its whole ancestry and every descendant. Identities are **people and venues,
linked**. It runs equally on **desktop and tablet behind the bar**, looks like nothing else (a
restrained **chroma-glass** identity), and feels *fast and tactile*. If it feels clunky, it's
wrong — regardless of feature completeness. The one asset nobody else has is the **cross-creator
fork lineage**; protect it above all.

---

## Pillars (the few things every plan serves)
1. **Speed of capture.** Radial-first creation. A spec and its first three ingredients with no
   traditional form. Friction is the enemy.
2. **Lineage is the spine.** The canvas exists to show how drinks relate and evolve. Branching is
   the core verb; published lineage is **permanent and crosses creators**.
3. **Costing you can trust.** The community catalogue gives the ingredient + a *reference* price;
   your own cost override drives GP, so **your margins stay private**. Numbers correct and
   legible at a glance, through the *user's chosen* formula.
4. **Character.** The chroma-glass identity is load-bearing, not decoration. Quiet everything
   else; let the glass be the signature.
5. **An open commons that compounds.** Private R&D → publish (CC-BY) → others fork → lineage
   grows across everyone. The network is the moat.
6. **Works behind the bar.** Desktop and tablet are equal, first-class targets — touch-first,
   legible in a dim room.

---

## Core interaction — the smart radial menu
This is the primary way you touch the app. Bring it back, but re-aimed at the two-layer model.

**Invocation:** right-click / long-press / a hotkey. Opens at the cursor. Touch supports
long-press then drag-to-segment, release to select.

**It is context-aware — the ring changes by what you invoke it on:**
- **Empty canvas** → New spec (blank) · Search library (fork a published cocktail) · Quick-ingest
  (paste/drop a recipe) · New prep.
- **On a spec node** → Branch (riff: copy + link) · Add component (opens an ingredient/prep
  search sub-ring) · Open recipe · Duplicate · Publish / Unpublish · Delete.
- **On a component (panel / mini-canvas)** → Edit amount · Swap ingredient (search) · Convert to
  prep · Remove.

**"Smart" means:**
- A **type-ahead at the centre** filters the ring *and* searches the ingredient library and the
  published cocktail DB at once.
- **Category sub-rings** for ingredients (spirit · modifier · citrus · sweetener · bitters ·
  prep · syrup · other) — the old eight-category wheel, reborn inside the new model.
- **Recently / frequently used** surface first.
- Fully **keyboard navigable**; never blocks on a modal.

**Success test:** create a spec and add three ingredients using only the radial — no typing into
a form field beyond search.

---

## Costing & GP system
Make GP *make sense*: real per-ingredient prices, flowing into a margin model the user picks.

### Cost flow
1. **Each ingredient carries a price — in two parts.** A shared **community catalogue** holds the
   canonical ingredient (name, ABV, pack sizes) plus a **reference price**. Each user sets their
   **own cost override** (their real supplier price); GP is computed from the user's cost, so
   **margins stay private**. `cost_per_ml` = user_cost ÷ pack_size_ml, falling back to the
   reference price when no override is set.
2. **Preps roll up.** A prep's `cost_per_ml` = Σ(component costs) ÷ `yield_ml`.
3. **Pour cost** of a spec = Σ(component_ml × cost_per_ml of its ingredient/prep).
4. **Cost modifiers** (applied to pour cost before any formula):
   - *Sundries*: a fixed £ per serve for garnish / ice / straw.
   - *Waste*: × (1 + waste% ) for spillage allowance.
   - Dilution does **not** change cost — it only affects final volume and ABV.

### The formula library (user picks the active model)
Costing is not one formula. Ship a small, named collection; the user selects which is the
**headline readout** on the node, and the panel shows the **full breakdown** (all of them) for
sanity. Defaults can differ per venue. Let `net = price_gross ÷ (1 + vatRate)`, `vatRate`
default 0.20, `cost` = modified pour cost.

| Model | Math | Use |
|---|---|---|
| **GP % (ex-VAT)** | `(net − cost) / net × 100` | UK on-trade standard. Default. |
| **Pour cost %** | `cost / net × 100` | US-style COGS view (= 100 − GP%). |
| **Cash margin** | `net − cost` (£) | Profit per serve — guards against high-% / low-cash drinks. |
| **Markup ×** | `net / cost` | "We sell at N× cost." |
| **Target-GP price** | `net = cost / (1 − targetGP/100)`, then × (1+vat), round to menu price | Reverse: suggest a price for a target GP. |
| **Target pour-cost price** | `net = cost / (targetPour/100)` | Reverse, pour-cost target. |

- The user sets **targets** (target GP%, rounding rule) and **modifiers** (vatRate, sundries,
  waste%) in settings; these persist (per venue where relevant).
- Formula functions live in `calculations.ts`, pure and unit-tested. Adding a new model = adding
  one pure function + a registry entry; the UI reads the registry so models are pluggable.

### What shows where
- **SpecNode (canvas):** the chosen headline readout (e.g. GP 78%) + ABV + volume, as backlit
  gauges. One number, glanceable.
- **SpecPanel (editor):** full cost breakdown — pour cost, each modifier, every model's result,
  and reverse-priced suggestion vs the set menu price.

---

## Social commons & identity
The network layer. Private by default; the commons is opt-in and additive.

- **Private R&D by default.** Your canvas is yours. You **publish chosen drinks** to the public
  commons; nothing is public unless you push it there.
- **Licence: CC-BY.** A published drink can be **forked and used by anyone, attribution
  required**. Attribution is *data, not text* — creator + venue travel with the spec.
- **Fork lineage is permanent and cross-creator.** A published version is an **immutable
  snapshot** so a fork's ancestry can never break; each spec records `forked_from` and is
  root-traceable. A public drink shows its whole ancestry *and* every descendant, across all
  users. **This is the moat — never compromise it.**
- **Identity = people and venues, linked.** A person works at one or more venues; a spec credits
  **creator + venue**. Both people and venues are followable entities (e.g. Kiyori, Aki).
- **Discovery centres on people first**, then lineage trees (a classic and all its forks), then
  ingredient ("what else uses yuzu"), then trending. *(Discovery UI is deferred — see scope.)*
- **Feedback (ratings + comments, Untappd-style) and follows are deferred** to post-v1, but the
  schema should not preclude them.

---

## Architecture recap (already built — protect it)
- **Two layers:** outer lineage canvas (`SpecNode`), inner recipe editor (`SpecPanel`, with the
  optional mini node-canvas). State in `useProofStore` (Zustand); React Flow owns node/edge
  state to avoid re-render lag.
- **Data:** normalized `ingredients / preps / specs / components` (migration `0001`). The
  searchable library (`cocktails`, JSONB) is a **published read model** — publishing flattens a
  spec's components into it.
- Costing views (`prep_costs`, `spec_costs`) do the SQL rollup; formulas/dilution/VAT live in
  `calculations.ts` because their factors are user-editable.

---

## Where the data model must grow (make v1 choices that don't block this)
The social turn moves things migration `0001` assumed. Don't build it all now, but don't paint
into a corner either:

- **Ingredients split in two:** a shared **catalogue** (canonical ingredient + reference price)
  and a **per-user cost override**. The current per-user-only `ingredients` table can't express
  this — plan the split.
- **Specs go public/forkable:** a **visibility** flag (private/public), an **immutable published
  snapshot**, `forked_from`, and lineage that **crosses users** — not just a single-parent tree
  inside one account.
- **Attribution as data:** creator + venue on every spec; CC-BY carried on published versions.
- **Identity:** `users ↔ venues` is **many-to-many** (with roles); venues are first-class,
  followable.
- RLS already isolates per-user data — keep new tables RLS-correct from the start.

---

## Visual identity — glass, with a chromatic whisper
A **glass UI** with **subtle chromatic aberration** — not a prism, not flat glassmorphism. Glass
is the aesthetic; the colour is a whisper that only appears where light would actually disperse:
the edges. Restraint is the whole point — if the chroma is the first thing you notice, it's too
loud. (Reference mock: `proof-glass-refined`, not the louder first pass.)

**Tokens**
- **Ground** `#0C0B14`, with soft blurred light blooms — indigo `#3a3380`, teal `#1d5f72`, plum
  `#5a2a66` — at low opacity (~0.3). They exist *only* so the glass has something to refract;
  keep them quiet.
- **Glass material:** fill `linear-gradient(168deg, rgba(255,255,255,.085), rgba(255,255,255,.025))`,
  `backdrop-blur(24px) saturate(135%)`, `1px` border `rgba(255,255,255,.14)`, soft drop shadow
  for depth.
- **Edge dispersion (the signature, subtle):** a faint cyan inner edge on one side
  `rgba(120,225,255,.42)` and magenta on the other `rgba(255,135,210,.36)`, plus a top light
  `inset 0 1px 0 rgba(255,255,255,.22)`. This is the only chroma on the card.
- **Aberration on display type:** a sub-pixel fringe only — `text-shadow: -.4px 0 rgba(120,225,255,.42), .4px 0 rgba(255,135,210,.36)`. Felt, not seen.
- **Gauges:** clean — white `JetBrains Mono` numerals, a faint cyan `#7FE6FF` on the unit, **no
  glow**.
- **Lineage edges:** thin (~1.6px) soft cyan→magenta stroke at reduced opacity; no neon.

**Type:** Bricolage Grotesque (display), Inter Tight (UI), JetBrains Mono (data/gauges).

**Principle:** spend the restraint everywhere. The glass and its edge-dispersion are the
identity; keep motion to a slow, faint sheen (respect reduced-motion). The **SpecPanel should be
calmer/more opaque** than the canvas nodes so you're not editing a recipe "through frost." Two
dials to tune intensity if needed: the edge-dispersion opacity and the title fringe — err
fainter.

---

## "Feels great" acceptance signals (anti-clunk guardrails)
A plan isn't done until these hold:
- New spec + first ingredient in ≤ 3 interactions via the radial.
- GP / cost readout updates effectively instantly on edit.
- Switching the active costing model re-renders every node's headline at once.
- The radial works and is context-correct on canvas, node, and component.
- **No `alert` / `prompt` / `confirm` anywhere** — real in-app surfaces only.
- Dragging a node never snaps back; selection never rebuilds the whole node array.
- Publishing a spec makes it findable in search and forkable from the radial.
- A forked drink preserves attribution and its full ancestry to the root — the chain never
  breaks, even after the parent is edited.

---

## Scope line — v1 vs deferred
The first version that ships to real bartenders. Build the v1 list; keep the deferred list in
mind only so v1 choices don't block it.

**v1 — build now:**
- Private **invent + cost** loop (canvas, radial, spec panel, formula library).
- **Publish** a drink to the commons; **fork** it — including cross-user — with attribution and
  permanent lineage.
- **Community ingredient catalogue** + per-user cost override.
- **Desktop + tablet** (touch-first).
- **Ingestion** (paste / scan a recipe → spec) as the onboarding on-ramp.

**Deferred — schema-aware, do NOT build yet:**
- Ratings + comments; follows; the people-first discovery feed.
- Venue rosters / profile pages UI.
- Moderation tooling and reputation.
- Monetisation (free for now — no paywalls).
- Any **AI beyond ingestion** (no creative collaborator, auto-riffs, or auto-costing).

---

## Non-goals (resist scope creep)
- Not a POS / till; no live stock or inventory depletion.
- No **real-time co-editing** — collaboration is *async, via forking*, not Google-Docs-style.
- No **AI creative collaborator** — AI is ingestion only.
- No nested preps (preps inside preps) this generation — keeps cost rollup to two clean levels.
- No native apps — responsive web (desktop + tablet) is the target.
- No monetisation work for now.

---

## How to use this when planning
Before writing a `PLAN.md` phase: (1) name the Pillar(s) it serves; (2) check it moves an
acceptance signal; (3) confirm it's on the **v1 scope line** (or flag it as deferred); (4) if it
touches cost, use the formula registry and the catalogue/override split, don't hard-code; (5) if
it touches creation, route through the radial; (6) if it adds chrome, keep it calm so the glass
stays the signature; (7) never bake in single-user assumptions that block the social schema.
Anything that fails these is out of scope until justified here.