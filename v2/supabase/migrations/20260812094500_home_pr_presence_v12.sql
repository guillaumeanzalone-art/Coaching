-- GA Coaching V1.2 - Home live + PR SBD

create table if not exists public.app_presence_v2 (
  user_id uuid primary key
    references auth.users(id)
    on delete cascade,
  athlete_slug text,
  display_name text,
  last_seen_at timestamptz
    not null
    default now()
);

create index if not exists
  app_presence_v2_last_seen_idx
on public.app_presence_v2 (
  last_seen_at desc
);

alter table
  public.app_presence_v2
enable row level security;

drop policy if exists
  "app_presence_v2_select"
on public.app_presence_v2;

create policy
  "app_presence_v2_select"
on public.app_presence_v2
for select
to authenticated
using (true);

drop policy if exists
  "app_presence_v2_insert_own"
on public.app_presence_v2;

create policy
  "app_presence_v2_insert_own"
on public.app_presence_v2
for insert
to authenticated
with check (
  user_id = auth.uid()
);

drop policy if exists
  "app_presence_v2_update_own"
on public.app_presence_v2;

create policy
  "app_presence_v2_update_own"
on public.app_presence_v2
for update
to authenticated
using (
  user_id = auth.uid()
)
with check (
  user_id = auth.uid()
);

drop policy if exists
  "app_presence_v2_delete_own"
on public.app_presence_v2;

create policy
  "app_presence_v2_delete_own"
on public.app_presence_v2
for delete
to authenticated
using (
  user_id = auth.uid()
);

grant
  select,
  insert,
  update,
  delete
on public.app_presence_v2
to authenticated;


create table if not exists public.athlete_sbd_prs_v2 (
  id uuid primary key
    default gen_random_uuid(),
  athlete_slug text not null,
  lift text not null
    check (
      lift in (
        'squat',
        'bench',
        'deadlift'
      )
    ),
  load_kg numeric not null
    check (
      load_kg > 0
    ),
  reps integer,
  exercise_name text,
  program_key text,
  week_index integer,
  day_index integer,
  set_index integer,
  achieved_at timestamptz
    not null
    default now(),
  created_by uuid
    references auth.users(id)
    on delete set null
    default auth.uid(),
  updated_by uuid
    references auth.users(id)
    on delete set null
    default auth.uid(),
  updated_at timestamptz
    not null
    default now(),
  unique (
    athlete_slug,
    lift
  )
);

create index if not exists
  athlete_sbd_prs_v2_latest_idx
on public.athlete_sbd_prs_v2 (
  achieved_at desc
);

alter table
  public.athlete_sbd_prs_v2
enable row level security;

drop policy if exists
  "athlete_sbd_prs_v2_select"
on public.athlete_sbd_prs_v2;

create policy
  "athlete_sbd_prs_v2_select"
on public.athlete_sbd_prs_v2
for select
to authenticated
using (true);

drop policy if exists
  "athlete_sbd_prs_v2_insert"
on public.athlete_sbd_prs_v2;

create policy
  "athlete_sbd_prs_v2_insert"
on public.athlete_sbd_prs_v2
for insert
to authenticated
with check (
  public.can_edit_athlete(
    athlete_slug
  )
);

drop policy if exists
  "athlete_sbd_prs_v2_update"
on public.athlete_sbd_prs_v2;

create policy
  "athlete_sbd_prs_v2_update"
on public.athlete_sbd_prs_v2
for update
to authenticated
using (
  public.can_edit_athlete(
    athlete_slug
  )
)
with check (
  public.can_edit_athlete(
    athlete_slug
  )
);

grant
  select,
  insert,
  update
on public.athlete_sbd_prs_v2
to authenticated;


drop function if exists
  public.record_sbd_pr_v2(
    text,
    text,
    numeric,
    integer,
    text,
    integer,
    integer,
    integer,
    text
  );

create or replace function
  public.record_sbd_pr_v2(
    p_athlete_slug text,
    p_lift text,
    p_load_kg numeric,
    p_reps integer default null,
    p_program_key text default null,
    p_week_index integer default null,
    p_day_index integer default null,
    p_set_index integer default null,
    p_exercise_name text default null
  )
returns table (
  is_pr boolean,
  previous_load numeric,
  current_load numeric,
  lift_code text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_previous numeric;
begin
  if not public.can_edit_athlete(
    p_athlete_slug
  ) then
    raise exception
      'Not allowed to edit athlete %',
      p_athlete_slug;
  end if;

  if p_lift not in (
    'squat',
    'bench',
    'deadlift'
  ) then
    raise exception
      'Invalid lift %',
      p_lift;
  end if;

  if (
    p_load_kg is null
    or p_load_kg <= 0
  ) then
    raise exception
      'Invalid load';
  end if;

  select
    load_kg
  into
    v_previous
  from
    public.athlete_sbd_prs_v2
  where
    athlete_slug =
      p_athlete_slug
    and lift =
      p_lift;

  if (
    v_previous is null
    or p_load_kg >
      v_previous
  ) then
    insert into
      public.athlete_sbd_prs_v2 (
        athlete_slug,
        lift,
        load_kg,
        reps,
        exercise_name,
        program_key,
        week_index,
        day_index,
        set_index,
        achieved_at,
        updated_by,
        updated_at
      )
    values (
      p_athlete_slug,
      p_lift,
      p_load_kg,
      p_reps,
      p_exercise_name,
      p_program_key,
      p_week_index,
      p_day_index,
      p_set_index,
      now(),
      auth.uid(),
      now()
    )
    on conflict (
      athlete_slug,
      lift
    )
    do update set
      load_kg =
        excluded.load_kg,
      reps =
        excluded.reps,
      exercise_name =
        excluded.exercise_name,
      program_key =
        excluded.program_key,
      week_index =
        excluded.week_index,
      day_index =
        excluded.day_index,
      set_index =
        excluded.set_index,
      achieved_at =
        excluded.achieved_at,
      updated_by =
        auth.uid(),
      updated_at =
        now();

    return query
    select
      true,
      v_previous,
      p_load_kg,
      p_lift;

    return;
  end if;

  return query
  select
    false,
    v_previous,
    v_previous,
    p_lift;
end;
$$;

grant execute
on function
  public.record_sbd_pr_v2(
    text,
    text,
    numeric,
    integer,
    text,
    integer,
    integer,
    integer,
    text
  )
to authenticated;
