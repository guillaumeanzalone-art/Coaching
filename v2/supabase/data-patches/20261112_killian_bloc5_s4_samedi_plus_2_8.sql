-- 2026-11-12 • Killian • Bloc 5 / S4 / samedi
-- S3 samedi (jour 5) est déjà identique au tableau fourni : il reste inchangé.
-- Dupliquer cet entraînement vers S4 (nouvel ID w4-d5), avec +2.8 POINTS
-- à CHAQUE intensité. Les répétitions, les notes et les charges potentielles
-- de la source restent identiques. Idempotent pour éviter toute double hausse.
--
-- Valeurs S4 :
-- SQ: 85.8, 88.8, 92.8, 101.8
-- BN: 84.8, 87.8, 90.8, 99.8
-- DL: 84.8, 84.8, 87.8, 90.8, 98.8
-- La semaine S4 n'a pas encore de Jour 4 : ne pas inventer de séance.
-- Le jour 5 est ajouté après les trois jours existants.
do $patch$
declare
 v_block jsonb;
 v_version jsonb;
 v_day jsonb;
 v_merged jsonb;
 exercise_index integer;
 set_index integer;
 old_percent numeric;
 num_updated integer := 0;
 updated_rows integer;
begin
 select program_json into v_block
 from public.athlete_program_blocks_v3
 where athlete_slug='killian' and block_key='killian-block-5-20261027' and status='current'
 for update;

 select program_json into v_version
 from public.program_versions_v2
 where athlete_slug='killian' and program_key='killian' and status='active' and version=3
 for update;

 if v_block is null or v_version is null or v_block<>v_version then
   raise exception 'Killian : blocs Supabase absents ou non synchronisés';
 end if;

 if exists (
   select 1 from jsonb_array_elements(v_block#>'{blocks,0,weeks,3,days}') as d
   where d->>'id'='killian-block-5-20261027-w4-d5'
 ) then
   raise notice 'Killian S4 samedi : déjà créé, aucune modification';
   return;
 end if;

 if jsonb_array_length(v_block#>'{blocks,0,weeks,3,days}')<>3 then
   raise exception 'Killian S4 : nombre de jours inattendu';
 end if;

 v_day := v_block#>'{blocks,0,weeks,2,days,4}';
 if v_day->>'id'<>'killian-block-5-20261027-w3-d5' then
   raise exception 'Killian S3 : samedi source introuvable';
 end if;
 if (select jsonb_agg(j.item->'percent' order by j.ord)
     from jsonb_array_elements(v_day#>'{exercises,0,sets}') with ordinality as j(item,ord))
    <> '[83,86,90,99]'::jsonb
    or (select jsonb_agg(j.item->'percent' order by j.ord)
     from jsonb_array_elements(v_day#>'{exercises,1,sets}') with ordinality as j(item,ord))
    <> '[82,85,88,97]'::jsonb
    or (select jsonb_agg(j.item->'percent' order by j.ord)
     from jsonb_array_elements(v_day#>'{exercises,2,sets}') with ordinality as j(item,ord))
    <> '[82,82,85,88,96]'::jsonb then
   raise exception 'Killian S3 : intensités différentes du tableau demandé';
 end if;

 -- Attribuer des IDs de jour, exercices et séries propres à la S4.
 v_day := replace(v_day::text,'-w3-d5','-w4-d5')::jsonb;
 for exercise_index in 0..jsonb_array_length(v_day->'exercises')-1 loop
   for set_index in 0..jsonb_array_length(v_day#>array['exercises',exercise_index::text,'sets'])-1 loop
     old_percent := (v_day#>>array['exercises',exercise_index::text,'sets',set_index::text,'percent'])::numeric;
     v_day := jsonb_set(v_day,
       array['exercises',exercise_index::text,'sets',set_index::text,'percent'],
       to_jsonb(round(old_percent+2.8,1)),false);
     num_updated := num_updated+1;
   end loop;
 end loop;
 if num_updated<>13 then raise exception 'Killian S4 : 13 séries attendues'; end if;

 v_merged := jsonb_set(v_block,'{blocks,0,weeks,3,days}',
   (v_block#>'{blocks,0,weeks,3,days}')||jsonb_build_array(v_day),false);

 update public.athlete_program_blocks_v3
    set program_json=v_merged,updated_at=now()
    where athlete_slug='killian' and block_key='killian-block-5-20261027'
    and status='current' and program_json=v_block;
 get diagnostics updated_rows=row_count;
 if updated_rows<>1 then raise exception 'Killian : écriture bloc actif échouée'; end if;

 update public.program_versions_v2
    set program_json=v_merged,updated_at=now()
    where athlete_slug='killian' and program_key='killian'
    and status='active' and version=3 and program_json=v_version;
 get diagnostics updated_rows=row_count;
 if updated_rows<>1 then raise exception 'Killian : écriture version active échouée'; end if;
end
$patch$;
