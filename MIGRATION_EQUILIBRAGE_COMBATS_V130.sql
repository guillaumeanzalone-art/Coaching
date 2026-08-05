begin;

-- ============================================================================
-- GA COACHING RPG — V130
-- ÉQUILIBRAGE DES PV, DES PALIERS ET DES COMBATS SPÉCIAUX
--
-- Principes :
--   • équilibre autour d'un nombre de frappes plutôt que de PV arbitraires ;
--   • avantage réel de l'équipement, mais plafonné pour éviter les combats
--     instantanés ou mathématiquement impossibles ;
--   • transition continue entre les paliers 100 et 101 ;
--   • durées adaptées à la rareté ;
--   • Noah, Val et Hanzalone raccourcis et recalibrés séparément ;
--   • aucun reset de compte, d'objet, de gold, d'XP ou de progression.
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1. COURBE DE PUISSANCE CONSEILLÉE SANS MUR 100 -> 101
-- --------------------------------------------------------------------------
create or replace function public.rpg_required_power_for_difficulty(
  p_difficulty integer
)
returns numeric
language sql
immutable
set search_path = public
as $$
  with d as (
    select least(10000, greatest(1, coalesce(p_difficulty, 1)))::numeric as value
  )
  select round(
    case
      when value <= 10 then
        1 + (value - 1) * (19::numeric / 9)
      when value <= 25 then
        20 + (value - 10) * (25::numeric / 15)
      when value <= 50 then
        45 + (value - 25) * (45::numeric / 25)
      when value <= 75 then
        90 + (value - 50) * (70::numeric / 25)
      when value <= 100 then
        160 + (value - 75) * (115::numeric / 25)
      when value <= 250 then
        275 + (value - 100) * (425::numeric / 150)
      when value <= 500 then
        700 + (value - 250) * (500::numeric / 250)
      when value <= 1000 then
        1200 + (value - 500) * (1000::numeric / 500)
      when value <= 2500 then
        2200 + (value - 1000) * (3800::numeric / 1500)
      when value <= 5000 then
        6000 + (value - 2500) * (9000::numeric / 2500)
      when value <= 7500 then
        15000 + (value - 5000) * (15000::numeric / 2500)
      else
        30000 + (value - 7500) * (30000::numeric / 2500)
    end,
    2
  )
  from d;
$$;

-- --------------------------------------------------------------------------
-- 2. OBJECTIFS DE FRAPPES ET DURÉES PAR RARETÉ
-- --------------------------------------------------------------------------
create or replace function public.rpg_target_hits_for_rarity(
  p_rarity text
)
returns numeric
language sql
immutable
set search_path = public
as $$
  select case lower(coalesce(p_rarity, 'common'))
    when 'normal' then 90::numeric
    when 'common' then 90::numeric
    when 'uncommon' then 105::numeric
    when 'rare' then 120::numeric
    when 'epic' then 140::numeric
    when 'legendary' then 165::numeric
    when 'mythic' then 190::numeric
    when 'secret' then 225::numeric
    else 90::numeric
  end;
$$;

create or replace function public.rpg_target_duration_for_rarity(
  p_rarity text
)
returns integer
language sql
immutable
set search_path = public
as $$
  select case lower(coalesce(p_rarity, 'common'))
    when 'normal' then 30
    when 'common' then 30
    when 'uncommon' then 35
    when 'rare' then 40
    when 'epic' then 50
    when 'legendary' then 65
    when 'mythic' then 80
    when 'secret' then 100
    else 30
  end;
$$;

-- Le coefficient individuel d'un monstre conserve un peu de variété, mais ne
-- peut plus transformer une rencontre ordinaire en sac à PV ×5 ou ×20.
create or replace function public.rpg_monster_endurance_factor(
  p_hp_multiplier numeric
)
returns numeric
language sql
immutable
set search_path = public
as $$
  select greatest(
    0.80::numeric,
    least(1.40::numeric, coalesce(p_hp_multiplier, 1::numeric))
  );
$$;

