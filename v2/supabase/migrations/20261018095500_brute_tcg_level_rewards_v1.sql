-- GA Brute · deterministic 3-card roguelike level rewards.

create or replace function public.brute_tcg_card_v1(
  p_candidate jsonb,
  p_slug text,
  p_level integer,
  p_slot integer
)
returns jsonb
language plpgsql
immutable
as $function$
declare
  v_card jsonb := coalesce(p_candidate,'{}'::jsonb);
  v_type text := v_card->>'type';
  v_id text := v_card->>'id';
  v_roll integer;
  v_rarity text;
  v_rarity_label text;
  v_power integer;
  v_amount integer;
  v_description text;
begin
  v_roll :=
    mod(
      abs(
        hashtext(
          coalesce(p_slug,'') || ':' ||
          coalesce(p_level,1)::text || ':' ||
          coalesce(p_slot,0)::text || ':tcg'
        )::bigint
      ),
      100
    )::integer;

  if mod(greatest(1,coalesce(p_level,1)),5) = 0 then
    if v_roll < 35 then
      v_rarity := 'common'; v_rarity_label := 'COMMUNE'; v_power := 1;
    elsif v_roll < 75 then
      v_rarity := 'rare'; v_rarity_label := 'RARE'; v_power := 2;
    elsif v_roll < 95 then
      v_rarity := 'epic'; v_rarity_label := 'ÉPIQUE'; v_power := 3;
    else
      v_rarity := 'legendary'; v_rarity_label := 'LÉGENDAIRE'; v_power := 4;
    end if;
  else
    if v_roll < 60 then
      v_rarity := 'common'; v_rarity_label := 'COMMUNE'; v_power := 1;
    elsif v_roll < 88 then
      v_rarity := 'rare'; v_rarity_label := 'RARE'; v_power := 2;
    elsif v_roll < 98 then
      v_rarity := 'epic'; v_rarity_label := 'ÉPIQUE'; v_power := 3;
    else
      v_rarity := 'legendary'; v_rarity_label := 'LÉGENDAIRE'; v_power := 4;
    end if;
  end if;

  if v_type = 'stat' then
    if v_id = 'hp' then
      v_amount := case v_power when 1 then 10 when 2 then 15 when 3 then 20 else 25 end;
      v_description := 'Augmente les PV max. Plus solide contre les gros impacts.';
    elsif v_id = 'strength' then
      v_amount := case v_power when 1 then 2 when 2 then 3 when 3 then 4 else 5 end;
      v_description := 'Augmente les dégâts et améliore les impacts lourds.';
    elsif v_id = 'agility' then
      v_amount := case v_power when 1 then 2 when 2 then 3 when 3 then 4 else 5 end;
      v_description := 'Améliore esquive, désarmement et réactions défensives.';
    else
      v_amount := case v_power when 1 then 2 when 2 then 3 when 3 then 4 else 5 end;
      v_description := 'Améliore initiative, rythme d’attaque et mobilité.';
    end if;

    v_card :=
      v_card ||
      jsonb_build_object(
        'amount', v_amount,
        'name',
          case v_id
            when 'hp' then '+' || v_amount::text || ' PV'
            when 'strength' then '+' || v_amount::text || ' Force'
            when 'agility' then '+' || v_amount::text || ' Agilité'
            else '+' || v_amount::text || ' Vitesse'
          end
      );
  elsif v_type = 'weapon' then
    v_description := 'Débloque définitivement cette arme dans ton arsenal.';
  elsif v_type = 'skill' then
    v_description := 'Débloque une capacité spéciale qui modifie tes combats.';
  elsif v_type = 'pet' then
    v_description := 'Ajoute un familier combattant à ton équipe, jusqu’à 3.';
  else
    v_description := 'Amélioration permanente de ta brute.';
  end if;

  return
    v_card ||
    jsonb_build_object(
      'rarity', v_rarity,
      'rarity_label', v_rarity_label,
      'power', v_power,
      'description', v_description,
      'slot', greatest(0,coalesce(p_slot,0)),
      'reward_level', greatest(1,coalesce(p_level,1))
    );
end;
$function$;

