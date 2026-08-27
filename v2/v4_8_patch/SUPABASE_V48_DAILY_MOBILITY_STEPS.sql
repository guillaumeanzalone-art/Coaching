-- ==========================================================================
-- GA Coaching V4.8 — DAILY mobilité / anti-cheat / Steps XP ×2 / Coffres ×2
-- À exécuter UNE FOIS dans Supabase > SQL Editor.
-- Idempotent : peut être relancé.
-- ==========================================================================

begin;

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

create table if not exists public.athlete_mobility_set_runs_v248 (
  athlete_slug text not null,
  activity_date date not null,
  mobility_focus text not null,
  exercise_key text not null,
  set_index integer not null check (set_index >= 0 and set_index <= 9),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key (athlete_slug, activity_date, mobility_focus, exercise_key, set_index)
);

create table if not exists public.athlete_step_xp_bonus_v248 (
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
  primary key (athlete_slug,program_key,week_index,day_index,set_index,exercise_code,training_date)
);

alter table public.athlete_mobility_set_runs_v248 enable row level security;
alter table public.athlete_step_xp_bonus_v248 enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='athlete_mobility_set_runs_v248' and policyname='mobility_runs_read_v248'
  ) then
    create policy mobility_runs_read_v248 on public.athlete_mobility_set_runs_v248 for select to authenticated using (true);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='athlete_step_xp_bonus_v248' and policyname='step_xp_read_v248'
  ) then
    create policy step_xp_read_v248 on public.athlete_step_xp_bonus_v248 for select to authenticated using (true);
  end if;
end $$;

grant select on public.athlete_mobility_set_runs_v248 to authenticated;
grant select on public.athlete_step_xp_bonus_v248 to authenticated;

-- Focus du jour : change TOUS LES JOURS. Comme une semaine fait 7 jours,
-- l'ordre décale aussi automatiquement d'une semaine à l'autre.
create or replace function public.mobility_focus_for_date_v248(p_date date)
returns text
language sql
immutable
as $$
  select (array['hip','shoulder','low_back','ankle'])[1 + mod((p_date - date '2026-01-05'), 4)];
$$;

create or replace function public.mobility_set_allowed_v248(
  p_focus text,
  p_exercise text,
  p_set_index integer
)
returns boolean
language sql
immutable
as $$
  select case p_focus
    when 'hip' then
      (p_exercise='cossack' and p_set_index between 0 and 2) or
      (p_exercise='9090' and p_set_index between 0 and 2) or
      (p_exercise='rockback' and p_set_index between 0 and 1)
    when 'shoulder' then
      (p_exercise='wallslide' and p_set_index between 0 and 2) or
      (p_exercise='scappush' and p_set_index between 0 and 2) or
      (p_exercise='doorpec' and p_set_index between 0 and 1)
    when 'low_back' then
      (p_exercise='mcgill' and p_set_index between 0 and 2) or
      (p_exercise='birddog' and p_set_index between 0 and 2) or
      (p_exercise='sideplank' and p_set_index between 0 and 2)
    when 'ankle' then
      (p_exercise='kneewall' and p_set_index between 0 and 2) or
      (p_exercise='soleus' and p_set_index between 0 and 2) or
      (p_exercise='calfraise' and p_set_index between 0 and 2)
    else false
  end;
$$;

create or replace function public.start_mobility_set_v248(
  p_athlete_slug text,
  p_activity_date date,
  p_mobility_focus text,
  p_exercise_key text,
  p_set_index integer
)
returns table(started_at timestamptz, status text)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_expected text := public.mobility_focus_for_date_v248(p_activity_date);
  v_started timestamptz;
begin
  if p_mobility_focus <> v_expected then
    raise exception 'Cette mobilité n''est pas la DAILY du jour.';
  end if;
  if not public.mobility_set_allowed_v248(p_mobility_focus,p_exercise_key,p_set_index) then
    raise exception 'Série invalide.';
  end if;

  insert into public.athlete_mobility_set_runs_v248(
    athlete_slug,activity_date,mobility_focus,exercise_key,set_index,started_at
  ) values (
    p_athlete_slug,p_activity_date,p_mobility_focus,p_exercise_key,p_set_index,clock_timestamp()
  )
  on conflict (athlete_slug,activity_date,mobility_focus,exercise_key,set_index)
  do nothing;

  select r.started_at into v_started
  from public.athlete_mobility_set_runs_v248 r
  where r.athlete_slug=p_athlete_slug and r.activity_date=p_activity_date
    and r.mobility_focus=p_mobility_focus and r.exercise_key=p_exercise_key and r.set_index=p_set_index;

  return query select v_started, 'running'::text;
end;
$$;

