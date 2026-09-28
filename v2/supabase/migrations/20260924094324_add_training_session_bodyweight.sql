-- Store the athlete's optional bodyweight for each training session.
-- Blank sessions remain null and are excluded from weekly averages.

alter table public.training_sessions_v2
  add column if not exists bodyweight_kg numeric;

alter table public.training_sessions_v2
  drop constraint if exists training_sessions_v2_bodyweight_kg_check;

alter table public.training_sessions_v2
  add constraint training_sessions_v2_bodyweight_kg_check
  check (
    bodyweight_kg is null
    or bodyweight_kg between 20 and 400
  );
