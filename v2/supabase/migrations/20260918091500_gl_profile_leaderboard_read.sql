-- Allow authenticated GA Coaching users to read active GL profiles
-- for SBD movement leaderboards. Writes remain protected and go through
-- the existing secured RPCs.

drop policy if exists athlete_program_gl_v171_read_authenticated
  on public.athlete_program_gl_v171;

create policy athlete_program_gl_v171_read_authenticated
  on public.athlete_program_gl_v171
  for select
  to authenticated
  using (true);
