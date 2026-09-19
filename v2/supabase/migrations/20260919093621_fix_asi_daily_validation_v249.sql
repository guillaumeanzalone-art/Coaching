-- Corrige l'ambiguïté entre les colonnes de retour PL/pgSQL et la clé primaire.

begin;

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
  on conflict on constraint athlete_daily_wellness_pkey
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

revoke all on function public.validate_mobility_day_v249(text, date, text)
  from public, anon;
grant execute on function public.validate_mobility_day_v249(text, date, text)
  to authenticated;

commit;
