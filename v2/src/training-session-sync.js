import { supabase } from './supabase.js'

const OUTBOX_KEY =
  'ga-v2-training-session-outbox-v1'

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

function cleanText(
  value,
  fallback = ''
) {
  const text =
    String(value ?? '').trim()

  return text || fallback
}

function safeIndex(value) {
  return Math.max(
    0,
    Number.parseInt(
      value,
      10
    ) || 0
  )
}

function safeNumber(
  value,
  {
    min = null,
    max = null,
  } = {}
) {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return null
  }

  const number =
    Number(
      String(value)
        .replace(',', '.')
    )

  if (!Number.isFinite(number)) {
    return null
  }

  let next = number

  if (min !== null) {
    next = Math.max(
      min,
      next
    )
  }

  if (max !== null) {
    next = Math.min(
      max,
      next
    )
  }

  return next
}

function safeInteger(
  value,
  options = {}
) {
  const number =
    safeNumber(
      value,
      options
    )

  return number === null
    ? null
    : Math.round(number)
}

function safeDuration(value) {
  return safeInteger(
    value,
    {
      min: 0,
    }
  )
}

export function trainingSessionIdentity({
  athleteSlug,
  programKey,
  weekIndex,
  dayIndex,
}) {
  return [
    cleanText(
      athleteSlug,
      'unknown'
    ),
    cleanText(
      programKey,
      'programme'
    ),
    safeIndex(
      weekIndex
    ),
    safeIndex(
      dayIndex
    ),
  ].join('::')
}

export function buildTrainingSessionPayload({
  athleteSlug,
  programKey,
  weekIndex,
  dayIndex,
  session,
}) {
  const startedAt =
    session?.startedAt ||
    null

  const completedAt =
    session?.completedAt ||
    null

  let status =
    cleanText(
      session?.status,
      'pending'
    )

  if (
    ![
      'pending',
      'in_progress',
      'completed',
    ].includes(status)
  ) {
    status =
      completedAt
        ? 'completed'
        : startedAt
          ? 'in_progress'
          : 'pending'
  }

  return {
    athlete_slug:
      cleanText(
        athleteSlug,
        'unknown'
      ),

    program_key:
      cleanText(
        programKey,
        'programme'
      ),

    week_index:
      safeIndex(
        weekIndex
      ),

    day_index:
      safeIndex(
        dayIndex
      ),

    started_at:
      startedAt,

    completed_at:
      completedAt,

    duration_seconds:
      safeDuration(
        session?.durationSeconds
      ),

    session_note:
      String(
        session?.note ?? ''
      ),

    hydration_liters:
      safeNumber(
        session?.hydrationLiters,
        {
          min: 0,
          max: 20,
        }
      ),

    sleep_hours:
      safeNumber(
        session?.sleepHours,
        {
          min: 0,
          max: 24,
        }
      ),

    pain_upper:
      safeNumber(
        session?.painUpper,
        {
          min: 0,
          max: 10,
        }
      ),

    pain_lower:
      safeNumber(
        session?.painLower,
        {
          min: 0,
          max: 10,
        }
      ),

    steps:
      safeInteger(
        session?.steps,
        {
          min: 0,
          max: 200000,
        }
      ),

    status,

    updated_at:
      new Date()
        .toISOString(),
  }
}

export function isTrainingSessionPending(
  payloadOrIdentity
) {
  const outbox =
    readOutbox()

  const identity =
    typeof payloadOrIdentity ===
      'string'
      ? payloadOrIdentity
      : trainingSessionIdentity({
          athleteSlug:
            payloadOrIdentity
              .athlete_slug ??
            payloadOrIdentity
              .athleteSlug,

          programKey:
            payloadOrIdentity
              .program_key ??
            payloadOrIdentity
              .programKey,

          weekIndex:
            payloadOrIdentity
              .week_index ??
            payloadOrIdentity
              .weekIndex,

          dayIndex:
            payloadOrIdentity
              .day_index ??
            payloadOrIdentity
              .dayIndex,
        })

  return Boolean(
    outbox[identity]
  )
}

export function queueTrainingSession(
  payload
) {
  const outbox =
    readOutbox()

  const identity =
    trainingSessionIdentity({
      athleteSlug:
        payload.athlete_slug,

      programKey:
        payload.program_key,

      weekIndex:
        payload.week_index,

      dayIndex:
        payload.day_index,
    })

  outbox[identity] =
    payload

  writeOutbox(
    outbox
  )
}

