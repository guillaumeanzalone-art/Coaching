-- Inputs agrégés pour le leaderboard Difficulté.
-- Les utilisateurs authentifiés voient uniquement les métadonnées nécessaires
-- au classement : bloc courant, programme courant, multiplicateur GL et
-- dernière semaine active enregistrée.

create or replace function public.get_difficulty_leaderboard_inputs_v252()
returns table(
  athlete_slug text,
  block_key text,
  block_number integer,
  block_title text,
  program_json jsonb,
  profile_body_weight numeric,
  gl_multiplier numeric,
  latest_program_key text,
  latest_week_index smallint,
  latest_activity_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  return query
  select
    p.slug::text as athlete_slug,
    b.block_key::text,
    b.block_number,
    b.title::text as block_title,
    b.program_json,
    p.body_weight as profile_body_weight,
    coalesce(ap.gl_multiplier, 1)::numeric as gl_multiplier,
    ws.program_key::text as latest_program_key,
    ws.week_index,
    ws.updated_at as latest_activity_at
  from public.athlete_profiles_v3 p
  left join lateral (
    select
      x.block_key,
      x.block_number,
      x.title,
      x.program_json
    from public.athlete_program_blocks_v3 x
    where lower(x.athlete_slug) = lower(p.slug)
      and x.status = 'current'
    order by x.updated_at desc, x.block_number desc
    limit 1
  ) b on true
  left join public.athlete_progress ap
    on lower(ap.athlete_slug) = lower(p.slug)
  left join lateral (
    select
      w.program_key,
      w.week_index,
      w.updated_at
    from public.workout_sets w
    where lower(w.athlete_slug) = lower(p.slug)
    order by w.updated_at desc
    limit 1
  ) ws on true
  where coalesce(p.active, true) = true
  order by p.sort_order nulls last, p.display_name, p.slug;
end;
$$;

revoke all on function public.get_difficulty_leaderboard_inputs_v252() from public;
grant execute on function public.get_difficulty_leaderboard_inputs_v252() to authenticated;
