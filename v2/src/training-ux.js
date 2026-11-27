// Fonctions pures pour le confort de saisie mobile.
// Aucune écriture serveur et aucune mutation de programmation.
export const QUICK_RPE_VALUES = Object.freeze([7, 8, 8.5, 9, 9.5])

export function plannedLoadSuggestion(rawRange) {
  if (rawRange === null || rawRange === undefined) return null
  const raw = String(rawRange).replace(/\s/g, '').replace(',', '.')
  const first = raw.match(/^\d+(?:\.\d+)?/)
  if (!first) return null
  const kg = Number(first[0])
  if (!Number.isFinite(kg) || kg <= 0 || kg > 1000) return null
  return Number(kg.toFixed(2))
}

export function formatPlannedLoad(kg) {
  return Number(kg).toLocaleString('fr-FR', { maximumFractionDigits: 2 })
}

// Les pourcentages SBD se basent sur le PR personnel de l'athlète.
// On préfère toujours un vrai PR x1 à une estimation issue de plusieurs reps.
const SBD_LIFTS = Object.freeze({
  sq: 'squat',
  squat: 'squat',
  bn: 'bench',
  bp: 'bench',
  bench: 'bench',
  dl: 'deadlift',
  deadlift: 'deadlift',
})

function finitePositive(value, max = 1000) {
  const number = typeof value === 'string'
    ? Number(value.replace(',', '.').trim())
    : Number(value)
  return Number.isFinite(number) && number > 0 && number <= max
    ? number : null
}

function roundedToStep(value, stepKg) {
  return Number((Math.round(value / stepKg) * stepKg).toFixed(2))
}

export function athletePrReference(exercise, sbdPrs) {
  const lift = SBD_LIFTS[String(exercise?.type || '').toLowerCase().trim()]
  if (!lift) return null
  const rows = sbdPrs?.[lift]
  if (!rows || typeof rows !== 'object') return null

  const record1 = finitePositive(rows[1]?.load_kg)
  if (record1 !== null) {
    return { lift, oneRmKg: record1, reps: 1, estimated: false }
  }

  // Si aucun x1 n'est connu, estimation Epley depuis un PR x2 à x6.
  // Éviter x7-x9 : précision de l'estimation moins fiable.
  const estimates = []
  for (let reps = 2; reps <= 6; reps += 1) {
    const record = finitePositive(rows[reps]?.load_kg)
    if (record !== null) {
      const e1rm = record * (1 + reps / 30)
      if (e1rm <= 1000) estimates.push({ oneRmKg: e1rm, reps })
    }
  }
  if (!estimates.length) return null
  estimates.sort((a, b) => b.oneRmKg - a.oneRmKg)
  return { lift, ...estimates[0], estimated: true }
}

export function plannedLoadForAthlete(exercise, sourceSet, sbdPrs, stepKg = 2.5) {
  const fallbackKg = plannedLoadSuggestion(sourceSet?.loadRange)
  const fallback = fallbackKg === null
    ? null
    : { loadKg: fallbackKg, source: 'programme', percent: null, reference: null }

  const reference = athletePrReference(exercise, sbdPrs)
  if (!reference) return fallback

  const rawPercent = sourceSet?.percent
  if (rawPercent === '' || rawPercent === null || rawPercent === undefined) return fallback
  const percent = finitePositive(
    typeof rawPercent === 'string' ? rawPercent.replace('%', '').trim() : rawPercent,
    150
  )
  if (percent === null) return fallback
  const increment = finitePositive(stepKg, 25)
  if (increment === null) return fallback

  const loadKg = roundedToStep(reference.oneRmKg * percent / 100, increment)
  if (loadKg <= 0 || loadKg > 1000) return fallback

  return {
    loadKg,
    source: reference.estimated ? 'pr-estime' : 'pr',
    percent,
    reference,
  }
}

export function nextPendingSet(day, getStatus) {
  if (!day || !Array.isArray(day.exercises)) return null
  for (const exercise of day.exercises) {
    for (let i = 0; i < (exercise.sets || []).length; i += 1) {
      const sourceSet = exercise.sets[i]
      const status = getStatus(sourceSet)
      if (status !== 'done' && status !== 'failed') {
        return {
          setId: String(sourceSet.id),
          exercise: String(exercise.variant || exercise.name || exercise.type || 'Exercice'),
          number: i + 1,
          reps: String(sourceSet.reps || ''),
        }
      }
    }
  }
  return null
}

export function progressPercent(completed, total) {
  if (!Number.isFinite(Number(total)) || total <= 0) return 0
  return Math.max(0, Math.min(100, Math.round(Number(completed || 0) / Number(total) * 100)))
}
