const CLARA_SQUAT_PREP_KEY =
  'clara-squat-prep'

const CLARA_SQUAT_PREP = [
  {
    key: 'clamshells',
    name: 'Clamshells avec bande',
    description:
      'Tempo lent, avec 2 secondes de contraction en haut. Cible le moyen fessier sans créer de fatigue.',
    sets: 2,
    reps: '15 / côté',
  },
  {
    key: 'lateral-walks',
    name: 'Banded lateral walks (monster walk)',
    description:
      'Bande aux genoux ou aux chevilles. Reste basse en demi-squat et ne te relève pas entre les pas.',
    sets: 2,
    reps: '10 pas / direction',
  },
  {
    key: 'squat-isometrics',
    name: 'Banded squats isométriques',
    description:
      'Bande au-dessus des genoux. Descends en position basse du squat et pousse les genoux vers l’extérieur pendant 5 secondes.',
    sets: 3,
    reps: '5 s',
  },
  {
    key: 'single-leg-glute-bridge',
    name: 'Single-leg glute bridge',
    description:
      'Pied en légère rotation externe. Active le grand fessier et les rotateurs externes en extension de hanche.',
    sets: 2,
    reps: '8 / côté',
  },
]

const CLARA_ASSISTANCE_KEY =
  'clara-hip-assistance'

const CLARA_ASSISTANCE_BY_DAY = {
  0: [
    {
      key: 'copenhagen-adductor',
      name: 'Copenhagen adductor (excentrique)',
      description:
        'Renforce les adducteurs en excentrique pour améliorer leur tolérance à l’allongement et limiter leur réflexe de raccourcissement dans le hole, sans les affaiblir pour le squat lourd.',
      sets: 3,
      reps: '6–8',
      variant: 'Lent',
    },
    {
      key: 'side-lying-hip-abduction',
      name: 'Side-lying hip abduction',
      description:
        'Avec un poids à la cheville ou à la poulie. Mouvement simple et ciblé pour le moyen fessier, avec un tempo 3010.',
      sets: 3,
      reps: '12–15',
      variant: 'Tempo 3010',
    },
  ],
  2: [
    {
      key: 'cable-hip-external-rotation',
      name: 'Cable hip external rotation debout',
      description:
        'Genou à 90°. Cible le piriforme et les rotateurs profonds, souvent oubliés.',
      sets: 3,
      reps: '12 / côté',
    },
    {
      key: 'single-leg-rdl',
      name: 'Single-leg RDL',
      description:
        'Travaille le grand fessier en anti-rotation et en anti-adduction du fémur de façon unilatérale, avec un transfert direct vers le squat.',
      sets: 3,
      reps: '8–10',
    },
  ],
  4: [
    {
      key: 'goblet-squat-pause-band',
      name: 'Squat goblet avec pause + bande',
      description:
        'Bande au-dessus des genoux et pause de 3 secondes dans le hole. Maintiens les genoux vers l’extérieur sous fatigue : renforcement et patterning.',
      sets: 3,
      reps: '8',
      variant: 'Pause 3 s',
    },
    {
      key: 'banded-seated-abduction',
      name: 'Banded seated abduction',
      description:
        'Léger, en pump et tout en fin de séance pour développer l’endurance du moyen fessier.',
      sets: 3,
      reps: '20',
      variant: 'Léger · pump',
    },
  ],
}

const SQUAT_SUPPORT_ATHLETES =
  new Set([
    'metaknight',
    'allan',
  ])

const DUANE_MILKO_PRESS_KEY =
  'duane-week-4-milko-press'

function createDuaneMilkoPress(
  dayId
) {
  const exerciseId =
    `${dayId}-${DUANE_MILKO_PRESS_KEY}`

  return {
    id: exerciseId,
    name: 'Milko Press',
    type: 'PRÉPA',
    variant: '10 kg par main',
    description:
      'Activation spécifique avant le bench. Utilise 10 kg dans chaque main et garde un mouvement contrôlé.',
    routineKey:
      DUANE_MILKO_PRESS_KEY,
    usesRpe: false,
    sets: Array.from(
      { length: 3 },
      (_, index) => ({
        id:
          `${exerciseId}-s${index + 1}`,
        reps: '15',
        percent: null,
        loadRange: '10',
        intensity: null,
        source: null,
        load: '',
        rpe: '',
        status: 'pending',
      })
    ),
  }
}

function isWeekFour(week) {
  if (Number(week?.number) === 4) {
    return true
  }

  return /^s(?:emaine\s*)?4$/i.test(
    String(
      week?.label || ''
    ).trim()
  )
}

function enhanceDuaneBenchDay(day) {
  const exercises =
    Array.isArray(day?.exercises)
      ? day.exercises
      : []

  const regularExercises =
    exercises.filter(
      (exercise) =>
        exercise?.routineKey !==
        DUANE_MILKO_PRESS_KEY
    )

  const firstBenchIndex =
    regularExercises.findIndex(
      (exercise) =>
        String(
          exercise?.type || ''
        ).toUpperCase() === 'BN'
    )

  if (firstBenchIndex < 0) {
    return {
      ...day,
      exercises:
        regularExercises,
    }
  }

  return {
    ...day,
    exercises: [
      ...regularExercises.slice(
        0,
        firstBenchIndex
      ),
      createDuaneMilkoPress(
        day.id
      ),
      ...regularExercises.slice(
        firstBenchIndex
      ),
    ],
  }
}

