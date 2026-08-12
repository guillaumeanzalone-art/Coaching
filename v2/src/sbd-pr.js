import { supabase } from './supabase.js'

const OUTBOX_KEY =
  'ga-sbd-pr-outbox-v1'

const LIFT_LABELS = {
  squat: 'Squat',
  bench: 'Bench',
  deadlift: 'Deadlift',
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(
      /[\u0300-\u036f]/g,
      ''
    )
    .toLowerCase()
    .trim()
}

function parseLoadKg(value) {
  const match =
    String(value ?? '')
      .replace(',', '.')
      .match(
        /-?\d+(?:\.\d+)?/
      )

  if (!match) {
    return null
  }

  const load =
    Number(match[0])

  return (
    Number.isFinite(load) &&
    load > 0
      ? load
      : null
  )
}

function parseReps(value) {
  const match =
    String(value ?? '')
      .match(/\d+/)

  if (!match) {
    return null
  }

  const reps =
    Number.parseInt(
      match[0],
      10
    )

  return Number.isFinite(reps)
    ? reps
    : null
}

export function normalizeSbdLift(
  exercise
) {
  const text =
    normalizeText(
      [
        exercise?.type,
        exercise?.code,
        exercise?.name,
        exercise?.variant,
      ]
        .filter(Boolean)
        .join(' ')
    )

  if (
    /(^|\s)(sq|squat)(\s|$)/.test(
      text
    )
  ) {
    return 'squat'
  }

  if (
    /(^|\s)(bn|bp|bench)(\s|$)/.test(
      text
    ) ||
    text.includes(
      'developpe couche'
    )
  ) {
    return 'bench'
  }

  if (
    /(^|\s)(dl|deadlift)(\s|$)/.test(
      text
    ) ||
    text.includes(
      'souleve de terre'
    )
  ) {
    return 'deadlift'
  }

  return null
}

function readOutbox() {
  try {
    const parsed =
      JSON.parse(
        localStorage.getItem(
          OUTBOX_KEY
        ) || '{}'
      )

    return (
      parsed &&
      typeof parsed === 'object'
        ? parsed
        : {}
    )
  } catch {
    return {}
  }
}

function writeOutbox(outbox) {
  localStorage.setItem(
    OUTBOX_KEY,
    JSON.stringify(outbox)
  )
}

function outboxKey(
  athleteSlug,
  lift
) {
  return [
    String(
      athleteSlug || ''
    ).toLowerCase(),
    lift,
  ].join('::')
}

function queueCandidate(
  payload
) {
  const outbox =
    readOutbox()

  const key =
    outboxKey(
      payload.athleteSlug,
      payload.lift
    )

  const current =
    outbox[key]

  if (
    current &&
    Number(
      current.loadKg
    ) >=
      Number(
        payload.loadKg
      )
  ) {
    return
  }

  outbox[key] =
    payload

  writeOutbox(outbox)
}

async function sendCandidate(
  payload
) {
  const {
    data,
    error,
  } =
    await supabase.rpc(
      'record_sbd_pr_v2',
      {
        p_athlete_slug:
          payload.athleteSlug,
        p_lift:
          payload.lift,
        p_load_kg:
          payload.loadKg,
        p_reps:
          payload.reps,
        p_program_key:
          payload.programKey,
        p_week_index:
          payload.weekIndex,
        p_day_index:
          payload.dayIndex,
        p_set_index:
          payload.setIndex,
        p_exercise_name:
          payload.exerciseName,
      }
    )

  if (error) {
    return {
      error,
    }
  }

  const row =
    Array.isArray(data)
      ? data[0]
      : data

  return {
    isPr:
      Boolean(
        row?.is_pr
      ),
    previousLoad:
      row?.previous_load ??
      null,
    currentLoad:
      row?.current_load ??
      payload.loadKg,
    lift:
      row?.lift_code ||
      payload.lift,
    label:
      LIFT_LABELS[
        row?.lift_code ||
        payload.lift
      ] ||
      payload.lift,
  }
}

