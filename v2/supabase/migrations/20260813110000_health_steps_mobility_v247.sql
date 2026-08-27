-- GA Coaching V4.7
-- Apple Health steps + daily mobility + next-day training XP bonus.

create table if not exists public.athlete_daily_wellness (
  athlete_slug text not null,
  activity_date date not null,
  steps integer not null default 0 check (steps >= 0 and steps <= 200000),
  step_source text,
  step_synced_at timestamptz,
  mobility_focus text,
  mobility_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (athlete_slug, activity_date)
);

create table if not exists public.athlete_step_xp_bonus_v247 (
  athlete_slug text not null,
  program_key text not null,
  week_index integer not null,
  day_index integer not null,
  set_index integer not null,
  exercise_code text not null,
  training_date date not null,
  source_activity_date date not null,
  source_steps integer not null default 0,
  xp_multiplier numeric(6,3) not null default 1,
  base_xp integer not null default 0,
  bonus_xp integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (
    athlete_slug,
    program_key,
    week_index,
    day_index,
    set_index,
    exercise_code,
    training_date
  )
);

alter table public.athlete_daily_wellness enable row level security;
alter table public.athlete_step_xp_bonus_v247 enable row level security;

-- The current coaching app lets authenticated coaches/athletes switch between athlete profiles.
-- Keep the same access model as the existing RPG tables while restricting anonymous access.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'athlete_daily_wellness'
      and policyname = 'wellness_authenticated_all_v247'
  ) then
    create policy wellness_authenticated_all_v247
      on public.athlete_daily_wellness
      for all
      to authenticated
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'athlete_step_xp_bonus_v247'
      and policyname = 'step_xp_authenticated_read_v247'
  ) then
    create policy step_xp_authenticated_read_v247
      on public.athlete_step_xp_bonus_v247
      for select
      to authenticated
      using (true);
  end if;
end $$;

grant select, insert, update on public.athlete_daily_wellness to authenticated;
grant select on public.athlete_step_xp_bonus_v247 to authenticated;

