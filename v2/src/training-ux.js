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