export async function recordValidatedSbdSet({
  athleteSlug,
  exercise,
  load,
  reps,
  programKey,
  weekIndex,
  dayIndex,
  setIndex,
}) {
  const lift =
    normalizeSbdLift(
      exercise
    )

  const loadKg =
    parseLoadKg(load)

  if (
    !athleteSlug ||
    !lift ||
    !loadKg
  ) {
    return null
  }

  const payload = {
    athleteSlug:
      String(
        athleteSlug
      ),
    lift,
    loadKg,
    reps:
      parseReps(reps),
    programKey:
      String(
        programKey || ''
      ),
    weekIndex:
      Number(
        weekIndex
      ) || 0,
    dayIndex:
      Number(
        dayIndex
      ) || 0,
    setIndex:
      Number(
        setIndex
      ) || 0,
    exerciseName:
      String(
        exercise?.name ||
        exercise?.type ||
        lift
      ),
  }

  if (
    navigator.onLine ===
    false
  ) {
    queueCandidate(
      payload
    )

    return {
      queued: true,
      lift,
      label:
        LIFT_LABELS[lift],
      currentLoad:
        loadKg,
    }
  }

  const result =
    await sendCandidate(
      payload
    )

  if (result.error) {
    queueCandidate(
      payload
    )

    return {
      queued: true,
      error:
        result.error,
      lift,
      label:
        LIFT_LABELS[lift],
      currentLoad:
        loadKg,
    }
  }

  return result
}

export async function flushSbdPrOutbox() {
  if (
    navigator.onLine ===
    false
  ) {
    return {
      flushed: 0,
      offline: true,
    }
  }

  const outbox =
    readOutbox()

  const entries =
    Object.entries(
      outbox
    )

  let flushed = 0

  for (
    const [
      key,
      payload,
    ] of entries
  ) {
    const result =
      await sendCandidate(
        payload
      )

    if (result.error) {
      continue
    }

    const latest =
      readOutbox()

    if (
      JSON.stringify(
        latest[key]
      ) ===
      JSON.stringify(
        payload
      )
    ) {
      delete latest[key]
      writeOutbox(
        latest
      )
    }

    flushed += 1
  }

  return {
    flushed,
  }
}

export async function loadAthleteSbdPrs(
  athleteSlug
) {
  const result = {
    squat: null,
    bench: null,
    deadlift: null,
  }

  if (!athleteSlug) {
    return result
  }

  const {
    data,
    error,
  } =
    await supabase
      .from(
        'athlete_sbd_prs_v2'
      )
      .select(
        [
          'athlete_slug',
          'lift',
          'load_kg',
          'reps',
          'exercise_name',
          'achieved_at',
        ].join(',')
      )
      .eq(
        'athlete_slug',
        athleteSlug
      )

  if (error) {
    console.error(
      'SBD PR load error:',
      error
    )

    return result
  }

  for (
    const row of
    data || []
  ) {
    if (
      Object.prototype
        .hasOwnProperty.call(
          result,
          row.lift
        )
    ) {
      result[
        row.lift
      ] = row
    }
  }

  return result
}

export async function loadLatestGroupSbdPrs(
  limit = 6
) {
  const {
    data,
    error,
  } =
    await supabase
      .from(
        'athlete_sbd_prs_v2'
      )
      .select(
        [
          'athlete_slug',
          'lift',
          'load_kg',
          'reps',
          'exercise_name',
          'achieved_at',
        ].join(',')
      )
      .order(
        'achieved_at',
        {
          ascending: false,
        }
      )
      .limit(
        Math.max(
          1,
          Number(limit) ||
          6
        )
      )

  if (error) {
    console.error(
      'Latest SBD PR error:',
      error
    )

    return []
  }

  return data || []
}
