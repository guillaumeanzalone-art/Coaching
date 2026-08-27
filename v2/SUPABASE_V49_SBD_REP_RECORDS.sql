-- ============================================================================
-- GA Coaching V4.9 — Records SBD par nombre de reps ×1…×9
-- À exécuter UNE FOIS dans Supabase > SQL Editor.
-- Importe l'historique de l'ancien site + conserve les nouveaux records V2.
-- Idempotent : peut être relancé sans écraser un record plus lourd.
-- ============================================================================

begin;

create table if not exists public.athlete_sbd_rep_prs_v249 (
  athlete_slug text not null,
  lift text not null check (lift in ('squat','bench','deadlift')),
  reps integer not null check (reps between 1 and 9),
  load_kg numeric(8,2) not null check (load_kg > 0),
  exercise_name text,
  program_key text,
  week_index integer,
  day_index integer,
  set_index integer,
  achieved_label text,
  source_label text,
  achieved_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (athlete_slug,lift,reps)
);

alter table public.athlete_sbd_rep_prs_v249 enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='athlete_sbd_rep_prs_v249'
      and policyname='sbd_rep_prs_read_v249'
  ) then
    create policy sbd_rep_prs_read_v249
      on public.athlete_sbd_rep_prs_v249
      for select to authenticated
      using (true);
  end if;
end $$;

grant select on public.athlete_sbd_rep_prs_v249 to authenticated;

create or replace function public.record_sbd_rep_pr_v249(
  p_athlete_slug text,
  p_lift text,
  p_load_kg numeric,
  p_reps integer,
  p_program_key text default null,
  p_week_index integer default null,
  p_day_index integer default null,
  p_set_index integer default null,
  p_exercise_name text default null
)
returns table(
  is_pr boolean,
  previous_load numeric,
  current_load numeric,
  lift_code text,
  rep_count integer
)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_previous numeric;
begin
  if nullif(trim(p_athlete_slug),'') is null then
    raise exception 'Athlète invalide.';
  end if;
  if p_lift not in ('squat','bench','deadlift') then
    raise exception 'Mouvement SBD invalide.';
  end if;
  if p_reps < 1 or p_reps > 9 then
    return query select false,null::numeric,p_load_kg,p_lift,p_reps;
    return;
  end if;
  if coalesce(p_load_kg,0) <= 0 then
    raise exception 'Charge invalide.';
  end if;

  select r.load_kg
  into v_previous
  from public.athlete_sbd_rep_prs_v249 r
  where r.athlete_slug=p_athlete_slug
    and r.lift=p_lift
    and r.reps=p_reps
  for update;

  if v_previous is null or p_load_kg > v_previous then
    insert into public.athlete_sbd_rep_prs_v249 as r(
      athlete_slug,lift,reps,load_kg,exercise_name,program_key,
      week_index,day_index,set_index,achieved_at,achieved_label,source_label,updated_at
    ) values (
      p_athlete_slug,p_lift,p_reps,p_load_kg,p_exercise_name,p_program_key,
      p_week_index,p_day_index,p_set_index,clock_timestamp(),'',
      'GA Coaching V2',clock_timestamp()
    )
    on conflict (athlete_slug,lift,reps) do update set
      load_kg=excluded.load_kg,
      exercise_name=excluded.exercise_name,
      program_key=excluded.program_key,
      week_index=excluded.week_index,
      day_index=excluded.day_index,
      set_index=excluded.set_index,
      achieved_at=excluded.achieved_at,
      achieved_label='',
      source_label='GA Coaching V2',
      updated_at=clock_timestamp();

    return query select true,v_previous,p_load_kg,p_lift,p_reps;
    return;
  end if;

  return query select false,v_previous,v_previous,p_lift,p_reps;
end;
$$;

grant execute on function public.record_sbd_rep_pr_v249(
  text,text,numeric,integer,text,integer,integer,integer,text
) to authenticated;

-- Historique de l'ancien site (Google Sheets / tableaux Statistiques).
create temporary table ga_sbd_seed_v249(
  athlete_slug text,
  lift text,
  reps integer,
  load_kg numeric,
  achieved_label text,
  source_label text
) on commit drop;

