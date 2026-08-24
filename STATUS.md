# STATUS.md — where Proof actually is

Read `VISION.md` for what and why, `PLAN.md` for the phase breakdown, `CLAUDE.md` for the rules.
This file is the honest snapshot: what just changed, and what is genuinely left.

**Last updated:** 2026-08-24 (second pass) · branch `feat/iba-commons-seed` · [PR #1](https://github.com/leonardostokes24/Cocktail-Playground-main/pull/1)

---

## What just changed

### The canvas menu was rebuilt

**The radial menu was never deleted — it was unreachable.** Opening a menu forced the plain
list fallback whenever `isFirstRun` was true, and the only thing that cleared that flag was a
small button *inside* the fallback. So a fresh browser profile got the list menu forever and
never saw the radial at all. That gate is gone.

In its place is the **command pad**: a 3×3 grid that opens where you click, instead of a wheel.

- Square, but it keeps the thing that makes a radial menu fast — **every action always sits in
  the same direction**, so your hand learns it and you stop reading the labels.
- **The numpad works**: `7 8 9 / 4 6 / 1 2 3` map onto the nine cells exactly as they look. A
  circle can't offer that.
- The **centre names what you're acting on** — the drink's name, not the action. It's the still
  point the actions are arranged around.
- **It isn't a box.** No frame, no card. The actions float over the canvas, and only the one
  you're pointing at fills in with colour.
- Works by click, by hover, by keyboard, and by press-drag-release (hold, flick toward an
  action, let go).

Emoji icons are gone — they render differently on every OS and can't take a colour, so they
always looked like placeholders. Replaced with drawn icons.

**Library and Preps now open from the pad**, and the **Prep category works** when adding to a
recipe. Only *Ingest* is still greyed out, because there's nothing behind it yet.

### Twists are numbered

Every branch used to read just `Twist`. On a canvas with six of them that told you nothing.
They now read `Twist 1`, `Twist 2` … numbered across the whole family tree in the order you
made them, so no two cards in a lineage share a label.

Note: the numbers are **positional, not permanent**. Delete `Twist 2` and the old `Twist 3`
becomes `Twist 2`. If a twist should keep its number for life, that needs a stored column.

### Delete moved to the corner of each card — and got honest

There's now a small delete button on the top-right of every node. It asks once before it
commits, and disarms itself after a few seconds. It stays hidden until you hover or select the
card, so a hundred nodes don't look like a hundred delete buttons.

Because that makes deleting much easier to reach, **every delete now tells you what will
actually happen.** This matters more than it sounds:

> Deleting a spec **does not delete the twists hanging off it.** They survive — but they come
> loose and become roots. Your lineage comes apart without a single row being lost, and nothing
> used to warn you.

So a card with twists below it now says **"Delete? 2 detach"** instead of a bare "Delete?", and
the same wording appears in the pad, the fallback menu, and the multi-select bar. Selecting a
parent *and* its child together correctly counts as nothing detaching, because the child is
going too.

### Housekeeping

- `.DS_Store` was committed before `.gitignore` listed it, so the ignore rule never applied and
  it showed as changed forever. Untracked now.
- The dev-server config pointed the preview at port 5173 while the server runs on 3000.

---

## What's left

`PLAN.md` has now been reconciled against the code — **27 done, 6 partial, 5 open, 1 blocked**.
Every partial or open task carries a `→` line saying exactly what is missing.

### Built this pass

| Thing | Where |
|---|---|
| **Export to PDF and CSV** | `src/utils/export.ts`, buttons in the spec panel |
| **Paste-a-recipe ingestion** | `src/utils/ingestion.ts` + `IngestPanel.tsx` — the pad's *Ingest* action is live |
| **Catalogue browse + import** | `CatalogueSearch.tsx`, reachable from the Cost Library |
| **Venues** | `lib/supabase/venues.ts` + `VenuePanel.tsx` — create / join / leave |
| **Fork vs branch edges** | Dashed magenta fork edge vs solid branch; `FORK` badge for off-canvas sources |

Two deliberate deviations, both flagged rather than silent:

- **CSV, not `.xlsx`.** CLAUDE.md's stack line says xlsx, but npm's copy of SheetJS stops at
  0.18.5 with an unpatched prototype-pollution advisory — the project moved distribution off
  npm. CSV needs no dependency and opens directly in Excel. Cells beginning `=`, `+`, `-` or `@`
  are escaped so an ingredient name can't execute as a formula.
- **Ingestion uses no AI.** CLAUDE.md permits it *for* ingestion but doesn't require it. A
  recipe line is a quantity, a unit and a name — a parser handles that exactly, offline, with
  no key and no latency, and reports the lines it couldn't read instead of guessing.

### Still open

- **Unpublish** — flips `specs.visibility` only, with copy explaining the snapshot persists for
  forks. Not built.
- **Recents-first** in the pad's search was never implemented.
- **The pad's search doesn't query the catalogue** — own ingredients and preps only.
- **No test proves the `published_specs` immutability trigger rejects an UPDATE.**

### Built but unproven

- **Touch long-press on a real device.** Everything so far was mouse or simulated pointer
  events. Needs a tablet or BrowserStack at 768px.
- **60fps with 100+ nodes** — the CLAUDE.md benchmark gate, never measured.
- **The two-account round trip** — publish, search, fork, edit, and confirm ancestry and credit
  survive. This is Phase 4's own definition of done.
- **Reduced-motion / reduced-transparency** rendering.
- **Vercel smoke test** — `vite build` is clean locally; the deployed build hasn't been checked.

### Smaller open questions

- **The dimming behind the pad** is light, so canvas text stays faintly readable through it.
- **Twist numbers renumber on delete** — fine if they mean "the Nth twist right now", wrong if a
  twist should keep its number permanently. The latter needs a stored column.
- **Ingested ingredients get 0% ABV.** A paste can't tell us strength, and unlike cost there's
  no "unknown" badge for ABV — the node just shows a low number until you set it. The ingest
  panel says so, but a proper unknown-ABV state would be better.

---

## Current state of the checks

`typecheck` 0 errors · **118 tests green** · `vite build` clean.

Driven by hand in the running app: the pad opens and commits by click, keyboard, numpad, and
press-drag-release; adding an ingredient works from menu to finished recipe line; twists number
correctly; the delete warning counts detaching twists correctly. Text contrast was measured on
every state of the pad, which caught two failures that were then fixed.

Second pass, also driven by hand: pasting a recipe reads the amounts, method, glass and garnish,
flags the line it can't parse, and creates the spec; the catalogue import shows the community
price as prose and leaves the price box empty, so importing without typing a price yields an
unpriced ingredient rather than someone else's cost; the venue panel opens with its three tabs.
