-- =============================================================================
-- Proof — Migration 0005: optional pricing
-- Builds on 0001–0004.
--
-- Pricing becomes secondary to creation. An ingredient can exist and be used in
-- a spec WITHOUT a price: you build the recipe first and price later (or never).
--
-- pack_cost drops its NOT NULL constraint. The generated cost_per_ml column
-- (pack_cost / pack_size_ml) already yields NULL when pack_cost is NULL, so an
-- unpriced ingredient simply contributes no cost and the spec reads as "unpriced".
-- pack_size_ml stays NOT NULL (defaulted from the catalogue on materialize).
-- =============================================================================

alter table ingredients alter column pack_cost drop not null;

comment on column ingredients.pack_cost is
  'User''s ex-VAT pack cost in GBP. NULL = unpriced (pricing is optional). '
  'cost_per_ml is generated from it and is NULL while unpriced.';
