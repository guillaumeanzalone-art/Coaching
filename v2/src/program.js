function createSets({
  athleteId,
  weekNumber,
  dayNumber,
  exerciseKey,
  count,
  reps,
  load,
}) {
  return Array.from(
    { length: count },
    (_, index) => ({
      id:
        `${athleteId}-w${weekNumber}` +
        `-d${dayNumber}` +
        `-${exerciseKey}` +
        `-set-${index + 1}`,

      reps,
      targetLoad: load,
      load,
      rpe: '',
      status: 'pending',
    })
  )
}

function createExercise({
  athleteId,
  weekNumber,
  dayNumber,
  key,
  name,
  type,
  usesRpe = true,
  sets,
  reps,
  load,
}) {
  return {
    id:
      `${athleteId}-w${weekNumber}` +
      `-d${dayNumber}-${key}`,

    name,
    type,
    usesRpe,

    sets: createSets({
      athleteId,
      weekNumber,
      dayNumber,
      exerciseKey: key,
      count: sets,
      reps,
      load,
    }),
  }
}

function createDay({
  athleteId,
  weekNumber,
  dayNumber,
  exercises,
}) {
  return {
    id:
      `${athleteId}-w${weekNumber}` +
      `-d${dayNumber}`,

    name: `Jour ${dayNumber}`,

    exercises:
      exercises.map(
        (exercise) =>
          createExercise({
            athleteId,
            weekNumber,
            dayNumber,
            ...exercise,
          })
      ),
  }
}

function createWeek({
  athleteId,
  weekNumber,
  days,
}) {
  return {
    id:
      `${athleteId}-week-${weekNumber}`,

    number: weekNumber,

    label:
      `Semaine ${weekNumber}`,

    days:
      days.map(
        (exercises, index) =>
          createDay({
            athleteId,
            weekNumber,
            dayNumber: index + 1,
            exercises,
          })
      ),
  }
}

