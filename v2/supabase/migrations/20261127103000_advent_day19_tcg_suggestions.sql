-- GA Coaching — Calendrier de l'Avent 2026, jour 19.
-- Une proposition libre par athlète, visible uniquement par son auteur et le coach.
create table if not exists public.advent_day19_tcg_suggestions_2026 (
  id uuid primary key default gen_random_uuid(),
  voter_id uuid not null references auth.users(id) on delete cascade,
  suggestion text not null check (
    char_length(btrim(suggestion)) between 2 and 120
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint advent_day19_tcg_suggestions_2026_voter_unique unique (voter_id)
);

create index if not exists advent_day19_tcg_suggestions_2026_updated_idx
  on public.advent_day19_tcg_suggestions_2026 (updated_at desc);

alter table public.advent_day19_tcg_suggestions_2026 enable row level security;

revoke all on public.advent_day19_tcg_suggestions_2026 from public, anon, authenticated;
grant select on public.advent_day19_tcg_suggestions_2026 to authenticated;
grant insert (voter_id, suggestion) on public.advent_day19_tcg_suggestions_2026 to authenticated;
grant update (suggestion, updated_at) on public.advent_day19_tcg_suggestions_2026 to authenticated;

create policy "advent_day19_read_own_or_coach"
  on public.advent_day19_tcg_suggestions_2026
  for select to authenticated
  using (
    voter_id = (select auth.uid())
    or public.is_coach()
  );

create policy "advent_day19_insert_own_after_unlock"
  on public.advent_day19_tcg_suggestions_2026
  for insert to authenticated
  with check (
    voter_id = (select auth.uid())
    and exists (
      select 1 from public.app_users m
      where m.user_id = (select auth.uid()) and m.role = 'athlete'
    )
    and (timezone('Europe/Paris', now()))::date >= date '2026-12-19'
  );

create policy "advent_day19_edit_own_after_unlock"
  on public.advent_day19_tcg_suggestions_2026
  for update to authenticated
  using (
    voter_id = (select auth.uid())
    and (timezone('Europe/Paris', now()))::date >= date '2026-12-19'
  )
  with check (
    voter_id = (select auth.uid())
    and (timezone('Europe/Paris', now()))::date >= date '2026-12-19'
  );

comment on table public.advent_day19_tcg_suggestions_2026 is
  'Calendrier de l Avent Team GA 2026, jour 19 : suggestion libre par athlète pour une future carte TCG.';
