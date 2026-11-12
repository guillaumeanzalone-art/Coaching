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
      'claim_tcg_workout_pack_v2',
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
      Number(row?.unopened_packs || 0),
    reason: String(row?.reason || ''),
    sessionId: row?.session_id || null,
    validatedSets: Number(row?.validated_sets || 0),
    totalSets: Number(row?.total_sets || 0),
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
    const result = await performClaim(payload)
    if (['session_not_synced','sets_not_synced','session_not_completed'].includes(result.reason)) {
      queueClaim(payload)
      return {...result, queued: true}
    }
    return result
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
  let awarded = 0

  for (
    const item
    of pending
  ) {
    try {
      const result = await performClaim(item)
      if(result.awarded) awarded += 1
      if (['session_not_synced','sets_not_synced','session_not_completed'].includes(result.reason)) {
        remaining.push(item)
      } else {
        flushed += 1
      }
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
    awarded,
    remaining:
      remaining.length,
  }
}

export function explainTcgAward(result) {
  if (result?.awarded) return '🎁 Booster gagné ! Retrouve-le dans le TCG.';
  if (result?.queued) return 'Booster en attente : la séance et les séries seront vérifiées après synchronisation.';
  const reasons = {
    already_awarded:'Le booster de cette séance a déjà été attribué.',
    already_awarded_legacy:'Un booster a déjà été attribué pour cette séance.',
    daily_limit:'Limite quotidienne de boosters atteinte.',
    duration_too_short:'Aucun booster : durée minimale de 15 minutes non atteinte.',
    sets_too_fast:'Aucun booster : séries validées trop rapidement.',
    insufficient_sets:'Aucun booster : pas assez de séries validées.',
    before_activation:'Cette séance est antérieure à l’activation des nouvelles récompenses.',
  };
  return reasons[result?.reason] || 'Séance enregistrée sans nouveau booster.';
}
