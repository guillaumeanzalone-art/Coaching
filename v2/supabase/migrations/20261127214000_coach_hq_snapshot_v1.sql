CREATE OR REPLACE FUNCTION public.coach_hq_snapshot_v1()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public AS $function$
DECLARE v_result jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_coach() THEN
    RAISE EXCEPTION 'Coach HQ réservé au compte coach' USING ERRCODE = '42501';
  END IF;

  WITH active_program AS (
    SELECT DISTINCT ON (lower(p.athlete_slug))
      lower(p.athlete_slug) AS slug, p.program_json #>> '{blocks,0,id}' AS block_key,
      coalesce(p.program_json #>> '{blocks,0,label}', 'Programme actif') AS title,
      p.program_json #> '{blocks,0,weeks}' AS weeks,
      p.updated_at AS program_updated_at
    FROM public.program_versions_v2 p
    WHERE p.status = 'active' AND p.program_json #>> '{blocks,0,id}' IS NOT NULL
    ORDER BY lower(p.athlete_slug), p.updated_at DESC
  ),
  roster AS (
    SELECT
      coalesce(a.slug, lower(p.slug)) AS slug,
      coalesce(p.display_name, initcap(coalesce(a.slug, 'Athlète'))) AS name,
      coalesce(p.emoji, '🏋️') AS emoji,
      a.block_key, a.title AS block_title, a.weeks,
      CASE WHEN jsonb_typeof(a.weeks) = 'array' THEN jsonb_array_length(a.weeks) ELSE 0 END AS total_weeks
    FROM active_program a
    FULL JOIN public.athlete_profiles_v3 p ON lower(p.slug) = a.slug
    WHERE coalesce(p.active, true)
  ),
  last_done AS (
    SELECT DISTINCT ON (lower(s.athlete_slug))
      lower(s.athlete_slug) AS slug, s.program_key, s.week_index, s.day_index, s.completed_at
    FROM public.training_sessions_v2 s
    JOIN active_program a ON a.slug = lower(s.athlete_slug) AND a.block_key = s.program_key
    WHERE s.status = 'completed' AND s.completed_at IS NOT NULL
    ORDER BY lower(s.athlete_slug), s.completed_at DESC, s.id DESC
  ),
  week_sessions AS (
    SELECT l.slug, count(DISTINCT s.day_index)::integer AS completed_days
    FROM last_done l JOIN public.training_sessions_v2 s
      ON lower(s.athlete_slug) = l.slug AND s.program_key = l.program_key
     AND s.week_index = l.week_index AND s.status = 'completed'
     AND s.completed_at IS NOT NULL
    GROUP BY l.slug
  ),
  valid_sets AS (
    SELECT l.slug, w.day_index, w.exercise_name, w.rpe
    FROM last_done l JOIN public.workout_sets w
      ON lower(w.athlete_slug) = l.slug
     AND w.program_key = l.program_key AND w.week_index = l.week_index
    WHERE w.completed = true AND w.rpe BETWEEN 1 AND 10
      AND EXISTS (
        SELECT 1 FROM public.training_sessions_v2 s
        WHERE lower(s.athlete_slug) = l.slug AND s.program_key = l.program_key
          AND s.week_index = l.week_index AND s.day_index = w.day_index
          AND s.status = 'completed' AND s.completed_at IS NOT NULL
      )
  ),
  rpe_counts AS (
    SELECT v.slug, count(*)::integer AS rated_sets,
      count(*) FILTER (WHERE v.rpe > 8)::integer AS over_8,
      count(*) FILTER (WHERE v.rpe > 8.5)::integer AS over_85
    FROM valid_sets v GROUP BY v.slug
  ),
  session_rpe AS (
    SELECT v.slug, count(*)::integer AS last_rated_sets,
      count(*) FILTER (WHERE v.rpe > 8)::integer AS last_over_8,
      count(*) FILTER (WHERE v.rpe > 8.5)::integer AS last_over_85
    FROM valid_sets v JOIN last_done l ON l.slug = v.slug AND l.day_index = v.day_index
    GROUP BY v.slug
  ),
  exercise_rpe AS (
    SELECT v.slug,v.exercise_name,
      count(*) FILTER (WHERE v.rpe > 8)::integer AS over_8,
      count(*) FILTER (WHERE v.rpe > 8.5)::integer AS over_85
    FROM valid_sets v WHERE v.rpe > 8 GROUP BY v.slug,v.exercise_name
  ),
  exercise_ranked AS (
    SELECT *,row_number() OVER (PARTITION BY slug ORDER BY over_85 DESC, over_8 DESC, exercise_name) AS rank
    FROM exercise_rpe
  ),
  exercise_top AS (
    SELECT slug,jsonb_agg(
      jsonb_build_object('name', exercise_name, 'over_8', over_8, 'over_85', over_85) ORDER BY rank
    ) AS top_exercises
    FROM exercise_ranked WHERE rank <= 3 GROUP BY slug
  ),
  last7 AS (
    SELECT lower(s.athlete_slug) AS slug, count(*)::integer AS sessions_7d
    FROM public.training_sessions_v2 s
    JOIN active_program a ON a.slug = lower(s.athlete_slug) AND a.block_key = s.program_key
    WHERE s.status='completed' AND s.completed_at >= now() - interval '7 days'
    GROUP BY lower(s.athlete_slug)
  ),
  output AS (
    SELECT
      r.slug, r.name, r.emoji, r.block_key, r.block_title, r.total_weeks,
      l.week_index + 1 AS week_number, l.completed_at AS last_session_at,
      coalesce(ws.completed_days,0) AS completed_days,
      CASE WHEN jsonb_typeof(r.weeks -> l.week_index -> 'days') = 'array'
           THEN jsonb_array_length(r.weeks -> l.week_index -> 'days') ELSE 0 END AS planned_days,
      coalesce(c.rated_sets,0) AS rated_sets, coalesce(c.over_8,0) AS over_8,
      coalesce(c.over_85,0) AS over_85, coalesce(sr.last_rated_sets,0) AS last_rated_sets,
      coalesce(sr.last_over_8,0) AS last_over_8,
      coalesce(sr.last_over_85,0) AS last_over_85,
      coalesce(x.top_exercises,'[]'::jsonb) AS top_exercises,
      coalesce(last7.sessions_7d,0) AS sessions_7d
    FROM roster r
    LEFT JOIN last_done l ON l.slug = r.slug
    LEFT JOIN week_sessions ws ON ws.slug = r.slug
    LEFT JOIN rpe_counts c ON c.slug = r.slug
    LEFT JOIN session_rpe sr ON sr.slug = r.slug
    LEFT JOIN exercise_top x ON x.slug = r.slug
    LEFT JOIN last7 ON last7.slug = r.slug
  )
  SELECT jsonb_build_object(
    'generated_at', now(), 'scope', 'last_completed_session_week_in_active_block',
    'athletes', coalesce(jsonb_agg(to_jsonb(o) ORDER BY o.name), '[]'::jsonb)
  ) INTO v_result FROM output o;
  RETURN v_result;
END
$function$;

REVOKE ALL ON FUNCTION public.coach_hq_snapshot_v1() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.coach_hq_snapshot_v1() TO authenticated;
COMMENT ON FUNCTION public.coach_hq_snapshot_v1() IS
  'Lecture coach uniquement. Dépassements stricts de RPE 8 et 8,5 sur la dernière semaine avec séance terminée du bloc actif. Séries terminées avec RPE valide et séance terminée.';
