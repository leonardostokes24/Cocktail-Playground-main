-- =============================================================================
-- Proof — Phase 0 schema: lineage canvas + recipe model + cost rollups
-- Run in Supabase SQL editor or as a migration. Postgres 15+ assumed.
-- Money is GBP stored as exact numeric. All volumes are millilitres (ml).
-- =============================================================================

create extension if not exists pgcrypto;  -- gen_random_uuid()

-- -----------------------------------------------------------------------------
-- Tear down previous schema so this script is safe to re-run.
-- Views first (they reference the tables), then tables in reverse FK order.
-- CASCADE drops dependent triggers, indexes, and RLS policies automatically.
-- -----------------------------------------------------------------------------
drop view  if exists spec_component_costs cascade;
drop view  if exists spec_costs            cascade;
drop view  if exists prep_costs            cascade;
drop table if exists spec_components       cascade;
drop table if exists prep_components       cascade;
drop table if exists specs                 cascade;
drop table if exists preps                 cascade;
drop table if exists ingredients           cascade;

-- -----------------------------------------------------------------------------
-- updated_at helper
-- -----------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =============================================================================
-- INGREDIENTS  (the cost library / products)
-- =============================================================================
create table ingredients (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  name          text not null,
  type          text,                          -- e.g. spirit, juice, syrup, bitters
  abv           numeric not null default 0 check (abv >= 0 and abv <= 100),
  pack_size_ml  numeric not null check (pack_size_ml > 0),  -- volume of purchased pack
  pack_cost     numeric not null check (pack_cost >= 0),    -- GBP, ex-VAT cost of the pack
  -- derived, same-row generated column:
  cost_per_ml   numeric generated always as (pack_cost / pack_size_ml) stored,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index ingredients_user_idx on ingredients (user_id);

create trigger ingredients_set_updated_at
  before update on ingredients
  for each row execute function set_updated_at();

-- =============================================================================
-- PREPS  (shared sub-recipes / batches: cordials, syrups, oleos)
-- =============================================================================
create table preps (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  yield_ml    numeric not null check (yield_ml > 0),  -- final batch volume
  method      text,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index preps_user_idx on preps (user_id);

create trigger preps_set_updated_at
  before update on preps
  for each row execute function set_updated_at();

-- Prep components reference INGREDIENTS only (no nested preps in this phase).
create table prep_components (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  prep_id         uuid not null references preps(id) on delete cascade,
  ingredient_id   uuid not null references ingredients(id) on delete restrict,
  amount_ml       numeric not null check (amount_ml > 0),  -- canonical, normalized to ml
  original_amount numeric,                                 -- optional, for authoring round-trip
  original_unit   text,                                    -- e.g. 'oz', 'tsp', 'dash'
  position        int not null default 0,
  created_at      timestamptz not null default now()
);
create index prep_components_prep_idx on prep_components (prep_id);
create index prep_components_user_idx on prep_components (user_id);

-- =============================================================================
-- SPECS  (one drink version = one canvas node; parent_spec_id IS the edge)
-- =============================================================================
create table specs (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  name            text not null,
  parent_spec_id  uuid references specs(id) on delete set null,
  change_note     text,                                    -- "what changed" on this branch
  method          text,                                    -- drives dilution factor app-side
  glass           text,
  garnish         text,
  build_text      text,
  sale_price      numeric check (sale_price >= 0),         -- GBP, menu price INC VAT
  status          text not null default 'draft'
                    check (status in ('draft', 'published')),
  published_recipe_id uuid,                                -- links to existing recipes table
  canvas_x        double precision not null default 0,
  canvas_y        double precision not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint specs_no_self_parent check (parent_spec_id is null or parent_spec_id <> id)
  -- NOTE: deeper lineage cycles must be prevented app-side on branch/move.
);
create index specs_user_idx   on specs (user_id);
create index specs_parent_idx on specs (parent_spec_id);
create index specs_status_idx on specs (user_id, status);

create trigger specs_set_updated_at
  before update on specs
  for each row execute function set_updated_at();

-- Spec components reference an INGREDIENT *or* a PREP (exactly one).
create table spec_components (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  spec_id         uuid not null references specs(id) on delete cascade,
  ingredient_id   uuid references ingredients(id) on delete restrict,
  prep_id         uuid references preps(id) on delete restrict,
  amount_ml       numeric not null check (amount_ml > 0),  -- canonical, normalized to ml
  original_amount numeric,
  original_unit   text,
  position        int not null default 0,
  created_at      timestamptz not null default now(),
  -- exactly one reference set:
  constraint spec_component_one_ref check (
    (ingredient_id is not null)::int + (prep_id is not null)::int = 1
  )
);
create index spec_components_spec_idx on spec_components (spec_id);
create index spec_components_user_idx on spec_components (user_id);

-- =============================================================================
-- COST ROLLUP VIEWS
-- security_invoker = true so the caller's RLS applies to the underlying tables.
-- GP and dilution are intentionally NOT here — they live in calculations.js
-- because their factors (VAT rate, per-technique dilution) are user-editable.
-- =============================================================================

-- Prep cost + volume-weighted ABV (accounts for dilution down to yield_ml).
create view prep_costs
with (security_invoker = true) as
select
  p.id        as prep_id,
  p.user_id,
  p.yield_ml,
  coalesce(sum(pc.amount_ml * i.cost_per_ml), 0)            as batch_cost,
  coalesce(sum(pc.amount_ml * i.cost_per_ml), 0) / p.yield_ml as cost_per_ml,
  coalesce(sum(pc.amount_ml * i.abv), 0) / p.yield_ml         as abv
from preps p
left join prep_components pc on pc.prep_id = p.id
left join ingredients i      on i.id = pc.ingredient_id
group by p.id;

-- Resolve each spec component to a unit cost + abv (ingredient or prep).
create view spec_component_costs
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

-- Per-spec rollup: pour cost, liquid volume, pre-dilution ABV.
-- The app then applies the technique's dilution factor and VAT to get
-- final_volume, final_abv and GP%.
create view spec_costs
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
-- ROW LEVEL SECURITY  (owner-only: user_id = auth.uid())
-- =============================================================================
alter table ingredients     enable row level security;
alter table preps           enable row level security;
alter table prep_components enable row level security;
alter table specs           enable row level security;
alter table spec_components enable row level security;

create policy "own ingredients" on ingredients
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own preps" on preps
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own prep_components" on prep_components
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own specs" on specs
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own spec_components" on spec_components
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
