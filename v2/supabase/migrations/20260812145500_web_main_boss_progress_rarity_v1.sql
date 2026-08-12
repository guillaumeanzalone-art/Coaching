-- WEB MAIN BOSS PROGRESS RARITY V1
-- Le RPC finish_rpg_combat_v166 actuel ajoute déjà +1 en cas de victoire.
-- Cette fonction ajoute uniquement le complément nécessaire.
-- Elle est appelée uniquement par le site legacy main/app.js.

create table if not exists
public.rpg_boss_progress_awards_web_v1 (
  combat_id text primary key,
  athlete_slug text not null,
  rarity text not null,
  total_gain integer not null,
  extra_gain integer not null,
  created_by uuid,
  created_at timestamptz not null
    default now()
);

alter table
public.rpg_boss_progress_awards_web_v1
enable row level security;

revoke all
on table
public.rpg_boss_progress_awards_web_v1
from anon, authenticated;

create or replace function
public.award_rpg_boss_progress_rarity_web_v1(
  p_combat_id text,
  p_athlete_slug text,
  p_rarity text
)
returns table (
  total_gain integer,
  extra_gain integer,
  kills_toward_boss integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_rarity text;
  v_total_gain integer;
  v_extra_gain integer;
  v_inserted integer := 0;
  v_kills integer := 0;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if coalesce(trim(p_combat_id), '') = '' then
    raise exception 'COMBAT_ID_REQUIRED';
  end if;

  if coalesce(trim(p_athlete_slug), '') = '' then
    raise exception 'ATHLETE_REQUIRED';
  end if;

  if not public.can_edit_athlete(
    trim(p_athlete_slug)
  ) then
    raise exception 'FORBIDDEN';
  end if;

  v_rarity :=
    lower(
      replace(
        replace(
          trim(
            coalesce(
              p_rarity,
              'normal'
            )
          ),
          '-',
          '_'
        ),
        ' ',
        '_'
      )
    );

  v_rarity :=
    case v_rarity
      when 'simple' then 'normal'
      when 'peu_commun' then 'uncommon'
      when 'legendaire' then 'legendary'
      when 'mythique' then 'mythic'
      when 'urm' then 'ultra_mythic'
      when 'ultra' then 'ultra_mythic'
      when 'ultra_mythique' then 'ultra_mythic'
      when 'ultra_rare_mythique' then 'ultra_mythic'
      else v_rarity
    end;

  v_total_gain :=
    case v_rarity
      when 'normal' then 2
      when 'common' then 3
      when 'uncommon' then 4
      when 'rare' then 8
      when 'epic' then 16
      when 'legendary' then 30
      when 'mythic' then 50
      when 'ultra_mythic' then 50
      when 'abyssal' then 50
      else 2
    end;

  v_extra_gain :=
    greatest(
      v_total_gain - 1,
      0
    );

  insert into
  public.rpg_boss_progress_awards_web_v1 (
    combat_id,
    athlete_slug,
    rarity,
    total_gain,
    extra_gain,
    created_by
  )
  values (
    trim(p_combat_id),
    trim(p_athlete_slug),
    v_rarity,
    v_total_gain,
    v_extra_gain,
    v_user_id
  )
  on conflict (combat_id)
  do nothing;

  get diagnostics
    v_inserted = row_count;

  if v_inserted > 0 then
    update public.athlete_progress
    set kills_toward_boss =
      least(
        50,
        coalesce(
          kills_toward_boss,
          0
        ) +
        v_extra_gain
      )
    where athlete_slug =
      trim(p_athlete_slug);
  end if;

  select
    coalesce(
      ap.kills_toward_boss,
      0
    )
  into v_kills
  from public.athlete_progress ap
  where ap.athlete_slug =
    trim(p_athlete_slug);

  return query
  select
    v_total_gain,
    case
      when v_inserted > 0
        then v_extra_gain
      else 0
    end,
    least(
      50,
      coalesce(
        v_kills,
        0
      )
    );
end;
$$;

revoke all
on function
public.award_rpg_boss_progress_rarity_web_v1(
  text,
  text,
  text
)
from public, anon;

grant execute
on function
public.award_rpg_boss_progress_rarity_web_v1(
  text,
  text,
  text
)
to authenticated;