create or replace function public.sync_athlete_steps_v247(
  p_athlete_slug text,
  p_activity_date date,
  p_steps integer,
  p_source text default 'healthkit'
)
returns table (
  athlete_slug text,
  activity_date date,
  steps integer,
  step_source text,
  step_synced_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_steps integer := greatest(0, least(coalesce(p_steps, 0), 200000));
begin
  if coalesce(trim(p_athlete_slug), '') = '' then
    raise exception 'athlete slug required';
  end if;

  insert into public.athlete_daily_wellness as w (
    athlete_slug,
    activity_date,
    steps,
    step_source,
    step_synced_at,
    updated_at
  ) values (
    p_athlete_slug,
    p_activity_date,
    v_steps,
    coalesce(nullif(trim(p_source), ''), 'healthkit'),
    now(),
    now()
  )
  on conflict (athlete_slug, activity_date)
  do update set
    steps = greatest(w.steps, excluded.steps),
    step_source = excluded.step_source,
    step_synced_at = excluded.step_synced_at,
    updated_at = now();

  return query
  select
    w.athlete_slug,
    w.activity_date,
    w.steps,
    w.step_source,
    w.step_synced_at
  from public.athlete_daily_wellness w
  where w.athlete_slug = p_athlete_slug
    and w.activity_date = p_activity_date;
end;
$$;

grant execute on function public.sync_athlete_steps_v247(text,date,integer,text) to authenticated;

create or replace function public.validate_mobility_day_v247(
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
set search_path = public
as $$
begin
  if coalesce(trim(p_athlete_slug), '') = '' then
    raise exception 'athlete slug required';
  end if;

  if p_mobility_focus not in ('hip','shoulder','low_back','ankle') then
    raise exception 'invalid mobility focus';
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
    now(),
    now()
  )
  on conflict (athlete_slug, activity_date)
  do update set
    mobility_focus = excluded.mobility_focus,
    mobility_completed_at = coalesce(w.mobility_completed_at, excluded.mobility_completed_at),
    updated_at = now();

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

grant execute on function public.validate_mobility_day_v247(text,date,text) to authenticated;

create or replace function public.ga_level_from_xp_v247(p_total_xp numeric)
returns integer
language plpgsql
immutable
as $$
declare
  v_total numeric := greatest(coalesce(p_total_xp, 0), 0);
  v_level integer := 1;
  v_spent numeric := 0;
  v_cost numeric := 50;
begin
  while v_level < 1000 and v_total >= v_spent + v_cost loop
    v_spent := v_spent + v_cost;
    v_level := v_level + 1;
    v_cost := round(50 * power(1.2, greatest(0, v_level - 1)));
  end loop;

  return v_level;
end;
$$;

create or replace function public.apply_step_xp_bonus_v247(
  p_athlete_slug text,
  p_program_key text,
  p_week_index integer,
  p_day_index integer,
  p_set_index integer,
  p_exercise_code text,
  p_training_date date,
  p_base_xp integer
)
returns table (
  source_steps integer,
  xp_multiplier numeric,
  bonus_xp integer,
  total_xp_after numeric,
  level_after integer,
  level_up boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source_date date := p_training_date - 1;
  v_steps integer := 0;
  v_multiplier numeric := 1;
  v_base integer := greatest(0, least(coalesce(p_base_xp, 0), 1000000));
  v_bonus integer := 0;
  v_inserted boolean := false;
  v_rows integer := 0;
  v_total_before numeric := 0;
  v_total_after numeric := 0;
  v_level_before integer := 1;
  v_level_after integer := 1;
begin
  select coalesce(w.steps, 0)
  into v_steps
  from public.athlete_daily_wellness w
  where w.athlete_slug = p_athlete_slug
    and w.activity_date = v_source_date;

  v_steps := coalesce(v_steps, 0);

  -- No penalty below 10k. Bonus starts at 10k and reaches +50% at 20k.
  if v_steps > 10000 then
    v_multiplier := least(
      1.5,
      1 + ((v_steps - 10000)::numeric / 20000::numeric)
    );
  end if;

  v_bonus := greatest(
    0,
    round(v_base * (v_multiplier - 1))::integer
  );

  select
    coalesce(ap.xp_total, 0),
    coalesce(ap.level, public.ga_level_from_xp_v247(coalesce(ap.xp_total, 0)))
  into
    v_total_before,
    v_level_before
  from public.athlete_progress ap
  where ap.athlete_slug = p_athlete_slug
  for update;

  if not found then
    return query
    select
      v_steps,
      v_multiplier,
      0,
      0::numeric,
      1,
      false;
    return;
  end if;

  insert into public.athlete_step_xp_bonus_v247 (
    athlete_slug,
    program_key,
    week_index,
    day_index,
    set_index,
    exercise_code,
    training_date,
    source_activity_date,
    source_steps,
    xp_multiplier,
    base_xp,
    bonus_xp
  ) values (
    p_athlete_slug,
    coalesce(p_program_key, ''),
    coalesce(p_week_index, 0),
    coalesce(p_day_index, 0),
    coalesce(p_set_index, 0),
    coalesce(p_exercise_code, ''),
    p_training_date,
    v_source_date,
    v_steps,
    v_multiplier,
    v_base,
    v_bonus
  )
  on conflict do nothing;

  get diagnostics v_rows = row_count;
  v_inserted := v_rows > 0;

  if v_inserted and v_bonus > 0 then
    v_total_after := v_total_before + v_bonus;
    v_level_after := greatest(
      v_level_before,
      public.ga_level_from_xp_v247(v_total_after)
    );

    update public.athlete_progress
    set
      xp_total = v_total_after,
      level = v_level_after
    where athlete_slug = p_athlete_slug;
  else
    v_bonus := 0;
    v_total_after := v_total_before;
    v_level_after := v_level_before;
  end if;

  return query
  select
    v_steps,
    v_multiplier,
    v_bonus,
    v_total_after,
    v_level_after,
    (v_level_after > v_level_before);
end;
$$;

grant execute on function public.apply_step_xp_bonus_v247(text,text,integer,integer,integer,text,date,integer) to authenticated;
