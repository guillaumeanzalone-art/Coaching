// Normalized, de-duplicated recent SBD PR snapshots.
// Unlike workout_activities, these tables are maintained by record_sbd_pr_v2
// and record_sbd_rep_pr_v249 when an athlete validates a new PR.

const SBD_LIFTS = new Set(['squat', 'bench', 'deadlift'])

export function mergeLatestSbdRecords(
  repetitionPrs = [],
  globalPrs = [],
  limit = 6
) {
  const latestByLiftAndReps = new Map()

  for (const source of [repetitionPrs, globalPrs]) {
    for (const row of Array.isArray(source) ? source : []) {
      const athleteSlug = String(row?.athlete_slug || '').trim().toLowerCase()
      const lift = String(row?.lift || '').trim().toLowerCase()
      const reps = Number(row?.reps)
      const load = Number(row?.load_kg)
      const time = Date.parse(row?.achieved_at || '')

      // Imported seed records do not have a real achieved_at.
      // Never disguise their import timestamp as the date of a new PR.
      if (
        !athleteSlug ||
        !SBD_LIFTS.has(lift) ||
        !Number.isInteger(reps) ||
        reps < 1 ||
        !Number.isFinite(load) ||
        load <= 0 ||
        !Number.isFinite(time)
      ) {
        continue
      }

      const key = athleteSlug + '::' + lift + '::' + reps
      const previous = latestByLiftAndReps.get(key)
      const normalized = {
        ...row,
        athlete_slug: athleteSlug,
        lift,
        reps,
        load_kg: load,
        achieved_at: new Date(time).toISOString(),
        previous_load_kg: null,
      }

      // Two PR tables can describe the same validated set. Keep it once.
      // For a shared athlete/lift/rep key, the newest validated PR wins.
      if (
        !previous ||
        time > previous.time ||
        (time === previous.time && load > previous.row.load_kg)
      ) {
        latestByLiftAndReps.set(key, { time, row: normalized })
      }
    }
  }

  return [...latestByLiftAndReps.values()]
    .sort((a, b) =>
      b.time - a.time ||
      a.row.athlete_slug.localeCompare(b.row.athlete_slug) ||
      a.row.lift.localeCompare(b.row.lift) ||
      a.row.reps - b.row.reps
    )
    .slice(0, Math.max(0, Number(limit) || 0))
    .map(entry => entry.row)
}
