-- =============================================================================
-- Proof — Migration 0007: make prep costs unpriced-aware
--
-- Pricing became optional in 0005: ingredients.pack_cost may be NULL, so the
-- generated cost_per_ml is NULL too. prep_costs sums those with
-- coalesce(sum(...), 0), and SUM skips NULLs — so a prep containing unpriced
-- ingredients silently reports a LOWER cost rather than "unpriced", which
-- contradicts the optional-pricing model used everywhere else in the app.
--
-- Adds two trailing columns so callers can tell "genuinely cheap" from
-- "not priced yet". Existing columns keep their position and meaning, so
-- create-or-replace is safe and spec_component_costs (which reads this view)
-- is unaffected.
-- =============================================================================

create or replace view prep_costs
with (security_invoker = true) as
select
  p.id        as prep_id,
  p.user_id,
  p.yield_ml,
  coalesce(sum(pc.amount_ml * i.cost_per_ml), 0)               as batch_cost,
  coalesce(sum(pc.amount_ml * i.cost_per_ml), 0) / p.yield_ml  as cost_per_ml,
  coalesce(sum(pc.amount_ml * i.abv), 0) / p.yield_ml          as abv,
  -- new: components whose ingredient has no price yet
  count(pc.id) filter (where i.cost_per_ml is null)            as unpriced_count,
  count(pc.id)                                                 as component_count
from preps p
left join prep_components pc on pc.prep_id = p.id
left join ingredients i      on i.id = pc.ingredient_id
group by p.id;

comment on view prep_costs is
  'Batch cost rollup per prep. cost_per_ml = batch_cost / yield_ml. '
  'unpriced_count > 0 means the figure is incomplete — treat the prep as unpriced '
  'rather than cheap (pricing is optional, see migration 0005).';
