# VISION.md — Proof

The north star. **Claude Code: read this before writing any plan.** Every phase, task, or
feature must ladder up to a goal here. This file is the *what & why*; `CLAUDE.md` is the *how*;
`PLAN.md` is the *when*. When you write a plan, state which Pillar(s) each phase serves.

---

## Market position
Proof occupies an **empty quadrant: creation-first + open/social**. Bar operations tools (Backbar, WISK, Partender) are inventory-first — recipes are cost objects for variance control, not creative artifacts. Cocktail reference/social apps (Difford's Guide, Kindred Cocktails, Untappd) are flat recipe lists — no branching, no lineage, no forking. Neither category has visual version-control or cross-creator forking with preserved attribution. That space is Proof's.

---

## The end goal (one paragraph)
Proof is an **open network for cocktail R&D**, built for working bartenders. You invent on a
**private lineage canvas** — branch a riff off any spec and the family tree shows how the idea
evolved — and **cost it honestly** as you build, in real UK on-trade terms (ex-VAT GP%). You
work through **fast radial menus**, never wading through forms. When a drink is worth sharing
you **publish it to a public commons** (CC-BY): anyone can **fork** it, and the lineage is
preserved **forever, across creators**. It runs equally on desktop and tablet behind the bar,
in a restrained **glass-with-a-chromatic-whisper** identity, and it feels *fast and tactile*.
If it feels clunky, it's wrong — regardless of feature completeness. The one asset nobody else
has is the **cross-creator fork lineage**; protect it above all.

---

## Where Proof sits (the empty quadrant)
Bar software today splits into two worlds, and **neither does what Proof does**:

- **Operations-first tools** — Backbar, WISK, BevSpot, Partender, MarginEdge — treat a recipe
  as an *inventory cost object* for variance control. Costing exists, creation doesn't.
- **Reference & social apps** — Difford's Guide, Kindred Cocktails, Untappd — store *flat
  recipes*. Kindred even has an "altered recipe" flag and attribution guidelines, but no
  lineage graph, no fork mechanic, no costing. Untappd proves bartenders and venues will
  engage socially at scale (1.5bn+ check-ins, ~20k venues) — around *finished* drinks, never
  around how a drink was developed.
- **"GitHub-for-recipes" attempts** (Forkful, dishout.recipes, Recipe Commons) prove latent
  demand for recipe versioning but all failed the same way: they required Git literacy.
  Proof delivers the fork-lineage mental model through a **bartender-native visual canvas**,
  not Git mechanics.

**Proof's quadrant — creation-first AND open/social — is empty.** No product offers visual
version-control of drink specs, cross-creator forking with attribution, or creation-driven
UK-native costing. That's the wedge.

## Why the commons will work (culture, not law)
- **Recipes are not copyrightable** (ingredient lists are facts, UK & US). Only names can be
  trademarked and prose/photos copyrighted. A CC-BY commons is legally clean.
- Bartending already runs on **riff-with-credit**: the Penicillin and Paper Plane are
  celebrated *because* they're riffed worldwide with the creator's name attached. Proof
  **formalizes an existing culture** — it preserves *attribution*, never claims *ownership*.
  (The Pusser's/"Painkiller" cease-and-desist backlash is the cautionary tale: heavy-handed
  IP enforcement is community poison. Proof does the opposite.)
- Commons T&Cs must license user prose/photos (copyrightable) via CC-BY separately from the
  spec itself (not copyrightable anyway).

---

## Pillars (the few things every plan serves)
1. **Speed of capture.** Radial-first creation. A spec and its first three ingredients with no
   traditional form. Friction is the enemy.
2. **Lineage is the spine.** The canvas shows how drinks relate and evolve. Branching is the
   core verb; published lineage is **permanent and crosses creators**.
3. **Costing you can trust — UK-native.** Ex-VAT GP% as the first-class metric (not a US
   pour-cost port). Community catalogue gives the ingredient + *reference* price; your own
   cost override drives GP, so **your margins stay private**. With 2025–26 cost pressure
   (employer NICs up to 15%, energy), per-drink GP discipline is the industry's live problem —
   creation-driven costing is a differentiator, not a bolt-on.
4. **Character.** The glass identity is load-bearing, not decoration — but restrained, on
   small surfaces, never at the cost of legibility behind a dim bar.
5. **An open commons that compounds.** Private R&D → publish (CC-BY) → others fork → lineage
   grows across everyone. The network is the moat.
6. **Works behind the bar.** Desktop and tablet are equal, first-class targets — touch-first,
   legible in a dim room.

---

## Core interaction — the smart radial menu
The primary way you touch the app.

- **Invocation:** right-click (desktop) / long-press 300ms then drag-to-segment, release to
  select (touch) / hotkey. Opens **anchored on the touched object** (reduces errors, per
  radial-menu research).
- **Max 6–8 segments per ring** (accuracy limit from the research). More options = sub-rings.
- **Context-aware:** empty canvas → New spec · Search commons (fork) · Quick-ingest · New prep.
  Spec node → Branch/Riff · Add component (ingredient sub-ring) · Open recipe · Duplicate ·
  Publish · Delete. Component → Edit amount · Swap · Convert to prep · Remove.
- **Smart:** type-ahead at centre searches your ingredients, the community catalogue, and the
  commons at once; recents surface first; eight ingredient-category segments.
- **Learnability is the known weakness** of radial menus — ship onboarding hints and a
  conventional context-menu fallback so new users are never stranded. Full keyboard access.
- **Success test:** create a spec and add three ingredients using only the radial.

---

## Costing & GP system (validated against UK trade practice)
- **Cost flow:** ingredient `pack_cost ÷ pack_size_ml` → prep rollup (÷ yield) → pour cost →
  modifiers → chosen formula.
- **Modifiers:** garnish/sundries as fixed £ per serve; waste % (default 5%, range 5–20% —
  costing on theoretical bottle yield understates cost by ~1pt); both user-editable.
- **GP is calculated on the EX-VAT price.** Menu price ÷ 1.20 → net; GP% = (net − cost)/net.
  This is the UK on-trade standard (Franklin & Sons, Inn Express both explicit). **VAT rate is
  a configurable setting defaulting to 0.20** — correct today, but policy is politically live
  (UKHospitality lobbying for 10%), so never hard-code it.
- **Formula library, user-selected:** GP% ex-VAT (default) · pour cost % (US complement) ·
  cash margin £ · markup × · reverse target-GP price · reverse target-pour-cost price.
  Registry-based; the node shows the chosen headline, the panel shows all.
- **Targets are user-set, never hard-coded.** The industry disagrees with itself: pricing
  guides say aim 70–80% GP on cocktails; measured pub wet GP lands 49–58% (BBPA), cocktail
  lounges ~62%. Proof shows *your realized* GP against *your* target and editorializes neither.
- **Dilution** (affects volume/ABV and batch water, never cost): shaken ~25%, stirred ~20–25%,
  built ~10% — user-editable defaults, with Dave Arnold's weigh-before-after method as the
  precision path for batching. Batch view shows the water line explicitly.

---

## Social commons & identity
- **Private R&D by default.** Nothing is public unless you publish it.
- **Publishing creates an immutable snapshot.** A published version can never be edited —
  that's the guarantee that makes cross-creator lineage trustworthy. Corrections = publish a
  new version.
- **Licence: CC-BY.** Fork and use freely, attribution required. Attribution is *data*
  (creator + venue travel with the spec), not a text field.
- **Fork lineage is permanent and root-traceable across all users.** This is the moat.
- **Identity = people and venues, linked** (many-to-many, roles). Both followable — later.
- **Deferred but schema-aware:** ratings/comments (Untappd-style), follows, discovery feed,
  venue profiles, moderation, monetisation.

---

## Visual identity — glass, with a chromatic whisper
Restrained glass UI with subtle chromatic aberration at the edges only. **If the chroma is the
first thing you notice, it's too loud.** Research adds hard guardrails: `backdrop-filter` is
GPU-expensive and an accessibility risk, so **glass lives only on small floating surfaces**
(nodes, radial, panel chrome) — never behind body text or full-screen; solid fallbacks;
respect reduce-transparency/reduce-motion. Tokens and anatomy live in `CLAUDE.md`; reference
mock `proof-glass-refined.html`.

---

## Scope line — v1 vs deferred
**v1:** private invent + cost loop (canvas, radial, formula registry) → publish → fork
(cross-user, attributed, permanent) → community catalogue with private cost overrides →
desktop + tablet → ingestion (paste a recipe → spec) as onboarding.
**Deferred (do not build; don't block):** ratings, comments, follows, discovery feed, venue
pages, moderation, monetisation, any AI beyond ingestion.

## Non-goals
Not a POS or inventory/variance tool (that's Backbar/WISK's fight — don't pick it). No
real-time co-editing (collaboration is async, via forking). No nested preps. No native apps.
No AI creativity. No monetisation work.

---

## "Feels great" acceptance signals (anti-clunk guardrails)
- New spec + first ingredient in ≤ 3 radial interactions.
- Cost readout updates instantly on edit; switching formula re-renders every node at once.
- Canvas holds 60fps at 100+ nodes (research benchmark — virtualize before adding features
  if it drops).
- Radial context-correct on canvas/node/component; fallback context menu exists.
- No `alert`/`prompt`/`confirm` anywhere.
- A fork preserves attribution and full ancestry to root, even after the parent is edited.
- Text on glass passes WCAG AA; reduce-transparency gets solid surfaces.

## How to use this when planning
(1) name the Pillar(s) served; (2) check it moves an acceptance signal; (3) confirm it's on
the v1 scope line; (4) cost → formula registry + catalogue/override split, never hard-coded;
(5) creation → through the radial; (6) chrome stays calm; (7) never bake in single-user
assumptions that block the social schema.