function createPrepExercise(
  dayId,
  item
) {
  const exerciseId =
    `${dayId}-${CLARA_SQUAT_PREP_KEY}-${item.key}`

  return {
    id: exerciseId,
    name: item.name,
    type: 'PRÉPA',
    variant: '',
    description:
      item.description,
    routineKey:
      CLARA_SQUAT_PREP_KEY,
    routineItemKey:
      item.key,
    usesRpe: false,
    sets: Array.from(
      {
        length: item.sets,
      },
      (_, index) => ({
        id:
          `${exerciseId}-s${index + 1}`,
        reps: item.reps,
        percent: null,
        loadRange: null,
        intensity: null,
        source: null,
        load: '',
        rpe: '',
        status: 'pending',
      })
    ),
  }
}

function createAssistanceExercise(
  dayId,
  item
) {
  const exerciseId =
    `${dayId}-${CLARA_ASSISTANCE_KEY}-${item.key}`

  return {
    id: exerciseId,
    name: item.name,
    type: 'RENFO',
    variant: item.variant || '',
    description: item.description,
    routineKey:
      CLARA_ASSISTANCE_KEY,
    routineItemKey: item.key,
    usesRpe: false,
    sets: Array.from(
      { length: item.sets },
      (_, index) => ({
        id:
          `${exerciseId}-s${index + 1}`,
        reps: item.reps,
        percent: null,
        loadRange: null,
        intensity: null,
        source: null,
        load: '',
        rpe: '',
        status: 'pending',
      })
    ),
  }
}

function enhanceSquatDay(
  day
) {
  const exercises =
    Array.isArray(
      day?.exercises
    )
      ? day.exercises
      : []

  const squatIndex =
    exercises.findIndex(
      (exercise) =>
        String(
          exercise?.type ||
          ''
        ).toUpperCase() ===
        'SQ'
    )

  if (squatIndex < 0) {
    return day
  }

  const regularExercises =
    exercises.filter(
      (exercise) =>
        exercise?.routineKey !==
        CLARA_SQUAT_PREP_KEY
    )

  const insertionIndex =
    regularExercises.findIndex(
      (exercise) =>
        String(
          exercise?.type ||
          ''
        ).toUpperCase() ===
        'SQ'
    )

  const prepExercises =
    CLARA_SQUAT_PREP.map(
      (item) =>
        createPrepExercise(
          day.id,
          item
        )
    )

  return {
    ...day,
    exercises: [
      ...regularExercises.slice(
        0,
        insertionIndex
      ),
      ...prepExercises,
      ...regularExercises.slice(
        insertionIndex
      ),
    ],
  }
}

function enhanceAssistanceDay(
  day,
  dayIndex
) {
  const exercises =
    Array.isArray(day?.exercises)
      ? day.exercises
      : []

  const regularExercises =
    exercises.filter(
      (exercise) =>
        exercise?.routineKey !==
        CLARA_ASSISTANCE_KEY
    )

  const assistance =
    CLARA_ASSISTANCE_BY_DAY[
      dayIndex
    ]

  if (!assistance) {
    return {
      ...day,
      exercises: regularExercises,
    }
  }

  return {
    ...day,
    exercises: [
      ...regularExercises,
      ...assistance.map(
        (item) =>
          createAssistanceExercise(
            day.id,
            item
          )
      ),
    ],
  }
}

export function enhanceProgramForAthlete(
  athleteId,
  program
) {
  const normalizedAthleteId =
    String(
      athleteId || ''
    ).toLowerCase()

  const hasSquatSupport =
    SQUAT_SUPPORT_ATHLETES.has(
      normalizedAthleteId
    )

  const hasDuaneWeekFourPrep =
    normalizedAthleteId ===
    'duane'

  if (
    (
      !hasSquatSupport &&
      !hasDuaneWeekFourPrep
    ) ||
    !program ||
    !Array.isArray(
      program.blocks
    )
  ) {
    return program
  }

  return {
    ...program,
    blocks:
      program.blocks.map(
        (block) => ({
          ...block,
          weeks:
            Array.isArray(
              block?.weeks
            )
              ? block.weeks.map(
                  (week) => {
                    const duaneWeekFour =
                      hasDuaneWeekFourPrep &&
                      isWeekFour(week)

                    return {
                      ...week,
                      days:
                        Array.isArray(
                          week?.days
                        )
                          ? week.days.map(
                              (day, dayIndex) => {
                                let enhancedDay =
                                  day

                                if (
                                  hasSquatSupport
                                ) {
                                  enhancedDay =
                                    enhanceAssistanceDay(
                                      enhanceSquatDay(
                                        enhancedDay
                                      ),
                                      dayIndex
                                    )
                                }

                                if (
                                  duaneWeekFour
                                ) {
                                  enhancedDay =
                                    enhanceDuaneBenchDay(
                                      enhancedDay
                                    )
                                }

                                return enhancedDay
                              }
                            )
                          : week?.days,
                    }
                  }
                )
              : block?.weeks,
        })
      ),
  }
}

export {
  CLARA_ASSISTANCE_BY_DAY,
  CLARA_ASSISTANCE_KEY,
  CLARA_SQUAT_PREP,
  CLARA_SQUAT_PREP_KEY,
  DUANE_MILKO_PRESS_KEY,
  SQUAT_SUPPORT_ATHLETES,
}
