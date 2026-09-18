-- Steps leaderboard security hardening.
-- Authenticated users may read the daily leaderboard.
-- Writes are limited to the athlete owner or the coach via can_edit_athlete().

drop policy if exists wellness_authenticated_all_v247
  on public.athlete_daily_wellness;

drop policy if exists wellness_read_authenticated_v251
  on public.athlete_daily_wellness;
drop policy if exists wellness_insert_editable_v251
  on public.athlete_daily_wellness;
drop policy if exists wellness_update_editable_v251
  on public.athlete_daily_wellness;
drop policy if exists wellness_delete_editable_v251
  on public.athlete_daily_wellness;

create policy wellness_read_authenticated_v251
  on public.athlete_daily_wellness
  for select
  to authenticated
  using (true);

create policy wellness_insert_editable_v251
  on public.athlete_daily_wellness
  for insert
  to authenticated
  with check (
    public.can_edit_athlete(athlete_slug)
  );

create policy wellness_update_editable_v251
  on public.athlete_daily_wellness
  for update
  to authenticated
  using (
    public.can_edit_athlete(athlete_slug)
  )
  with check (
    public.can_edit_athlete(athlete_slug)
  );

create policy wellness_delete_editable_v251
  on public.athlete_daily_wellness
  for delete
  to authenticated
  using (
    public.can_edit_athlete(athlete_slug)
  );

create or replace function public.sync_athlete_steps_v247(
  p_athlete_slug text,
  p_activity_date date,
  p_steps integer,
  p_source text default 'healthkit'::text
)
returns table(
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
  v_steps integer :=
    greatest(
      0,
      least(
        coalesce(p_steps, 0),
        200000
      )
    );
begin
  if auth.uid() is null
     or not public.can_edit_athlete(
       p_athlete_slug
     ) then
    raise exception
      'Accès refusé pour cet athlète';
  end if;

  if coalesce(
    trim(p_athlete_slug),
    ''
  ) = '' then
    raise exception
      'athlete slug required';
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
    coalesce(
      nullif(trim(p_source), ''),
      'healthkit'
    ),
    now(),
    now()
  )
  on conflict on constraint
    athlete_daily_wellness_pkey
  do update set
    steps =
      greatest(
        w.steps,
        excluded.steps
      ),
    step_source =
      excluded.step_source,
    step_synced_at =
      excluded.step_synced_at,
    updated_at =
      now();

  return query
  select
    w.athlete_slug,
    w.activity_date,
    w.steps,
    w.step_source,
    w.step_synced_at
  from public.athlete_daily_wellness w
  where w.athlete_slug =
      p_athlete_slug
    and w.activity_date =
      p_activity_date;
end;
$$;
