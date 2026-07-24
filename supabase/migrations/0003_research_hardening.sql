-- =============================================================================
-- Proof — Migration 0003: research hardening
-- Builds on 0001 + 0002. Three fixes the research demands:
--   1. TRIGGER-enforced immutability on published_specs (absent RLS policy
--      is not enough — a definer function or future policy could slip through).
--   2. get_spec_lineage(): SECURITY DEFINER RPC for cross-user lineage.
--      Plain reads truncate ancestry to rows the caller can see under RLS;
--      public lineage must be traversed server-side. Uses PG15 CYCLE guard.
--   3. Weighted full-text search on published_specs (name > body).
-- =============================================================================

-- 1. Append-only enforcement -------------------------------------------------
create or replace function reject_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'published_specs is append-only: % not permitted', tg_op
    using errcode = 'raise_exception',
          hint = 'Publish a new version instead of modifying a published one.';
end $$;

create trigger published_specs_immutable
  before update on published_specs
  for each row execute function reject_mutation();
-- (deletes stay possible for the creator, guarded app-side for existing forks)

-- 2. Cross-user lineage RPC ----------------------------------------------------
-- Returns the full ancestry chain (self → root) and all descendants of a
-- published spec, across creators. SECURITY DEFINER so RLS on published_specs
-- does not truncate the walk; safe because published_specs is public-read
-- anyway — this only guarantees completeness, it exposes nothing private.
create or replace function get_spec_lineage(p_published_id uuid)
returns table (
  id uuid, name text, creator_id uuid, venue_id uuid,
  forked_from_id uuid, published_at timestamptz,
  relationship text,           -- 'self' | 'ancestor' | 'descendant'
  depth int                    -- 0 = self; ancestors negative walk, descendants positive
)
language sql
security definer
set search_path = public
stable
as $$
  with recursive
  ancestors as (
    select ps.id, ps.name, ps.creator_id, ps.venue_id, ps.forked_from_id,
           ps.published_at, 0 as depth
    from published_specs ps where ps.id = p_published_id
    union all
    select ps.id, ps.name, ps.creator_id, ps.venue_id, ps.forked_from_id,
           ps.published_at, a.depth - 1
    from published_specs ps
    join ancestors a on ps.id = a.forked_from_id
  ) cycle id set is_cycle using path,
  descendants as (
    select ps.id, ps.name, ps.creator_id, ps.venue_id, ps.forked_from_id,
           ps.published_at, 0 as depth
    from published_specs ps where ps.id = p_published_id
    union all
    select ps.id, ps.name, ps.creator_id, ps.venue_id, ps.forked_from_id,
           ps.published_at, d.depth + 1
    from published_specs ps
    join descendants d on ps.forked_from_id = d.id
  ) cycle id set is_cycle using path
  select id, name, creator_id, venue_id, forked_from_id, published_at,
         case when depth = 0 then 'self'
              when depth < 0 then 'ancestor' else 'descendant' end,
         depth
  from (
    select * from ancestors where not is_cycle
    union
    select * from descendants where not is_cycle and depth > 0
  ) t
  order by depth;
$$;

-- Authenticated users may call it (data is public-read anyway).
revoke all on function get_spec_lineage(uuid) from public;
grant execute on function get_spec_lineage(uuid) to authenticated;

-- 3. Weighted search vector -----------------------------------------------------
-- Replace the unweighted generated column from 0002 with name('A') > body('B').
alter table published_specs drop column if exists search_vector;
alter table published_specs add column search_vector tsvector
  generated always as (
    setweight(to_tsvector('english', coalesce(name,'')), 'A') ||
    setweight(to_tsvector('english',
      coalesce(method,'') || ' ' || coalesce(glass,'') || ' ' ||
      coalesce(build_text,'') || ' ' || coalesce(change_note,'')), 'B')
  ) stored;
create index if not exists published_specs_search_idx
  on published_specs using gin(search_vector);

-- Client usage: .textSearch('search_vector', q, { type: 'websearch', config: 'english' })
-- Rank ordering (ts_rank) belongs in an RPC if/when discovery needs it.
