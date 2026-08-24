-- =============================================================================
-- Proof — Migration 0004: fix public_specs_feed visibility
-- Builds on 0002 + 0003.
--
-- Problem: 0002 created public_specs_feed with security_invoker = true, and the
-- view joins auth.users to resolve creator display name/avatar. The `authenticated`
-- role has no SELECT on auth.users (and must not — it holds emails and auth
-- metadata), so every real logged-in user hitting the feed got
-- "permission denied for table users" and the entire commons rendered empty.
--
-- Fix: recreate the feed as a SECURITY DEFINER view (security_invoker = false).
-- It exposes ONLY public commons data + public attribution (creator display
-- name/avatar, venue) — never private cost data or auth secrets. This is the
-- same justification as get_spec_lineage()'s SECURITY DEFINER in 0003:
-- published_specs is public-read to any authenticated user anyway; the definer
-- context only guarantees the join resolves. The login gate is preserved at the
-- grant level (authenticated only; anon revoked).
-- =============================================================================

drop view if exists public_specs_feed;

create view public_specs_feed
with (security_invoker = false) as
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
  ps.creator_id,
  u.raw_user_meta_data->>'full_name'  as creator_name,
  u.raw_user_meta_data->>'avatar_url' as creator_avatar,
  ps.venue_id,
  v.name  as venue_name,
  v.slug  as venue_slug,
  v.city  as venue_city,
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

-- Only logged-in users browse the commons; keep the login gate at grant level.
revoke all on public_specs_feed from anon;
grant select on public_specs_feed to authenticated;
