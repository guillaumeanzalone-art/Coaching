import { supabase } from './supabase.js'

const OUTBOX_KEY =
  'ga-tcg-workout-pack-outbox-v1'

function readOutbox() {
  try {
    const parsed =
      JSON.parse(
        localStorage.getItem(
          OUTBOX_KEY
        ) ||
        '[]'
      )

    return Array.isArray(parsed)
      ? parsed
      : []
  } catch {
    return []
  }
}

function writeOutbox(items) {
  localStorage.setItem(
    OUTBOX_KEY,
    JSON.stringify(
      items
    )
  )
}

function claimKey(payload) {
  return [
    payload.athleteSlug,
    payload.programKey,
    payload.weekIndex,
    payload.dayIndex,
  ].join('|')
}

function queueClaim(payload) {
  const current =
    readOutbox()

  const key =
    claimKey(
      payload
    )

  const next = [
    ...current.filter(
      item =>
        claimKey(item) !==
        key
    ),
    payload,
  ]

  writeOutbox(next)
}

async function performClaim({
  athleteSlug,
  programKey,
  weekIndex,
  dayIndex,
}) {
  const {
    data,
    error,
  } =
    await supabase.rpc(
      'claim_tcg_workout_pack_v1',
      {
        p_athlete_slug:
          athleteSlug,
        p_program_key:
          programKey,
        p_week_index:
          weekIndex,
        p_day_index:
          dayIndex,
      }
    )

  if (error) {
    throw error
  }

  const row =
    Array.isArray(data)
      ? data[0]
      : data

  return {
    awarded:
      Boolean(
        row?.awarded
      ),
    unopenedPacks:
      Number(
        row?.unopened_packs ||
        0
      ),
  }
}

export async function claimTcgWorkoutPack(
  payload
) {
  if (
    !payload?.athleteSlug ||
    !payload?.programKey
  ) {
    return {
      awarded: false,
      unopenedPacks: 0,
    }
  }

  if (
    navigator.onLine ===
      false
  ) {
    queueClaim(
      payload
    )

    return {
      awarded: false,
      queued: true,
      unopenedPacks: null,
    }
  }

  try {
    return await performClaim(
      payload
    )
  } catch (error) {
    queueClaim(
      payload
    )

    throw error
  }
}

export async function flushTcgWorkoutPackOutbox() {
  if (
    navigator.onLine ===
      false
  ) {
    return {
      flushed: 0,
      remaining:
        readOutbox()
          .length,
    }
  }

  const pending =
    readOutbox()

  const remaining = []
  let flushed = 0

  for (
    const item
    of pending
  ) {
    try {
      await performClaim(
        item
      )

      flushed += 1
    } catch (error) {
      console.error(
        'TCG PACK CLAIM ERROR',
        error
      )

      remaining.push(
        item
      )
    }
  }

  writeOutbox(
    remaining
  )

  return {
    flushed,
    remaining:
      remaining.length,
  }
}
