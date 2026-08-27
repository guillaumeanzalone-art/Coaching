-- GA COACHING V5.1
-- FIX URM / SECRET -> +50 PROGRESSION BOSS
--
-- Règles officielles :
-- Simple +2 / Commun +3 / Peu commun +4 / Rare +8 / Épique +16
-- Légendaire +30 / Mythique +50 / Ultra Rare Mythique +50 / Abyssal +50
--
-- finish_rpg_combat_v166 crédite déjà +1 sur une victoire normale.
-- Cette RPC crédite donc uniquement le complément nécessaire.
-- Elle lit maintenant la rareté DIRECTEMENT dans rpg_combats : le client ne peut
-- plus envoyer une rareté incorrecte, et l'ancien type "secret" est assimilé à URM.

begin;

create table if not exists public.rpg_boss_progress_awards_web_v2 (
  combat_id text primary key,
  athlete_slug text not null,
  rarity text not null,
  total_gain integer not null,
  extra_gain integer not null,
  created_by uuid,
  created_at timestamptz not null default now()
);

alter table public.rpg_boss_progress_awards_web_v2 enable row level security;

create or replace function public.award_rpg_boss_progress_rarity_web_v2(
  p_combat_id text,
  p_athlete_slug text,
  p_rarity text default null
)
returns table (
  total_gain integer,
  extra_gain integer,
  kills_toward_boss integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_user_id uuid;
  v_db_rarity text;
  v_rarity text;
  v_total_gain integer;
  v_expected_extra integer;
  v_previous_extra integer := 0;
  v_apply_extra integer := 0;
  v_kills integer := 0;
  v_combat public.rpg_combats%rowtype;
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

  if not public.can_edit_athlete(trim(p_athlete_slug)) then
    raise exception 'FORBIDDEN';
  end if;

  -- La rareté de référence est celle du combat enregistré par le serveur.
  select rc.*
  into v_combat
  from public.rpg_combats rc
  where rc.id::text = trim(p_combat_id)
    and rc.athlete_slug = trim(p_athlete_slug)
  for update;

  if not found then
    raise exception 'COMBAT_NOT_FOUND';
  end if;

  if coalesce(v_combat.won, false) is not true
     or coalesce(v_combat.is_boss, false) is true then
    raise exception 'COMBAT_NOT_ELIGIBLE';
  end if;

  v_db_rarity := coalesce(v_combat.monster_rarity, p_rarity, 'normal');

  v_rarity := lower(
    replace(
      replace(trim(v_db_rarity), '-', '_'),
      ' ', '_'
    )
  );

  v_rarity := case v_rarity
    when 'simple' then 'normal'
    when 'peu_commun' then 'uncommon'
    when 'legendaire' then 'legendary'
    when 'mythique' then 'mythic'
    when 'urm' then 'ultra_mythic'
    when 'ultra' then 'ultra_mythic'
    when 'ultra_mythique' then 'ultra_mythic'
    when 'ultra_rare_mythique' then 'ultra_mythic'
    when 'secret' then 'ultra_mythic'
    else v_rarity
  end;

  v_total_gain := case v_rarity
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

  -- +1 vient déjà de finish_rpg_combat_v166.
  v_expected_extra := greatest(v_total_gain - 1, 0);

  select coalesce(a.extra_gain, 0)
  into v_previous_extra
  from public.rpg_boss_progress_awards_web_v2 a
  where a.combat_id = trim(p_combat_id)
  for update;

  if not found then
    v_previous_extra := 0;

    insert into public.rpg_boss_progress_awards_web_v2 (
      combat_id,
      athlete_slug,
      rarity,
      total_gain,
      extra_gain,
      created_by
    ) values (
      trim(p_combat_id),
      trim(p_athlete_slug),
      v_rarity,
      v_total_gain,
      v_expected_extra,
      v_user_id
    );
  else
    update public.rpg_boss_progress_awards_web_v2 a
    set rarity = v_rarity,
        total_gain = v_total_gain,
        extra_gain = v_expected_extra
    where a.combat_id = trim(p_combat_id);
  end if;

  -- Si un ancien "secret" avait déjà reçu +1 de complément au lieu de +49,
  -- on n'ajoute que la différence. Idempotent même si la RPC est rejouée.
  v_apply_extra := greatest(v_expected_extra - v_previous_extra, 0);

  if v_apply_extra > 0 then
    update public.athlete_progress ap
    set kills_toward_boss = least(
          50,
          greatest(0, coalesce(ap.kills_toward_boss, 0)) + v_apply_extra
        ),
        updated_at = now()
    where ap.athlete_slug = trim(p_athlete_slug);
  end if;

  select coalesce(ap.kills_toward_boss, 0)
  into v_kills
  from public.athlete_progress ap
  where ap.athlete_slug = trim(p_athlete_slug);

  return query select
    v_total_gain,
    v_apply_extra,
    least(50, coalesce(v_kills, 0));
end;
$function$;

revoke all on function public.award_rpg_boss_progress_rarity_web_v2(text,text,text)
from public, anon;

grant execute on function public.award_rpg_boss_progress_rarity_web_v2(text,text,text)
to authenticated;

-- ---------------------------------------------------------------------------
-- RÉPARATION DES URM DÉJÀ GAGNÉS DANS LE CYCLE DE BOSS ACTUEL
-- ---------------------------------------------------------------------------
-- 1) Un ancien award "secret"/URM mal valorisé est recalculé à +50.
-- 2) Un URM gagné dont l'appel de bonus avait échoué est également récupéré.
-- 3) On ignore tous les combats antérieurs au dernier boss vaincu afin de ne
--    jamais recréditer un ancien cycle de progression.

