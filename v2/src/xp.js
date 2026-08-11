import { supabase } from './supabase.js'

export async function getAthleteProgress(athleteSlug) {
  const { data, error } = await supabase
    .from('athlete_progress')
    .select('*')
    .eq('athlete_slug', athleteSlug)
    .maybeSingle()

  if (error) {
    throw error
  }

  return data ?? null
}

export async function awardSetXp({
  athleteSlug,
  programKey,
  weekIndex,
  dayIndex,
  setIndex,
  exerciseCode,
  isPr = false,
  previousPrKg = null,
  totalSets = 0,
  sbdSets = 0,
  accessorySets = 0,
skipQueue = false,
}) {
  if (navigator.onLine === false) {
    return {
      offline: true,
    }
  }

  const { data, error } = await supabase.rpc(
    'award_set_xp_v71',
    {
      p_athlete_slug: athleteSlug,
      p_program_key: programKey,
      p_week_index: weekIndex,
      p_day_index: dayIndex,
      p_set_index: setIndex,
      p_exercise_code: exerciseCode,
      p_is_pr: Boolean(isPr),
      p_previous_pr_kg: previousPrKg,
      p_total_sets: totalSets,
      p_sbd_sets: sbdSets,
      p_accessory_sets: accessorySets,
    }
  )

  if (error) {
    throw error
  }

  const row =
    Array.isArray(data)
      ? data[0]
      : data

  if (!row) {
    return null
  }

  return {
    duplicate: Boolean(row.was_duplicate),
    basePoints: Number(row.base_points || 0),
    prBonus: Number(row.pr_bonus_points || 0),
    glPoints: Number(row.gl_points || 0),
    glMultiplier: Number(row.gl_multiplier || 1),
    classMultiplier: Number(row.class_multiplier || 1),
    collectionMultiplier: Number(row.collection_multiplier || 1),
    setPoints: Number(row.set_points_awarded || 0),
    speedMultiplier: Number(row.speed_multiplier || 1),
    speedBonus: Number(row.speed_bonus_awarded || 0),
    totalXp: Number(row.total_xp || 0),
    level: Number(row.level_after || 1),
    levelUp: Boolean(row.level_up),
    packEarned: Number(row.packs_earned || 0),
  }
}

export function xpCostForLevel(level) {
  return Math.max(
    1,
    Math.round(
      50 *
      Math.pow(
        1.2,
        Math.max(
          0,
          Number(level || 1) - 1
        )
      )
    )
  )
}

export function xpProgressFromTotal(value) {
  const totalXp =
    Math.max(
      0,
      Number(value || 0)
    )

  let level = 1
  let spent = 0
  let cost =
    xpCostForLevel(level)

  while (
    level < 1000 &&
    totalXp >= spent + cost
  ) {
    spent += cost
    level += 1
    cost =
      xpCostForLevel(level)
  }

  return {
    level,
    into:
      totalXp - spent,
    cost,
  }
}


const XP_OUTBOX_KEY =
  'ga-coaching-xp-outbox-v2'

function xpRequestKey(request) {
  return [
    request.athleteSlug,
    request.programKey,
    request.weekIndex,
    request.dayIndex,
    request.setIndex,
    request.exerciseCode,
  ].join('|')
}

function readXpOutbox() {
  try {
    const raw =
      localStorage.getItem(
        XP_OUTBOX_KEY
      )

    const parsed =
      raw
        ? JSON.parse(raw)
        : []

    return Array.isArray(parsed)
      ? parsed
      : []
  } catch {
    return []
  }
}

function writeXpOutbox(items) {
  localStorage.setItem(
    XP_OUTBOX_KEY,
    JSON.stringify(items)
  )
}

export function queueXpAward(request) {
  const items =
    readXpOutbox()

  const key =
    xpRequestKey(request)

  const next =
    items.filter(
      (item) =>
        xpRequestKey(item) !== key
    )

  next.push(request)

  writeXpOutbox(next)

  return next.length
}

export async function flushXpOutbox() {
  if (
    navigator.onLine === false
  ) {
    return {
      offline: true,
      remaining:
        readXpOutbox().length,
    }
  }

  const items =
    readXpOutbox()

  if (!items.length) {
    return {
      flushed: 0,
      remaining: 0,
    }
  }

  const remaining = []
  let flushed = 0

  for (const request of items) {
    try {
      const result =
        await awardSetXp({
          ...request,
          skipQueue: true,
        })

      if (
        result &&
        !result.offline
      ) {
        flushed += 1
      } else {
        remaining.push(request)
      }
    } catch (error) {
      console.error(
        'XP OUTBOX ERROR',
        error
      )

      remaining.push(request)
    }
  }

  writeXpOutbox(
    remaining
  )

  return {
    flushed,
    remaining:
      remaining.length,
  }
}
