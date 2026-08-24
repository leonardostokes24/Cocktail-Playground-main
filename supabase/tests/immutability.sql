-- =============================================================================
-- Proof — immutability proof for published_specs (⚑ CLAUDE.md)
--
-- 0003 makes published_specs append-only by trigger. 0006 carves out exactly
-- one exception: spec_id going NOT NULL -> NULL when a creator deletes the spec
-- a snapshot was published from, every other column byte-identical.
--
-- This asserts both halves. It runs inside a transaction that ALWAYS rolls
-- back, so it can be pointed at any environment without leaving a trace.
--
--   psql "$DATABASE_URL" -f supabase/tests/immutability.sql
--
-- Expect four "ok" NOTICEs. Any failure raises and the transaction unwinds.
-- =============================================================================

begin;

do $$
declare
  v_user   uuid;
  v_spec   uuid;
  v_pub    uuid;
  v_failed boolean;
begin
  select id into v_user from auth.users limit 1;
  if v_user is null then
    raise exception 'no auth.users row to test with';
  end if;

  insert into specs (user_id, name) values (v_user, '__immutability_probe__')
    returning id into v_spec;

  insert into published_specs (spec_id, creator_id, name, components_snapshot)
    values (v_spec, v_user, '__immutability_probe__', '[]'::jsonb)
    returning id into v_pub;
  raise notice 'ok  - INSERT into published_specs is allowed';

  -- 1. Content must not be editable.
  v_failed := false;
  begin
    update published_specs set name = 'tampered' where id = v_pub;
    v_failed := true;
  exception when others then
    raise notice 'ok  - UPDATE of name rejected (%)', sqlerrm;
  end;
  if v_failed then
    raise exception 'FAIL - published_specs.name was updated; append-only is not protecting content';
  end if;

  -- 2. Attribution and the snapshot body must not be editable either.
  v_failed := false;
  begin
    update published_specs
       set components_snapshot = '[{"name":"tampered"}]'::jsonb
     where id = v_pub;
    v_failed := true;
  exception when others then
    raise notice 'ok  - UPDATE of components_snapshot rejected (%)', sqlerrm;
  end;
  if v_failed then
    raise exception 'FAIL - components_snapshot was updated; the snapshot is not immutable';
  end if;

  -- 3. The one permitted mutation: the creator deletes the spec, the FK nulls
  --    the back-reference, and the snapshot survives so forks keep ancestry.
  delete from specs where id = v_spec;
  if not exists (select 1 from published_specs where id = v_pub) then
    raise exception 'FAIL - deleting the spec removed the snapshot; forks would lose ancestry';
  end if;
  if (select spec_id from published_specs where id = v_pub) is not null then
    raise exception 'FAIL - spec_id was not nulled on spec delete';
  end if;
  raise notice 'ok  - spec delete nulls spec_id and leaves the snapshot intact';
end $$;

rollback;
