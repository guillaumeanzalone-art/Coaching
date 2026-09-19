-- ============================================================================
-- GA COACHING V249 - REHAB ASI QUOTIDIENNE
-- Routine fixe pour Duane, Clara (magicarpe) et Noé, sans modifier les autres.
-- ============================================================================

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
    when lower(btrim(coalesce(p_athlete_slug, ''))) in ('duane', 'magicarpe', 'noe')
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
    when lower(btrim(coalesce(p_athlete_slug, ''))) in ('duane', 'magicarpe', 'noe')
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

create or replace function public.start_mobility_set_v249(
  p_athlete_slug text,
  p_activity_date date,
  p_mobility_focus text,
  p_exercise_key text,
  p_set_index integer
)
returns table (
  started_at timestamptz,
  status text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_expected text := public.mobility_focus_for_athlete_date_v249(
    p_athlete_slug,
    p_activity_date
  );
  v_started timestamptz;
begin
  if auth.uid() is null or not public.v3_can_access_athlete(p_athlete_slug) then
    raise exception 'Not allowed to edit athlete %', p_athlete_slug;
  end if;

  if p_mobility_focus <> v_expected then
    raise exception 'Cette mobilité n''est pas la DAILY de cet athlète.';
  end if;

  if not public.mobility_set_allowed_for_athlete_v249(
    p_athlete_slug,
    p_mobility_focus,
    p_exercise_key,
    p_set_index
  ) then
    raise exception 'Série invalide.';
  end if;

  insert into public.athlete_mobility_set_runs_v248 (
    athlete_slug,
    activity_date,
    mobility_focus,
    exercise_key,
    set_index,
    started_at
  ) values (
    p_athlete_slug,
    p_activity_date,
    p_mobility_focus,
    p_exercise_key,
    p_set_index,
    clock_timestamp()
  )
  on conflict (
    athlete_slug,
    activity_date,
    mobility_focus,
    exercise_key,
    set_index
  ) do nothing;

  select r.started_at
  into v_started
  from public.athlete_mobility_set_runs_v248 r
  where r.athlete_slug = p_athlete_slug
    and r.activity_date = p_activity_date
    and r.mobility_focus = p_mobility_focus
    and r.exercise_key = p_exercise_key
    and r.set_index = p_set_index;

  return query
  select v_started, 'running'::text;
end;
$$;

create or replace function public.complete_mobility_set_v249(
  p_athlete_slug text,
  p_activity_date date,
  p_mobility_focus text,
  p_exercise_key text,
  p_set_index integer
)
returns table (
  completed_at timestamptz,
  elapsed_seconds integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.athlete_mobility_set_runs_v248%rowtype;
  v_elapsed integer;
begin
  if auth.uid() is null or not public.v3_can_access_athlete(p_athlete_slug) then
    raise exception 'Not allowed to edit athlete %', p_athlete_slug;
  end if;

  if p_mobility_focus <> public.mobility_focus_for_athlete_date_v249(
    p_athlete_slug,
    p_activity_date
  ) then
    raise exception 'Cette mobilité n''est pas la DAILY de cet athlète.';
  end if;

  if not public.mobility_set_allowed_for_athlete_v249(
    p_athlete_slug,
    p_mobility_focus,
    p_exercise_key,
    p_set_index
  ) then
    raise exception 'Série invalide.';
  end if;

  select *
  into v_row
  from public.athlete_mobility_set_runs_v248 r
  where r.athlete_slug = p_athlete_slug
    and r.activity_date = p_activity_date
    and r.mobility_focus = p_mobility_focus
    and r.exercise_key = p_exercise_key
    and r.set_index = p_set_index
  for update;

  if not found then
    raise exception 'Démarre la série avant de la valider.';
  end if;

  if v_row.completed_at is not null then
    return query
    select
      v_row.completed_at,
      greatest(
        30,
        extract(epoch from (v_row.completed_at - v_row.started_at))::integer
      );
    return;
  end if;

  v_elapsed := floor(
    extract(epoch from (clock_timestamp() - v_row.started_at))
  )::integer;

  if v_elapsed < 30 then
    raise exception
      'Anti-cheat : série trop rapide. Minimum 30 secondes (% secondes restantes).',
      30 - v_elapsed;
  end if;

  update public.athlete_mobility_set_runs_v248
  set completed_at = clock_timestamp()
  where athlete_slug = p_athlete_slug
    and activity_date = p_activity_date
    and mobility_focus = p_mobility_focus
    and exercise_key = p_exercise_key
    and set_index = p_set_index
  returning athlete_mobility_set_runs_v248.completed_at
  into v_row.completed_at;

  return query
  select v_row.completed_at, v_elapsed;
end;
$$;

create or replace function public.validate_mobility_day_v249(
  p_athlete_slug text,
  p_activity_date date,
  p_mobility_focus text
)
returns table (
  athlete_slug text,
  activity_date date,
  mobility_focus text,
  mobility_completed_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_expected text := public.mobility_focus_for_athlete_date_v249(
    p_athlete_slug,
    p_activity_date
  );
  v_required integer := case
    when p_mobility_focus = 'asi_rehab' then 27
    when p_mobility_focus in ('hip', 'shoulder') then 8
    else 9
  end;
  v_done integer := 0;
begin
  if auth.uid() is null or not public.v3_can_access_athlete(p_athlete_slug) then
    raise exception 'Not allowed to edit athlete %', p_athlete_slug;
  end if;

  if p_mobility_focus <> v_expected then
    raise exception 'Mauvaise DAILY pour cet athlète.';
  end if;

  select count(*)::integer
  into v_done
  from public.athlete_mobility_set_runs_v248 r
  where r.athlete_slug = p_athlete_slug
    and r.activity_date = p_activity_date
    and r.mobility_focus = p_mobility_focus
    and r.completed_at is not null
    and public.mobility_set_allowed_for_athlete_v249(
      r.athlete_slug,
      r.mobility_focus,
      r.exercise_key,
      r.set_index
    );

  if v_done < v_required then
    raise exception
      'Routine incomplète : %/% séries validées.',
      v_done,
      v_required;
  end if;

  insert into public.athlete_daily_wellness as w (
    athlete_slug,
    activity_date,
    mobility_focus,
    mobility_completed_at,
    updated_at
  ) values (
    p_athlete_slug,
    p_activity_date,
    p_mobility_focus,
    clock_timestamp(),
    clock_timestamp()
  )
  on conflict (athlete_slug, activity_date)
  do update set
    mobility_focus = excluded.mobility_focus,
    mobility_completed_at = coalesce(
      w.mobility_completed_at,
      excluded.mobility_completed_at
    ),
    updated_at = clock_timestamp();

  return query
  select
    w.athlete_slug,
    w.activity_date,
    w.mobility_focus,
    w.mobility_completed_at
  from public.athlete_daily_wellness w
  where w.athlete_slug = p_athlete_slug
    and w.activity_date = p_activity_date;
end;
$$;

revoke all on function public.mobility_focus_for_athlete_date_v249(text, date)
  from public, anon, authenticated;
revoke all on function public.mobility_set_allowed_for_athlete_v249(text, text, text, integer)
  from public, anon, authenticated;
revoke all on function public.start_mobility_set_v249(text, date, text, text, integer)
  from public, anon;
revoke all on function public.complete_mobility_set_v249(text, date, text, text, integer)
  from public, anon;
revoke all on function public.validate_mobility_day_v249(text, date, text)
  from public, anon;

grant execute on function public.start_mobility_set_v249(text, date, text, text, integer)
  to authenticated;
grant execute on function public.complete_mobility_set_v249(text, date, text, text, integer)
  to authenticated;
grant execute on function public.validate_mobility_day_v249(text, date, text)
  to authenticated;

commit;
