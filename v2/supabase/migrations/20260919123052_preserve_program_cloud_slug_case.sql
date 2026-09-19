-- Conserve les slugs historiques attendus par l'application déjà publiée.
-- Les tables V3 restent normalisées en minuscules.

begin;

create temporary table ga_program_cloud_canonical_active
on commit drop
as
select distinct on (lower(athlete_slug))
  id,
  lower(athlete_slug) as normalized_slug
from public.program_versions_v2
where lower(athlete_slug) in ('noe', 'matthieu')
  and status = 'active'
order by
  lower(athlete_slug),
  published_at desc nulls last,
  updated_at desc,
  version desc,
  created_at desc;

update public.program_versions_v2
set
  status = 'archived',
  updated_at = now()
where lower(athlete_slug) in ('noe', 'matthieu')
  and status = 'active';

update public.program_versions_v2 as version_row
set
  athlete_slug = case canonical.normalized_slug
    when 'noe' then 'Noe'
    when 'matthieu' then 'Matthieu'
  end,
  status = 'active',
  updated_at = now()
from ga_program_cloud_canonical_active as canonical
where version_row.id = canonical.id;

create or replace function public.publish_imported_program_v1(
  p_athlete_slug text,
  p_program_key text,
  p_program_json jsonb,
  p_block_key text,
  p_block_number integer,
  p_title text,
  p_overview_json jsonb default '{}'::jsonb,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_requested_slug text := btrim(coalesce(p_athlete_slug, ''));
  v_athlete_slug text := lower(v_requested_slug);
  v_program_cloud_slug text := case lower(v_requested_slug)
    when 'noe' then 'Noe'
    when 'matthieu' then 'Matthieu'
    else lower(v_requested_slug)
  end;
  v_program_key text := btrim(coalesce(p_program_key, ''));
  v_block_key text := btrim(coalesce(p_block_key, ''));
  v_title text := btrim(coalesce(p_title, ''));
  v_version integer;
  v_version_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if v_athlete_slug = '' then
    raise exception 'athlete_slug is required';
  end if;

  if not public.can_edit_athlete(v_athlete_slug) then
    raise exception 'Not allowed to edit athlete %', v_athlete_slug;
  end if;

  if v_program_key = '' then
    raise exception 'program_key is required';
  end if;

  if p_program_json is null or jsonb_typeof(p_program_json) <> 'object' then
    raise exception 'program_json must be an object';
  end if;

  if v_block_key = '' then
    raise exception 'block_key is required';
  end if;

  if coalesce(p_block_number, 0) < 1 then
    raise exception 'block_number must be greater than zero';
  end if;

  if v_title = '' then
    raise exception 'title is required';
  end if;

  perform pg_advisory_xact_lock(hashtext(v_athlete_slug || ':' || v_program_key));

  select coalesce(max(version), 0) + 1
  into v_version
  from public.program_versions_v2
  where lower(athlete_slug) = v_athlete_slug
    and program_key = v_program_key;

  update public.program_versions_v2
  set
    status = 'archived',
    updated_at = now()
  where lower(athlete_slug) = v_athlete_slug
    and status = 'active';

  insert into public.program_versions_v2 (
    athlete_slug,
    program_key,
    version,
    status,
    current_week,
    program_json,
    notes,
    created_by,
    published_at
  )
  values (
    v_program_cloud_slug,
    v_program_key,
    v_version,
    'active',
    1,
    p_program_json,
    p_notes,
    auth.uid(),
    now()
  )
  returning id into v_version_id;

  update public.athlete_program_blocks_v3
  set
    status = 'archived',
    updated_at = now()
  where lower(athlete_slug) = v_athlete_slug
    and status = 'current';

  insert into public.athlete_program_blocks_v3 (
    athlete_slug,
    block_key,
    block_number,
    title,
    subtitle,
    status,
    program_json,
    overview_json
  )
  values (
    v_athlete_slug,
    v_block_key,
    p_block_number,
    v_title,
    'Import Google Sheets',
    'current',
    p_program_json,
    coalesce(p_overview_json, '{}'::jsonb)
  )
  on conflict (athlete_slug, block_key)
  do update set
    block_number = excluded.block_number,
    title = excluded.title,
    subtitle = excluded.subtitle,
    status = 'current',
    program_json = excluded.program_json,
    overview_json = excluded.overview_json,
    updated_at = now();

  return jsonb_build_object(
    'version', v_version,
    'version_id', v_version_id,
    'block_key', v_block_key,
    'block_number', p_block_number
  );
end;
$$;

revoke all on function public.publish_imported_program_v1(
  text,
  text,
  jsonb,
  text,
  integer,
  text,
  jsonb,
  text
) from public, anon;

grant execute on function public.publish_imported_program_v1(
  text,
  text,
  jsonb,
  text,
  integer,
  text,
  jsonb,
  text
) to authenticated;

commit;
