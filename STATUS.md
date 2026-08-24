# STATUS.md — where Proof actually is

Read `VISION.md` for what and why, `PLAN.md` for the phase breakdown, `CLAUDE.md` for the rules.
This file is the honest snapshot: what just changed, and what is genuinely left.

**Last updated:** 2026-08-24 · branch `feat/iba-commons-seed` · [PR #1](https://github.com/leonardostokes24/Cocktail-Playground-main/pull/1)

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

> ⚠️ **`PLAN.md` is out of date.** All 39 of its checkboxes are unticked, including work that is
> clearly finished (the radial menu, the migrations, publish, fork, the lineage RPC). Trust the
> list below over the checkboxes until someone reconciles the two.

### Actually missing — not built at all

| Thing | Where it belongs | Notes |
|---|---|---|
| **Export to PDF / Excel** | `src/utils/export.ts` | File doesn't exist. `jspdf` and `xlsx` are already installed. |
| **Recipe ingestion** | `src/utils/ingestion.ts` | File doesn't exist. This is what the pad's greyed-out *Ingest* action is waiting for. |
| **Catalogue search UI** | `CatalogueSearch.tsx` | The queries exist (`lib/supabase/catalogue.ts`); the surface to use them doesn't. |
| **Venues** | `queries/venues.ts` + minimal UI | Tables exist from migration 0002; no code touches them. |

### Built but unproven

These are written and appear to work, but nothing has confirmed them:

- **Touch long-press on a real device.** Everything so far was mouse or simulated. The 300ms
  press-and-hold on a real finger has never run. Needs a tablet or BrowserStack at 768px.
- **60fps with 100+ nodes.** The CLAUDE.md benchmark gate. Never measured.
- **The two-account round trip** — publish, find by search, fork, edit the fork, and confirm the
  ancestry and credit survive every step. This is Phase 4's own definition of done.
- **Reduced-motion and reduced-transparency** rendering. The CSS is written; nobody's looked at
  it with those settings on.

### Smaller open questions

- **The dimming behind the pad** is set fairly light, so canvas text stays faintly readable
  through it. Easy to push darker if it reads as muddy.
- **Twist numbers renumber on delete** (see above) — fine if they mean "the Nth twist right
  now", wrong if a twist should keep its number permanently.
- **PR #1 is large** — 60 files, ~9.4k added. The three most recent commits are individually
  bisectable if a commit-by-commit read is easier.

---

## Current state of the checks

`typecheck` 0 errors · **87 tests green** · `vite build` clean.

Driven by hand in the running app: the pad opens and commits by click, keyboard, numpad, and
press-drag-release; adding an ingredient works from menu to finished recipe line; twists number
correctly; the delete warning counts detaching twists correctly. Text contrast was measured on
every state of the pad, which caught two failures that were then fixed.
