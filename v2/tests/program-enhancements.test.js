import test from 'node:test'
import assert from 'node:assert/strict'
import {
  enhanceProgramForAthlete,
} from '../src/program-enhancements.js'

function sampleProgram() {
  const day = (
    id,
    name,
    type
  ) => ({
    id,
    exercises: [
      {
        id: `${id}-exercise`,
        name,
        type,
        sets: [],
      },
    ],
  })

  return {
    id: 'sample',
    blocks: [
      {
        id: 'block-1',
        weeks: [
          {
            id: 'week-1',
            days: [
              {
                id: 'squat-day',
                exercises: [
                  {
                    id: 'warmup',
                    name: 'Rameur',
                    type: 'AC',
                    sets: [],
                  },
                  {
                    id: 'squat',
                    name: 'Comp squat',
                    type: 'SQ',
                    sets: [],
                  },
                ],
              },
              day('bench-day', 'Bench', 'BN'),
              day('deadlift-day', 'Deadlift', 'DL'),
              day('accessory-day', 'Rowing', 'AC'),
              day('last-day', 'Squat tempo', 'SQ'),
            ],
          },
        ],
      },
    ],
  }
}

test('ajoute les quatre activations juste avant le premier squat', () => {
  const enhanced =
    enhanceProgramForAthlete(
      'metaknight',
      sampleProgram()
    )

  const exercises =
    enhanced.blocks[0]
      .weeks[0]
      .days[0]
      .exercises

  assert.deepEqual(
    exercises.map(
      (exercise) =>
        exercise.name
    ),
    [
      'Rameur',
      'Clamshells avec bande',
      'Banded lateral walks (monster walk)',
      'Banded squats isométriques',
      'Single-leg glute bridge',
      'Comp squat',
      'Copenhagen adductor (excentrique)',
      'Side-lying hip abduction',
    ]
  )

  assert.deepEqual(
    exercises
      .slice(1, 5)
      .map(
        (exercise) =>
          exercise.sets.length
      ),
    [2, 2, 3, 2]
  )

  assert.ok(
    exercises
      .slice(1, 5)
      .every(
        (exercise) =>
          exercise.description
      )
  )
})

test('applique exactement le même dispositif à Allan', () => {
  const clara =
    enhanceProgramForAthlete(
      'metaknight',
      sampleProgram()
    )

  const allan =
    enhanceProgramForAthlete(
      'allan',
      sampleProgram()
    )

  assert.deepEqual(
    allan,
    clara
  )
})

test('ne modifie ni les jours sans squat ni les autres athlètes', () => {
  const source =
    sampleProgram()

  const clara =
    enhanceProgramForAthlete(
      'metaknight',
      source
    )

  assert.deepEqual(
    clara.blocks[0]
      .weeks[0]
      .days[1],
    source.blocks[0]
      .weeks[0]
      .days[1]
  )

  assert.equal(
    enhanceProgramForAthlete(
      'tom',
      source
    ),
    source
  )
})

test('répartit les six renforcements en fin de trois séances', () => {
  const enhanced =
    enhanceProgramForAthlete(
      'metaknight',
      sampleProgram()
    )

  const days =
    enhanced.blocks[0]
      .weeks[0]
      .days

  const assistanceNames =
    days.map((day) =>
      day.exercises
        .filter(
          (exercise) =>
            exercise.routineKey ===
            'clara-hip-assistance'
        )
        .map(
          (exercise) =>
            exercise.name
        )
    )

  assert.deepEqual(
    assistanceNames,
    [
      [
        'Copenhagen adductor (excentrique)',
        'Side-lying hip abduction',
      ],
      [],
      [
        'Cable hip external rotation debout',
        'Single-leg RDL',
      ],
      [],
      [
        'Squat goblet avec pause + bande',
        'Banded seated abduction',
      ],
    ]
  )

  for (const index of [0, 2, 4]) {
    assert.ok(
      days[index].exercises
        .slice(-2)
        .every(
          (exercise) =>
            exercise.routineKey ===
            'clara-hip-assistance'
        )
    )
  }
})

