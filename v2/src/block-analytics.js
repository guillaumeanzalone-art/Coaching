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

function piecewiseScore(
  value,
  points
) {
  const x =
    Math.max(
      0,
      Number(value) || 0
    )

  if (!points.length) {
    return 0
  }

  if (x <= points[0][0]) {
    return points[0][1]
  }

  for (
    let index = 1;
    index < points.length;
    index += 1
  ) {
    const [
      x0,
      y0,
    ] =
      points[index - 1]

    const [
      x1,
      y1,
    ] =
      points[index]

    if (x <= x1) {
      const span =
        Math.max(
          0.0001,
          x1 - x0
        )

      const ratio =
        (x - x0) /
        span

      return (
        y0 +
        (y1 - y0) *
          ratio
      )
    }
  }

  return points[
    points.length - 1
  ][1]
}

function relativeVolumeWeight(
  percent
) {
  const intensity =
    clamp(
      percent,
      45,
      100
    ) / 100

  /*
   * Le volume n'est plus seulement un nombre de répétitions.
   * Une rep à 90 % coûte davantage qu'une rep à 60 %, sans
   * pour autant doubler le facteur Intensité déjà calculé à part.
   */
  return clamp(
    0.65 +
      0.62 *
        Math.pow(
          intensity / 0.75,
          2
        ),
    0.7,
    1.45
  )
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
  referenceMaxes = null,
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

  const theoreticalMaxes =
    referenceMaxes &&
    typeof referenceMaxes ===
      'object'
      ? {
          squat:
            Math.max(
              0,
              Number(
                referenceMaxes.squat
              ) || 0
            ),
          bench:
            Math.max(
              0,
              Number(
                referenceMaxes.bench
              ) || 0
            ),
          deadlift:
            Math.max(
              0,
              Number(
                referenceMaxes.deadlift
              ) || 0
            ),
        }
      : Object.fromEntries(
          Object.entries(
            maxCandidates
          ).map(
            ([lift, values]) => [
              lift,
              median(values),
            ]
          )
        )

  let plannedTonnageKg = 0
  let completedTonnageKg = 0
  let totalReps = 0
  let totalEffectiveReps = 0
  let totalHardReps = 0
  let intensityWeighted = 0
  let intensityReps = 0
  let totalSbdSets = 0
  const weekRows = []

  weeks.forEach((week, weekIndex) => {
    let plannedWeekKg = 0
    let completedWeekKg = 0
    let weekReps = 0
    let weekEffectiveReps = 0
    let weekHardReps = 0
    let weekSbdSets = 0

    const weekLiftVolume = {
      squat: {
        reps: 0,
        effectiveReps: 0,
        sets: 0,
      },
      bench: {
        reps: 0,
        effectiveReps: 0,
        sets: 0,
      },
      deadlift: {
        reps: 0,
        effectiveReps: 0,
        sets: 0,
      },
    }

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

          const effectiveReps =
            reps *
            relativeVolumeWeight(
              percent || 65
            )

          /*
           * "Hard reps" = répétitions réalisées au-dessus de 80 %,
           * avec une montée progressive jusqu'à 100 % de leur poids
           * à 95 % et plus. On évite ainsi qu'un 5x5 léger et un
           * 5x5 lourd aient exactement le même score de volume.
           */
          const hardRepWeight =
            clamp(
              (
                (percent || 0) -
                80
              ) / 15,
              0,
              1
            )

          const hardReps =
            reps *
            hardRepWeight

          weekEffectiveReps +=
            effectiveReps

          totalEffectiveReps +=
            effectiveReps

          weekHardReps +=
            hardReps

          totalHardReps +=
            hardReps

          weekLiftVolume[
            lift
          ].reps +=
            reps

          weekLiftVolume[
            lift
          ].effectiveReps +=
            effectiveReps

          weekLiftVolume[
            lift
          ].sets +=
            1

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
      effectiveReps:
        weekEffectiveReps,
      hardReps:
        weekHardReps,
      sets: weekSbdSets,
      frequency: activeDays.size,
      density:
        activeDays.size > 0
          ? weekEffectiveReps /
            activeDays.size
          : 0,
      liftVolume:
        weekLiftVolume,
    })
  })

  const weekCount = Math.max(1, weeks.length)
  const averageIntensity = intensityReps > 0
    ? intensityWeighted / intensityReps
    : 0

  const averageVolume =
    totalReps /
    weekCount

  const averageEffectiveReps =
    totalEffectiveReps /
    weekCount

  const averageHardReps =
    totalHardReps /
    weekCount

  const averageSets =
    totalSbdSets /
    weekCount

  const averageFrequency =
    weekRows.reduce(
      (sum, row) =>
        sum +
        row.frequency,
      0
    ) /
    weekCount

  const averageDensity =
    weekRows.reduce(
      (sum, row) =>
        sum +
        row.density,
      0
    ) /
    weekCount

  const peakEffectiveReps =
    Math.max(
      0,
      ...weekRows.map(
        row =>
          row.effectiveReps
      )
    )

  const volumeSpikeRatio =
    averageEffectiveReps > 0
      ? peakEffectiveReps /
        averageEffectiveReps
      : 1

  const averageTonnageKg =
    plannedTonnageKg /
    weekCount

  const theoreticalTotal =
    Object.values(
      theoreticalMaxes
    ).reduce(
      (sum, value) =>
        sum + value,
      0
    )

  const glPoints =
    theoreticalTotal *
    Math.max(
      0.01,
      Number(
        glMultiplier
      ) || 1
    )

  const safeBodyWeight =
    Math.max(
      40,
      Number(
        bodyWeight
      ) || 80
    )

  /*
   * VOLUME V2 — score composite
   *
   * 1) reps effectives / semaine : quantité totale pondérée par charge
   * 2) séries SBD / semaine : nombre d'expositions réelles
   * 3) hard reps >80 % : fatigue des répétitions lourdes
   * 4) densité / séance : même volume comprimé = plus difficile
   * 5) pic hebdo : sanctionne les semaines de surcharge marquée
   *
   * Les courbes sont volontairement non linéaires : passer de
   * 60 à 100 reps effectives compte davantage que passer de 10 à 50,
   * puis le score se tasse à proximité des volumes extrêmes.
   */
  const volumeComponents = {
    effectiveReps:
      clamp(
        piecewiseScore(
          averageEffectiveReps,
          [
            [0, 0],
            [35, 18],
            [60, 36],
            [85, 55],
            [110, 72],
            [140, 87],
            [175, 96],
            [210, 100],
          ]
        )
      ),

    sets:
      clamp(
        piecewiseScore(
          averageSets,
          [
            [0, 0],
            [6, 18],
            [10, 35],
            [14, 52],
            [18, 68],
            [22, 82],
            [28, 94],
            [34, 100],
          ]
        )
      ),

    hardReps:
      clamp(
        piecewiseScore(
          averageHardReps,
          [
            [0, 0],
            [4, 18],
            [8, 35],
            [14, 55],
            [22, 75],
            [32, 90],
            [45, 100],
          ]
        )
      ),

    density:
      clamp(
        piecewiseScore(
          averageDensity,
          [
            [0, 0],
            [15, 20],
            [25, 40],
            [35, 60],
            [45, 78],
            [60, 92],
            [75, 100],
          ]
        )
      ),

    spike:
      clamp(
        piecewiseScore(
          volumeSpikeRatio,
          [
            [1, 10],
            [1.1, 25],
            [1.2, 45],
            [1.35, 68],
            [1.5, 85],
            [1.75, 100],
          ]
        )
      ),
  }

  const complexVolumeScore =
    clamp(
      volumeComponents.effectiveReps *
        0.4 +
      volumeComponents.sets *
        0.24 +
      volumeComponents.hardReps *
        0.18 +
      volumeComponents.density *
        0.12 +
      volumeComponents.spike *
        0.06
    )

  const factors = {
    intensity:
      clamp(
        (
          averageIntensity -
          50
        ) /
          45 *
          100
      ),

    volume:
      complexVolumeScore,

    frequency:
      clamp(
        averageFrequency /
          6 *
          100
      ),

    tonnage:
      clamp(
        averageTonnageKg /
          (
            safeBodyWeight *
            75
          ) *
          100
      ),

    gl:
      clamp(
        glPoints /
          800 *
          100
      ),
  }

  const difficultyScore =
    Math.round(
      factors.intensity *
        0.3 +
      factors.volume *
        0.28 +
      factors.frequency *
        0.14 +
      factors.tonnage *
        0.18 +
      factors.gl *
        0.1
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
    averageEffectiveReps,
    averageHardReps,
    averageSets,
    averageDensity,
    peakEffectiveReps,
    volumeSpikeRatio,
    volumeComponents,
    averageFrequency,
    totalReps,
    totalEffectiveReps,
    totalHardReps,
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