create or replace function public.complete_mobility_set_v248(
  p_athlete_slug text,
  p_activity_date date,
  p_mobility_focus text,
  p_exercise_key text,
  p_set_index integer
)
returns table(completed_at timestamptz, elapsed_seconds integer)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_row public.athlete_mobility_set_runs_v248%rowtype;
  v_elapsed integer;
begin
  if p_mobility_focus <> public.mobility_focus_for_date_v248(p_activity_date) then
    raise exception 'Cette mobilité n''est pas la DAILY du jour.';
  end if;

  select * into v_row
  from public.athlete_mobility_set_runs_v248 r
  where r.athlete_slug=p_athlete_slug and r.activity_date=p_activity_date
    and r.mobility_focus=p_mobility_focus and r.exercise_key=p_exercise_key and r.set_index=p_set_index
  for update;

  if not found then
    raise exception 'Démarre la série avant de la valider.';
  end if;
  if v_row.completed_at is not null then
    return query select v_row.completed_at, greatest(30,extract(epoch from (v_row.completed_at-v_row.started_at))::integer);
    return;
  end if;

  v_elapsed := floor(extract(epoch from (clock_timestamp()-v_row.started_at)))::integer;
  if v_elapsed < 30 then
    raise exception 'Anti-cheat : série trop rapide. Minimum 30 secondes (% secondes restantes).', 30-v_elapsed;
  end if;

  update public.athlete_mobility_set_runs_v248
  set completed_at=clock_timestamp()
  where athlete_slug=p_athlete_slug and activity_date=p_activity_date
    and mobility_focus=p_mobility_focus and exercise_key=p_exercise_key and set_index=p_set_index
  returning athlete_mobility_set_runs_v248.completed_at into v_row.completed_at;

  return query select v_row.completed_at, v_elapsed;
end;
$$;

create or replace function public.validate_mobility_day_v248(
  p_athlete_slug text,
  p_activity_date date,
  p_mobility_focus text
)
returns table(athlete_slug text,activity_date date,mobility_focus text,mobility_completed_at timestamptz)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_expected text := public.mobility_focus_for_date_v248(p_activity_date);
  v_required integer := case p_mobility_focus when 'hip' then 8 when 'shoulder' then 8 else 9 end;
  v_done integer := 0;
begin
  if p_mobility_focus <> v_expected then raise exception 'Mauvaise DAILY pour ce jour.'; end if;

  select count(*)::integer into v_done
  from public.athlete_mobility_set_runs_v248 r
  where r.athlete_slug=p_athlete_slug and r.activity_date=p_activity_date
    and r.mobility_focus=p_mobility_focus and r.completed_at is not null
    and public.mobility_set_allowed_v248(r.mobility_focus,r.exercise_key,r.set_index);

  if v_done < v_required then
    raise exception 'Routine incomplète : %/% séries validées.',v_done,v_required;
  end if;

  insert into public.athlete_daily_wellness as w(
    athlete_slug,activity_date,mobility_focus,mobility_completed_at,updated_at
  ) values(p_athlete_slug,p_activity_date,p_mobility_focus,clock_timestamp(),clock_timestamp())
  on conflict(athlete_slug,activity_date) do update set
    mobility_focus=excluded.mobility_focus,
    mobility_completed_at=coalesce(w.mobility_completed_at,excluded.mobility_completed_at),
    updated_at=clock_timestamp();

  return query
  select w.athlete_slug,w.activity_date,w.mobility_focus,w.mobility_completed_at
  from public.athlete_daily_wellness w
  where w.athlete_slug=p_athlete_slug and w.activity_date=p_activity_date;
end;
$$;

grant execute on function public.start_mobility_set_v248(text,date,text,text,integer) to authenticated;
grant execute on function public.complete_mobility_set_v248(text,date,text,text,integer) to authenticated;
grant execute on function public.validate_mobility_day_v248(text,date,text) to authenticated;


create or replace function public.ga_level_from_xp_v248(p_total_xp numeric)
returns integer
language plpgsql
immutable
as $$
declare
  v_total numeric:=greatest(coalesce(p_total_xp,0),0);
  v_level integer:=1;
  v_spent numeric:=0;
  v_cost numeric:=50;
begin
  while v_level<1000 and v_total>=v_spent+v_cost loop
    v_spent:=v_spent+v_cost;
    v_level:=v_level+1;
    v_cost:=round(50*power(1.2,greatest(0,v_level-1)));
  end loop;
  return v_level;
end;
$$;