-- ratio = dégâts recommandés / dégâts réels
-- L'exposant 0,70 adoucit l'écart. La borne 0,60 / 2,00 conserve l'intérêt de
-- l'équipement sans autoriser un combat instantané ou un mur impossible.
create or replace function public.rpg_balanced_target_hits(
  p_base_hits numeric,
  p_actual_damage numeric,
  p_recommended_damage numeric
)
returns numeric
language sql
immutable
set search_path = public
as $$
  with values_safe as (
    select
      greatest(1::numeric, coalesce(p_base_hits, 90::numeric)) as base_hits,
      greatest(0.01::numeric, coalesce(p_actual_damage, 1::numeric)) as actual_damage,
      greatest(0.01::numeric, coalesce(p_recommended_damage, 1::numeric)) as recommended_damage
  )
  select round(
    greatest(
      base_hits * 0.60::numeric,
      least(
        base_hits * 2.00::numeric,
        base_hits * power(recommended_damage / actual_damage, 0.70::numeric)
      )
    ),
    2
  )
  from values_safe;
$$;

-- Multiplicateur lisible conservé pour l'interface et les fonctions existantes.
create or replace function public.rpg_difficulty_hp_multiplier(
  p_difficulty integer
)
returns numeric
language sql
immutable
set search_path = public
as $$
  select public.rpg_power_damage_multiplier(
    public.rpg_required_power_for_difficulty(p_difficulty)
  ) / public.rpg_power_damage_multiplier(1);
$$;

-- --------------------------------------------------------------------------
-- 3. COMBAT ORDINAIRE : PV BASÉS SUR UN OBJECTIF DE FRAPPES
-- --------------------------------------------------------------------------
create or replace function public.start_rpg_combat_tier(
  p_athlete_slug text,
  p_difficulty integer
)
returns table(
  combat_id uuid,
  rpg_class text,
  level integer,
  xp_total numeric,
  monster_name text,
  monster_hp numeric,
  base_damage numeric,
  duration_seconds integer,
  started_at timestamptz,
  difficulty integer,
  hp_multiplier numeric,
  xp_multiplier numeric,
  crit_seed integer,
  crit_chance_pct numeric,
  monster_rarity text,
  monster_world text
)
language plpgsql
security definer
set search_path = public
as $start_tier_v130$
declare
  v_class text;
  v_level integer;
  v_xp numeric;
  v_difficulty integer;
  v_power_score numeric;
  v_required_power numeric;
  v_damage_pct numeric;
  v_reference_damage numeric;
  v_recommended_damage numeric;
  v_base numeric;
  v_battle uuid;
  v_started_at timestamptz;
  v_existing_is_boss boolean;
  v_rolled record;
  v_hp numeric;
  v_hp_mult numeric;
  v_seed integer;
  v_crit numeric;
  v_t numeric;
  v_epic_boost numeric;
  v_target_hits numeric;
  v_balanced_hits numeric;
  v_duration integer;
