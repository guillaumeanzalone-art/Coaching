-- Corrige l'identifiant de Clara pour la Rehab ASI quotidienne.
-- Clara utilise le slug metaknight ; magicarpe conserve la rotation standard.

begin;

create or replace function public.mobility_focus_for_athlete_date_v249(
  p_athlete_slug text,
  p_date date
)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when lower(btrim(coalesce(p_athlete_slug, ''))) in ('duane', 'metaknight', 'noe')
      then 'asi_rehab'
    else public.mobility_focus_for_date_v248(p_date)
  end;
$$;

create or replace function public.mobility_set_allowed_for_athlete_v249(
  p_athlete_slug text,
  p_focus text,
  p_exercise text,
  p_set_index integer
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when lower(btrim(coalesce(p_athlete_slug, ''))) in ('duane', 'metaknight', 'noe')
      and p_focus = 'asi_rehab'
    then case p_exercise
      when 'iliacus_release' then p_set_index between 0 and 1
      when 'glute_med_release' then p_set_index = 0
      when 'ql_erectors_roll' then p_set_index between 0 and 1
      when 'couch_stretch' then p_set_index between 0 and 1
      when 'figure_four' then p_set_index between 0 and 3
      when 'asi_bird_dog' then p_set_index between 0 and 1
      when 'clamshell' then p_set_index between 0 and 1
      when 'band_glute_bridge' then p_set_index between 0 and 1
      when 'lower_trunk_rotation' then p_set_index between 0 and 2
      when 'supine_piriformis' then p_set_index between 0 and 2
      when 'side_hip_abduction' then p_set_index = 0
      when 'side_hip_adduction' then p_set_index = 0
      when 'asi_dead_bug' then p_set_index between 0 and 1
      else false
    end
    else
      public.mobility_set_allowed_v248(p_focus, p_exercise, p_set_index)
  end;
$$;

revoke all on function public.mobility_focus_for_athlete_date_v249(text, date)
  from public, anon, authenticated;
revoke all on function public.mobility_set_allowed_for_athlete_v249(text, text, text, integer)
  from public, anon, authenticated;

commit;
