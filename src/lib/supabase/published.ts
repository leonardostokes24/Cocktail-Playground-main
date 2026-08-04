import { supabase } from './client';

// Component shape inside components_snapshot JSONB
export type ComponentSnapshot = {
  name: string;
  amount_ml: number;
  original_amount: number;
  original_unit: string;
  type: string;
  catalogue_id: string | null;
  abv: number;
  cost_per_ml_at_publish: number | null;
  note?: string | null;
};

// Row returned by public_specs_feed view (world-readable)
export type PublishedSpec = {
  id: string;
  name: string;
  method: string | null;
  glass: string | null;
  garnish: string | null;
  build_text: string | null;
  change_note: string | null;
  components_snapshot: ComponentSnapshot[];
  forked_from_id: string | null;
  published_at: string;
  creator_id: string;
  creator_name: string | null;
  creator_avatar: string | null;
  venue_id: string | null;
  venue_name: string | null;
  venue_slug: string | null;
  venue_city: string | null;
  lineage_depth: number;
};

// One row of a published spec's family tree, from get_spec_lineage() (0003).
export type LineageRow = {
  id: string;
  name: string;
  creator_id: string;
  venue_id: string | null;
  forked_from_id: string | null;
  published_at: string;
  relationship: 'self' | 'ancestor' | 'descendant';
  depth: number; // 0 = self, negative = ancestors, positive = descendants
};

// Cross-user lineage MUST come from this SECURITY DEFINER RPC (⚑). A plain read
// of published_specs is truncated by RLS to rows the caller can see, which
// silently breaks ancestry across creators — never walk the tree client-side.
export async function getSpecLineage(publishedId: string): Promise<LineageRow[]> {
  const { data, error } = await supabase.rpc('get_spec_lineage', { p_published_id: publishedId });
  if (error) throw error;
  return (data ?? []) as LineageRow[];
}

export async function listPublishedFeed(
  limit = 50,
  offset = 0
): Promise<PublishedSpec[]> {
  const { data, error } = await supabase
    .from('public_specs_feed')
    .select('*')
    .order('published_at', { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw error;
  return data as PublishedSpec[];
}

export async function searchPublished(q: string): Promise<PublishedSpec[]> {
  if (!q.trim()) return listPublishedFeed(50, 0);
  const { data, error } = await supabase
    .from('published_specs')
    .select(`
      id, name, method, glass, garnish, build_text, change_note,
      components_snapshot, forked_from_id, published_at, creator_id
    `)
    .textSearch('search_vector', q, { type: 'websearch' })
    .limit(30);
  if (error) throw error;
  // search_vector query hits published_specs directly — creator_name not available
  // Cast to Partial<PublishedSpec>[] and fill missing fields with nulls
  return (data as unknown[]).map((r) => ({
    ...(r as object),
    creator_name: null,
    creator_avatar: null,
    venue_id: null,
    venue_name: null,
    venue_slug: null,
    venue_city: null,
    lineage_depth: 0,
  })) as PublishedSpec[];
}

export type PublishedSpecInput = {
  specId: string | null;
  name: string;
  method: string | null;
  glass: string | null;
  garnish: string | null;
  buildText: string | null;
  changeNote: string | null;
  componentsSnapshot: ComponentSnapshot[];
  forkedFromId: string | null;
  venueId: string | null;
};

export async function insertPublishedSpec(
  input: PublishedSpecInput
): Promise<PublishedSpec> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('published_specs')
    .insert({
      spec_id: input.specId,
      creator_id: user.id,
      venue_id: input.venueId,
      name: input.name,
      method: input.method,
      glass: input.glass,
      garnish: input.garnish,
      build_text: input.buildText,
      change_note: input.changeNote,
      components_snapshot: input.componentsSnapshot,
      forked_from_id: input.forkedFromId,
    })
    .select()
    .single();
  if (error) throw error;
  return data as PublishedSpec;
}

export async function forkPublishedSpec(publishedId: string): Promise<{
  newSpecId: string;
  name: string;
  componentsSnapshot: ComponentSnapshot[];
  forkedFromPublishedId: string;
}> {
  const { data: source, error } = await supabase
    .from('published_specs')
    .select('name, method, glass, garnish, build_text, components_snapshot')
    .eq('id', publishedId)
    .single();
  if (error) throw error;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Create a new private spec forked from the published snapshot
  const { data: newSpec, error: specErr } = await supabase
    .from('specs')
    .insert({
      user_id: user.id,
      name: source.name,
      method: source.method,
      glass: source.glass,
      garnish: source.garnish,
      build_text: source.build_text,
      forked_from_published_id: publishedId,
      status: 'draft',
    })
    .select('id')
    .single();
  if (specErr) throw specErr;

  return {
    newSpecId: newSpec.id,
    name: source.name,
    componentsSnapshot: source.components_snapshot as ComponentSnapshot[],
    forkedFromPublishedId: publishedId,
  };
}
