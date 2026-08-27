-- GA Coaching V5.0 — nouvelle courbe Steps -> XP séance du lendemain
-- 0 pas = ×1 ; 10 000 pas = ×2 ; 20 000 pas = ×2,5 ; cap ×2,5.
-- Cette fonction remplace uniquement le calcul du multiplicateur V4.8.

create or replace function public.apply_step_xp_bonus_v248(
  p_athlete_slug text,p_program_key text,p_week_index integer,p_day_index integer,
  p_set_index integer,p_exercise_code text,p_training_date date,p_base_xp integer
)
returns table(source_steps integer,xp_multiplier numeric,bonus_xp integer,total_xp_after numeric,level_after integer,level_up boolean)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_source_date date:=p_training_date-1;
  v_steps integer:=0;
  v_multiplier numeric:=1;
  v_base integer:=greatest(0,least(coalesce(p_base_xp,0),1000000));
  v_bonus integer:=0;
  v_rows integer:=0;
  v_total_before numeric:=0;
  v_total_after numeric:=0;
  v_level_before integer:=1;
  v_level_after integer:=1;
begin
  select coalesce(w.steps,0) into v_steps
  from public.athlete_daily_wellness w
  where w.athlete_slug=p_athlete_slug and w.activity_date=v_source_date;
  v_steps:=coalesce(v_steps,0);

  if v_steps <= 10000 then
    v_multiplier:=1::numeric + (v_steps::numeric / 10000::numeric);
  else
    v_multiplier:=least(
      2.5::numeric,
      2::numeric + ((v_steps-10000)::numeric / 20000::numeric)
    );
  end if;

  v_bonus:=greatest(0,round(v_base*(v_multiplier-1))::integer);

  select coalesce(ap.xp_total,0),coalesce(ap.level,1)
  into v_total_before,v_level_before
  from public.athlete_progress ap where ap.athlete_slug=p_athlete_slug for update;
  if not found then return query select v_steps,v_multiplier,0,0::numeric,1,false; return; end if;

  insert into public.athlete_step_xp_bonus_v248(
    athlete_slug,program_key,week_index,day_index,set_index,exercise_code,training_date,
    source_activity_date,source_steps,xp_multiplier,base_xp,bonus_xp
  ) values(
    p_athlete_slug,coalesce(p_program_key,''),coalesce(p_week_index,0),coalesce(p_day_index,0),
    coalesce(p_set_index,0),coalesce(p_exercise_code,''),p_training_date,v_source_date,
    v_steps,v_multiplier,v_base,v_bonus
  ) on conflict do nothing;
  get diagnostics v_rows=row_count;

  if v_rows>0 and v_bonus>0 then
    v_total_after:=v_total_before+v_bonus;
    v_level_after:=greatest(v_level_before,public.ga_level_from_xp_v248(v_total_after));
    update public.athlete_progress
    set xp_total=v_total_after,level=v_level_after
    where athlete_slug=p_athlete_slug;
  else
    v_bonus:=0; v_total_after:=v_total_before; v_level_after:=v_level_before;
  end if;

  return query select v_steps,v_multiplier,v_bonus,v_total_after,v_level_after,(v_level_after>v_level_before);
end;
$$;

grant execute on function public.apply_step_xp_bonus_v248(text,text,integer,integer,integer,text,date,integer) to authenticated;
