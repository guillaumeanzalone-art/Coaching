-- GA Coaching V2.50 — édition manuelle des PR SBD ×1…×9.
-- Une modification manuelle remplace la valeur affichée, même si elle est
-- inférieure à l'ancien historique importé.

create or replace function public.set_sbd_rep_pr_v250(
  p_athlete_slug text,
  p_lift text,
  p_reps integer,
  p_load_kg numeric
)
returns public.athlete_sbd_rep_prs_v249
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.athlete_sbd_rep_prs_v249;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentification requise.';
  end if;

  if nullif(trim(p_athlete_slug), '') is null then
    raise exception 'Athlète invalide.';
  end if;

  if not public.can_edit_athlete(lower(trim(p_athlete_slug))) then
    raise exception 'Accès refusé pour cet athlète.';
  end if;

  if p_lift not in ('squat', 'bench', 'deadlift') then
    raise exception 'Mouvement SBD invalide.';
  end if;

  if p_reps is null or p_reps < 1 or p_reps > 9 then
    raise exception 'Nombre de répétitions invalide.';
  end if;

  if p_load_kg is null or p_load_kg <= 0 or p_load_kg > 1000 then
    raise exception 'Charge invalide.';
  end if;

  insert into public.athlete_sbd_rep_prs_v249 as target (
    athlete_slug,
    lift,
    reps,
    load_kg,
    exercise_name,
    achieved_label,
    source_label,
    achieved_at,
    updated_at
  ) values (
    lower(trim(p_athlete_slug)),
    p_lift,
    p_reps,
    p_load_kg,
    'Modification manuelle',
    '',
    'Modification manuelle',
    clock_timestamp(),
    clock_timestamp()
  )
  on conflict (athlete_slug, lift, reps) do update set
    load_kg = excluded.load_kg,
    exercise_name = excluded.exercise_name,
    achieved_label = excluded.achieved_label,
    source_label = excluded.source_label,
    achieved_at = excluded.achieved_at,
    updated_at = excluded.updated_at
  returning target.* into v_row;

  return v_row;
end;
$$;

revoke all on function public.set_sbd_rep_pr_v250(text, text, integer, numeric)
from public, anon;

grant execute on function public.set_sbd_rep_pr_v250(text, text, integer, numeric)
to authenticated;
