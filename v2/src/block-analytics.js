const SBD_TYPES = {
  SQ: 'squat',
  BN: 'bench',
  DL: 'deadlift',
}

const LIFT_LABELS = {
  squat: 'Squat',
  bench: 'Bench',
  deadlift: 'Deadlift',
}

function numberList(value) {
  return (String(value ?? '')
    .replaceAll(',', '.')
    .match(/\d+(?:\.\d+)?/g) || [])
    .map(Number)
    .filter(Number.isFinite)
}

function averageRange(value, fallback = 0) {
  const values = numberList(value)
  if (!values.length) return fallback
  if (values.length === 1) return values[0]
  return (values[0] + values[1]) / 2
}

function averageReps(value) {
  const text = String(value ?? '').toLowerCase()
  if (/sec|min|amrap|libre/.test(text)) return 0
  return Math.max(0, averageRange(text, 0))
}

function plannedLoad(set) {
  return Math.max(0, averageRange(set?.loadRange, 0))
}

function explicitSourceMax(set) {
  const source = String(set?.source || '')
  if (!/pr\s*\/\s*exercice/i.test(source) || source.includes('%')) {
    return 0
  }

  return Math.max(0, averageRange(source, 0))
}

function theoreticalMax(set) {
  const explicit = explicitSourceMax(set)
  if (explicit > 0) return explicit

  const load = plannedLoad(set)
  const percent = Number(set?.percent)
  if (load > 0 && Number.isFinite(percent) && percent > 0) {
    return load / (percent / 100)
  }

  const reps = averageReps(set?.reps)
  if (load > 0 && reps > 0) {
    return load * (1 + reps / 30)
  }

  return 0
}

function median(values) {
  const sorted = values
    .filter(value => Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b)

  if (!sorted.length) return 0
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2
}

function clamp(value, min = 0, max = 100) {
  return Math.min(max, Math.max(min, Number(value) || 0))
}

function difficultyTier(score) {
  if (score < 25) return { key: 'easy', label: 'FACILE', detail: 'Débutant' }
  if (score < 40) return { key: 'moderate', label: 'MODÉRÉ', detail: 'Accessible' }
  if (score < 55) return { key: 'demanding', label: 'EXIGEANT', detail: 'Intermédiaire' }
  if (score < 70) return { key: 'hard', label: 'TRÈS DIFFICILE', detail: 'Avancé' }
  if (score < 85) return { key: 'brutal', label: 'BRUTAL', detail: 'Expert' }
  return { key: 'infernal', label: 'INFERNAL', detail: 'Impossible' }
}

export function analyzeTrainingBlock({
  block,
  state = {},
  bodyWeight = 0,
  glMultiplier = 1,
} = {}) {
  const weeks = Array.isArray(block?.weeks) ? block.weeks : []
  const maxCandidates = {
    squat: [],
    bench: [],
    deadlift: [],
  }

  weeks.forEach(week => {
    ;(week.days || []).forEach(day => {
      ;(day.exercises || []).forEach(exercise => {
        const lift = SBD_TYPES[String(exercise?.type || '').toUpperCase()]
        if (!lift) return
        ;(exercise.sets || []).forEach(set => {
          const max = theoreticalMax(set)
          if (max > 0) maxCandidates[lift].push(max)
        })
      })
    })
  })

  const theoreticalMaxes = Object.fromEntries(
    Object.entries(maxCandidates).map(([lift, values]) => [lift, median(values)])
  )

  let plannedTonnageKg = 0
  let completedTonnageKg = 0
  let totalReps = 0
  let intensityWeighted = 0
  let intensityReps = 0
  let totalSbdSets = 0
  const weekRows = []

  weeks.forEach((week, weekIndex) => {
    let plannedWeekKg = 0
    let completedWeekKg = 0
    let weekReps = 0
    let weekSbdSets = 0
    const activeDays = new Set()

    ;(week.days || []).forEach((day, dayIndex) => {
      let dayHasSbd = false

      ;(day.exercises || []).forEach(exercise => {
        const lift = SBD_TYPES[String(exercise?.type || '').toUpperCase()]
        if (!lift) return
        dayHasSbd = true

        ;(exercise.sets || []).forEach(set => {
          const reps = averageReps(set?.reps)
          const load = plannedLoad(set) || (
            theoreticalMaxes[lift] > 0 && Number(set?.percent) > 0
              ? theoreticalMaxes[lift] * Number(set.percent) / 100
              : 0
          )

          if (reps <= 0 || load <= 0) return

          const tonnage = reps * load
          plannedWeekKg += tonnage
          plannedTonnageKg += tonnage
          weekReps += reps
          totalReps += reps
          weekSbdSets += 1
          totalSbdSets += 1

          const percent = Number(set?.percent) > 0
            ? Number(set.percent)
            : theoreticalMaxes[lift] > 0
              ? load / theoreticalMaxes[lift] * 100
              : 0

          if (percent > 0) {
            intensityWeighted += percent * reps
            intensityReps += reps
          }

          const saved = state?.sets?.[set.id]
          if (saved?.status === 'done') {
            const actualLoad = averageRange(saved.load, 0) || load
            completedWeekKg += actualLoad * reps
            completedTonnageKg += actualLoad * reps
          }
        })
      })

      if (dayHasSbd) {
        activeDays.add(`${weekIndex}:${dayIndex}`)
      }
    })

    weekRows.push({
      id: week.id,
      label: week.label,
      plannedTonnageKg: plannedWeekKg,
      completedTonnageKg: completedWeekKg,
      reps: weekReps,
      sets: weekSbdSets,
      frequency: activeDays.size,
    })
  })

  const weekCount = Math.max(1, weeks.length)
  const averageIntensity = intensityReps > 0
    ? intensityWeighted / intensityReps
    : 0
  const averageVolume = totalReps / weekCount
  const averageFrequency = weekRows.reduce((sum, row) => sum + row.frequency, 0) / weekCount
  const averageTonnageKg = plannedTonnageKg / weekCount
  const theoreticalTotal = Object.values(theoreticalMaxes).reduce((sum, value) => sum + value, 0)
  const glPoints = theoreticalTotal * Math.max(0.01, Number(glMultiplier) || 1)
  const safeBodyWeight = Math.max(40, Number(bodyWeight) || 80)

  const factors = {
    intensity: clamp((averageIntensity - 50) / 45 * 100),
    volume: clamp(averageVolume / 135 * 100),
    frequency: clamp(averageFrequency / 6 * 100),
    tonnage: clamp(averageTonnageKg / (safeBodyWeight * 75) * 100),
    gl: clamp(glPoints / 800 * 100),
  }

  const difficultyScore = Math.round(
    factors.intensity * 0.3 +
    factors.volume * 0.22 +
    factors.frequency * 0.16 +
    factors.tonnage * 0.22 +
    factors.gl * 0.1
  )

  return {
    weeks: weekRows,
    theoreticalMaxes,
    theoreticalTotal,
    plannedTonnageKg,
    completedTonnageKg,
    averageTonnageKg,
    averageIntensity,
    averageVolume,
    averageFrequency,
    totalReps,
    totalSbdSets,
    glPoints,
    glMultiplier: Math.max(0.01, Number(glMultiplier) || 1),
    factors,
    difficultyScore,
    tier: difficultyTier(difficultyScore),
  }
}

export function formatTonnes(value) {
  return (Math.max(0, Number(value) || 0) / 1000)
    .toLocaleString('fr-FR', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })
}

export function liftLabel(lift) {
  return LIFT_LABELS[lift] || lift
}