export function pendingTrainingSessionCount() {
  return Object.keys(
    readOutbox()
  ).length
}

async function authenticatedUserId() {
  const {
    data,
  } =
    await supabase.auth
      .getSession()

  return (
    data.session
      ?.user
      ?.id ??
    null
  )
}

async function persistPayload(
  rawPayload,
  userId
) {
  const payload = {
    ...rawPayload,
    updated_by:
      userId,
  }

  const {
    error,
  } =
    await supabase
      .from(
        'training_sessions_v2'
      )
      .upsert(
        payload,
        {
          onConflict:
            'athlete_slug,program_key,week_index,day_index',
        }
      )

  return {
    error,
  }
}

export async function flushTrainingSessionOutbox(
  setSyncStatus = null
) {
  if (flushPromise) {
    return flushPromise
  }

  flushPromise =
    (async () => {
      if (
        navigator.onLine ===
        false
      ) {
        return {
          flushed: 0,
          offline: true,
        }
      }

      const userId =
        await authenticatedUserId()

      if (!userId) {
        return {
          flushed: 0,
          unauthenticated:
            true,
        }
      }

      const outbox =
        readOutbox()

      const entries =
        Object.entries(
          outbox
        )

      if (!entries.length) {
        return {
          flushed: 0,
        }
      }

      if (setSyncStatus) {
        setSyncStatus(
          'syncing',
          'Synchronisation…'
        )
      }

      let flushed = 0

      for (
        const [
          identity,
          payload,
        ] of entries
      ) {
        const result =
          await persistPayload(
            payload,
            userId
          )

        if (result.error) {
          console.error(
            'Training session sync error:',
            result.error
          )

          if (
            setSyncStatus
          ) {
            setSyncStatus(
              'error',
              'Cloud indisponible · sauvegarde locale'
            )
          }

          continue
        }

        const latest =
          readOutbox()

        if (
          JSON.stringify(
            latest[identity]
          ) ===
          JSON.stringify(
            payload
          )
        ) {
          delete latest[
            identity
          ]

          writeOutbox(
            latest
          )
        }

        flushed += 1
      }

      if (
        setSyncStatus &&
        !pendingTrainingSessionCount()
      ) {
        setSyncStatus(
          'synced',
          'Synchronisé'
        )
      }

      return {
        flushed,
      }
    })()

  try {
    return await flushPromise
  } finally {
    flushPromise = null
  }
}

export async function loadRemoteTrainingSessions({
  athleteSlug,
  programKey,
}) {
  if (
    !athleteSlug ||
    !programKey
  ) {
    return {
      data: [],
      error: null,
    }
  }

  return supabase
    .from(
      'training_sessions_v2'
    )
    .select(
      [
        'athlete_slug',
        'program_key',
        'week_index',
        'day_index',
        'started_at',
        'completed_at',
        'duration_seconds',
        'session_note',
        'hydration_liters',
        'sleep_hours',
        'pain_upper',
        'pain_lower',
        'steps',
        'status',
        'updated_at',
      ].join(',')
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

export function remoteTrainingSessionToLocalState(
  row
) {
  return {
    startedAt:
      row?.started_at ||
      null,

    completedAt:
      row?.completed_at ||
      null,

    durationSeconds:
      safeDuration(
        row?.duration_seconds
      ),

    note:
      String(
        row?.session_note ??
        ''
      ),

    hydrationLiters:
      safeNumber(
        row?.hydration_liters,
        {
          min: 0,
          max: 20,
        }
      ),

    sleepHours:
      safeNumber(
        row?.sleep_hours,
        {
          min: 0,
          max: 24,
        }
      ),

    painUpper:
      safeNumber(
        row?.pain_upper,
        {
          min: 0,
          max: 10,
        }
      ),

    painLower:
      safeNumber(
        row?.pain_lower,
        {
          min: 0,
          max: 10,
        }
      ),

    steps:
      safeInteger(
        row?.steps,
        {
          min: 0,
          max: 200000,
        }
      ),

    status:
      cleanText(
        row?.status,
        row?.completed_at
          ? 'completed'
          : row?.started_at
            ? 'in_progress'
            : 'pending'
      ),
  }
}