begin
  if auth.uid() is null or not public.can_edit_athlete(p_athlete_slug) then
    raise exception 'Accès refusé pour cet athlète';
  end if;

  insert into public.athlete_progress(athlete_slug)
  values(p_athlete_slug)
  on conflict(athlete_slug) do nothing;

  select
    ap.rpg_class,
    ap.level,
    ap.xp_total,
    least(10000, greatest(1, coalesce(p_difficulty, 1)))
  into
    v_class,
    v_level,
    v_xp,
    v_difficulty
  from public.athlete_progress ap
  where ap.athlete_slug = p_athlete_slug;

  if v_class is null then
    raise exception 'Choisis d’abord une classe';
  end if;

  v_level := greatest(1, coalesce(v_level, 1));
  v_xp := greatest(0, coalesce(v_xp, 0));

  if v_difficulty > (
    select least(10000, greatest(1, coalesce(ap.adventure_difficulty, 1)))
    from public.athlete_progress ap
    where ap.athlete_slug = p_athlete_slug
  ) then
    raise exception 'Palier % non débloqué', v_difficulty;
  end if;

  select exists(
    select 1
    from public.rpg_combats rc
    where rc.athlete_slug = p_athlete_slug
      and rc.finished_at is null
      and coalesce(rc.is_boss, false) = true
  ) into v_existing_is_boss;

  if v_existing_is_boss then
    raise exception 'Un combat de boss est déjà en cours';
  end if;

  update public.rpg_combats rc
  set finished_at = now(), won = false
  where rc.athlete_slug = p_athlete_slug
    and rc.finished_at is null
    and coalesce(rc.is_boss, false) = false;

  v_power_score := coalesce(public.rpg_combat_power_score(p_athlete_slug), 0);
  v_required_power := public.rpg_required_power_for_difficulty(v_difficulty);
  v_damage_pct := coalesce(public.rpg_equipment_damage_bonus_pct(p_athlete_slug), 0);
  v_reference_damage := greatest(1, public.rpg_base_damage(v_level, v_xp));

  v_base := greatest(1, floor(
    v_reference_damage
    * public.rpg_power_damage_multiplier(v_power_score)
    * public.rpg_passive_damage_multiplier(v_damage_pct)
  ));

  -- Dégâts théoriques d'un joueur exactement équipé pour ce palier.
  v_recommended_damage := greatest(1, floor(
    v_reference_damage
    * public.rpg_power_damage_multiplier(v_required_power)
  ));

  v_t := ln(v_difficulty::numeric) / ln(10000::numeric);
  v_epic_boost := 1 + coalesce(
    public.rpg_equipped_passive_total(p_athlete_slug, 'epic_hunter'),
    0
  ) / 5;

  -- Les trois personnages spéciaux ne peuvent plus apparaître dans le pool
  -- ordinaire. Leur tirage absolu reste géré par start_rpg_combat_special_v25.
  select
    mc.monster_key,
    mc.monster_name,
    mc.rarity,
    mc.hp_multiplier,
    mc.gold_multiplier,
    mc.category
  into v_rolled
  from public.rpg_monster_catalog mc
  where v_level between mc.min_player_level and mc.max_player_level
    and mc.monster_key not in ('val_shadow', 'noah_nain', 'hanzalone_evil')
  order by
    -ln(greatest(random(), 0.000000000001))
    / greatest(
        0.00000001,
        mc.encounter_weight
        * case mc.rarity
            when 'common' then 1 - 0.45 * v_t
            when 'uncommon' then 1 + 0.45 * v_t
            when 'rare' then 1 + 1.75 * v_t
            when 'epic' then (1 + 2.25 * v_t) * v_epic_boost
            when 'legendary' then 0.06 * (1 + 3 * v_t)
            when 'mythic' then 0.015 * (1 + 3 * v_t)
            when 'secret' then 0.002 * (1 + 4 * v_t)
            else 1
          end
      )
  limit 1;

  if v_rolled.monster_key is null then
    select
      mc.monster_key,
      mc.monster_name,
      mc.rarity,
      mc.hp_multiplier,
      mc.gold_multiplier,
      mc.category
    into v_rolled
    from public.rpg_monster_catalog mc
    where mc.monster_key not in ('val_shadow', 'noah_nain', 'hanzalone_evil')
    order by random()
    limit 1;
  end if;

  if v_rolled.monster_key is null then
    raise exception 'Aucun monstre disponible';
  end if;

  v_target_hits :=
    public.rpg_target_hits_for_rarity(v_rolled.rarity)
    * public.rpg_monster_endurance_factor(v_rolled.hp_multiplier);

  v_balanced_hits := public.rpg_balanced_target_hits(
    v_target_hits,
    v_base,
    v_recommended_damage
  );

  v_hp := greatest(1, floor(v_base * v_balanced_hits));
  v_duration := public.rpg_target_duration_for_rarity(v_rolled.rarity);
  v_hp_mult := v_balanced_hits / 90::numeric;

  v_seed := 1 + floor(random() * 2147483645)::integer;
  v_crit := public.rpg_crit_chance_pct(p_athlete_slug);

  insert into public.rpg_combats as inserted_combat(
    athlete_slug,
    rpg_class,
    level_snapshot,
    xp_snapshot,
    monster_key,
    monster_name,
    monster_rarity,
    monster_hp,
    base_damage,
    duration_seconds,
    difficulty,
    is_boss,
    boss_for_difficulty,
    crit_seed,
    crit_chance_pct,
    created_by
  ) values (
    p_athlete_slug,
    v_class,
    v_level,
    v_xp,
    v_rolled.monster_key,
    v_rolled.monster_name,
    v_rolled.rarity,
    v_hp,
    v_base,
    v_duration,
    v_difficulty,
    false,
    null,
    v_seed,
    v_crit,
    auth.uid()
  )
  returning inserted_combat.id, inserted_combat.started_at
  into v_battle, v_started_at;

  if v_battle is null or v_hp <= 0 or v_base <= 0 then
    raise exception 'Combat invalide : identifiant, PV ou dégâts manquants';
  end if;

  return query
  select
    v_battle::uuid,
    v_class::text,
    v_level::integer,
    v_xp::numeric,
    coalesce(v_rolled.monster_name::text, 'Monstre'),
    v_hp::numeric,
    v_base::numeric,
    v_duration::integer,
    coalesce(v_started_at, clock_timestamp())::timestamptz,
    v_difficulty::integer,
    v_hp_mult::numeric,
    1::numeric,
    v_seed::integer,
    coalesce(v_crit, 0)::numeric,
    coalesce(v_rolled.rarity::text, 'common'),
    coalesce(v_rolled.category::text, 'Bestiaire');