test('reste idempotent et ne duplique pas la routine', () => {
  const once =
    enhanceProgramForAthlete(
      'metaknight',
      sampleProgram()
    )

  const twice =
    enhanceProgramForAthlete(
      'metaknight',
      once
    )

  const prep =
    twice.blocks[0]
      .weeks[0]
      .days[0]
      .exercises
      .filter(
        (exercise) =>
          exercise.routineKey ===
          'clara-squat-prep'
      )

  assert.equal(
    prep.length,
    4
  )

  const assistance =
    twice.blocks[0]
      .weeks[0]
      .days.flatMap(
        (day) =>
          day.exercises.filter(
            (exercise) =>
              exercise.routineKey ===
              'clara-hip-assistance'
          )
      )

  assert.equal(
    assistance.length,
    6
  )
})

test('ajoute un Milko Press avant le bloc bench de Duane en semaine 4 uniquement', () => {
  const benchExercise =
    (id) => ({
      id,
      name:
        'Comp bench primaire',
      type: 'BN',
      sets: [],
    })

  const source = {
    id: 'duane-sample',
    blocks: [
      {
        id: 'block-1',
        weeks: [
          {
            id: 'week-3',
            number: 3,
            label: 'S3',
            days: [
              {
                id: 'w3-day',
                exercises: [
                  benchExercise(
                    'w3-bench'
                  ),
                ],
              },
            ],
          },
          {
            id: 'week-4',
            number: 4,
            label: 'S4',
            days: [
              {
                id: 'w4-day-1',
                exercises: [
                  {
                    id: 'squat',
                    name: 'Comp squat',
                    type: 'SQ',
                    sets: [],
                  },
                  benchExercise(
                    'w4-bench-top'
                  ),
                  benchExercise(
                    'w4-bench-backoff'
                  ),
                ],
              },
              {
                id: 'w4-day-2',
                exercises: [
                  benchExercise(
                    'w4-larsen'
                  ),
                ],
              },
            ],
          },
        ],
      },
    ],
  }

  const enhanced =
    enhanceProgramForAthlete(
      'duane',
      source
    )

  assert.deepEqual(
    enhanced.blocks[0]
      .weeks[0]
      .days[0]
      .exercises,
    source.blocks[0]
      .weeks[0]
      .days[0]
      .exercises,
    'la semaine 3 reste inchangée'
  )

  const weekFourDays =
    enhanced.blocks[0]
      .weeks[1]
      .days

  assert.deepEqual(
    weekFourDays.map(
      (day) =>
        day.exercises.map(
          (exercise) =>
            exercise.name
        )
    ),
    [
      [
        'Comp squat',
        'Milko Press',
        'Comp bench primaire',
        'Comp bench primaire',
      ],
      [
        'Milko Press',
        'Comp bench primaire',
      ],
    ]
  )

  const milkoPresses =
    weekFourDays.flatMap(
      (day) =>
        day.exercises.filter(
          (exercise) =>
            exercise.routineKey ===
            'duane-week-4-milko-press'
        )
    )

  assert.equal(
    milkoPresses.length,
    2
  )

  assert.ok(
    milkoPresses.every(
      (exercise) =>
        exercise.variant ===
          '10 kg par main' &&
        exercise.sets.length ===
          3 &&
        exercise.sets.every(
          (set) =>
            set.reps === '15' &&
            set.loadRange ===
              '10'
        )
    )
  )
})

test('ne duplique pas le Milko Press de Duane lors d’un second enrichissement', () => {
  const source = {
    id: 'duane-idempotence',
    blocks: [
      {
        id: 'block-1',
        weeks: [
          {
            id: 'week-4',
            number: 4,
            label: 'S4',
            days: [
              {
                id: 'day-1',
                exercises: [
                  {
                    id: 'bench',
                    name: 'Comp bench',
                    type: 'BN',
                    sets: [],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  }

  const once =
    enhanceProgramForAthlete(
      'duane',
      source
    )

  const twice =
    enhanceProgramForAthlete(
      'duane',
      once
    )

  assert.equal(
    twice.blocks[0]
      .weeks[0]
      .days[0]
      .exercises.filter(
        (exercise) =>
          exercise.routineKey ===
          'duane-week-4-milko-press'
      ).length,
    1
  )
})