function createDemoProgram({
  athleteId,
  athleteName,
}) {
  const weeksData = [
    [
      [
        {
          key: 'squat',
          name: 'Comp Squat',
          type: 'SQ',
          sets: 3,
          reps: 5,
          load: 140,
        },
        {
          key: 'bench',
          name: 'Comp Bench',
          type: 'BN',
          sets: 4,
          reps: 4,
          load: 100,
        },
        {
          key: 'leg-extension',
          name: 'Leg Extension',
          type: 'AC',
          usesRpe: false,
          sets: 3,
          reps: '10-12',
          load: 40,
        },
      ],

      [
        {
          key: 'deadlift',
          name: 'Comp Deadlift',
          type: 'DL',
          sets: 3,
          reps: 3,
          load: 180,
        },
        {
          key: 'bench-pause',
          name: 'Bench Pause',
          type: 'BN',
          sets: 3,
          reps: 5,
          load: 90,
        },
        {
          key: 'rowing',
          name: 'Rowing',
          type: 'AC',
          usesRpe: false,
          sets: 3,
          reps: '10-12',
          load: 50,
        },
      ],

      [
        {
          key: 'squat-pause',
          name: 'Squat Pause',
          type: 'SQ',
          sets: 3,
          reps: 4,
          load: 130,
        },
        {
          key: 'bench',
          name: 'Comp Bench',
          type: 'BN',
          sets: 4,
          reps: 3,
          load: 105,
        },
        {
          key: 'curl',
          name: 'Curl Biceps',
          type: 'AC',
          usesRpe: false,
          sets: 3,
          reps: 12,
          load: 15,
        },
      ],

      [
        {
          key: 'squat',
          name: 'Comp Squat',
          type: 'SQ',
          sets: 3,
          reps: 3,
          load: 150,
        },
        {
          key: 'bench',
          name: 'Comp Bench',
          type: 'BN',
          sets: 3,
          reps: 3,
          load: 110,
        },
        {
          key: 'deadlift',
          name: 'Comp Deadlift',
          type: 'DL',
          sets: 3,
          reps: 2,
          load: 190,
        },
      ],
    ],

    [
      [
        {
          key: 'squat',
          name: 'Comp Squat',
          type: 'SQ',
          sets: 3,
          reps: 5,
          load: 145,
        },
        {
          key: 'bench',
          name: 'Comp Bench',
          type: 'BN',
          sets: 4,
          reps: 4,
          load: 102.5,
        },
        {
          key: 'leg-extension',
          name: 'Leg Extension',
          type: 'AC',
          usesRpe: false,
          sets: 3,
          reps: '10-12',
          load: 42.5,
        },
      ],

      [
        {
          key: 'deadlift',
          name: 'Comp Deadlift',
          type: 'DL',
          sets: 3,
          reps: 3,
          load: 185,
        },
        {
          key: 'bench-pause',
          name: 'Bench Pause',
          type: 'BN',
          sets: 3,
          reps: 5,
          load: 92.5,
        },
        {
          key: 'rowing',
          name: 'Rowing',
          type: 'AC',
          usesRpe: false,
          sets: 3,
          reps: '10-12',
          load: 52.5,
        },
      ],

      [
        {
          key: 'squat-pause',
          name: 'Squat Pause',
          type: 'SQ',
          sets: 3,
          reps: 4,
          load: 135,
        },
        {
          key: 'bench',
          name: 'Comp Bench',
          type: 'BN',
          sets: 4,
          reps: 3,
          load: 107.5,
        },
        {
          key: 'curl',
          name: 'Curl Biceps',
          type: 'AC',
          usesRpe: false,
          sets: 3,
          reps: 12,
          load: 17.5,
        },
      ],

      [
        {
          key: 'squat',
          name: 'Comp Squat',
          type: 'SQ',
          sets: 3,
          reps: 3,
          load: 155,
        },
        {
          key: 'bench',
          name: 'Comp Bench',
          type: 'BN',
          sets: 3,
          reps: 3,
          load: 112.5,
        },
        {
          key: 'deadlift',
          name: 'Comp Deadlift',
          type: 'DL',
          sets: 3,
          reps: 2,
          load: 195,
        },
      ],
    ],

    [
      [
        {
          key: 'squat',
          name: 'Comp Squat',
          type: 'SQ',
          sets: 3,
          reps: 4,
          load: 150,
        },
        {
          key: 'bench',
          name: 'Comp Bench',
          type: 'BN',
          sets: 4,
          reps: 4,
          load: 105,
        },
        {
          key: 'leg-extension',
          name: 'Leg Extension',
          type: 'AC',
          usesRpe: false,
          sets: 3,
          reps: '10-12',
          load: 45,
        },
      ],

      [
        {
          key: 'deadlift',
          name: 'Comp Deadlift',
          type: 'DL',
          sets: 3,
          reps: 3,
          load: 190,
        },
        {
          key: 'bench-pause',
          name: 'Bench Pause',
          type: 'BN',
          sets: 3,
          reps: 4,
          load: 95,
        },
        {
          key: 'rowing',
          name: 'Rowing',
          type: 'AC',
          usesRpe: false,
          sets: 3,
          reps: '10-12',
          load: 55,
        },
      ],

      [
        {
          key: 'squat-pause',
          name: 'Squat Pause',
          type: 'SQ',
          sets: 3,
          reps: 3,
          load: 140,
        },
        {
          key: 'bench',
          name: 'Comp Bench',
          type: 'BN',
          sets: 4,
          reps: 3,
          load: 110,
        },
        {
          key: 'curl',
          name: 'Curl Biceps',
          type: 'AC',
          usesRpe: false,
          sets: 3,
          reps: 12,
          load: 17.5,
        },
      ],

      [
        {
          key: 'squat',
          name: 'Comp Squat',
          type: 'SQ',
          sets: 3,
          reps: 2,
          load: 160,
        },
        {
          key: 'bench',
          name: 'Comp Bench',
          type: 'BN',
          sets: 3,
          reps: 2,
          load: 115,
        },
        {
          key: 'deadlift',
          name: 'Comp Deadlift',
          type: 'DL',
          sets: 3,
          reps: 2,
          load: 200,
        },
      ],
    ],

    [
      [
        {
          key: 'squat',
          name: 'Comp Squat',
          type: 'SQ',
          sets: 3,
          reps: 3,
          load: 155,
        },
        {
          key: 'bench',
          name: 'Comp Bench',
          type: 'BN',
          sets: 3,
          reps: 3,
          load: 110,
        },
        {
          key: 'leg-extension',
          name: 'Leg Extension',
          type: 'AC',
          usesRpe: false,
          sets: 3,
          reps: '10-12',
          load: 45,
        },
      ],

      [
        {
          key: 'deadlift',
          name: 'Comp Deadlift',
          type: 'DL',
          sets: 3,
          reps: 2,
          load: 195,
        },
        {
          key: 'bench-pause',
          name: 'Bench Pause',
          type: 'BN',
          sets: 3,
          reps: 3,
          load: 97.5,
        },
        {
          key: 'rowing',
          name: 'Rowing',
          type: 'AC',
          usesRpe: false,
          sets: 3,
          reps: 10,
          load: 57.5,
        },
      ],

      [
        {
          key: 'squat-pause',
          name: 'Squat Pause',
          type: 'SQ',
          sets: 3,
          reps: 3,
          load: 145,
        },
        {
          key: 'bench',
          name: 'Comp Bench',
          type: 'BN',
          sets: 3,
          reps: 2,
          load: 115,
        },
        {
          key: 'curl',
          name: 'Curl Biceps',
          type: 'AC',
          usesRpe: false,
          sets: 3,
          reps: 12,
          load: 20,
        },
      ],

      [
        {
          key: 'squat',
          name: 'Comp Squat',
          type: 'SQ',
          sets: 2,
          reps: 1,
          load: 165,
        },
        {
          key: 'bench',
          name: 'Comp Bench',
          type: 'BN',
          sets: 2,
          reps: 1,
          load: 117.5,
        },
        {
          key: 'deadlift',
          name: 'Comp Deadlift',
          type: 'DL',
          sets: 2,
          reps: 1,
          load: 205,
        },
      ],
    ],
  ]

  return {
    id:
      `ga-${athleteId}-demo-program-v1`,

    athlete: {
      id: athleteId,
      name: athleteName,
    },

    weeks:
      weeksData.map(
        (days, index) =>
          createWeek({
            athleteId,
            weekNumber: index + 1,
            days,
          })
      ),
  }
}

const programs = {
  killian: createDemoProgram({
    athleteId: 'killian',
    athleteName: 'Killian',
  }),

  saya: createDemoProgram({
    athleteId: 'saya',
    athleteName: 'Saya',
  }),

  janel: createDemoProgram({
    athleteId: 'janel',
    athleteName: 'Janel',
  }),
}

export function getProgramForAthlete(
  athleteId
) {
  return programs[athleteId] ?? null
}