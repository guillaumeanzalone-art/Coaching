-- Repair PR history without altering existing records or training sets.
create or replace function public.record_sbd_rep_pr_v249(
 p_athlete_slug text,p_lift text,p_load_kg numeric,p_reps integer,
 p_program_key text default null,p_week_index integer default null,p_day_index integer default null,
 p_set_index integer default null,p_exercise_name text default null
) returns table(is_pr boolean,previous_load numeric,current_load numeric,lift_code text,rep_count integer)
language plpgsql security definer set search_path='' as $$
declare
 v_previous numeric; v_previous_at timestamptz; v_now timestamptz; v_code text; v_slug text; v_name text; v_emoji text;
begin
 v_slug:=trim(p_athlete_slug);
 if (select auth.uid()) is null or not coalesce(public.can_edit_athlete(v_slug),false) then
   raise exception 'Accès refusé pour cet athlète.' using errcode='42501';
 end if;
 if v_slug is null or v_slug='' or p_lift is null or p_lift not in ('squat','bench','deadlift') then
   raise exception 'Athlète ou mouvement invalide.';
 end if;
 if p_reps is null or p_reps not between 1 and 9 then
   return query select false,null::numeric,p_load_kg,p_lift,p_reps; return;
 end if;
 if p_load_kg is null or p_load_kg<=0 or p_load_kg>1000 then raise exception 'Charge invalide.'; end if;
 v_code:=case p_lift when 'squat' then 'sq' when 'bench' then 'bn' else 'dl' end;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_slug||':'||p_lift||':'||p_reps,0));
 select r.load_kg,case when r.source_label='GA Coaching V2' then r.achieved_at end into v_previous,v_previous_at
 from public.athlete_sbd_rep_prs_v249 r where r.athlete_slug=v_slug and r.lift=p_lift and r.reps=p_reps for update;
 if v_previous is not null and p_load_kg<=v_previous then
   return query select false,v_previous,v_previous,p_lift,p_reps; return;
 end if;
 v_now:=clock_timestamp();
 insert into public.athlete_sbd_rep_prs_v249 as r(athlete_slug,lift,reps,load_kg,exercise_name,program_key,week_index,day_index,set_index,achieved_at,achieved_label,source_label,updated_at)
 values(v_slug,p_lift,p_reps,p_load_kg,p_exercise_name,p_program_key,p_week_index,p_day_index,p_set_index,v_now,'','GA Coaching V2',v_now)
 on conflict(athlete_slug,lift,reps) do update set load_kg=excluded.load_kg,exercise_name=excluded.exercise_name,program_key=excluded.program_key,week_index=excluded.week_index,day_index=excluded.day_index,set_index=excluded.set_index,achieved_at=excluded.achieved_at,achieved_label='',source_label=excluded.source_label,updated_at=excluded.updated_at;
 select display_name,emoji into v_name,v_emoji from public.athlete_profiles_v3 where slug=v_slug;
 insert into public.pr_history(source_key,athlete_slug,athlete_name,athlete_emoji,exercise_code,exercise_name,reps,new_load_kg,previous_load_kg,achieved_at,previous_achieved_at,program_key,week_index,day_index,set_index,source_label,created_by)
 values('sbd-v249:'||md5(concat_ws('|',v_slug,p_lift,p_reps,p_load_kg,extract(epoch from v_now))),v_slug,coalesce(v_name,v_slug),coalesce(v_emoji,'🏋️'),v_code,coalesce(nullif(p_exercise_name,''),p_lift),p_reps::smallint,p_load_kg,v_previous,v_now,v_previous_at,p_program_key,p_week_index::smallint,p_day_index::smallint,p_set_index::smallint,'PR enregistré V249',auth.uid())
 on conflict(source_key) do nothing;
 return query select true,v_previous,p_load_kg,p_lift,p_reps;