create or replace function public.brute_level_choices_v1(
  p_athlete_slug text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_slug text := lower(trim(coalesce(p_athlete_slug,'')));
  v_row public.brutes%rowtype;
  v_base integer;
  v_idx integer;
  v_candidate jsonb;
  v_choices jsonb := '[]'::jsonb;
  v_try integer;
  v_type text;
  v_id text;
  v_stat_idx integer;
begin
  if auth.uid() is null then
    raise exception 'Utilisateur non connecté';
  end if;

  if not public.can_edit_athlete(v_slug) then
    raise exception 'Accès refusé';
  end if;

  perform public.brute_seed_one_v1(v_slug);

  select *
  into v_row
  from public.brutes b
  where b.athlete_slug = v_slug;

  if v_row.pending_reward_level is null then
    return '[]'::jsonb;
  end if;

  v_base :=
    mod(
      abs(hashtext(v_slug || ':' || v_row.pending_reward_level::text || ':deck')::bigint),
      100000
    )::integer;

  v_stat_idx := mod(v_base + v_row.pending_reward_level * 3,4);

  v_candidate :=
    public.brute_tcg_card_v1(
      public.brute_reward_catalog_v1(v_stat_idx),
      v_slug,
      v_row.pending_reward_level,
      0
    );

  v_choices := v_choices || jsonb_build_array(v_candidate);

  for v_try in 0..39 loop
    exit when jsonb_array_length(v_choices) >= 2;

    v_idx := 4 + mod(v_base + v_try * 5 + v_try * v_try + v_row.pending_reward_level,11);
    v_candidate := public.brute_reward_catalog_v1(v_idx);
    v_type := v_candidate->>'type';
    v_id := v_candidate->>'id';

    if v_type = 'weapon' and v_row.weapons @> jsonb_build_array(v_id) then
      continue;
    end if;

    if v_type = 'skill' and v_row.skills @> jsonb_build_array(v_id) then
      continue;
    end if;

    v_candidate :=
      public.brute_tcg_card_v1(
        v_candidate,
        v_slug,
        v_row.pending_reward_level,
        1
      );

    v_choices := v_choices || jsonb_build_array(v_candidate);
  end loop;

  if jsonb_array_length(v_choices) < 2 then
    v_candidate :=
      public.brute_tcg_card_v1(
        public.brute_reward_catalog_v1(mod(v_stat_idx + 1,4)),
        v_slug,
        v_row.pending_reward_level,
        1
      );

    v_choices := v_choices || jsonb_build_array(v_candidate);
  end if;

  for v_try in 0..79 loop
    exit when jsonb_array_length(v_choices) >= 3;

    v_idx := mod(v_base + 13 + v_try * 7 + v_try * v_try * 3,20);
    v_candidate := public.brute_reward_catalog_v1(v_idx);
    v_type := v_candidate->>'type';
    v_id := v_candidate->>'id';

    if v_type = 'weapon' and v_row.weapons @> jsonb_build_array(v_id) then
      continue;
    end if;

    if v_type = 'skill' and v_row.skills @> jsonb_build_array(v_id) then
      continue;
    end if;

    if v_type = 'pet' then
      if jsonb_array_length(v_row.pets) >= 3 then
        continue;
      end if;

      if v_row.pets @> jsonb_build_array(v_id) then
        continue;
      end if;
    end if;

    if exists (
      select 1
      from jsonb_array_elements(v_choices) choice
      where choice->>'type' = v_type
        and choice->>'id' = v_id
    ) then
      continue;
    end if;

    v_candidate :=
      public.brute_tcg_card_v1(
        v_candidate,
        v_slug,
        v_row.pending_reward_level,
        2
      );

    v_choices := v_choices || jsonb_build_array(v_candidate);
  end loop;

  while jsonb_array_length(v_choices) < 3 loop
    v_idx := mod(v_stat_idx + jsonb_array_length(v_choices),4);

    v_candidate :=
      public.brute_tcg_card_v1(
        public.brute_reward_catalog_v1(v_idx),
        v_slug,
        v_row.pending_reward_level,
        jsonb_array_length(v_choices)
      );

    if not exists (
      select 1
      from jsonb_array_elements(v_choices) choice
      where choice->>'type' = v_candidate->>'type'
        and choice->>'id' = v_candidate->>'id'
    ) then
      v_choices := v_choices || jsonb_build_array(v_candidate);
    else
      v_candidate :=
        public.brute_tcg_card_v1(
          public.brute_reward_catalog_v1(mod(v_idx + 1,4)),
          v_slug,
          v_row.pending_reward_level,
          jsonb_array_length(v_choices)
        );

      v_choices := v_choices || jsonb_build_array(v_candidate);
    end if;
  end loop;

  return v_choices;
end;
$function$;

create or replace function public.brute_choose_reward_v1(
  p_athlete_slug text,
  p_choice integer
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_slug text := lower(trim(coalesce(p_athlete_slug,'')));
  v_choice integer := greatest(0,least(2,coalesce(p_choice,0)));
  v_row public.brutes%rowtype;
  v_choices jsonb;
  v_reward jsonb;
  v_type text;
  v_id text;
  v_amount integer;
  v_threshold integer;
begin
  if auth.uid() is null then
    raise exception 'Utilisateur non connecté';
  end if;

  if not public.can_edit_athlete(v_slug) then
    raise exception 'Accès refusé';
  end if;

  select *
  into v_row
  from public.brutes b
  where b.athlete_slug = v_slug
  for update;

  if v_row.pending_reward_level is null then
    raise exception 'Aucun choix de niveau en attente';
  end if;

  v_choices := public.brute_level_choices_v1(v_slug);

  if jsonb_array_length(v_choices) < 3 then
    raise exception 'Pack de niveau incomplet';
  end if;

  v_reward := v_choices->v_choice;
  v_type := v_reward->>'type';
  v_id := v_reward->>'id';
  v_amount := coalesce((v_reward->>'amount')::integer,0);

  if v_type = 'stat' and v_id = 'hp' then
    v_row.hp := v_row.hp + v_amount;
  elsif v_type = 'stat' and v_id = 'strength' then
    v_row.strength := v_row.strength + v_amount;
  elsif v_type = 'stat' and v_id = 'agility' then
    v_row.agility := v_row.agility + v_amount;
  elsif v_type = 'stat' and v_id = 'speed' then
    v_row.speed := v_row.speed + v_amount;
  elsif v_type = 'weapon' then
    if not (v_row.weapons @> jsonb_build_array(v_id)) then
      v_row.weapons := v_row.weapons || jsonb_build_array(v_id);
    end if;
  elsif v_type = 'skill' then
    if not (v_row.skills @> jsonb_build_array(v_id)) then
      v_row.skills := v_row.skills || jsonb_build_array(v_id);
    end if;
  elsif v_type = 'pet' then
    if jsonb_array_length(v_row.pets) < 3
       and not (v_row.pets @> jsonb_build_array(v_id)) then
      v_row.pets := v_row.pets || jsonb_build_array(v_id);
    end if;
  end if;

  v_row.pending_reward_level := null;
  v_threshold := public.brute_xp_to_next_v1(v_row.level);

  if v_row.xp >= v_threshold then
    v_row.xp := v_row.xp - v_threshold;
    v_row.level := v_row.level + 1;
    v_row.hp := v_row.hp + 4;
    v_row.strength := v_row.strength + 1;
    v_row.agility := v_row.agility + 1;
    v_row.speed := v_row.speed + 1;
    v_row.pending_reward_level := v_row.level;
  end if;

  update public.brutes b
  set
    level = v_row.level,
    xp = v_row.xp,
    hp = v_row.hp,
    strength = v_row.strength,
    agility = v_row.agility,
    speed = v_row.speed,
    weapons = v_row.weapons,
    skills = v_row.skills,
    pets = v_row.pets,
    pending_reward_level = v_row.pending_reward_level,
    updated_at = now()
  where b.athlete_slug = v_slug
  returning *
  into v_row;

  return jsonb_build_object(
    'brute', to_jsonb(v_row),
    'reward', v_reward,
    'next_choices',
      case
        when v_row.pending_reward_level is null then '[]'::jsonb
        else public.brute_level_choices_v1(v_slug)
      end
  );
end;
$function$;
