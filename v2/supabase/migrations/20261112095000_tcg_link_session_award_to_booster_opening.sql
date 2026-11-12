CREATE OR REPLACE FUNCTION public.open_tcg_pack_v2(p_athlete_slug text, p_booster_id text)
 RETURNS TABLE(opening_id bigint, opening_number integer, remaining_packs integer, cards jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 v_pack public.tcg_booster_types_v2%rowtype;
 v_slot integer;
 v_number integer;
 v_remaining integer;
 v_profile_packs integer;
 v_random numeric;
 v_odds jsonb;
 v_rarity text;
 v_candidate text;
 v_candidate_rarity text;
 v_id bigint;
 v_cards jsonb := '[]'::jsonb;
 v_seen text[] := array[]::text[];
 v_try text;
begin
 if auth.uid() is null or not public.can_edit_athlete(p_athlete_slug) then
   raise exception 'Acces refuse pour cet athlete';
 end if;
 select * into v_pack from public.tcg_booster_types_v2 where id=p_booster_id and published;
 if not found then raise exception 'Booster indisponible'; end if;
 insert into public.tcg_profiles(athlete_slug) values(p_athlete_slug) on conflict do nothing;
 select unopened_packs, opened_packs into v_profile_packs,v_number
 from public.tcg_profiles where athlete_slug=p_athlete_slug for update;
 if coalesce(v_profile_packs,0) < 1 then raise exception 'Aucun booster disponible'; end if;
 v_number := v_number + 1;
 for v_slot in 0..4 loop
   select odds into v_odds from public.tcg_slot_odds_v2 where slot=v_slot;
   if v_odds is null then raise exception 'Probabilites introuvables'; end if;
   if v_slot=4 and mod(v_number,50)=0 then
      v_rarity:='secret';
   elsif v_slot=4 and mod(v_number,10)=0 then
      v_rarity:='ultra';
   else
      v_random:=random()*100;
      select z.key into v_rarity from
        (select key, sum(value::numeric) over(order by
         case key when 'common' then 1 when 'uncommon' then 2 when 'rare' then 3 when 'ultra' then 4 else 5 end) cumulative
         from jsonb_each_text(v_odds)) z
      where z.cumulative > v_random
      order by z.cumulative limit 1;
      if v_rarity is null then raise exception 'Probabilites invalides'; end if;
   end if;
   v_candidate:=null;
   -- On privilegie la rarete tiree. Si un pack est pauvre, on replie vers une rarete disponible.
   for v_try in select unnest(case v_rarity
      when 'secret' then array['secret','ultra','rare','uncommon','common']::text[]
      when 'ultra' then array['ultra','rare','uncommon','common']::text[]
      when 'rare' then array['rare','uncommon','common']::text[]
      when 'uncommon' then array['uncommon','common']::text[]
      else array['common','uncommon','rare']::text[] end)
   loop
      select c.id,c.rarity into v_candidate,v_candidate_rarity
      from public.tcg_cards_v2 c
      where c.publication_status='published'
        and (p_booster_id=any(c.booster_ids) or '*'=any(c.booster_ids))
        and c.rarity=v_try
        and (v_try<>'secret' or v_pack.secret_only_slug is null or c.character_slug=v_pack.secret_only_slug)
        and not(c.id=any(v_seen))
      order by -ln(greatest(random(),0.000000000001))/
        (case when c.character_slug=v_pack.lead_slug then 5.0 else 1.0 end)
      limit 1;
      exit when v_candidate is not null;
   end loop;
   if v_candidate is null then
     select c.id,c.rarity into v_candidate,v_candidate_rarity
     from public.tcg_cards_v2 c where c.publication_status='published'
       and (p_booster_id=any(c.booster_ids) or '*'=any(c.booster_ids))
       and (c.rarity<>'secret' or v_pack.secret_only_slug is null or c.character_slug=v_pack.secret_only_slug)
     order by random() limit 1;
   end if;
   if v_candidate is null then raise exception 'Booster vide, aucune carte publiee eligible'; end if;
   v_seen:=array_append(v_seen,v_candidate);
   v_cards:=v_cards||jsonb_build_array(jsonb_build_object('card_id',v_candidate,'rarity',v_candidate_rarity));
 end loop;
 update public.tcg_profiles
    set unopened_packs=unopened_packs-1,opened_packs=opened_packs+1,updated_at=now()
    where athlete_slug=p_athlete_slug returning unopened_packs into v_remaining;
 insert into public.tcg_openings(athlete_slug,booster_id,opening_number,cards)
    values(p_athlete_slug,p_booster_id,v_number,v_cards) returning id into v_id;
 -- Lier automatiquement ce booster a la plus ancienne seance recompensee et non ouverte.
 -- Le suivi du tirage reste fiable meme si plusieurs packs sont accumules.
 update public.tcg_session_pack_awards_v2 a
    set opening_id=v_id, booster_id=p_booster_id
    where a.session_id=(
      select candidate.session_id from public.tcg_session_pack_awards_v2 candidate
      where candidate.athlete_slug=p_athlete_slug and candidate.opening_id is null
      order by candidate.awarded_at,candidate.session_id
      limit 1 for update skip locked
    );
 for v_candidate in select value->>'card_id' from jsonb_array_elements(v_cards)
 loop
   insert into public.tcg_collection(athlete_slug,card_id,copies)
   values(p_athlete_slug,v_candidate,1)
   on conflict(athlete_slug,card_id) do update
     set copies=public.tcg_collection.copies+1,last_pulled_at=now();
 end loop;
 return query select v_id,v_number,v_remaining,v_cards;
end
$function$
;
revoke all on function public.open_tcg_pack_v2(text,text) from public,anon;
grant execute on function public.open_tcg_pack_v2(text,text) to authenticated;