with eligible as (
  select
    rc.id::text as combat_id,
    rc.athlete_slug,
    case
      when lower(coalesce(rc.monster_rarity,'')) in (
        'secret','urm','ultra','ultra_mythique','ultra_rare_mythique'
      ) then 'ultra_mythic'
      else lower(coalesce(rc.monster_rarity,''))
    end as rarity,
    rc.finished_at,
    coalesce(a.extra_gain,0) as old_extra,
    ap.last_boss_at
  from public.rpg_combats rc
  join public.athlete_progress ap
    on ap.athlete_slug = rc.athlete_slug
  left join public.rpg_boss_progress_awards_web_v2 a
    on a.combat_id = rc.id::text
  where coalesce(rc.won,false) = true
    and coalesce(rc.is_boss,false) = false
    and lower(coalesce(rc.monster_rarity,'')) in (
      'ultra_mythic','secret','urm','ultra','ultra_mythique','ultra_rare_mythique'
    )
    and rc.finished_at is not null
    and rc.finished_at > coalesce(ap.last_boss_at, '-infinity'::timestamptz)
),
need as (
  select *, greatest(49 - old_extra,0) as delta
  from eligible
  where old_extra < 49
),
per_athlete as (
  select athlete_slug, sum(delta)::integer as delta
  from need
  group by athlete_slug
)
update public.athlete_progress ap
set kills_toward_boss = least(
      50,
      greatest(0,coalesce(ap.kills_toward_boss,0)) + p.delta
    ),
    updated_at = now()
from per_athlete p
where ap.athlete_slug = p.athlete_slug;

insert into public.rpg_boss_progress_awards_web_v2 (
  combat_id, athlete_slug, rarity, total_gain, extra_gain, created_by, created_at
)
select
  rc.id::text,
  rc.athlete_slug,
  'ultra_mythic',
  50,
  49,
  null,
  coalesce(rc.finished_at,now())
from public.rpg_combats rc
join public.athlete_progress ap
  on ap.athlete_slug = rc.athlete_slug
left join public.rpg_boss_progress_awards_web_v2 a
  on a.combat_id = rc.id::text
where coalesce(rc.won,false) = true
  and coalesce(rc.is_boss,false) = false
  and lower(coalesce(rc.monster_rarity,'')) in (
    'ultra_mythic','secret','urm','ultra','ultra_mythique','ultra_rare_mythique'
  )
  and rc.finished_at is not null
  and rc.finished_at > coalesce(ap.last_boss_at, '-infinity'::timestamptz)
  and a.combat_id is null
on conflict (combat_id) do update
set rarity='ultra_mythic', total_gain=50, extra_gain=49;

update public.rpg_boss_progress_awards_web_v2 a
set rarity = 'ultra_mythic',
    total_gain = 50,
    extra_gain = 49
from public.rpg_combats rc
join public.athlete_progress ap
  on ap.athlete_slug = rc.athlete_slug
where a.combat_id = rc.id::text
  and coalesce(rc.won,false) = true
  and coalesce(rc.is_boss,false) = false
  and lower(coalesce(rc.monster_rarity,'')) in (
    'ultra_mythic','secret','urm','ultra','ultra_mythique','ultra_rare_mythique'
  )
  and rc.finished_at > coalesce(ap.last_boss_at, '-infinity'::timestamptz);

commit;

select pg_notify('pgrst','reload schema');