insert into ga_sbd_seed_v249 values
('guillaume','squat',1,320,'','Google Sheets — Statistiques'),
('guillaume','squat',2,297.5,'','Google Sheets — Statistiques'),
('guillaume','squat',3,290,'','Google Sheets — Statistiques'),
('guillaume','squat',4,285,'','Google Sheets — Statistiques'),
('guillaume','squat',5,280,'','Google Sheets — Statistiques'),
('guillaume','squat',6,275,'','Google Sheets — Statistiques'),
('guillaume','squat',7,270,'','Google Sheets — Statistiques'),
('guillaume','squat',8,250,'','Google Sheets — Statistiques'),
('guillaume','squat',9,240,'','Google Sheets — Statistiques'),
('guillaume','bench',1,210,'','Google Sheets — Statistiques'),
('guillaume','bench',2,200,'','Google Sheets — Statistiques'),
('guillaume','bench',3,187.5,'','Google Sheets — Statistiques'),
('guillaume','bench',4,180,'','Google Sheets — Statistiques'),
('guillaume','bench',5,180,'','Google Sheets — Statistiques'),
('guillaume','bench',6,160,'','Google Sheets — Statistiques'),
('guillaume','bench',7,157.5,'','Google Sheets — Statistiques'),
('guillaume','bench',8,140,'','Google Sheets — Statistiques'),
('guillaume','deadlift',1,340,'','Google Sheets — Statistiques'),
('guillaume','deadlift',2,310,'','Google Sheets — Statistiques'),
('guillaume','deadlift',3,300,'','Google Sheets — Statistiques'),
('guillaume','deadlift',5,280,'','Google Sheets — Statistiques'),
('guillaume','deadlift',6,220,'','Google Sheets — Statistiques'),
('guillaume','deadlift',7,195,'','Google Sheets — Statistiques'),
('benoit','deadlift',2,200,'','Google Sheets — Statistiques'),
('benoit','deadlift',3,200,'','Google Sheets — Statistiques'),
('benoit','deadlift',4,200,'19/07/2025','Google Sheets — Statistiques'),
('benoit','deadlift',5,190,'','Google Sheets — Statistiques'),
('benoit','deadlift',6,190,'','Google Sheets — Statistiques'),
('celia','squat',1,100,'AFFRONT','Google Sheets — Statistiques'),
('celia','squat',5,77.5,'','Google Sheets — Statistiques'),
('celia','bench',2,53.5,'','Google Sheets — Statistiques'),
('charles','squat',1,200,'25/04/26','Google Sheets — Statistiques'),
('charles','squat',2,175,'B11','Google Sheets — Statistiques'),
('charles','squat',3,152.5,'B12','Google Sheets — Statistiques'),
('charles','squat',4,165,'B2 TDAH','Google Sheets — Statistiques'),
('charles','squat',5,165,'B13','Google Sheets — Statistiques'),
('charles','squat',6,155,'B2 TDAH','Google Sheets — Statistiques'),
('charles','squat',7,147.5,'Bloc 5','Google Sheets — Statistiques'),
('charles','squat',8,140,'Bloc 4','Google Sheets — Statistiques'),
('charles','bench',1,120,'25/04/26','Google Sheets — Statistiques'),
('charles','bench',2,110,'','Google Sheets — Statistiques'),
('charles','bench',3,112.5,'B14','Google Sheets — Statistiques'),
('charles','bench',4,105,'B Suite Squat','Google Sheets — Statistiques'),
('charles','bench',5,107.5,'B11','Google Sheets — Statistiques'),
('charles','bench',6,102.5,'Bloc 5','Google Sheets — Statistiques'),
('charles','bench',7,102.5,'Bloc 9','Google Sheets — Statistiques'),
('charles','bench',8,100,'B4 TDAH','Google Sheets — Statistiques'),
('charles','deadlift',1,210,'25/04/26','Google Sheets — Statistiques'),
('charles','deadlift',2,182.5,'Bloc 5','Google Sheets — Statistiques'),
('charles','deadlift',3,175,'B13','Google Sheets — Statistiques'),
('charles','deadlift',4,180,'B2 TDAH','Google Sheets — Statistiques'),
('charles','deadlift',5,175,'B10','Google Sheets — Statistiques'),
('charles','deadlift',6,180,'B4 TDAH','Google Sheets — Statistiques'),
('clara','squat',1,137.5,'17/04','Google Sheets — Statistiques'),
('clara','squat',2,125,'','Google Sheets — Statistiques'),
('clara','squat',3,122.5,'','Google Sheets — Statistiques'),
('clara','squat',4,120,'','Google Sheets — Statistiques'),
('clara','squat',5,117.5,'','Google Sheets — Statistiques'),
('clara','squat',6,107.5,'','Google Sheets — Statistiques'),
('clara','squat',7,105,'','Google Sheets — Statistiques'),
('clara','bench',1,75,'05/03','Google Sheets — Statistiques'),
('clara','bench',2,71,'','Google Sheets — Statistiques'),
('clara','bench',3,70,'','Google Sheets — Statistiques'),
('clara','bench',4,67.5,'','Google Sheets — Statistiques'),
('clara','bench',5,65,'','Google Sheets — Statistiques'),
('clara','bench',6,60,'','Google Sheets — Statistiques'),
('clara','deadlift',1,170,'','Google Sheets — Statistiques'),
('clara','deadlift',2,150,'','Google Sheets — Statistiques'),
('clara','deadlift',3,145,'','Google Sheets — Statistiques'),
('clara','deadlift',5,135,'','Google Sheets — Statistiques'),
('clemosaurus','squat',1,165,'','Google Sheets — Statistiques'),
('clemosaurus','squat',2,160,'','Google Sheets — Statistiques'),
('clemosaurus','squat',3,132.5,'','Google Sheets — Statistiques'),
('clemosaurus','squat',5,145,'','Google Sheets — Statistiques'),
('clemosaurus','squat',6,125,'','Google Sheets — Statistiques'),
('clemosaurus','squat',7,135,'','Google Sheets — Statistiques'),
('clemosaurus','bench',1,130,'','Google Sheets — Statistiques'),
('clemosaurus','bench',2,117.5,'','Google Sheets — Statistiques'),
('clemosaurus','bench',5,95,'','Google Sheets — Statistiques'),
('clemosaurus','bench',6,100,'','Google Sheets — Statistiques'),
('clemosaurus','bench',8,105,'','Google Sheets — Statistiques'),
('clemosaurus','deadlift',1,200,'','Google Sheets — Statistiques'),
('clemosaurus','deadlift',2,200,'','Google Sheets — Statistiques'),
('clemosaurus','deadlift',3,192.5,'','Google Sheets — Statistiques'),
('clemosaurus','deadlift',4,165,'','Google Sheets — Statistiques'),
('clemosaurus','deadlift',5,182.5,'','Google Sheets — Statistiques'),
('dorian','squat',1,220,'','Google Sheets — Statistiques'),
('dorian','squat',2,200,'','Google Sheets — Statistiques'),
('dorian','squat',3,200,'','Google Sheets — Statistiques'),
('dorian','squat',4,200,'','Google Sheets — Statistiques'),
('dorian','squat',5,200,'','Google Sheets — Statistiques'),
('dorian','squat',6,170,'','Google Sheets — Statistiques'),
('dorian','squat',7,175,'','Google Sheets — Statistiques'),
('dorian','squat',8,170,'','Google Sheets — Statistiques'),
('dorian','squat',9,170,'','Google Sheets — Statistiques'),
('dorian','bench',1,120,'','Google Sheets — Statistiques'),
('dorian','bench',2,115,'','Google Sheets — Statistiques'),
('dorian','bench',3,110,'','Google Sheets — Statistiques'),
('dorian','bench',4,110,'11/09/2025','Google Sheets — Statistiques'),
('dorian','bench',5,110,'','Google Sheets — Statistiques'),
('dorian','bench',6,100,'','Google Sheets — Statistiques'),
('dorian','bench',7,85,'','Google Sheets — Statistiques'),
('dorian','deadlift',1,220,'','Google Sheets — Statistiques'),
('dorian','deadlift',2,210,'','Google Sheets — Statistiques'),
('dorian','deadlift',3,210,'11/09/2025','Google Sheets — Statistiques'),
('dorian','deadlift',4,200,'','Google Sheets — Statistiques'),
('dorian','deadlift',5,175,'','Google Sheets — Statistiques'),
('dorian','deadlift',6,165,'','Google Sheets — Statistiques'),
('duane','squat',1,320,'','Google Sheets — Statistiques'),
('duane','squat',3,290,'','Google Sheets — Statistiques'),
('duane','bench',1,220,'','Google Sheets — Statistiques'),
('duane','bench',3,200,'','Google Sheets — Statistiques'),
('duane','deadlift',1,275,'','Google Sheets — Statistiques'),
('duane','deadlift',2,270,'','Google Sheets — Statistiques'),
('duane','deadlift',3,260,'','Google Sheets — Statistiques'),
('duane','deadlift',4,245,'','Google Sheets — Statistiques'),
('duane','deadlift',5,245,'','Google Sheets — Statistiques'),
('duane','deadlift',6,220,'','Google Sheets — Statistiques'),
('duane','deadlift',7,195,'','Google Sheets — Statistiques'),
('flop','squat',1,125,'','Google Sheets — Statistiques'),
('flop','squat',4,112,'02/09/2025','Google Sheets — Statistiques'),
('gibertini','squat',1,260,'02/2026','Google Sheets — Statistiques'),
('gibertini','squat',2,240,'','Google Sheets — Statistiques'),
('gibertini','squat',4,235,'02/2026','Google Sheets — Statistiques'),
('gibertini','squat',5,215,'','Google Sheets — Statistiques'),
('gibertini','bench',1,155,'04/2026','Google Sheets — Statistiques'),
('gibertini','bench',2,142.5,'10/2025','Google Sheets — Statistiques'),
('gibertini','bench',3,145,'27/07/26','Google Sheets — Statistiques'),
('gibertini','bench',4,135,'','Google Sheets — Statistiques'),
('gibertini','bench',5,130,'','Google Sheets — Statistiques'),
('gibertini','bench',6,125,'','Google Sheets — Statistiques'),
('gibertini','deadlift',1,305,'05/2025','Google Sheets — Statistiques'),
('gibertini','deadlift',2,300,'10/2025','Google Sheets — Statistiques'),
('gibertini','deadlift',4,285,'02/2026','Google Sheets — Statistiques'),
('gibertini','deadlift',5,270,'08/2025','Google Sheets — Statistiques'),
('gibertini','deadlift',6,260,'','Google Sheets — Statistiques'),
('janel','squat',1,140,'24/12/25','Google Sheets — Statistiques'),
('janel','squat',2,130,'','Google Sheets — Statistiques'),
('janel','squat',3,162.5,'','Google Sheets — Statistiques'),
('janel','squat',4,162.5,'','Google Sheets — Statistiques'),
('janel','squat',5,155,'','Google Sheets — Statistiques'),
('janel','squat',6,150,'','Google Sheets — Statistiques'),
('janel','squat',7,155,'','Google Sheets — Statistiques'),
('janel','bench',1,70,'24/12/25','Google Sheets — Statistiques'),
('janel','bench',2,115,'22/11/25','Google Sheets — Statistiques'),
('janel','bench',3,112.5,'02/04/26','Google Sheets — Statistiques'),
('janel','bench',4,110,'','Google Sheets — Statistiques'),
('janel','bench',5,102.5,'','Google Sheets — Statistiques'),
('janel','bench',6,101,'','Google Sheets — Statistiques'),
('janel','deadlift',1,180,'','Google Sheets — Statistiques'),
('janel','deadlift',2,190,'','Google Sheets — Statistiques'),
('janel','deadlift',3,187.5,'','Google Sheets — Statistiques'),
('janel','deadlift',5,180,'','Google Sheets — Statistiques'),
('jolan','squat',1,230,'','Google Sheets — Statistiques'),
('jolan','squat',2,215,'','Google Sheets — Statistiques'),
('jolan','squat',3,215,'','Google Sheets — Statistiques'),
('jolan','squat',4,200,'','Google Sheets — Statistiques'),
('jolan','squat',5,200,'','Google Sheets — Statistiques'),
('jolan','squat',6,195,'','Google Sheets — Statistiques'),
('jolan','squat',7,185,'','Google Sheets — Statistiques'),
('jolan','bench',1,180,'','Google Sheets — Statistiques'),
('jolan','bench',2,170,'','Google Sheets — Statistiques'),
('jolan','bench',3,170,'','Google Sheets — Statistiques'),
('jolan','bench',5,160,'','Google Sheets — Statistiques'),
('jolan','bench',6,150,'','Google Sheets — Statistiques'),
('jolan','bench',7,140,'','Google Sheets — Statistiques'),
('jolan','deadlift',1,275,'','Google Sheets — Statistiques'),
('jolan','deadlift',2,270,'','Google Sheets — Statistiques'),
('jolan','deadlift',3,260,'','Google Sheets — Statistiques'),
('jolan','deadlift',5,250,'','Google Sheets — Statistiques'),
('jonathan','squat',1,200,'','Google Sheets — Statistiques'),
('jonathan','squat',2,170,'26/11','Google Sheets — Statistiques'),
('jonathan','squat',3,170,'26/11','Google Sheets — Statistiques'),
('jonathan','squat',4,170,'26/11','Google Sheets — Statistiques'),
('jonathan','squat',5,180,'03/12','Google Sheets — Statistiques'),
('jonathan','bench',1,162.5,'','Google Sheets — Statistiques'),
('jonathan','bench',2,140,'03/12/2024','Google Sheets — Statistiques'),
('jonathan','bench',3,150,'26/01/24','Google Sheets — Statistiques'),
('jonathan','bench',5,142.5,'06/12/24','Google Sheets — Statistiques'),
('jonathan','bench',6,130,'09/12/24','Google Sheets — Statistiques'),
('jonathan','deadlift',1,210,'','Google Sheets — Statistiques'),
('jonathan','deadlift',2,215,'06/12/24','Google Sheets — Statistiques'),
('jonathan','deadlift',5,180,'08/12/24','Google Sheets — Statistiques'),
('kaoutar','squat',1,95,'','Google Sheets — Statistiques'),
('kaoutar','squat',5,90,'','Google Sheets — Statistiques'),
('kaoutar','bench',1,60,'','Google Sheets — Statistiques'),
('kaoutar','bench',2,60,'','Google Sheets — Statistiques'),
('kaoutar','bench',5,55,'','Google Sheets — Statistiques'),
('kaoutar','deadlift',1,137.5,'17/08/2025','Google Sheets — Statistiques'),
('kaoutar','deadlift',2,130,'','Google Sheets — Statistiques'),
('kaoutar','deadlift',3,120,'','Google Sheets — Statistiques'),
('killian','squat',1,180,'24/12/25','Google Sheets — Statistiques'),
('killian','squat',2,170,'','Google Sheets — Statistiques'),
('killian','squat',3,162.5,'','Google Sheets — Statistiques'),
('killian','squat',4,162.5,'','Google Sheets — Statistiques'),
('killian','squat',5,155,'','Google Sheets — Statistiques'),
('killian','squat',6,150,'','Google Sheets — Statistiques'),
('killian','squat',7,155,'','Google Sheets — Statistiques'),
('killian','bench',1,120,'24/12/25','Google Sheets — Statistiques'),
('killian','bench',2,115,'22/11/25','Google Sheets — Statistiques'),
('killian','bench',3,112.5,'02/04/26','Google Sheets — Statistiques'),
('killian','bench',4,110,'','Google Sheets — Statistiques'),
('killian','bench',5,102.5,'','Google Sheets — Statistiques'),
('killian','bench',6,101,'','Google Sheets — Statistiques'),
('killian','deadlift',1,200,'','Google Sheets — Statistiques'),
('killian','deadlift',2,190,'','Google Sheets — Statistiques'),
('killian','deadlift',3,187.5,'','Google Sheets — Statistiques'),
('killian','deadlift',5,180,'','Google Sheets — Statistiques'),
('lou','squat',1,95,'','Google Sheets — Statistiques'),
('lou','squat',2,90,'','Google Sheets — Statistiques'),
('lou','squat',4,82.5,'','Google Sheets — Statistiques'),
('lou','squat',5,77.5,'','Google Sheets — Statistiques'),
('lou','bench',1,57.5,'','Google Sheets — Statistiques'),
('lou','bench',2,55,'','Google Sheets — Statistiques'),
('lou','bench',3,52.5,'','Google Sheets — Statistiques'),
('lou','bench',4,50,'','Google Sheets — Statistiques'),
('lou','bench',5,50,'','Google Sheets — Statistiques'),
('lou','deadlift',1,120,'','Google Sheets — Statistiques'),
('lou','deadlift',2,110,'','Google Sheets — Statistiques'),
('lou','deadlift',4,100,'','Google Sheets — Statistiques'),
('lou','deadlift',5,97.5,'','Google Sheets — Statistiques'),
('lucine','squat',1,150,'','Google Sheets — Statistiques'),
('lucine','squat',2,140,'20/09/2025','Google Sheets — Statistiques'),
('lucine','squat',3,137.5,'','Google Sheets — Statistiques'),
('lucine','squat',4,137.5,'','Google Sheets — Statistiques'),
('lucine','squat',5,132.5,'','Google Sheets — Statistiques'),
('lucine','squat',6,120,'','Google Sheets — Statistiques'),
('lucine','squat',7,115,'','Google Sheets — Statistiques'),
('lucine','squat',8,110,'','Google Sheets — Statistiques'),
('lucine','bench',1,87.5,'20/10/2025','Google Sheets — Statistiques'),
('lucine','bench',2,80,'','Google Sheets — Statistiques'),
('lucine','bench',3,80,'','Google Sheets — Statistiques'),
('lucine','bench',4,77.5,'','Google Sheets — Statistiques'),
('lucine','bench',5,75,'','Google Sheets — Statistiques'),
('lucine','bench',6,70,'','Google Sheets — Statistiques'),
('lucine','bench',7,62.5,'','Google Sheets — Statistiques'),
('lucine','bench',8,60,'','Google Sheets — Statistiques'),
('lucine','deadlift',1,187.5,'','Google Sheets — Statistiques'),
('lucine','deadlift',2,180,'','Google Sheets — Statistiques'),
('lucine','deadlift',3,175,'','Google Sheets — Statistiques'),
('lucine','deadlift',4,167.5,'','Google Sheets — Statistiques'),
('lucine','deadlift',5,160,'','Google Sheets — Statistiques'),
('lucine','deadlift',6,155,'','Google Sheets — Statistiques'),
('lucine','deadlift',7,140,'','Google Sheets — Statistiques'),
('magicarpe','squat',1,155,'30/10/25','Google Sheets — Statistiques'),
('magicarpe','squat',2,150,'30/08/25','Google Sheets — Statistiques'),
('magicarpe','squat',3,147.5,'27/09/25','Google Sheets — Statistiques'),
('magicarpe','squat',4,132.5,'','Google Sheets — Statistiques'),
('magicarpe','squat',5,130,'','Google Sheets — Statistiques'),
('magicarpe','bench',1,95,'23/05/26','Google Sheets — Statistiques'),
('magicarpe','bench',2,90,'30/08/25','Google Sheets — Statistiques'),
('magicarpe','bench',3,90,'27/09/25','Google Sheets — Statistiques'),
('magicarpe','bench',5,80,'','Google Sheets — Statistiques'),
('magicarpe','deadlift',1,187.5,'30/10/25','Google Sheets — Statistiques'),
('magicarpe','deadlift',2,170,'','Google Sheets — Statistiques'),
('magicarpe','deadlift',3,170,'15/05/25','Google Sheets — Statistiques'),
('magicarpe','deadlift',4,160,'25/08/25','Google Sheets — Statistiques'),
('malo','squat',1,210,'','Google Sheets — Statistiques'),
('malo','squat',2,180,'','Google Sheets — Statistiques'),
('malo','squat',3,175,'','Google Sheets — Statistiques'),
('malo','squat',4,175,'','Google Sheets — Statistiques'),
('malo','squat',5,175,'','Google Sheets — Statistiques'),
('malo','squat',6,175,'','Google Sheets — Statistiques'),
('malo','squat',7,175,'','Google Sheets — Statistiques'),
('malo','bench',1,145,'','Google Sheets — Statistiques'),
('malo','bench',2,132.5,'','Google Sheets — Statistiques'),
('malo','bench',3,125,'','Google Sheets — Statistiques'),
('malo','bench',4,125,'','Google Sheets — Statistiques'),
('malo','bench',5,105,'','Google Sheets — Statistiques'),
('malo','bench',6,105,'','Google Sheets — Statistiques'),
('malo','deadlift',1,240,'','Google Sheets — Statistiques'),
('malo','deadlift',2,200,'','Google Sheets — Statistiques'),
('malo','deadlift',3,200,'','Google Sheets — Statistiques'),
('malo','deadlift',4,200,'19/07/2025','Google Sheets — Statistiques'),
('malo','deadlift',5,190,'','Google Sheets — Statistiques'),
('malo','deadlift',6,190,'','Google Sheets — Statistiques'),
('marvin','squat',1,286,'','Google Sheets — Statistiques'),
('marvin','squat',2,250,'','Google Sheets — Statistiques'),
('marvin','squat',3,250,'','Google Sheets — Statistiques'),
('marvin','squat',4,240,'','Google Sheets — Statistiques'),
('marvin','squat',5,235,'','Google Sheets — Statistiques'),
('marvin','squat',6,220,'','Google Sheets — Statistiques'),
('marvin','squat',7,205,'16/07/2025*','Google Sheets — Statistiques'),
('marvin','squat',8,190,'','Google Sheets — Statistiques'),
('marvin','bench',1,185,'','Google Sheets — Statistiques'),
('marvin','bench',2,170,'','Google Sheets — Statistiques'),
('marvin','bench',3,165,'','Google Sheets — Statistiques'),
('marvin','bench',4,150,'','Google Sheets — Statistiques'),
('marvin','bench',5,150,'16/07/2025','Google Sheets — Statistiques'),
('marvin','bench',6,142.5,'','Google Sheets — Statistiques'),
('marvin','bench',8,130,'','Google Sheets — Statistiques'),
('marvin','deadlift',1,300,'','Google Sheets — Statistiques'),
('marvin','deadlift',2,260,'','Google Sheets — Statistiques'),
('marvin','deadlift',3,260,'','Google Sheets — Statistiques'),
('marvin','deadlift',4,250,'','Google Sheets — Statistiques'),
('marvin','deadlift',5,250,'','Google Sheets — Statistiques'),
('marvin','deadlift',6,230,'','Google Sheets — Statistiques'),
('matthieu','squat',1,210,'','Profil HTML — aucun onglet « Statistiques » trouvé dans le Google Sheet Matthieu BF'),
('matthieu','bench',1,115,'','Profil HTML — aucun onglet « Statistiques » trouvé dans le Google Sheet Matthieu BF'),
('matthieu','deadlift',1,260,'','Profil HTML — aucun onglet « Statistiques » trouvé dans le Google Sheet Matthieu BF'),
('maxence','squat',1,215,'04/01/26','Google Sheets — Statistiques'),
('maxence','squat',2,200,'04/12/25','Google Sheets — Statistiques'),
('maxence','squat',3,200,'04/12/25','Google Sheets — Statistiques'),
('maxence','squat',4,180,'03/25','Google Sheets — Statistiques'),
('maxence','squat',5,192.5,'06/05/26','Google Sheets — Statistiques'),
('maxence','squat',6,170,'24/02/26','Google Sheets — Statistiques'),
('maxence','squat',7,180,'10/05/26','Google Sheets — Statistiques'),
('maxence','squat',8,140,'','Google Sheets — Statistiques'),
('maxence','squat',9,100,'','Google Sheets — Statistiques'),
('maxence','bench',1,143,'06/05/26','Google Sheets — Statistiques'),
('maxence','bench',2,132.5,'04/05/26','Google Sheets — Statistiques'),
('maxence','bench',3,130,'06/05/26','Google Sheets — Statistiques'),
('maxence','bench',4,122.5,'04/25','Google Sheets — Statistiques'),
('maxence','bench',5,122.5,'18/05/26','Google Sheets — Statistiques'),
('maxence','bench',6,112.5,'04/25','Google Sheets — Statistiques'),
('maxence','bench',7,110,'04/25','Google Sheets — Statistiques'),
('maxence','bench',8,100,'','Google Sheets — Statistiques'),
('maxence','bench',9,100,'','Google Sheets — Statistiques'),
('maxence','deadlift',1,250,'01/02/26','Google Sheets — Statistiques'),
('maxence','deadlift',2,230,'02/12/25','Google Sheets — Statistiques'),
('maxence','deadlift',3,225,'06/06/26','Google Sheets — Statistiques'),
('maxence','deadlift',4,215,'28/12/25','Google Sheets — Statistiques'),
('maxence','deadlift',5,210,'19/02/26','Google Sheets — Statistiques'),
('maxence','deadlift',6,182.5,'04/25','Google Sheets — Statistiques'),
('maxence','deadlift',7,180,'','Google Sheets — Statistiques'),
('maxence','deadlift',8,180,'27/05/25','Google Sheets — Statistiques'),
('maxence','deadlift',9,192.5,'11/01/26','Google Sheets — Statistiques'),
('noe','squat',1,245,'','Google Sheets — Statistiques'),
('noe','squat',2,235,'','Google Sheets — Statistiques'),
('noe','squat',3,230,'','Google Sheets — Statistiques'),
('noe','squat',4,230,'','Google Sheets — Statistiques'),
('noe','squat',5,220,'','Google Sheets — Statistiques'),
('noe','bench',1,160,'','Google Sheets — Statistiques'),
('noe','bench',2,155,'06/02/2025','Google Sheets — Statistiques'),
('noe','bench',3,150,'','Google Sheets — Statistiques'),
('noe','bench',5,140,'','Google Sheets — Statistiques'),
('noe','deadlift',1,275,'','Google Sheets — Statistiques'),
('noe','deadlift',2,270,'','Google Sheets — Statistiques'),
('noe','deadlift',3,260,'','Google Sheets — Statistiques'),
('noe','deadlift',4,245,'','Google Sheets — Statistiques'),
('noe','deadlift',5,245,'','Google Sheets — Statistiques'),
('noe','deadlift',6,220,'','Google Sheets — Statistiques'),
('noe','deadlift',7,195,'','Google Sheets — Statistiques'),
('saya','squat',1,172.5,'','Google Sheets — Statistiques'),
('saya','squat',2,150,'','Google Sheets — Statistiques'),
('saya','squat',3,152.5,'','Google Sheets — Statistiques'),
('saya','squat',4,155,'','Google Sheets — Statistiques'),
('saya','squat',5,140,'','Google Sheets — Statistiques'),
('saya','squat',6,147.5,'','Google Sheets — Statistiques'),
('saya','squat',7,140,'','Google Sheets — Statistiques'),
('saya','squat',8,140,'','Google Sheets — Statistiques'),
('saya','bench',1,82.5,'','Google Sheets — Statistiques'),
('saya','bench',2,75,'Block 12','Google Sheets — Statistiques'),
('saya','bench',3,75,'','Google Sheets — Statistiques'),
('saya','bench',4,70,'','Google Sheets — Statistiques'),
('saya','bench',5,75,'18/07/26','Google Sheets — Statistiques'),
('saya','bench',7,65,'','Google Sheets — Statistiques'),
('saya','deadlift',1,185,'','Google Sheets — Statistiques'),
('saya','deadlift',2,170,'','Google Sheets — Statistiques'),
('saya','deadlift',3,170,'','Google Sheets — Statistiques'),
('saya','deadlift',4,140,'','Google Sheets — Statistiques'),
('saya','deadlift',5,157.5,'','Google Sheets — Statistiques'),
('saya','deadlift',6,145,'','Google Sheets — Statistiques'),
('serena','squat',1,170,'FR JNR 26','Google Sheets — Statistiques'),
('serena','squat',4,152.5,'PREPA JNR 26','Google Sheets — Statistiques'),
('serena','squat',6,147.5,'','Google Sheets — Statistiques'),
('serena','bench',1,85,'FR JNR 26','Google Sheets — Statistiques'),
('serena','bench',2,82.5,'PREPA QUALIF','Google Sheets — Statistiques'),
('serena','bench',3,79,'PREPA QUALIF','Google Sheets — Statistiques'),
('serena','bench',5,80,'PREPA JNR 26','Google Sheets — Statistiques'),
('serena','deadlift',1,215,'FR JNR 26','Google Sheets — Statistiques'),
('serena','deadlift',2,190,'PREPA QUALIF','Google Sheets — Statistiques'),
('serena','deadlift',5,200,'PREPA JNR 26','Google Sheets — Statistiques'),
('tom','squat',1,285,'','Google Sheets — Statistiques'),
('tom','squat',2,265,'','Google Sheets — Statistiques'),
('tom','squat',3,265,'','Google Sheets — Statistiques'),
('tom','squat',4,250,'','Google Sheets — Statistiques'),
('tom','squat',5,252.5,'','Google Sheets — Statistiques'),
('tom','squat',6,242.5,'','Google Sheets — Statistiques'),
('tom','squat',7,232.5,'','Google Sheets — Statistiques'),
('tom','squat',8,230,'','Google Sheets — Statistiques'),
('tom','bench',1,167.5,'','Google Sheets — Statistiques'),
('tom','bench',2,160,'','Google Sheets — Statistiques'),
('tom','bench',3,155,'','Google Sheets — Statistiques'),
('tom','bench',4,145,'','Google Sheets — Statistiques'),
('tom','bench',5,145,'','Google Sheets — Statistiques'),
('tom','bench',6,145,'','Google Sheets — Statistiques'),
('tom','deadlift',1,307.5,'','Google Sheets — Statistiques'),
('tom','deadlift',2,290,'','Google Sheets — Statistiques'),
('tom','deadlift',3,280,'','Google Sheets — Statistiques'),
('tom','deadlift',4,260,'','Google Sheets — Statistiques'),
('tom','deadlift',5,250,'','Google Sheets — Statistiques'),
('yann','squat',1,320,'','Google Sheets — Statistiques'),
('yann','squat',3,300,'','Google Sheets — Statistiques'),
('yann','squat',5,280,'20/04','Google Sheets — Statistiques'),
('yann','squat',6,260,'','Google Sheets — Statistiques'),
('yann','bench',1,222.5,'','Google Sheets — Statistiques'),
('yann','bench',2,207.5,'','Google Sheets — Statistiques'),
('yann','bench',3,200,'','Google Sheets — Statistiques'),
('yann','bench',5,200,'01/07/26','Google Sheets — Statistiques'),
('yann','deadlift',1,336,'RBC 2026','Google Sheets — Statistiques'),
('yann','deadlift',3,312.5,'','Google Sheets — Statistiques'),
('yann','deadlift',4,300,'04/07/26','Google Sheets — Statistiques'),
('yann','deadlift',5,290,'','Google Sheets — Statistiques'),
('sarah','squat',1,130,'','Google Sheets Sarah — Sarah retour vacances dev'),
('sarah','bench',1,88,'','Google Sheets Sarah — Sarah retour vacances dev'),
('sarah','deadlift',1,152.5,'','Google Sheets Sarah — Sarah retour vacances dev');

