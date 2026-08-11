import { supabase } from './supabase.js'

const OUTBOX_KEY =
  'ga-v2-workout-outbox-v1'

let flushPromise = null

function readOutbox() {
  try {
    const raw =
      localStorage.getItem(
        OUTBOX_KEY
      )

    if (!raw) {
      return {}
    }

    const parsed =
      JSON.parse(raw)

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

function normalizeNumber(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return null
  }

  const text =
    String(value)
      .trim()
      .replace(',', '.')

  if (!text) {
    return null
  }

  const number =
    Number(text)

  return Number.isFinite(number)
    ? number
    : null
}

function parseLoadRange(value) {
  const text =
    String(value ?? '')
      .trim()
      .replace(/,/g, '.')

  if (!text) {
    return {
      min: null,
      max: null,
    }
  }

  const range =
    text.match(
      /(-?\d+(?:\.\d+)?)\s*-\s*(-?\d+(?:\.\d+)?)/
    )

  if (range) {
    return {
      min: Number(range[1]),
      max: Number(range[2]),
    }
  }

  const fixed =
    normalizeNumber(text)

  return {
    min: fixed,
    max: fixed,
  }
}

function prescriptionInfo(value) {
  const text =
    String(value ?? '')
      .trim()
      .toLowerCase()

  if (
    /\bsec\b|\bseconde|\bmin\b|minute/.test(text)
  ) {
    return {
      reps: 1,
      trackingMode: 'time',
    }
  }

  const firstNumber =
    text.match(/\d+/)

  return {
    reps:
      firstNumber
        ? Math.max(
            1,
            Number(firstNumber[0])
          )
        : 1,

    trackingMode: 'reps',
  }
}

function cleanRequiredText(
  value,
  fallback
) {
  const text =
    String(value ?? '').trim()

  return (
    text ||
    String(fallback ?? '').trim() ||
    '—'
  )
}

function exerciseCode(type) {
  const code =
    String(type || 'AC')
      .toLowerCase()

  return (
    ['sq', 'bn', 'dl', 'ac']
      .includes(code)
      ? code
      : 'ac'
  )
}

export function remoteIdentityKey({
  athleteSlug,
  programKey,
  weekIndex,
  dayIndex,
  setIndex,
}) {
  return [
    athleteSlug,
    programKey,
    weekIndex,
    dayIndex,
    setIndex,
  ].join('|')
}

export function buildWorkoutSetPayload({
  athleteSlug,
  athleteName,
  programKey,
  weekIndex,
  dayIndex,
  setIndex,
  exercise,
  sourceSet,
  setState,
}) {
  const {
    min,
    max,
  } =
    parseLoadRange(
      sourceSet.loadRange
    )

  const prescription =
    prescriptionInfo(
      sourceSet.reps
    )

  const completed =
    setState.status === 'done' ||
    setState.status === 'failed'

  const failed =
    setState.status === 'failed'

  const now =
    new Date().toISOString()

  const payload = {
    athlete_slug:
      cleanRequiredText(
        athleteSlug,
        'athlete'
      ),

    athlete_name:
      cleanRequiredText(
        athleteName,
        athleteSlug
      ),

    program_key:
      cleanRequiredText(
        programKey,
        'programme'
      ),

    week_index:
      Math.max(
        0,
        Number.parseInt(
          weekIndex,
          10
        ) || 0
      ),

    day_index:
      Math.max(
        0,
        Number.parseInt(
          dayIndex,
          10
        ) || 0
      ),

    set_index:
      Math.max(
        0,
        Number.parseInt(
          setIndex,
          10
        ) || 0
      ),

    exercise_code:
      exerciseCode(
        exercise.type
      ),

    exercise_name:
      cleanRequiredText(
        exercise.variant
          ? `${exercise.name} · ${exercise.variant}`
          : exercise.name,
        'Exercice'
      ),

    reps:
      prescription.reps,

    load_kg:
      normalizeNumber(
        setState.load
      ),

    rpe:
      exercise.usesRpe
        ? normalizeNumber(
            setState.rpe
          )
        : null,

    completed,

    completed_at:
      completed
        ? now
        : null,

    updated_at:
      now,

    prescribed_load_min_kg:
      min,

    prescribed_load_max_kg:
      max,

    exercise_key:
      cleanRequiredText(
        exercise.id,
        null
      ),

    tracking_mode:
      prescription.trackingMode,

    actual_reps:
      null,

    duration_seconds:
      null,

    set_outcome:
      failed
        ? 'failed'
        : 'success',
  }

  return payload
}

export function payloadIdentity(
  payload
) {
  return remoteIdentityKey({
    athleteSlug:
      payload.athlete_slug,

    programKey:
      payload.program_key,

    weekIndex:
      payload.week_index,

    dayIndex:
      payload.day_index,

    setIndex:
      payload.set_index,
  })
}

export function isPayloadPending(
  payload
) {
  const outbox =
    readOutbox()

  return Boolean(
    outbox[
      payloadIdentity(payload)
    ]
  )
}

export function queueWorkoutSet(
  payload
) {
  const outbox =
    readOutbox()

  outbox[
    payloadIdentity(payload)
  ] = payload

  writeOutbox(outbox)
}

export function pendingWorkoutSetCount() {
  return Object.keys(
    readOutbox()
  ).length
}

async function authenticatedUserId() {
  const {
    data,
  } =
    await supabase.auth.getSession()

  return (
    data.session?.user?.id ??
    null
  )
}

async function persistPayload(
  rawPayload,
  userId
) {
  const payload = {
    ...rawPayload,

    completed_by:
      rawPayload.completed
        ? userId
        : null,
  }

  const mutable = {
    load_kg:
      payload.load_kg,

    rpe:
      payload.rpe,

    completed:
      Boolean(
        payload.completed
      ),

    completed_by:
      payload.completed_by,

    completed_at:
      payload.completed_at,

    updated_at:
      payload.updated_at,

    set_outcome:
      payload.set_outcome ||
      'success',
  }

  let result =
    await supabase
      .from('workout_sets')
      .update(mutable)
      .eq(
        'athlete_slug',
        payload.athlete_slug
      )
      .eq(
        'program_key',
        payload.program_key
      )
      .eq(
        'week_index',
        payload.week_index
      )
      .eq(
        'day_index',
        payload.day_index
      )
      .eq(
        'set_index',
        payload.set_index
      )
      .select('set_index')

  if (
    !result.error &&
    Array.isArray(result.data) &&
    result.data.length
  ) {
    return result
  }

  const fullPayload = {
    athlete_slug:
      payload.athlete_slug,

    athlete_name:
      payload.athlete_name,

    program_key:
      payload.program_key,

    week_index:
      payload.week_index,

    day_index:
      payload.day_index,

    set_index:
      payload.set_index,

    exercise_code:
      payload.exercise_code,

    exercise_name:
      payload.exercise_name,

    reps:
      Math.max(
        1,
        Number.parseInt(
          payload.reps,
          10
        ) || 1
      ),

    load_kg:
      payload.load_kg,

    rpe:
      payload.rpe,

    completed:
      Boolean(
        payload.completed
      ),

    completed_by:
      payload.completed_by,

    completed_at:
      payload.completed_at,

    updated_at:
      payload.updated_at,

    prescribed_load_min_kg:
      payload.prescribed_load_min_kg,

    prescribed_load_max_kg:
      payload.prescribed_load_max_kg,

    exercise_key:
      payload.exercise_key,

    tracking_mode:
      payload.tracking_mode,

    actual_reps:
      payload.actual_reps,

    duration_seconds:
      payload.duration_seconds,

    set_outcome:
      payload.set_outcome ||
      'success',
  }

  return await supabase
    .from('workout_sets')
    .upsert(
      fullPayload,
      {
        onConflict:
          'athlete_slug,program_key,week_index,day_index,set_index',
      }
    )
}

export async function flushWorkoutOutbox(
  onStatus = () => {}
) {
  if (flushPromise) {
    return flushPromise
  }

  flushPromise = (async () => {
    const initialOutbox =
      readOutbox()

    if (
      !Object.keys(
        initialOutbox
      ).length
    ) {
      onStatus(
        'synced',
        'Synchronisé'
      )
      return {
        ok: true,
        pending: 0,
      }
    }

    if (
      typeof navigator !==
        'undefined' &&
      navigator.onLine === false
    ) {
      onStatus(
        'offline',
        'Hors ligne · sauvegardé localement'
      )

      return {
        ok: false,
        pending:
          pendingWorkoutSetCount(),
      }
    }

    onStatus(
      'syncing',
      'Synchronisation…'
    )

    const userId =
      await authenticatedUserId()

    while (true) {
      const outbox =
        readOutbox()

      const entries =
        Object.entries(outbox)

      if (!entries.length) {
        onStatus(
          'synced',
          'Synchronisé'
        )

        return {
          ok: true,
          pending: 0,
        }
      }

      const [
        key,
        payload,
      ] =
        entries[0]

      let result

      try {
        result =
          await persistPayload(
            payload,
            userId
          )
      } catch (error) {
        console.error(
          'Synchronisation workout_sets impossible :',
          error
        )

        onStatus(
          'offline',
          'Cloud indisponible · sauvegardé localement'
        )

        return {
          ok: false,
          pending:
            pendingWorkoutSetCount(),
          error,
        }
      }

      if (result.error) {
        console.error(
          'Synchronisation workout_sets refusée :',
          result.error
        )

        onStatus(
          'error',
          'À synchroniser'
        )

        return {
          ok: false,
          pending:
            pendingWorkoutSetCount(),
          error:
            result.error,
        }
      }

      const latest =
        readOutbox()

      /*
       * Si l'utilisateur a modifié la même série
       * pendant la requête réseau, la valeur du
       * outbox a changé. On ne supprime donc que
       * l'ancienne version réellement envoyée.
       */
      if (
        JSON.stringify(
          latest[key]
        ) ===
        JSON.stringify(
          payload
        )
      ) {
        delete latest[key]
        writeOutbox(latest)
      }
    }
  })()

  try {
    return await flushPromise
  } finally {
    flushPromise = null
  }
}

export async function loadRemoteWorkoutSets({
  athleteSlug,
  programKey,
}) {
  return await supabase
    .from('workout_sets')
    .select(
      `
      week_index,
      day_index,
      set_index,
      load_kg,
      rpe,
      completed,
      set_outcome,
      completed_at,
      updated_at
      `
    )
    .eq(
      'athlete_slug',
      athleteSlug
    )
    .eq(
      'program_key',
      programKey
    )
}

export function remoteRowToLocalState(
  row
) {
  return {
    load:
      row.load_kg === null ||
      row.load_kg === undefined
        ? ''
        : String(
            row.load_kg
          ),

    rpe:
      row.rpe === null ||
      row.rpe === undefined
        ? ''
        : String(
            row.rpe
          ),

    status:
      row.completed
        ? (
            row.set_outcome ===
              'failed'
              ? 'failed'
              : 'done'
          )
        : 'pending',
  }
}
