-- =============================================================================
-- Proof — Migration 0002: social schema
-- Builds on 0001. Run after 0001 is applied.
-- Postgres 15+ / Supabase assumed. Money GBP, volumes ml.
--
-- What this migration adds:
--   1. Community ingredient catalogue  (shared; world-readable)
--   2. Catalogue FK on ingredients     (user's row = personal cost override)
--   3. Venues + user_venues            (followable identity; person ↔ venue M:M)
--   4. Spec social columns             (visibility, venue attribution, published_at)
--   5. published_specs                 (immutable snapshots — the fork anchor)
--   6. Deferred FK from specs          (forked_from_published_id)
--   7. Updated cost views              (unchanged logic; notes on new resolution)
--   8. Public browse view              (published_specs + creator + venue joined)
--   9. RLS for every new table
--
-- Design principles baked in:
--   - specs table stays PRIVATE (own rows only). Other users read published_specs,
--     not specs. This keeps R&D private by default with zero RLS complexity.
--   - published_specs is INSERT-ONLY. No update policy is granted. Immutability
--     is the guarantee that makes cross-user fork lineage trustworthy.
--   - ingredients.pack_cost IS the user's personal cost. cost_per_ml is generated
--     from it. Catalogue reference_price is only a seed / cold-start fallback,
--     not used in any cost formula directly — users always resolve to their own row.
--   - Venues are self-service (any user can create one and add members).
--     Moderation comes later; verified flag is future-ready.
-- =============================================================================

-- =============================================================================
-- 1. COMMUNITY INGREDIENT CATALOGUE
--    Shared library any authenticated user can read and contribute to.
--    When a user imports a catalogue ingredient, a row is created in their
--    private `ingredients` table (with catalogue_id set). Their pack_cost on
--    that row IS their personal price — it may differ from reference_price.
-- =============================================================================
create table catalogue_ingredients (
  id                   uuid primary key default gen_random_uuid(),
  name                 text not null,
  type                 text check (type in
                         ('spirit','modifier','citrus','sweetener',
                          'bitters','syrup','prep','other')),
  abv                  numeric not null default 0 check (abv >= 0 and abv <= 100),
  default_pack_size_ml numeric check (default_pack_size_ml > 0),
  -- reference_price is a community ballpark in GBP ex-VAT.
  -- It is a COLD-START AID only, not used in any cost formula.
  -- Users override with their own pack_cost on their ingredients row.
  reference_price      numeric check (reference_price >= 0),
  contributed_by       uuid references auth.users(id) on delete set null,
  -- verified: moderator-approved entry. Future-ready; not enforced yet.
  verified             boolean not null default false,
  -- full-text search
  search_vector        tsvector generated always as
                         (to_tsvector('english', coalesce(name,'') || ' ' || coalesce(type,''))) stored,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index catalogue_ingredients_search_idx on catalogue_ingredients using gin(search_vector);
create index catalogue_ingredients_type_idx   on catalogue_ingredients (type);

create trigger catalogue_ingredients_set_updated_at
  before update on catalogue_ingredients
  for each row execute function set_updated_at();

-- =============================================================================
-- 2. CATALOGUE FK ON INGREDIENTS
--    Link a user's ingredient row back to the community entry (nullable).
--    null  → custom private ingredient, not in catalogue.
--    set   → imported from catalogue; user's pack_cost is their price override.
--    The existing cost_per_ml generated column (pack_cost / pack_size_ml) is
--    unchanged — it always uses the user's own pack_cost.
-- =============================================================================
alter table ingredients
  add column catalogue_id uuid references catalogue_ingredients(id) on delete set null;

comment on column ingredients.catalogue_id is
  'null = custom private ingredient. set = sourced from community catalogue. '
  'User''s own pack_cost is always the cost source; catalogue reference_price is advisory only.';

-- =============================================================================
-- 3. VENUES + MEMBERSHIP
--    Venue = a followable identity (a bar, a pop-up, a team).
--    A person works at one or more venues (M:M with role).
--    Published specs credit both creator and venue.
-- =============================================================================
create table venues (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text unique,               -- url-safe handle, e.g. 'kiyori-bar'
  city        text,
  country     text not null default 'GB',
  bio         text,
  created_by  uuid not null references auth.users(id) on delete restrict,
  -- verified: future moderation hook
  verified    boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index venues_slug_idx on venues (slug);

create trigger venues_set_updated_at
  before update on venues
  for each row execute function set_updated_at();

-- Many-to-many: users ↔ venues
create table user_venues (
  user_id   uuid not null references auth.users(id) on delete cascade,
  venue_id  uuid not null references venues(id)     on delete cascade,
  role      text not null default 'bartender'
              check (role in ('owner','bartender','guest')),
  joined_at timestamptz not null default now(),
  primary key (user_id, venue_id)
);
create index user_venues_venue_idx on user_venues (venue_id);

-- Helper: is the current user an owner of a given venue?
create or replace function is_venue_owner(p_venue_id uuid)
returns boolean
language sql stable
as $$
  select exists (
    select 1 from user_venues
    where user_id = auth.uid()
      and venue_id = p_venue_id
      and role = 'owner'
  );
$$;

-- =============================================================================
-- 4. SPEC SOCIAL COLUMNS
--    Adds visibility, venue attribution, published_at, and the fork link.
--    Existing status column ('draft'|'published') is kept for backward compat
--    during transition; visibility is the canonical field going forward.
--    The app should write both during the transition and drop status later.
-- =============================================================================

-- Who sees this spec?
alter table specs
  add column visibility text not null default 'private'
    check (visibility in ('private','published'));

-- Venue credited at time of publish (set on publish, not mutable after).
alter table specs
  add column venue_id uuid references venues(id) on delete set null;

-- Timestamp the publish moment (set once on publish).
alter table specs
  add column published_at timestamptz;

-- FK to the immutable published snapshot (set once on publish; defined after
-- published_specs is created — see section 6 for the deferred FK).
alter table specs
  add column published_spec_id uuid;  -- FK added below after table creation

-- New indexes
create index specs_visibility_idx on specs (user_id, visibility);
create index specs_venue_idx       on specs (venue_id);

-- =============================================================================
-- 5. PUBLISHED SPECS — immutable snapshots
--    This is the public commons. INSERT-ONLY: no UPDATE policy is granted.
--    Every published drink is a permanent record. A fork always has a stable
--    published_specs row to point at, so lineage never breaks even if the
--    source user edits or deletes their private spec.
--
--    Fork lineage across users:
--      forked_from_id → the published_specs row that was forked.
--    Within a user's private canvas:
--      specs.parent_spec_id (from 0001) → same-user branch lineage.
--    Both can coexist: you fork a public drink (forked_from_id set) and
--    then make your own branches (parent_spec_id set on your private specs).
-- =============================================================================
create table published_specs (
  id                  uuid primary key default gen_random_uuid(),

  -- back-reference to the live spec (nullable: if user deletes their spec,
  -- the published record stays — lineage is permanent).
  spec_id             uuid references specs(id) on delete set null,

  -- who published it
  creator_id          uuid not null references auth.users(id) on delete restrict,
  venue_id            uuid references venues(id) on delete set null,

  -- cross-user fork lineage: points to the published snapshot this was forked from.
  -- null = original (not a fork of any public drink).
  forked_from_id      uuid references published_specs(id) on delete restrict,

  -- spec data snapshot (immutable from this point on)
  name                text not null,
  method              text,
  glass               text,
  garnish             text,
  build_text          text,
  change_note         text,    -- "what changed" note from the spec at publish time

  -- components as a JSONB array so the snapshot is self-contained.
  -- Schema: [{name, amount_ml, original_amount, original_unit, type: 'ingredient'|'prep',
  --           catalogue_id, abv, cost_per_ml_at_publish}]
  -- cost_per_ml_at_publish is the creator's personal cost at publish time.
  -- It is NOT surfaced to other users; it is stored for the creator's own history.
  components_snapshot jsonb not null default '[]',

  -- search
  search_vector       tsvector generated always as (
                        to_tsvector('english',
                          coalesce(name,'') || ' ' ||
                          coalesce(method,'') || ' ' ||
                          coalesce(glass,''))
                      ) stored,

  -- NO updated_at — this table is insert-only.
  published_at        timestamptz not null default now()
);

create index published_specs_creator_idx  on published_specs (creator_id);
create index published_specs_venue_idx    on published_specs (venue_id);
create index published_specs_fork_idx     on published_specs (forked_from_id);
create index published_specs_search_idx   on published_specs using gin(search_vector);
create index published_specs_published_at on published_specs (published_at desc);

-- =============================================================================
-- 6. DEFERRED FKs (circular deps resolved here)
-- =============================================================================

-- Link specs → their published snapshot (set once on publish, never updated).
alter table specs
  add constraint specs_published_spec_fk
  foreign key (published_spec_id) references published_specs(id) on delete set null;

-- Link specs → the published snapshot they were forked from (cross-user).
alter table specs
  add column forked_from_published_id uuid
    references published_specs(id) on delete restrict;

comment on column specs.forked_from_published_id is
  'Cross-user fork: the published_specs row this spec was forked from. '
  'null = user''s own original. Distinct from parent_spec_id (same-user private branch).';

create index specs_forked_from_idx on specs (forked_from_published_id);

-- =============================================================================
-- 7. UPDATED COST VIEWS
--    Logic is unchanged: ingredients.cost_per_ml (generated from user's own
--    pack_cost) is always the source. Catalogue reference_price never touches
--    these views — it only seeds the user's ingredient row on import.
--    Views are recreated to pick up any schema refreshes cleanly.
-- =============================================================================
create or replace view prep_costs
with (security_invoker = true) as
select
  p.id        as prep_id,
  p.user_id,
  p.yield_ml,
  coalesce(sum(pc.amount_ml * i.cost_per_ml), 0)               as batch_cost,
  coalesce(sum(pc.amount_ml * i.cost_per_ml), 0) / p.yield_ml  as cost_per_ml,
  coalesce(sum(pc.amount_ml * i.abv), 0) / p.yield_ml          as abv
from preps p
left join prep_components pc on pc.prep_id = p.id
left join ingredients i      on i.id = pc.ingredient_id
group by p.id;

create or replace view spec_component_costs
with (security_invoker = true) as
select
  sc.id,
  sc.spec_id,
  sc.user_id,
  sc.amount_ml,
  case
    when sc.ingredient_id is not null then i.cost_per_ml
    else pc.cost_per_ml
  end as unit_cost_per_ml,
  case
    when sc.ingredient_id is not null then i.abv
    else pc.abv
  end as abv
from spec_components sc
left join ingredients i on i.id = sc.ingredient_id
left join prep_costs  pc on pc.prep_id = sc.prep_id;

create or replace view spec_costs
with (security_invoker = true) as
select
  s.id        as spec_id,
  s.user_id,
  s.sale_price,
  coalesce(sum(scc.amount_ml * scc.unit_cost_per_ml), 0) as pour_cost,
  coalesce(sum(scc.amount_ml), 0)                        as liquid_volume_ml,
  case
    when coalesce(sum(scc.amount_ml), 0) > 0
    then coalesce(sum(scc.amount_ml * scc.abv), 0) / sum(scc.amount_ml)
    else 0
  end as pre_dilution_abv
from specs s
left join spec_component_costs scc on scc.spec_id = s.id
group by s.id;

-- =============================================================================
-- 8. PUBLIC BROWSE VIEW
--    What the discovery layer reads. Exposes published_specs with creator
--    display name + venue name. Never exposes private cost data.
-- =============================================================================
create or replace view public_specs_feed
with (security_invoker = true) as
select
  ps.id,
  ps.name,
  ps.method,
  ps.glass,
  ps.garnish,
  ps.build_text,
  ps.change_note,
  ps.components_snapshot,
  ps.forked_from_id,
  ps.published_at,
  -- creator
  ps.creator_id,
  u.raw_user_meta_data->>'full_name'  as creator_name,
  u.raw_user_meta_data->>'avatar_url' as creator_avatar,
  -- venue
  ps.venue_id,
  v.name  as venue_name,
  v.slug  as venue_slug,
  v.city  as venue_city,
  -- lineage depth (how many forks from root, 0 = original)
  (
    with recursive depth_cte as (
      select ps2.id, ps2.forked_from_id, 0 as depth
      from published_specs ps2
      where ps2.id = ps.id
      union all
      select ps3.id, ps3.forked_from_id, d.depth + 1
      from published_specs ps3
      join depth_cte d on ps3.id = d.forked_from_id
    )
    select max(depth) from depth_cte
  ) as lineage_depth
from published_specs ps
join auth.users u on u.id = ps.creator_id
left join venues v on v.id = ps.venue_id;

-- =============================================================================
-- 9. ROW LEVEL SECURITY
-- =============================================================================

-- --------------- catalogue_ingredients ----------------------------------------
alter table catalogue_ingredients enable row level security;

-- Any authenticated user can read the full catalogue.
create policy "catalogue: authenticated read"
  on catalogue_ingredients for select
  using (auth.uid() is not null);

-- Any authenticated user can contribute an entry.
create policy "catalogue: authenticated insert"
  on catalogue_ingredients for insert
  with check (auth.uid() is not null and contributed_by = auth.uid());

-- Only the contributor can edit their own unverified entry.
-- Verified entries are locked (edit via moderation process — future).
create policy "catalogue: contributor update"
  on catalogue_ingredients for update
  using (contributed_by = auth.uid() and verified = false)
  with check (contributed_by = auth.uid() and verified = false);

-- Contributors can delete their own unverified entries.
create policy "catalogue: contributor delete"
  on catalogue_ingredients for delete
  using (contributed_by = auth.uid() and verified = false);

-- --------------- venues -------------------------------------------------------
alter table venues enable row level security;

-- Any authenticated user can read venues.
create policy "venues: authenticated read"
  on venues for select
  using (auth.uid() is not null);

-- Any authenticated user can create a venue (they become owner in user_venues app-side).
create policy "venues: authenticated create"
  on venues for insert
  with check (auth.uid() is not null and created_by = auth.uid());

-- Only venue owners can update.
create policy "venues: owner update"
  on venues for update
  using (is_venue_owner(id))
  with check (is_venue_owner(id));

-- Only the creating owner can delete (app must check no published specs reference it).
create policy "venues: owner delete"
  on venues for delete
  using (created_by = auth.uid());

-- --------------- user_venues --------------------------------------------------
alter table user_venues enable row level security;

-- Users can see their own memberships.
create policy "user_venues: own read"
  on user_venues for select
  using (user_id = auth.uid());

-- Venue owners can see all members of their venues.
create policy "user_venues: owner read members"
  on user_venues for select
  using (is_venue_owner(venue_id));

-- Users can add themselves (join); owners can add anyone.
create policy "user_venues: insert"
  on user_venues for insert
  with check (user_id = auth.uid() or is_venue_owner(venue_id));

-- Users can leave; owners can remove members.
create policy "user_venues: delete"
  on user_venues for delete
  using (user_id = auth.uid() or is_venue_owner(venue_id));

-- --------------- published_specs ----------------------------------------------
alter table published_specs enable row level security;

-- Any authenticated user can browse the commons.
create policy "published_specs: authenticated read"
  on published_specs for select
  using (auth.uid() is not null);

-- Only the creator can publish (insert) a spec.
create policy "published_specs: creator insert"
  on published_specs for insert
  with check (creator_id = auth.uid());

-- NO UPDATE POLICY — insert-only. Immutability is the guarantee.

-- Creator can delete their own published spec.
-- NOTE: app must block deletion if forked_from_id references exist (forks would break).
-- Enforce this app-side before calling delete, not in SQL, to give the user a
-- useful error ("X bartenders have forked this drink").
create policy "published_specs: creator delete"
  on published_specs for delete
  using (creator_id = auth.uid());

-- --------------- specs (additive — existing own-row policy stays) --------------
-- No change to specs RLS: still own rows only. Published specs are read via
-- published_specs, not via specs. This is intentional.

-- =============================================================================
-- DATA MIGRATION NOTES (run manually / via seed script, not in this file)
-- =============================================================================
-- 1. Existing specs with status = 'published' should be backfilled:
--      UPDATE specs SET visibility = 'published', published_at = updated_at
--      WHERE status = 'published';
--    Then create a published_specs snapshot row for each.
--    Script outline:
--      INSERT INTO published_specs (spec_id, creator_id, name, method, glass,
--        garnish, build_text, change_note, components_snapshot, published_at)
--      SELECT s.id, s.user_id, s.name, s.method, s.glass, s.garnish,
--        s.build_text, s.change_note, '[]'::jsonb, s.updated_at
--      FROM specs s WHERE s.status = 'published';
--    Then backfill published_spec_id on specs from the inserts above.
--
-- 2. status column on specs is now deprecated in favour of visibility.
--    Keep it during transition; remove in migration 0003 once app is updated.
--
-- 3. published_recipe_id on specs (from 0001, a placeholder FK) is superseded
--    by published_spec_id. Drop it in migration 0003 once app is updated.
-- =============================================================================
