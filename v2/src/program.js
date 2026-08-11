function createSets({
  prefix,
  count,
  reps,
  load,
}) {
  return Array.from(
    { length: count },
    (_, index) => ({
      id: `${prefix}-set-${index + 1}`,
      reps,
      targetLoad: load,
      load,
      rpe: '',
      status: 'pending',
    })
  )
}

function createExercise({
  id,
  name,
  type,
  usesRpe = true,
  sets,
  reps,
  load,
}) {
  return {
    id,
    name,
    type,
    usesRpe,

    sets: createSets({
      prefix: id,
      count: sets,
      reps,
      load,
    }),
  }
}

export const demoProgram = {
  id: 'ga-demo-program-v1',

  athlete: {
    id: 'test-athlete',
    name: 'Athlète Test',
  },

  weeks: [
    {
      id: 'week-1',
      number: 1,
      label: 'Semaine 1',

      days: [
        {
          id: 'w1-d1',
          name: 'Jour 1',
          exercises: [
            createExercise({
              id: 'w1-d1-squat',
              name: 'Comp Squat',
              type: 'SQ',
              sets: 3,
              reps: 5,
              load: 140,
            }),

            createExercise({
              id: 'w1-d1-bench',
              name: 'Comp Bench',
              type: 'BN',
              sets: 4,
              reps: 4,
              load: 100,
            }),

            createExercise({
              id: 'w1-d1-leg-extension',
              name: 'Leg Extension',
              type: 'AC',
              usesRpe: false,
              sets: 3,
              reps: '10-12',
              load: 40,
            }),
          ],
        },

        {
          id: 'w1-d2',
          name: 'Jour 2',
          exercises: [
            createExercise({
              id: 'w1-d2-deadlift',
              name: 'Comp Deadlift',
              type: 'DL',
              sets: 3,
              reps: 3,
              load: 180,
            }),

            createExercise({
              id: 'w1-d2-bench',
              name: 'Bench Pause',
              type: 'BN',
              sets: 3,
              reps: 5,
              load: 90,
            }),

            createExercise({
              id: 'w1-d2-row',
              name: 'Rowing',
              type: 'AC',
              usesRpe: false,
              sets: 3,
              reps: '10-12',
              load: 50,
            }),
          ],
        },

        {
          id: 'w1-d3',
          name: 'Jour 3',
          exercises: [
            createExercise({
              id: 'w1-d3-squat',
              name: 'Squat Pause',
              type: 'SQ',
              sets: 3,
              reps: 4,
              load: 130,
            }),

            createExercise({
              id: 'w1-d3-bench',
              name: 'Comp Bench',
              type: 'BN',
              sets: 4,
              reps: 3,
              load: 105,
            }),

            createExercise({
              id: 'w1-d3-curl',
              name: 'Curl Biceps',
              type: 'AC',
              usesRpe: false,
              sets: 3,
              reps: 12,
              load: 15,
            }),
          ],
        },

        {
          id: 'w1-d4',
          name: 'Jour 4',
          exercises: [
            createExercise({
              id: 'w1-d4-squat',
              name: 'Comp Squat',
              type: 'SQ',
              sets: 3,
              reps: 3,
              load: 150,
            }),

            createExercise({
              id: 'w1-d4-bench',
              name: 'Comp Bench',
              type: 'BN',
              sets: 3,
              reps: 3,
              load: 110,
            }),

            createExercise({
              id: 'w1-d4-deadlift',
              name: 'Comp Deadlift',
              type: 'DL',
              sets: 3,
              reps: 2,
              load: 190,
            }),
          ],
        },
      ],
    },

    {
      id: 'week-2',
      number: 2,
      label: 'Semaine 2',

      days: [
        {
          id: 'w2-d1',
          name: 'Jour 1',
          exercises: [
            createExercise({
              id: 'w2-d1-squat',
              name: 'Comp Squat',
              type: 'SQ',
              sets: 3,
              reps: 5,
              load: 145,
            }),

            createExercise({
              id: 'w2-d1-bench',
              name: 'Comp Bench',
              type: 'BN',
              sets: 4,
              reps: 4,
              load: 102.5,
            }),

            createExercise({
              id: 'w2-d1-leg-extension',
              name: 'Leg Extension',
              type: 'AC',
              usesRpe: false,
              sets: 3,
              reps: '10-12',
              load: 42.5,
            }),
          ],
        },

        {
          id: 'w2-d2',
          name: 'Jour 2',
          exercises: [
            createExercise({
              id: 'w2-d2-deadlift',
              name: 'Comp Deadlift',
              type: 'DL',
              sets: 3,
              reps: 3,
              load: 185,
            }),

            createExercise({
              id: 'w2-d2-bench',
              name: 'Bench Pause',
              type: 'BN',
              sets: 3,
              reps: 5,
              load: 92.5,
            }),

            createExercise({
              id: 'w2-d2-row',
              name: 'Rowing',
              type: 'AC',
              usesRpe: false,
              sets: 3,
              reps: '10-12',
              load: 52.5,
            }),
          ],
        },

        {
          id: 'w2-d3',
          name: 'Jour 3',
          exercises: [
            createExercise({
              id: 'w2-d3-squat',
              name: 'Squat Pause',
              type: 'SQ',
              sets: 3,
              reps: 4,
              load: 135,
            }),

            createExercise({
              id: 'w2-d3-bench',
              name: 'Comp Bench',
              type: 'BN',
              sets: 4,
              reps: 3,
              load: 107.5,
            }),

            createExercise({
              id: 'w2-d3-curl',
              name: 'Curl Biceps',
              type: 'AC',
              usesRpe: false,
              sets: 3,
              reps: 12,
              load: 17.5,
            }),
          ],
        },

        {
          id: 'w2-d4',
          name: 'Jour 4',
          exercises: [
            createExercise({
              id: 'w2-d4-squat',
              name: 'Comp Squat',
              type: 'SQ',
              sets: 3,
              reps: 3,
              load: 155,
            }),

            createExercise({
              id: 'w2-d4-bench',
              name: 'Comp Bench',
              type: 'BN',
              sets: 3,
              reps: 3,
              load: 112.5,
            }),

            createExercise({
              id: 'w2-d4-deadlift',
              name: 'Comp Deadlift',
              type: 'DL',
              sets: 3,
              reps: 2,
              load: 195,
            }),
          ],
        },
      ],
    },

    {
      id: 'week-3',
      number: 3,
      label: 'Semaine 3',

      days: [
        {
          id: 'w3-d1',
          name: 'Jour 1',
          exercises: [
            createExercise({
              id: 'w3-d1-squat',
              name: 'Comp Squat',
              type: 'SQ',
              sets: 3,
              reps: 4,
              load: 150,
            }),

            createExercise({
              id: 'w3-d1-bench',
              name: 'Comp Bench',
              type: 'BN',
              sets: 4,
              reps: 4,
              load: 105,
            }),

            createExercise({
              id: 'w3-d1-leg-extension',
              name: 'Leg Extension',
              type: 'AC',
              usesRpe: false,
              sets: 3,
              reps: '10-12',
              load: 45,
            }),
          ],
        },

        {
          id: 'w3-d2',
          name: 'Jour 2',
          exercises: [
            createExercise({
              id: 'w3-d2-deadlift',
              name: 'Comp Deadlift',
              type: 'DL',
              sets: 3,
              reps: 3,
              load: 190,
            }),

            createExercise({
              id: 'w3-d2-bench',
              name: 'Bench Pause',
              type: 'BN',
              sets: 3,
              reps: 4,
              load: 95,
            }),

            createExercise({
              id: 'w3-d2-row',
              name: 'Rowing',
              type: 'AC',
              usesRpe: false,
              sets: 3,
              reps: '10-12',
              load: 55,
            }),
          ],
        },

        {
          id: 'w3-d3',
          name: 'Jour 3',
          exercises: [
            createExercise({
              id: 'w3-d3-squat',
              name: 'Squat Pause',
              type: 'SQ',
              sets: 3,
              reps: 3,
              load: 140,
            }),

            createExercise({
              id: 'w3-d3-bench',
              name: 'Comp Bench',
              type: 'BN',
              sets: 4,
              reps: 3,
              load: 110,
            }),

            createExercise({
              id: 'w3-d3-curl',
              name: 'Curl Biceps',
              type: 'AC',
              usesRpe: false,
              sets: 3,
              reps: 12,
              load: 17.5,
            }),
          ],
        },

        {
          id: 'w3-d4',
          name: 'Jour 4',
          exercises: [
            createExercise({
              id: 'w3-d4-squat',
              name: 'Comp Squat',
              type: 'SQ',
              sets: 3,
              reps: 2,
              load: 160,
            }),

            createExercise({
              id: 'w3-d4-bench',
              name: 'Comp Bench',
              type: 'BN',
              sets: 3,
              reps: 2,
              load: 115,
            }),

            createExercise({
              id: 'w3-d4-deadlift',
              name: 'Comp Deadlift',
              type: 'DL',
              sets: 3,
              reps: 2,
              load: 200,
            }),
          ],
        },
      ],
    },

    {
      id: 'week-4',
      number: 4,
      label: 'Semaine 4',

      days: [
        {
          id: 'w4-d1',
          name: 'Jour 1',
          exercises: [
            createExercise({
              id: 'w4-d1-squat',
              name: 'Comp Squat',
              type: 'SQ',
              sets: 3,
              reps: 3,
              load: 155,
            }),

            createExercise({
              id: 'w4-d1-bench',
              name: 'Comp Bench',
              type: 'BN',
              sets: 3,
              reps: 3,
              load: 110,
            }),

            createExercise({
              id: 'w4-d1-leg-extension',
              name: 'Leg Extension',
              type: 'AC',
              usesRpe: false,
              sets: 3,
              reps: '10-12',
              load: 45,
            }),
          ],
        },

        {
          id: 'w4-d2',
          name: 'Jour 2',
          exercises: [
            createExercise({
              id: 'w4-d2-deadlift',
              name: 'Comp Deadlift',
              type: 'DL',
              sets: 3,
              reps: 2,
              load: 195,
            }),

            createExercise({
              id: 'w4-d2-bench',
              name: 'Bench Pause',
              type: 'BN',
              sets: 3,
              reps: 3,
              load: 97.5,
            }),

            createExercise({
              id: 'w4-d2-row',
              name: 'Rowing',
              type: 'AC',
              usesRpe: false,
              sets: 3,
              reps: 10,
              load: 57.5,
            }),
          ],
        },

        {
          id: 'w4-d3',
          name: 'Jour 3',
          exercises: [
            createExercise({
              id: 'w4-d3-squat',
              name: 'Squat Pause',
              type: 'SQ',
              sets: 3,
              reps: 3,
              load: 145,
            }),

            createExercise({
              id: 'w4-d3-bench',
              name: 'Comp Bench',
              type: 'BN',
              sets: 3,
              reps: 2,
              load: 115,
            }),

            createExercise({
              id: 'w4-d3-curl',
              name: 'Curl Biceps',
              type: 'AC',
              usesRpe: false,
              sets: 3,
              reps: 12,
              load: 20,
            }),
          ],
        },

        {
          id: 'w4-d4',
          name: 'Jour 4',
          exercises: [
            createExercise({
              id: 'w4-d4-squat',
              name: 'Comp Squat',
              type: 'SQ',
              sets: 2,
              reps: 1,
              load: 165,
            }),

            createExercise({
              id: 'w4-d4-bench',
              name: 'Comp Bench',
              type: 'BN',
              sets: 2,
              reps: 1,
              load: 117.5,
            }),

            createExercise({
              id: 'w4-d4-deadlift',
              name: 'Comp Deadlift',
              type: 'DL',
              sets: 2,
              reps: 1,
              load: 205,
            }),
          ],
        },
      ],
    },
  ],
}