insert into public.athlete_sbd_rep_prs_v249 as target(
  athlete_slug,lift,reps,load_kg,achieved_label,source_label,updated_at
)
select athlete_slug,lift,reps,load_kg,achieved_label,source_label,now()
from ga_sbd_seed_v249
on conflict (athlete_slug,lift,reps) do update set
  load_kg=excluded.load_kg,
  achieved_label=excluded.achieved_label,
  source_label=excluded.source_label,
  updated_at=now()
where excluded.load_kg > target.load_kg;

-- Récupère également les PR déjà enregistrés dans la V2 avant cette migration.
do $$
begin
  if to_regclass('public.athlete_sbd_prs_v2') is not null then
    insert into public.athlete_sbd_rep_prs_v249 as target(
      athlete_slug,lift,reps,load_kg,exercise_name,achieved_at,source_label,updated_at
    )
    select
      athlete_slug,
      lift,
      coalesce(reps,1),
      load_kg,
      exercise_name,
      achieved_at,
      'GA Coaching V2 — migration',
      now()
    from public.athlete_sbd_prs_v2
    where load_kg > 0
      and coalesce(reps,1) between 1 and 9
    on conflict (athlete_slug,lift,reps) do update set
      load_kg=excluded.load_kg,
      exercise_name=excluded.exercise_name,
      achieved_at=excluded.achieved_at,
      source_label=excluded.source_label,
      updated_at=now()
    where excluded.load_kg > target.load_kg;
  end if;
end $$;

commit;

-- Contrôle rapide :
-- select athlete_slug,lift,reps,load_kg,coalesce(achieved_label,achieved_at::text) as date
-- from public.athlete_sbd_rep_prs_v249
-- order by athlete_slug,lift,reps;
