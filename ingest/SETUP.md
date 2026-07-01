# Cocktail app — setup guide (fresh start, keyword search)

Three stores: a shared searchable **library** (`cocktails`), each user's **saved drinks**
(`saved_cocktails`), and each user's **canvases** (`canvases`). Search runs on Postgres
full-text plus the flavour tags Claude generates at ingest — no embeddings provider needed.

Files: `schema.sql`, `search.sql`, `ingest.js`, `package.json`, `route.ts`.
(The old `hybrid_search.sql` is gone — `search.sql` replaces it.)

---

## What you need first

- Node 18+ (20.6+ to use `--env-file` without a dotenv package).
- Your Supabase project, with **Auth enabled** (saved drinks + canvases key off logged-in users).
- A free **Gemini API key** from aistudio.google.com (no credit card), plus your Supabase URL +
  two Supabase keys. No paid API needed.

---

## Step 1 — Supabase URL and keys

**Settings → API Keys.** Either generation works:
- New: `sb_publishable_…` (public, app) and `sb_secret_…` (secret, server-side).
- Legacy: `anon` (public) and `service_role` (secret).

Project URL is in the **Connect** dialog. The secret key never ships to the browser.

---

## Step 2 — Create the schema  ⚠️ wipes the old tables

`schema.sql` opens with a destructive RESET that drops your current `cocktails`/`canvases`.
Back up first or comment that block out.

1. SQL Editor → New query → paste `schema.sql` → **Run**.
2. New query → paste `search.sql` → **Run**.

Table Editor should now show `cocktails`, `saved_cocktails`, `canvases`. Grants are in the SQL.

---

## Step 3 — Ingest project on your laptop

`ingest.js` + `package.json` in a folder, `npm install`, then `.env`:

```
GEMINI_API_KEY=AIza...
SUPABASE_URL=https://yourref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...      # or legacy service_role
```

---

## Step 4 — Fill the library

`--source` is required. Dry run, review, then commit:

```bash
node --env-file=.env ingest.js ./pdfs/iba-cocktails.pdf --source "IBA"
node --env-file=.env ingest.js ./pdfs/iba-cocktails.pdf --source "IBA" --commit
```

Repeat per source ("Dead Rabbit", "Milk & Honey", ...). Same drink from different sources
coexists (unique on name + source); re-running a source updates rather than duplicates.

Notes:
- Ingredients stored as `[{"name":"gin","amount":60,"unit":"ml"}]`. If your canvas expects a
  different shape, say so and I'll match it.
- Spend a moment on the dry-run `keywords` — those tags are what makes "smoky" or "bitter"
  searches work, so good tags = good search.
- The script auto-splits the PDF into page-chunks, so size isn't an issue. If a chunk ever fails,
  lower it with `--chunk 10`. Gemini's free tier (≈15 requests/min) easily covers this.

---

## Step 5 — Search from the app

`route.ts` → `app/api/search/route.ts`. In `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://yourref.supabase.co
SUPABASE_ANON_KEY=sb_publishable_...          # or legacy anon
```

Test:

```bash
curl "http://localhost:3000/api/search?q=smoky%20bitter"
```

Saving drinks/canvases happens client-side with the logged-in user's session
(`supabase.from('saved_cocktails').insert(...)` / `canvases`); RLS ties each row to the user.

---

## If you want stronger "vibe" search later

Keyword + Claude's tags covers a lot, but true free-text semantic search ("a low-sugar drink
that drinks like autumn") needs vectors. Two no-new-paid-key options when you're ready:

- **Claude query expansion** — at search time, send the user's phrase to Claude and have it
  return tsquery terms + tags, then search those. Uses only your Claude key, but costs one small
  Claude call per search.
- **Local embeddings** — run a free embedding model on your Mac (Transformers.js in Node, or
  Ollama's `nomic-embed-text`) to generate vectors at ingest and at search time. No per-search
  cost, but adds a local model to the pipeline.

Either is a bolt-on; the current schema doesn't need to change much. Ask when you want one.

---

## When something doesn't work

- **Search returns nothing** → no library rows match. Confirm rows exist in the Table Editor and
  that you ran with `--commit`.
- **Saved/canvas insert fails** → the request isn't authenticated; those calls must run with the
  user's Supabase session, not the bare anon key.
- **Library readable by anyone** → the `cocktails` policy is `using (true)`. To restrict to
  logged-in staff (and keep book-sourced recipes out of public view), switch it to `to
  authenticated` and use an auth-aware client for the search route. Ask and I'll wire it.
