-- =============================================================================
-- Proof — Migration 0006: let a creator delete a spec they've published
--
-- Bug: published_specs.spec_id is `references specs(id) on delete set null`
-- (0002). Deleting a published spec therefore makes Postgres UPDATE
-- published_specs to null that back-reference — and the append-only trigger from
-- 0003 rejects every UPDATE, so the delete failed with
--   "published_specs is append-only: UPDATE not permitted".
-- Effect: any spec that had ever been published could never be deleted, and a
-- bulk delete failed as soon as one published spec was in the batch.
--
-- 0002 explicitly intended the opposite ("if user deletes their spec, the
-- published record stays — lineage is permanent"), so this restores that intent.
--
-- Immutability (⚑) is preserved: the ONLY update allowed is spec_id going
-- NOT NULL → NULL with every other column byte-identical. The snapshot's
-- content, attribution and lineage still cannot be modified.
-- =============================================================================

create or replace function reject_mutation()
returns trigger language plpgsql as $$
begin
  -- Referential maintenance only: clearing the back-reference to a spec row the
  -- creator has deleted. Content is unchanged, so the snapshot stays immutable.
  --
  -- search_vector is a GENERATED column: in a BEFORE UPDATE trigger Postgres has
  -- not computed NEW.search_vector yet (it is null), so it must be excluded from
  -- the comparison or no update would ever match. It is generated from the
  -- content columns and cannot be set by a client, so ignoring it is safe.
  -- Comparing the whole remaining row (rather than a column list) means any
  -- column added later is protected by default.
  if tg_op = 'UPDATE'
     and old.spec_id is not null
     and new.spec_id is null
     and (to_jsonb(new) - 'spec_id' - 'search_vector')
       = (to_jsonb(old) - 'spec_id' - 'search_vector')
  then
    return new;
  end if;

  raise exception 'published_specs is append-only: % not permitted', tg_op
    using errcode = 'raise_exception',
          hint = 'Publish a new version instead of modifying a published one.';
end $$;
