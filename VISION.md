# VISION.md — Proof

**The what and the why.** `CLAUDE.md` holds the how, `PLAN.md` holds what's next. If a plan
or a rule contradicts this file, this file wins — and the contradiction gets fixed, not
worked around.

Rewritten 2026-08-24 from scratch. The previous version described the app through the
controls it happened to have, so two redesigns made it false. This one describes what Proof
is for. Only two implementation facts appear below, and only because they are load-bearing.

---

## The end goal (one paragraph)

Proof is an **open network for cocktail R&D**, built for working bartenders. You invent on a
**private lineage canvas** — branch a riff off any spec and the family tree shows how the idea
evolved — and **cost it honestly** as you build, in real UK on-trade terms (ex-VAT GP%). When
a drink is worth sharing you **publish it to a public commons** (CC-BY): anyone can **fork**
it, and the lineage is preserved **forever, across creators**. It runs behind a bar, on a
tablet, in a dim room, mid-service. If it feels clunky it's wrong, regardless of feature
completeness. The one asset nobody else has is the **cross-creator fork lineage** — protect it.

---

## Market position

Proof occupies an **empty quadrant: creation-first + open/social**.

- **Operations-first tools** — Backbar, WISK, BevSpot, Partender, MarginEdge — treat a recipe
  as a cost object for variance control. Creation is an afterthought; there is no lineage.
- **Reference and social apps** — Difford's Guide, Kindred Cocktails, Untappd — are flat
  recipe lists. No branching, no evolution, no forking with preserved credit.

Neither category has visual version-control for drinks, or cross-creator forking with
permanent attribution. That space is Proof's, and defending the boundary matters: the moment
Proof becomes a worse stock system, it loses the only ground it holds.

---

## Pillars

Every plan serves at least one. A task that serves none gets cut.

**1. Speed of capture.** Right-click or `⌘K`, type to act or search, enter. A spec and its
first three ingredients with **no traditional form**. Friction is the enemy — the measure is
interactions, not features.

**2. Lineage is the spine.** The canvas shows how drinks relate and evolve. Branching is the
core verb. Published lineage is permanent and crosses creators.

**3. Costing you can trust — UK-native.** Ex-VAT GP% as the first-class metric, not a US
pour-cost port. The community catalogue supplies the ingredient and a *reference* price; your
own cost drives GP, so **your margins stay private**. With 2025–26 cost pressure, per-drink GP
discipline is the trade's live problem — costing driven by creation is the differentiator.

**4. Character.** Proof must not look like bar software. The identity is **paper, ink and one
crimson** — flat card stock, hairline rules, a serif for names and mono for every number. It
is load-bearing, not decoration, and it is settled: changing it means changing this file.

**5. An open commons that compounds.** Private R&D → publish (CC-BY) → others fork → lineage
grows across everyone. The network is the moat.

**6. Works behind the bar.** Tablet and desktop are equal targets. Touch-first, legible in a
dim room, usable one-handed during service.

---

## Definition of done

**One working bartender uses Proof for a week, with their own drinks, and comes back.**

Not a feature list, not a demo. That means deployed, reachable, enterable and trustworthy
enough that somebody who is not you chooses it over the notebook they already have.

Everything in `PLAN.md` is ordered by what that sentence requires.

---

## Scope

**Core — must work for the week**

- Canvas, lineage and branching — the private invent loop.
- Costing and GP, live as you build, **including the work of getting prices in**.
- Ingestion — paste a recipe, get a spec. The realistic way an existing menu arrives.
- Export — PDF and CSV. Getting drinks back out is part of using them.
- The capture menu (Pillar 1) and the paper identity (Pillar 4).

**Present, but not on the critical path**

The commons — publish, fork, cross-creator lineage, catalogue, venue attribution. It is the
moat and it stays working and seeded, but no milestone blocks on it. One bartender in one week
never forks a stranger; the asset still has to be protected while that's true.

**Deferred — do not build, do not block on**

Ratings · comments · follows · discovery feed · venue pages · moderation.

---

## Non-goals

Each is a test to apply to a feature, not a category to avoid.

- **Nothing that only works with perfect data.** Every screen must be useful with half the
  prices missing, because that is the state every real ingredient library is in.
- **Nothing that requires the bar to maintain a list it doesn't already keep.** A feature that
  needs somebody to keep a new record current dies in week two.
- **No interaction that assumes a mouse, a quiet room and two free hands.** Tablet, dim room,
  mid-service, one hand, wet fingers.
- **Nothing that blocks the work.** No required field, no modal that must be answered before
  you can write a drink down. Half a spec is a legitimate state.
- **No feature that can lose someone's work.** A dropped connection behind a bar is normal,
  not an error case.
- **No feature that only pays off at a scale we don't have.** Feeds, reputation and
  recommendation cost the same to build at one user as at ten thousand, and are worth nothing
  at one.
- **Nothing that is impressive in a demo and useless on a Tuesday.**
- **No software words a bartender wouldn't say out loud.** Specs, twists, builds, preps and
  pours — not nodes, entities or records.
- **Nothing that duplicates a tool the bar already trusts, unless we are plainly better at
  it.** A bar running stock elsewhere doesn't need a worse second stock system — but it may
  well want the drink costed here to leave in a form its other tools can read.
- **No claim we can't stand behind.** GP targets are the user's and never asserted;
  attribution grants credit and never ownership; a suggested price is a suggestion and never
  silently becomes a cost.

**AI line.** AI may read and structure what the user already wrote. It may not invent recipes,
prices or names. Ingestion and substitution hints from your own library are in; generated
drinks and generated costs are out. That line is what protects Pillar 3.

---

## Reversible decisions

In force, but not settled the way the pillars are. A future agent may revisit these with
reason; it may not revisit the pillars.

- **Vertical lineage** — parent above, twists below, orthogonal edges.
- **Groups** — derived hulls around a lineage family, draggable and deletable.
- **Nested preps** — now permitted in principle, scheduled after the week. It reverses a ⚑
  rule and touches the money path, so it is not a casual change.
