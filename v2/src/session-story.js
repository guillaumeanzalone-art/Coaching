function numberFromInput(value) {
  const normalized = String(value ?? '')
    .trim()
    .replace(',', '.')

  if (!normalized) {
    return null
  }

  const match = normalized.match(/-?\d+(?:\.\d+)?/)

  if (!match) {
    return null
  }

  const number = Number(match[0])

  return Number.isFinite(number)
    ? number
    : null
}

function repsFromPrescription(value) {
  const number = numberFromInput(value)

  if (number === null) {
    return null
  }

  return Math.max(0, number)
}

function formatFrenchNumber(
  value,
  maximumFractionDigits = 1
) {
  return Number(value).toLocaleString(
    'fr-FR',
    {
      maximumFractionDigits,
    }
  )
}

function formatStoryDate(value) {
  const date = value
    ? new Date(value)
    : new Date()

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return new Intl.DateTimeFormat(
    'fr-FR',
    {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }
  ).format(date)
}

function topSetLabel(rows) {
  const candidates = rows
    .filter(({ setState }) =>
      setState.status === 'done'
    )
    .map(({ sourceSet, setState }) => ({
      load: numberFromInput(setState.load),
      reps: repsFromPrescription(sourceSet.reps),
      rpe: String(setState.rpe ?? '').trim(),
    }))
    .filter(item => item.load !== null)
    .sort((a, b) => b.load - a.load)

  const top = candidates[0]

  if (!top) {
    return ''
  }

  const reps = top.reps !== null
    ? ` × ${formatFrenchNumber(top.reps, 0)}`
    : ''

  const rpe = top.rpe
    ? ` · RPE ${top.rpe}`
    : ''

  return `${formatFrenchNumber(top.load)} kg${reps}${rpe}`
}

export function buildSessionStorySummary({
  athleteName,
  blockLabel,
  weekLabel,
  dayName,
  session,
  exercises,
  getSetState,
}) {
  const exerciseRows = (
    Array.isArray(exercises)
      ? exercises
      : []
  ).map((exercise) => {
    const rows = (
      Array.isArray(exercise?.sets)
        ? exercise.sets
        : []
    ).map(sourceSet => ({
      sourceSet,
      setState: getSetState(sourceSet),
    }))

    const completedRows = rows.filter(({ setState }) =>
      setState.status === 'done' ||
      setState.status === 'failed'
    )

    return {
      name: exercise?.variant
        ? `${exercise.name} · ${exercise.variant}`
        : String(exercise?.name || 'Exercice'),
      rows,
      completed: completedRows.length,
      total: rows.length,
      topSet: topSetLabel(rows),
    }
  })

  let tonnageKg = 0
  let successfulSets = 0
  let failedSets = 0

  exerciseRows.forEach((exercise) => {
    exercise.rows.forEach(({ sourceSet, setState }) => {
      if (setState.status === 'failed') {
        failedSets += 1
        return
      }

      if (setState.status !== 'done') {
        return
      }

      successfulSets += 1

      const load = numberFromInput(setState.load)
      const reps = repsFromPrescription(sourceSet.reps)

      if (load !== null && reps !== null) {
        tonnageKg += load * reps
      }
    })
  })

  const completedSets = successfulSets + failedSets

  return {
    athleteName: String(athleteName || 'Athlète'),
    blockLabel: String(blockLabel || 'Bloc'),
    weekLabel: String(weekLabel || 'Semaine'),
    dayName: String(dayName || 'Séance'),
    dateLabel: formatStoryDate(
      session?.completedAt ||
      session?.startedAt
    ),
    durationSeconds: Math.max(
      0,
      Number(session?.durationSeconds) || 0
    ),
    bodyWeightKg:
      numberFromInput(session?.bodyWeightKg),
    note: String(session?.note || '').trim(),
    completedSets,
    successfulSets,
    failedSets,
    totalSets: exerciseRows.reduce(
      (sum, item) => sum + item.total,
      0
    ),
    exerciseCount: exerciseRows.filter(
      item => item.completed > 0
    ).length,
    tonnageKg,
    highlights: exerciseRows
      .filter(item => item.completed > 0)
      .slice(0, 4)
      .map(item => ({
        name: item.name,
        detail: item.topSet ||
          `${item.completed}/${item.total} séries`,
      })),
  }
}

export function isSessionStoryReady(summary) {
  return Boolean(
    summary &&
    summary.totalSets > 0 &&
    summary.completedSets === summary.totalSets
  )
}

