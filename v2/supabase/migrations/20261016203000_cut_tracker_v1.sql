-- GA Coaching · CUT v1
-- Persist water-cut / food-mass tracker state per athlete.

create table if not exists public.athlete_cut_protocols_v1 (
  id uuid primary key default gen_random_uuid(),
  athlete_slug text not null,
  protocol_key text not null,
  title text not null default 'CUT',
  category text not null default '',
  event_date date,
  start_bodyweight numeric(7,2),
  target_bodyweight numeric(7,2),
  status text not null default 'active'
    check (status in ('active','completed','archived')),
  data jsonb not null default '{}'::jsonb,
  created_by uuid
    references auth.users(id)
    on delete set null
    default auth.uid(),
  updated_by uuid
    references auth.users(id)
    on delete set null
    default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (athlete_slug, protocol_key)
);

create index if not exists
  athlete_cut_protocols_v1_athlete_idx
on public.athlete_cut_protocols_v1 (
  athlete_slug,
  updated_at desc
);

alter table public.athlete_cut_protocols_v1
enable row level security;

drop policy if exists
  "athlete_cut_protocols_v1_select"
on public.athlete_cut_protocols_v1;

create policy
  "athlete_cut_protocols_v1_select"
on public.athlete_cut_protocols_v1
for select
to authenticated
using (
  public.can_edit_athlete(
    athlete_slug
  )
);

drop policy if exists
  "athlete_cut_protocols_v1_insert"
on public.athlete_cut_protocols_v1;

create policy
  "athlete_cut_protocols_v1_insert"
on public.athlete_cut_protocols_v1
for insert
to authenticated
with check (
  public.can_edit_athlete(
    athlete_slug
  )
);

drop policy if exists
  "athlete_cut_protocols_v1_update"
on public.athlete_cut_protocols_v1;

create policy
  "athlete_cut_protocols_v1_update"
on public.athlete_cut_protocols_v1
for update
to authenticated
using (
  public.can_edit_athlete(
    athlete_slug
  )
)
with check (
  public.can_edit_athlete(
    athlete_slug
  )
);

drop policy if exists
  "athlete_cut_protocols_v1_delete"
on public.athlete_cut_protocols_v1;

create policy
  "athlete_cut_protocols_v1_delete"
on public.athlete_cut_protocols_v1
for delete
to authenticated
using (
  public.can_edit_athlete(
    athlete_slug
  )
);

grant
  select,
  insert,
  update,
  delete
on public.athlete_cut_protocols_v1
to authenticated;