end;
$start_tier_v130$;

-- --------------------------------------------------------------------------
-- 4. BOSS : 220 UNITÉS DE FRAPPES, 45 SECONDES, MÊME RATIO ADOUCI
-- --------------------------------------------------------------------------
create or replace function public.start_rpg_boss(
  p_athlete_slug text
)
returns table(
  combat_id uuid,
  rpg_class text,
  level integer,
  xp_total numeric,
  monster_name text,
  monster_hp numeric,
  base_damage numeric,
  duration_seconds integer,
  started_at timestamptz,
  difficulty integer,
  hp_multiplier numeric,
  crit_seed integer,
  crit_chance_pct numeric
)
language plpgsql
security definer
set search_path = public
as $start_boss_v130$
declare
  v_class text;
  v_level integer;
  v_xp numeric;
  v_difficulty integer;
  v_kills integer;
  v_power_score numeric;
  v_required_power numeric;
  v_damage_pct numeric;
  v_reference_damage numeric;
  v_recommended_damage numeric;
  v_base numeric;
  v_hp numeric;
  v_hp_mult numeric;
  v_balanced_hits numeric;
  v_battle uuid;
  v_seed integer;
  v_crit numeric;
begin
  if auth.uid() is null or not public.can_edit_athlete(p_athlete_slug) then
    raise exception 'Accès refusé pour cet athlète';
  end if;

  select
    ap.rpg_class,
    ap.level,
    ap.xp_total,
    ap.adventure_difficulty,
    ap.kills_toward_boss
  into
    v_class,
    v_level,
    v_xp,
    v_difficulty,
    v_kills
  from public.athlete_progress ap
  where ap.athlete_slug = p_athlete_slug
  for update;

  if v_class is null then
    raise exception 'Choisis d’abord une classe';
  end if;

  if coalesce(v_kills, 0) < 50 then
    raise exception
      'Il faut vaincre 50 monstres au palier % avant le boss (%/50)',
      v_difficulty,
      coalesce(v_kills, 0);
  end if;

  v_level := greatest(1, coalesce(v_level, 1));
  v_xp := greatest(0, coalesce(v_xp, 0));
  v_difficulty := least(10000, greatest(1, coalesce(v_difficulty, 1)));

  update public.rpg_combats rc
  set finished_at = now(), won = false
  where rc.athlete_slug = p_athlete_slug
    and rc.finished_at is null;

  v_power_score := coalesce(public.rpg_combat_power_score(p_athlete_slug), 0);
  v_required_power := public.rpg_required_power_for_difficulty(v_difficulty);
  v_damage_pct := coalesce(public.rpg_equipment_damage_bonus_pct(p_athlete_slug), 0);
  v_reference_damage := greatest(1, public.rpg_base_damage(v_level, v_xp));

  v_base := greatest(1, floor(
    v_reference_damage
    * public.rpg_power_damage_multiplier(v_power_score)
    * public.rpg_passive_damage_multiplier(v_damage_pct)
  ));

  v_recommended_damage := greatest(1, floor(
    v_reference_damage
    * public.rpg_power_damage_multiplier(v_required_power)
  ));

  v_balanced_hits := public.rpg_balanced_target_hits(
    220::numeric,
    v_base,
    v_recommended_damage
  );

  v_hp := greatest(1, floor(v_base * v_balanced_hits));
  v_hp_mult := v_balanced_hits / 90::numeric;
  v_seed := 1 + floor(random() * 2147483645)::integer;
  v_crit := public.rpg_crit_chance_pct(p_athlete_slug);

  insert into public.rpg_combats(
    athlete_slug,
    rpg_class,
    level_snapshot,
    xp_snapshot,
    monster_key,
    monster_name,
    monster_rarity,
    monster_hp,
    base_damage,
    duration_seconds,
    difficulty,
    is_boss,
    boss_for_difficulty,
    crit_seed,
    crit_chance_pct,
    created_by
  ) values (
    p_athlete_slug,
    v_class,
    v_level,
    v_xp,
    'boss_palier_' || v_difficulty::text,
    public.rpg_boss_name(v_difficulty),
    'legendary',
    v_hp,
    v_base,
    45,
    v_difficulty,
    true,
    v_difficulty,
    v_seed,
    v_crit,
    auth.uid()
  )
  returning id into v_battle;

  return query
  select
    rc.id,
    rc.rpg_class,
    rc.level_snapshot,
    rc.xp_snapshot,
    rc.monster_name,
    rc.monster_hp,
    rc.base_damage,
    rc.duration_seconds,
    rc.started_at,
    rc.difficulty,
    v_hp_mult::numeric,
    rc.crit_seed,
    rc.crit_chance_pct
  from public.rpg_combats rc
  where rc.id = v_battle;
