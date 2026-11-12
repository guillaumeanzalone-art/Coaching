-- Recompense v2 idempotente a partir du tracker Supabase (aucun achat, aucune monnaie).
create table if not exists public.tcg_reward_policy_v2 (
 id integer primary key default 1 check(id=1),
 min_completion_ratio numeric not null default 0.80 check(min_completion_ratio>0 and min_completion_ratio<=1),
 min_duration_seconds integer not null default 900 check(min_duration_seconds>=0),
 min_set_span_seconds integer not null default 300 check(min_set_span_seconds>=0),
 min_completed_sets integer not null default 3 check(min_completed_sets>=1),
 max_packs_per_day integer not null default 2 check(max_packs_per_day between 1 and 20),
 active_since timestamptz not null default now()
);
insert into public.tcg_reward_policy_v2(id) values(1) on conflict(id) do nothing;
alter table public.tcg_reward_policy_v2 enable row level security;
revoke all on public.tcg_reward_policy_v2 from public,anon,authenticated;
grant select on public.tcg_reward_policy_v2 to authenticated;
drop policy if exists tcg_reward_policy_v2_read on public.tcg_reward_policy_v2;
create policy tcg_reward_policy_v2_read on public.tcg_reward_policy_v2 for select to authenticated using(true);

create table if not exists public.tcg_session_pack_awards_v2 (
 session_id uuid primary key references public.training_sessions_v2(id) on delete restrict,
 athlete_slug text not null,
 awarded_at timestamptz not null default now(),
 opening_id bigint unique references public.tcg_openings(id) on delete set null,
 booster_id text
);
create index if not exists tcg_session_pack_awards_v2_athlete_day
 on public.tcg_session_pack_awards_v2(athlete_slug,awarded_at);
alter table public.tcg_session_pack_awards_v2 enable row level security;
revoke all on public.tcg_session_pack_awards_v2 from public,anon,authenticated;
grant select on public.tcg_session_pack_awards_v2 to authenticated;
drop policy if exists tcg_session_pack_awards_v2_read on public.tcg_session_pack_awards_v2;
create policy tcg_session_pack_awards_v2_read on public.tcg_session_pack_awards_v2 for select to authenticated
 using(public.can_edit_athlete(athlete_slug));

create or replace function public.claim_tcg_workout_pack_v2(
 p_athlete_slug text,p_program_key text,p_week_index integer,p_day_index integer
) returns table(awarded boolean,unopened_packs integer,reason text,session_id uuid,validated_sets integer,total_sets integer)
language plpgsql security definer set search_path=''
as $$
declare
 v_session public.training_sessions_v2%rowtype;
 v_policy public.tcg_reward_policy_v2%rowtype;
 v_total integer:=0;v_done integer:=0;
 v_first timestamptz;v_last timestamptz;
 v_unopened integer:=0;v_daily integer:=0;
 v_inserted uuid;
 v_source text;
begin
 if auth.uid() is null or not public.can_edit_athlete(p_athlete_slug) then
   raise exception 'Acces refuse pour cet athlete';
 end if;
 select * into v_policy from public.tcg_reward_policy_v2 where id=1;
 if not found then raise exception 'Configuration recompenses introuvable'; end if;
 insert into public.tcg_profiles(athlete_slug) values(p_athlete_slug) on conflict do nothing;
 select p.unopened_packs into v_unopened from public.tcg_profiles p
 where p.athlete_slug=p_athlete_slug for update;
 select * into v_session from public.training_sessions_v2 s
 where s.athlete_slug=p_athlete_slug and s.program_key=p_program_key
 and s.week_index=p_week_index and s.day_index=p_day_index
 limit 1;
 if not found then
   return query select false,v_unopened,'session_not_synced'::text,null::uuid,0,0;return;
 end if;
 if exists(select 1 from public.tcg_session_pack_awards_v2 a where a.session_id=v_session.id) then
   return query select false,v_unopened,'already_awarded'::text,v_session.id,0,0;return;
 end if;
 v_source:=format('workout|%s|%s|%s|%s',p_athlete_slug,p_program_key,p_week_index,p_day_index);
 if exists(select 1 from public.tcg_workout_pack_awards old where old.source_key=v_source) then
   return query select false,v_unopened,'already_awarded_legacy'::text,v_session.id,0,0;return;
 end if;
 if v_session.status<>'completed' or v_session.completed_at is null then
   return query select false,v_unopened,'session_not_completed'::text,v_session.id,0,0;return;
 end if;
 if v_session.completed_at<v_policy.active_since then
   return query select false,v_unopened,'before_activation'::text,v_session.id,0,0;return;
 end if;
 if v_session.started_at is null or v_session.completed_at-v_session.started_at <
      make_interval(secs=>v_policy.min_duration_seconds) or
      coalesce(v_session.duration_seconds,0)<v_policy.min_duration_seconds then
   return query select false,v_unopened,'duration_too_short'::text,v_session.id,0,0;return;
 end if;
 select count(*)::integer,count(*) filter(where w.completed)::integer,
        min(w.completed_at) filter(where w.completed),max(w.completed_at) filter(where w.completed)
   into v_total,v_done,v_first,v_last
 from public.workout_sets w
 where w.athlete_slug=p_athlete_slug and w.program_key=p_program_key
   and w.week_index=p_week_index and w.day_index=p_day_index;
 if v_total<v_policy.min_completed_sets then
   return query select false,v_unopened,'sets_not_synced'::text,v_session.id,v_done,v_total;return;
 end if;
 if v_done<v_policy.min_completed_sets or v_done::numeric/nullif(v_total,0)<v_policy.min_completion_ratio then
   return query select false,v_unopened,'insufficient_sets'::text,v_session.id,v_done,v_total;return;
 end if;
 if v_first is null or v_last is null or extract(epoch from (v_last-v_first))<v_policy.min_set_span_seconds then
   return query select false,v_unopened,'sets_too_fast'::text,v_session.id,v_done,v_total;return;
 end if;
 select count(*)::integer into v_daily from public.tcg_session_pack_awards_v2 a
 where a.athlete_slug=p_athlete_slug
 and (a.awarded_at at time zone 'Europe/Paris')::date=(now() at time zone 'Europe/Paris')::date;
 if v_daily>=v_policy.max_packs_per_day then
   return query select false,v_unopened,'daily_limit'::text,v_session.id,v_done,v_total;return;
 end if;
 insert into public.tcg_session_pack_awards_v2(session_id,athlete_slug)
 values(v_session.id,p_athlete_slug) on conflict(session_id) do nothing returning session_id into v_inserted;
 if v_inserted is null then
   return query select false,v_unopened,'already_awarded'::text,v_session.id,v_done,v_total;return;
 end if;
 update public.tcg_profiles p set unopened_packs=p.unopened_packs+1,updated_at=now()
 where p.athlete_slug=p_athlete_slug returning p.unopened_packs into v_unopened;
 return query select true,v_unopened,'earned'::text,v_session.id,v_done,v_total;
end
$$;
revoke all on function public.claim_tcg_workout_pack_v2(text,text,integer,integer) from public,anon;
grant execute on function public.claim_tcg_workout_pack_v2(text,text,integer,integer) to authenticated;
-- Plus de recompenses sur simple declaration d'un jour de programme.
revoke all on function public.claim_tcg_workout_pack_v1(text,text,smallint,smallint) from public,anon,authenticated;
-- Evite l'auto-credit manuel via les anciennes permissions des tables.
revoke insert,update,delete on public.tcg_profiles from anon,authenticated;
revoke insert,update,delete on public.tcg_workout_pack_awards from anon,authenticated;
