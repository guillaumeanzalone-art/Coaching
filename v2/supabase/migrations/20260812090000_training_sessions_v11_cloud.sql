-- GA Coaching V1.1 - Session Tracking Cloud + Bilan

create table if not exists public.training_sessions_v2 (
  id uuid primary key default gen_random_uuid(),
  athlete_slug text not null,
  program_key text not null,
  week_index integer not null check (week_index >= 0),
  day_index integer not null check (day_index >= 0),

  started_at timestamptz,
  completed_at timestamptz,
  duration_seconds integer
    check (
      duration_seconds is null
      or duration_seconds >= 0
    ),

  session_note text not null default '',

  hydration_liters numeric,
  sleep_hours numeric,
  pain_upper numeric,
  pain_lower numeric,
  steps integer,

  status text not null default 'pending'
    check (
      status in (
        'pending',
        'in_progress',
        'completed'
      )
    ),

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

  unique (
    athlete_slug,
    program_key,
    week_index,
    day_index
  )
);

alter table public.training_sessions_v2
  add column if not exists hydration_liters numeric;

alter table public.training_sessions_v2
  add column if not exists sleep_hours numeric;

alter table public.training_sessions_v2
  add column if not exists pain_upper numeric;

alter table public.training_sessions_v2
  add column if not exists pain_lower numeric;

alter table public.training_sessions_v2
  add column if not exists steps integer;

create index if not exists
  training_sessions_v2_athlete_program_idx
on public.training_sessions_v2 (
  athlete_slug,
  program_key
);

alter table
  public.training_sessions_v2
enable row level security;

drop policy if exists
  "training_sessions_v2_select"
on public.training_sessions_v2;

create policy
  "training_sessions_v2_select"
on public.training_sessions_v2
for select
to authenticated
using (
  public.can_edit_athlete(
    athlete_slug
  )
);

drop policy if exists
  "training_sessions_v2_insert"
on public.training_sessions_v2;

create policy
  "training_sessions_v2_insert"
on public.training_sessions_v2
for insert
to authenticated
with check (
  public.can_edit_athlete(
    athlete_slug
  )
);

drop policy if exists
  "training_sessions_v2_update"
on public.training_sessions_v2;

create policy
  "training_sessions_v2_update"
on public.training_sessions_v2
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
  "training_sessions_v2_delete"
on public.training_sessions_v2;

create policy
  "training_sessions_v2_delete"
on public.training_sessions_v2
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
on public.training_sessions_v2
to authenticated;