end;
$start_boss_v130$;

-- --------------------------------------------------------------------------
-- 5. PERSONNAGES SPÉCIAUX : OBJECTIFS FIXES ET DURÉES PLUS COURTES
-- --------------------------------------------------------------------------
update public.rpg_monster_catalog
set hp_multiplier = 4.67,
    duration_seconds = 120
where monster_key = 'noah_nain';

update public.rpg_monster_catalog
set hp_multiplier = 7.22,
    duration_seconds = 180
where monster_key = 'val_shadow';

update public.rpg_monster_catalog
set hp_multiplier = 12.22,
    duration_seconds = 300
where monster_key = 'hanzalone_evil';

create or replace function public.start_rpg_combat_special_v25(
  p_athlete_slug text,
  p_difficulty integer
)
returns table (
  combat_id uuid,
  rpg_class text,
  level integer,
  xp_total numeric,
  monster_name text,
  monster_hp numeric,
  base_damage numeric,
  duration_seconds integer,
  started_at timestamptz,
  difficulty integer,
  hp_multiplier numeric,
  xp_multiplier numeric,
  crit_seed integer,
  crit_chance_pct numeric,
  monster_rarity text,
  monster_world text
)
language plpgsql
security definer
set search_path = public
as $start_special_v130$
declare
  v_base record;
  v_roll numeric := random();
  v_target_key text;
  v_target record;
  v_unlocked_difficulty integer := 1;
  v_val_min_difficulty integer := 2;
  v_reference_damage numeric;
  v_required_power numeric;
  v_recommended_damage numeric;
  v_target_hits numeric;
  v_balanced_hits numeric;
  v_new_hp numeric;
  v_new_hp_multiplier numeric;
  v_duration integer;
