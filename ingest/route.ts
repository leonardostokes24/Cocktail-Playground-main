// app/api/search/route.ts
//
// GET /api/search?q=smoky+sour
// Keyword search over the cocktails library. No embeddings, no extra API key.
//
// Env:
//   NEXT_PUBLIC_SUPABASE_URL   your project URL
//   SUPABASE_ANON_KEY          publishable / anon key (RLS applies)

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim();
  if (!q) return Response.json({ results: [] });

  try {
    const { data, error } = await supabase.rpc("search_cocktails", {
      query_text: q,
      match_count: 12,
    });
    if (error) throw error;
    return Response.json({ results: data });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
