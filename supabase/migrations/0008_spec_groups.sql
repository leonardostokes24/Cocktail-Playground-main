-- =============================================================================
-- Proof — Migration 0008: manual spec groups
--
-- Lineage groups are derived (root + descendants) and store nothing, which is
-- why they split and merge correctly with no state to repair. A *manual* group
-- is the opposite: an arbitrary set of specs the user gathered on purpose, so it
-- has to be persisted.
--
-- Both kinds coexist. A spec's group_id is independent of its lineage; the
-- canvas draws manual hulls differently so the two are never confused.
--
-- Not a node type (⚑ CLAUDE.md) — a group owns no canvas position and is drawn
-- as an overlay derived from its members' bounds.
-- =============================================================================

create table if not exists spec_groups (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null default 'Group',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ON DELETE SET NULL, matching how specs.parent_spec_id behaves: removing the
-- container must never remove what it contained.
alter table specs
  add column if not exists group_id uuid references spec_groups(id) on delete set null;

create index if not exists specs_group_idx      on specs (group_id);
create index if not exists spec_groups_user_idx on spec_groups (user_id);

-- ── RLS: owner-only, deny by default (⚑) ─────────────────────────────────────
alter table spec_groups enable row level security;

-- ⚑ An UPDATE policy silently no-ops without a matching SELECT policy, so these
-- are written as a pair and must stay one.
drop policy if exists "spec_groups: own read"   on spec_groups;
create policy "spec_groups: own read"
  on spec_groups for select
  using (user_id = auth.uid());

drop policy if exists "spec_groups: own insert" on spec_groups;
create policy "spec_groups: own insert"
  on spec_groups for insert
  with check (user_id = auth.uid());

drop policy if exists "spec_groups: own update" on spec_groups;
create policy "spec_groups: own update"
  on spec_groups for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "spec_groups: own delete" on spec_groups;
create policy "spec_groups: own delete"
  on spec_groups for delete
  using (user_id = auth.uid());