end $$;
revoke execute on function public.record_sbd_rep_pr_v249(text,text,numeric,integer,text,integer,integer,integer,text) from public,anon;
grant execute on function public.record_sbd_rep_pr_v249(text,text,numeric,integer,text,integer,integer,integer,text) to authenticated;
-- Legacy PR writers already check can_edit_athlete; revoke unnecessary anonymous access.
revoke execute on function public.record_sbd_pr_v2(text,text,numeric,integer,text,integer,integer,integer,text) from public,anon;
grant execute on function public.record_sbd_pr_v2(text,text,numeric,integer,text,integer,integer,integer,text) to authenticated;
revoke execute on function public.record_pr_history(text,text,text,text,text,text,text,integer,numeric,numeric,timestamptz,timestamptz,text,integer,text,integer,text,integer,text) from public,anon;
grant execute on function public.record_pr_history(text,text,text,text,text,text,text,integer,numeric,numeric,timestamptz,timestamptz,text,integer,text,integer,text,integer,text) to authenticated;
-- Recover dated records only where matching successful sets exist. No invented previous loads/dates.
insert into public.pr_history(source_key,athlete_slug,athlete_name,athlete_emoji,exercise_code,exercise_name,reps,new_load_kg,achieved_at,program_key,week_index,day_index,set_index,source_label)
select 'sbd-v249:'||md5(concat_ws('|',r.athlete_slug,r.lift,r.reps,r.load_kg,extract(epoch from r.achieved_at))),
 r.athlete_slug,coalesce(a.display_name,r.athlete_slug),coalesce(a.emoji,'🏋️'),w.exercise_code,coalesce(nullif(w.exercise_name,''),r.lift),r.reps::smallint,r.load_kg,w.completed_at,w.program_key,w.week_index,w.day_index,w.set_index,'PR récupéré · série réussie'
from public.athlete_sbd_rep_prs_v249 r
join lateral (
 select lower(s.exercise_code) exercise_code,s.exercise_name,s.completed_at,s.program_key,s.week_index,s.day_index,s.set_index
 from public.workout_sets s
 where s.athlete_slug=r.athlete_slug and lower(s.exercise_code)=case r.lift when 'squat' then 'sq' when 'bench' then 'bn' when 'deadlift' then 'dl' end
 and s.completed and s.set_outcome='success' and s.load_kg=r.load_kg and coalesce(s.actual_reps,s.reps)=r.reps
 and s.program_key=r.program_key and s.week_index=r.week_index and s.day_index=r.day_index and s.completed_at is not null
 order by abs(extract(epoch from (s.completed_at-r.achieved_at))),s.set_index limit 1
) w on true
left join public.athlete_profiles_v3 a on a.slug=r.athlete_slug
where r.source_label='GA Coaching V2' and r.achieved_at is not null and r.reps between 1 and 9
and not exists(select 1 from public.pr_history h where h.athlete_slug=r.athlete_slug and h.exercise_code=w.exercise_code and h.reps=r.reps and h.new_load_kg=r.load_kg)
on conflict(source_key) do nothing;
-- Observed performance (not all-time PRs): daily maximum by lift/reps. RLS stays in force.
create or replace function public.athlete_observed_sbd_stats_v1(p_athlete_slug text)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare v_result jsonb;
begin
 if (select auth.uid()) is null or not coalesce(public.can_edit_athlete(p_athlete_slug),false) then
   raise exception 'Accès refusé pour cet athlète.' using errcode='42501';
 end if;
 with valid as (
  select lower(exercise_code) code,coalesce(actual_reps,reps) rep,load_kg,rpe,
    (completed_at at time zone 'Europe/Paris')::date d
  from public.workout_sets
  where athlete_slug=p_athlete_slug and completed and set_outcome='success' and load_kg>0
  and lower(exercise_code) in ('sq','bn','dl') and coalesce(actual_reps,reps) between 1 and 9 and completed_at is not null
 ), best as (
  select code,rep,d,max(load_kg) new_load_kg,count(*) set_count,sum(load_kg*rep) tonnage,
  round(avg(rpe) filter(where rpe between 1 and 10),2) mean_rpe
  from valid group by code,rep,d
 )
 select coalesce(jsonb_agg(jsonb_build_object('exercise_code',code,'reps',rep,'achieved_at',d::text||'T12:00:00Z','new_load_kg',new_load_kg,'set_count',set_count,'tonnage',tonnage,'mean_rpe',mean_rpe) order by d,code,rep),'[]'::jsonb) into v_result from best;
 return v_result;
end $$;
revoke execute on function public.athlete_observed_sbd_stats_v1(text) from public,anon;
grant execute on function public.athlete_observed_sbd_stats_v1(text) to authenticated;
notify pgrst,'reload schema';