-- 10k = XP ×1 ; 15k = ×1,5 ; 20k+ = XP ×2 le lendemain.
create or replace function public.apply_step_xp_bonus_v248(
  p_athlete_slug text,p_program_key text,p_week_index integer,p_day_index integer,
  p_set_index integer,p_exercise_code text,p_training_date date,p_base_xp integer
)
returns table(source_steps integer,xp_multiplier numeric,bonus_xp integer,total_xp_after numeric,level_after integer,level_up boolean)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_source_date date:=p_training_date-1;
  v_steps integer:=0;
  v_multiplier numeric:=1;
  v_base integer:=greatest(0,least(coalesce(p_base_xp,0),1000000));
  v_bonus integer:=0;
  v_rows integer:=0;
  v_total_before numeric:=0;
  v_total_after numeric:=0;
  v_level_before integer:=1;
  v_level_after integer:=1;
begin
  select coalesce(w.steps,0) into v_steps
  from public.athlete_daily_wellness w
  where w.athlete_slug=p_athlete_slug and w.activity_date=v_source_date;
  v_steps:=coalesce(v_steps,0);

  if v_steps>10000 then
    v_multiplier:=least(2::numeric,1::numeric+((v_steps-10000)::numeric/10000::numeric));
  end if;
  v_bonus:=greatest(0,round(v_base*(v_multiplier-1))::integer);

  select coalesce(ap.xp_total,0),coalesce(ap.level,1)
  into v_total_before,v_level_before
  from public.athlete_progress ap where ap.athlete_slug=p_athlete_slug for update;
  if not found then return query select v_steps,v_multiplier,0,0::numeric,1,false; return; end if;

  insert into public.athlete_step_xp_bonus_v248(
    athlete_slug,program_key,week_index,day_index,set_index,exercise_code,training_date,
    source_activity_date,source_steps,xp_multiplier,base_xp,bonus_xp
  ) values(
    p_athlete_slug,coalesce(p_program_key,''),coalesce(p_week_index,0),coalesce(p_day_index,0),
    coalesce(p_set_index,0),coalesce(p_exercise_code,''),p_training_date,v_source_date,
    v_steps,v_multiplier,v_base,v_bonus
  ) on conflict do nothing;
  get diagnostics v_rows=row_count;

  if v_rows>0 and v_bonus>0 then
    v_total_after:=v_total_before+v_bonus;
    v_level_after:=greatest(v_level_before,public.ga_level_from_xp_v248(v_total_after));
    update public.athlete_progress
    set xp_total=v_total_after,level=v_level_after
    where athlete_slug=p_athlete_slug;
  else
    v_bonus:=0; v_total_after:=v_total_before; v_level_after:=v_level_before;
  end if;

  return query select v_steps,v_multiplier,v_bonus,v_total_after,v_level_after,(v_level_after>v_level_before);
end;
$$;

grant execute on function public.apply_step_xp_bonus_v248(text,text,integer,integer,integer,text,date,integer) to authenticated;

-- Coffres standards : DAILY validée = deux vrais tirages pour le prix d'un.
-- L'ancien moteur v20 reste l'unique moteur de rareté / inventaire.
create or replace function public.open_rpg_cases_v248(
  p_athlete_slug text,
  p_item_level integer,
  p_case_type text,
  p_quantity integer
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_today date:=(now() at time zone 'Europe/Paris')::date;
  v_bonus boolean:=false;
  v_cost numeric:=0;
  v_first jsonb:='[]'::jsonb;
  v_second jsonb:='[]'::jsonb;
begin
  select exists(
    select 1 from public.athlete_daily_wellness w
    where w.athlete_slug=p_athlete_slug and w.activity_date=v_today
      and w.mobility_completed_at is not null
      and w.mobility_focus=public.mobility_focus_for_date_v248(v_today)
  ) into v_bonus;

  select public.rpg_case_price_v20(p_athlete_slug,p_item_level,p_case_type)::numeric into v_cost;

  select coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb)
  into v_first
  from public.open_rpg_cases_v20(p_athlete_slug,p_item_level,p_case_type,p_quantity) r;

  if v_bonus then
    -- Rembourse le coût d'un lot AVANT le deuxième tirage : même un joueur qui
    -- possède exactement le prix d'un coffre peut profiter du bonus.
    update public.athlete_progress
    set gold_balance=coalesce(gold_balance,0)+greatest(0,coalesce(v_cost,0))*greatest(1,coalesce(p_quantity,1))
    where athlete_slug=p_athlete_slug;

    select coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb)
    into v_second
    from public.open_rpg_cases_v20(p_athlete_slug,p_item_level,p_case_type,p_quantity) r;
  end if;

  return jsonb_build_object(
    'items',v_first||v_second,
    'mobility_bonus_active',v_bonus,
    'roll_multiplier',case when v_bonus then 2 else 1 end
  );
end;
$$;

grant execute on function public.open_rpg_cases_v248(text,integer,text,integer) to authenticated;

commit;