begin
  -- Le combat normal est créé en premier avec le nouvel équilibrage V130.
  select *
  into v_base
  from public.start_rpg_combat_tier(p_athlete_slug, p_difficulty);

  if v_base.combat_id is null then
    raise exception 'Le combat de base n’a pas été créé';
  end if;

  select greatest(1, coalesce(ap.adventure_difficulty, 1))
  into v_unlocked_difficulty
  from public.athlete_progress ap
  where ap.athlete_slug = p_athlete_slug;

  v_unlocked_difficulty := greatest(
    1,
    coalesce(v_unlocked_difficulty, p_difficulty, 1)
  );

  v_val_min_difficulty :=
    ceil(v_unlocked_difficulty::numeric / 2)::integer + 1;

  -- Probabilités absolues conservées :
  -- Hanzalone 0,01 %, Noah 0,05 %, Val 0,10 % dans la moitié haute.
  if v_roll < 0.00010 then
    v_target_key := 'hanzalone_evil';
  elsif v_roll < 0.00060 then
    v_target_key := 'noah_nain';
  elsif v_roll < 0.00160
        and p_difficulty >= v_val_min_difficulty then
    v_target_key := 'val_shadow';
  end if;

  if v_target_key is null then
    return query
    select
      v_base.combat_id,
      v_base.rpg_class,
      v_base.level,
      v_base.xp_total,
      v_base.monster_name,
      v_base.monster_hp,
      v_base.base_damage,
      v_base.duration_seconds,
      v_base.started_at,
      v_base.difficulty,
      v_base.hp_multiplier,
      v_base.xp_multiplier,
      v_base.crit_seed,
      v_base.crit_chance_pct,
      v_base.monster_rarity,
      v_base.monster_world;
    return;
  end if;

  select
    mc.monster_key,
    mc.monster_name,
    mc.rarity,
    mc.category,
    mc.duration_seconds
  into v_target
  from public.rpg_monster_catalog mc
  where mc.monster_key = v_target_key;

  if not found then
    raise exception 'Monstre spécial introuvable : %', v_target_key;
  end if;

  v_reference_damage := greatest(
    1,
    public.rpg_base_damage(v_base.level, v_base.xp_total)
  );
  v_required_power := public.rpg_required_power_for_difficulty(v_base.difficulty);
  v_recommended_damage := greatest(1, floor(
    v_reference_damage
    * public.rpg_power_damage_multiplier(v_required_power)
  ));

  v_target_hits := case v_target_key
    when 'noah_nain' then 420::numeric
    when 'val_shadow' then 650::numeric
    when 'hanzalone_evil' then 1100::numeric
    else 420::numeric
  end;

  v_duration := case v_target_key
    when 'noah_nain' then 120
    when 'val_shadow' then 180
    when 'hanzalone_evil' then 300
    else coalesce(v_target.duration_seconds, 120)
  end;

  v_balanced_hits := public.rpg_balanced_target_hits(
    v_target_hits,
    v_base.base_damage,
    v_recommended_damage
  );

  v_new_hp := greatest(1, floor(v_base.base_damage * v_balanced_hits));
  v_new_hp_multiplier := v_balanced_hits / 90::numeric;

  update public.rpg_combats rc
  set
    monster_key = v_target.monster_key,
    monster_name = v_target.monster_name,
    monster_rarity = v_target.rarity,
    monster_hp = v_new_hp,
    duration_seconds = v_duration,
    planned_duration_seconds = v_duration
  where rc.id = v_base.combat_id;

  return query
  select
    v_base.combat_id,
    v_base.rpg_class,
    v_base.level,
    v_base.xp_total,
    v_target.monster_name,
    v_new_hp,
    v_base.base_damage,
    v_duration,
    v_base.started_at,
    v_base.difficulty,
    v_new_hp_multiplier,
    v_base.xp_multiplier,
    v_base.crit_seed,
    v_base.crit_chance_pct,
    v_target.rarity,
    coalesce(v_target.category, 'Personnages spéciaux');
end;
$start_special_v130$;

-- --------------------------------------------------------------------------
-- 6. DROITS ET RECHARGEMENT DE L'API SUPABASE
-- --------------------------------------------------------------------------
revoke all on function public.rpg_target_hits_for_rarity(text) from public, anon;
revoke all on function public.rpg_target_duration_for_rarity(text) from public, anon;
revoke all on function public.rpg_monster_endurance_factor(numeric) from public, anon;
revoke all on function public.rpg_balanced_target_hits(numeric, numeric, numeric) from public, anon;
revoke all on function public.start_rpg_combat_tier(text, integer) from public, anon;
revoke all on function public.start_rpg_boss(text) from public, anon;
revoke all on function public.start_rpg_combat_special_v25(text, integer) from public, anon;

grant execute on function public.rpg_target_hits_for_rarity(text) to authenticated;
grant execute on function public.rpg_target_duration_for_rarity(text) to authenticated;
grant execute on function public.rpg_monster_endurance_factor(numeric) to authenticated;
grant execute on function public.rpg_balanced_target_hits(numeric, numeric, numeric) to authenticated;
grant execute on function public.start_rpg_combat_tier(text, integer) to authenticated;
grant execute on function public.start_rpg_boss(text) to authenticated;
grant execute on function public.start_rpg_combat_special_v25(text, integer) to authenticated;

select pg_notify('pgrst', 'reload schema');

commit;

-- --------------------------------------------------------------------------
-- VÉRIFICATIONS VISUELLES APRÈS EXÉCUTION
-- --------------------------------------------------------------------------
select
  difficulty,
  public.rpg_required_power_for_difficulty(difficulty) as required_power,
  round(public.rpg_difficulty_hp_multiplier(difficulty), 2) as hp_curve_multiplier
from (values (1), (10), (25), (50), (75), (100), (101), (125), (150), (250), (500), (1000)) v(difficulty)
order by difficulty;

select
  rarity,
  public.rpg_target_hits_for_rarity(rarity) as target_hits,
  public.rpg_target_duration_for_rarity(rarity) as duration_seconds
from (values
  ('common'), ('uncommon'), ('rare'), ('epic'),
  ('legendary'), ('mythic'), ('secret')
) v(rarity);
