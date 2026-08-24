# PLAN.md — Proof

**What's next, and where we actually are.** Read `VISION.md` for what and why, `CLAUDE.md` for
the rules. If a task here contradicts either, they win — fix this file.

Rewritten 2026-08-24. Replaces the old phase plan and `STATUS.md`, which had drifted apart
within a day of each other. One file, one truth.

## How to use this
- Milestones run in order. Each is gated on `lint` 0 · `test` green · `build` clean, plus its
  own condition.
- Mark `[ ] → [~] → [x]`, `[!]` blocked with the reason.
- A `→` line under a task is its current state. Keep it true or delete it.
- **Everything here is ordered by one sentence:** *one working bartender uses Proof for a week
  with their own drinks, and comes back.*

---

## Where we are

`lint` 0 · **140 tests green** · `build` clean.

**Migration 0008 is written but not applied.** Manual groups fail with a readable message
until it runs: `psql "$DATABASE_URL" -f supabase/migrations/0008_spec_groups.sql`

**Built and verified in the running app:** the lineage canvas with vertical top-to-bottom
routing and orthogonal edges · branching and twist numbering · the capture menu (right-click /
`⌘K`, type to act or search, amount entry, eight actions) · corner delete with detach warnings
· paper identity throughout · derived lineage groups, draggable and deletable · ingestion
(paste a recipe → spec) · catalogue browse and import · export to PDF and CSV · publish,
unpublish and fork with cross-creator lineage through the RPC · preps · venues (panel only).

**Built but never proven:** the two-account commons round trip · touch and long-press on real
hardware · 60fps at 100+ nodes · reduced-motion rendering · anything on a deployed build.

### Known broken
- Nothing known-broken. `Tidy` was fixed 2026-08-24.

### Repo state
Three branches form a **linear stack**, so consolidation needs no cherry-picking:
`master` → `feat/iba-commons-seed` (+22, PR #1 open) → `feat/vertical-ghost-groups` (+24,
never pushed) → `feat/proof-new-ui` (+32, contains everything).
`origin/main` also exists alongside `origin/master`; which is canonical is unresolved.

---

## M0 — Consolidate
**Done when:** one trunk, docs true against it, nothing known-broken merged in silence.

- [x] Fix `Tidy`.
      → the defect was a ref mutated inside a React state updater; StrictMode double-invokes
      updaters, so the second pass discarded the layout. Also replaced the √n grid with a
      real vertical tree, and made it work with nothing selected.
- [ ] Merge `feat/proof-new-ui` to `master`; close PR #1 as subsumed.
- [ ] Resolve `origin/main` vs `origin/master`.
- [ ] Delete the two retired branches. Delete `STATUS.md`.
- [ ] Re-verify the three docs against merged `master`.

## M1 — Deploy
**Done when:** a stranger can reach it, sign in, and see a seeded commons.

- [ ] **Resolve `GEMINI_API_KEY` first.** `vite.config.ts` inlines it into the client bundle;
      anything public exposes it. Move it behind a function or remove it.
- [ ] Vercel project, environment variables, production Supabase.
- [ ] Apply migrations 0004–0007 in order; run `supabase/tests/immutability.sql`.
- [ ] Smoke-test the production build — never done.
      → needs credentials only the owner has.

## M2 — First run
**Done when:** a new account lands somewhere it understands and can act from.

- [ ] A seeded example lineage on an empty canvas — one drink, one twist, one fork, so
      branching explains itself.
- [ ] The empty state is an invitation, not a dead end.
- [ ] One pass that teaches the menu without a tour: right-click, type, enter.

## M3 — The pricing workflow ⚑
**Done when:** GP is trustworthy without anyone doing invisible data entry.

This is the pillar the app currently claims and does not honour. Ingredients arrive unpriced
from ingestion and from the catalogue, GP reads `unpriced`, and nothing ever asks.

- [ ] Surface what's unpriced, at the point it costs you the number — not in a settings screen.
- [ ] Price several ingredients in one pass; a spec should become costed in one sitting.
- [ ] Ingested ingredients get 0% ABV as well as no price — unlike cost, nothing flags that.
- [ ] Wire venue attribution into publishing: `publishSpec` passes `venueId: null` today, so
      half of "attribution is data" silently doesn't happen.

## M4 — Menu scale
**Done when:** twenty drinks is as comfortable as one.

- [ ] Ingest a whole menu in a sitting, not a drink at a time.
- [ ] Duplicate, re-price and re-cost across many specs.
- [ ] The canvas stays readable at that size — this is where the 60fps gate gets measured.

## M5 — Survive a dropout
**Done when:** losing wifi mid-service costs nothing.

- [ ] Optimistic writes with a retry queue; an in-flight edit is never lost.
- [ ] Failures say what happened and what to do, and never silently discard.
      → deliberately **not** offline-first. A local database with sync stays out.

## M6 — Tablet reality
**Done when:** it is genuinely usable behind a bar.

- [!] Long-press and touch on real hardware — blocked, needs a device or BrowserStack.
- [ ] 44px targets at 768 and 1024; pinch and pan intact.
- [ ] Legible in a dim room, one-handed, mid-service.
- [ ] `prefers-reduced-motion` honoured.

## M7 — The week
**Done when:** the definition of done in `VISION.md` is met.

- [ ] Put it in front of one working bartender with their own drinks.
- [ ] Watch what they don't use, and what they reach for the notebook to do instead.
- [ ] Come back to this file and rewrite it from what happened.

---

## After the week

Not before. Each is real work, none of it serves M7.

- **Nested preps** — reverses a ⚑ rule, needs a migration (`ingredient_id` nullable +
  `child_prep_id` + XOR + cycle guard), a recursive `prep_costs`, and a change to the cost
  engine's money path.
- **The two-account commons round trip** — publish, search, fork, edit, ancestry and credit
  intact. Phase 4's old definition of done, demoted because one bartender never forks a
  stranger.
- **Group-to-group links** — needs `0008_spec_group_links`. Anchor links to member spec ids,
  not to a root, so a group splitting doesn't strand them.
- **AI within the line** — substitution hints from your own library. Read and structure, never
  invent.

## Reversible decisions
Vertical lineage · derived groups · nested preps being permitted at all. In force, revisitable
with reason. The pillars in `VISION.md` are not.
