-- 036: Normalize casing on existing load data
-- Title Case cities/commodity, UPPER states
-- Safe to run multiple times (idempotent).

UPDATE loads SET
  origin_city  = initcap(origin_city),
  dest_city    = initcap(dest_city),
  commodity    = initcap(commodity),
  origin_state = upper(origin_state),
  dest_state   = upper(dest_state);
