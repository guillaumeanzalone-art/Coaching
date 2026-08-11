const STORAGE_KEY = 'ga-v2-training-v2'

const defaultSession = {
  athlete: 'Test',
  week: 1,
  day: 'Séance SBD test',

  exercises: [
    {
      id: 'squat-1',
      name: 'Comp Squat',
      type: 'SQ',
      usesRpe: true,

      sets: [
        {
          id: 'squat-1-set-1',
          reps: 5,
          targetLoad: 140,
          load: 140,
          rpe: '',
          status: 'pending',
        },
        {
          id: 'squat-1-set-2',
          reps: 5,
          targetLoad: 140,
          load: 140,
          rpe: '',
          status: 'pending',
        },
        {
          id: 'squat-1-set-3',
          reps: 5,
          targetLoad: 140,
          load: 140,
          rpe: '',
          status: 'pending',
        },
      ],
    },

    {
      id: 'bench-1',
      name: 'Comp Bench',
      type: 'BN',
      usesRpe: true,

      sets: [
        {
          id: 'bench-1-set-1',
          reps: 4,
          targetLoad: 100,
          load: 100,
          rpe: '',
          status: 'pending',
        },
        {
          id: 'bench-1-set-2',
          reps: 4,
          targetLoad: 100,
          load: 100,
          rpe: '',
          status: 'pending',
        },
        {
          id: 'bench-1-set-3',
          reps: 4,
          targetLoad: 100,
          load: 100,
          rpe: '',
          status: 'pending',
        },
        {
          id: 'bench-1-set-4',
          reps: 4,
          targetLoad: 100,
          load: 100,
          rpe: '',
          status: 'pending',
        },
      ],
    },

    {
      id: 'deadlift-1',
      name: 'Comp Deadlift',
      type: 'DL',
      usesRpe: true,

      sets: [
        {
          id: 'deadlift-1-set-1',
          reps: 3,
          targetLoad: 180,
          load: 180,
          rpe: '',
          status: 'pending',
        },
        {
          id: 'deadlift-1-set-2',
          reps: 3,
          targetLoad: 180,
          load: 180,
          rpe: '',
          status: 'pending',
        },
        {
          id: 'deadlift-1-set-3',
          reps: 3,
          targetLoad: 180,
          load: 180,
          rpe: '',
          status: 'pending',
        },
      ],
    },

    {
      id: 'leg-extension-1',
      name: 'Leg Extension',
      type: 'AC',
      usesRpe: false,

      sets: [
        {
          id: 'leg-extension-1-set-1',
          reps: '10-12',
          targetLoad: 40,
          load: 40,
          rpe: '',
          status: 'pending',
        },
        {
          id: 'leg-extension-1-set-2',
          reps: '10-12',
          targetLoad: 40,
          load: 40,
          rpe: '',
          status: 'pending',
        },
        {
          id: 'leg-extension-1-set-3',
          reps: '10-12',
          targetLoad: 40,
          load: 40,
          rpe: '',
          status: 'pending',
        },
      ],
    },
  ],
}

function cloneDefaultSession() {
  return JSON.parse(JSON.stringify(defaultSession))
}

function loadSession() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)

    if (!saved) {
      return cloneDefaultSession()
    }

    return JSON.parse(saved)
  } catch {
    return cloneDefaultSession()
  }
}

function saveSession(session) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(session)
  )
}

function getSet(session, exerciseId, setId) {
  const exercise = session.exercises.find(
    (item) => item.id === exerciseId
  )

  if (!exercise) {
    return null
  }

  return exercise.sets.find(
    (item) => item.id === setId
  )
}

function getExercise(session, exerciseId) {
  return session.exercises.find(
    (item) => item.id === exerciseId
  )
}

function getAllSets(session) {
  return session.exercises.flatMap(
    (exercise) => exercise.sets
  )
}

export function mountTraining(root, onBack) {
  let session = loadSession()

  function updateSet(
    exerciseId,
    setId,
    changes
  ) {
    const set = getSet(
      session,
      exerciseId,
      setId
    )

    if (!set) {
      return
    }

    Object.assign(
      set,
      changes
    )

    saveSession(session)
    render()
  }

  function resetSession() {
    session = cloneDefaultSession()

    saveSession(session)
    render()
  }

  function renderRpe(exercise, set, index) {
    if (!exercise.usesRpe) {
      return `
        <div
          class="set-rpe-placeholder"
          aria-hidden="true"
        ></div>
      `
    }

    const isFailed =
      set.status === 'failed'

    const rpeValues = [
      6,
      6.5,
      7,
      7.5,
      8,
      8.5,
      9,
      9.5,
      10,
    ]

    return `
      <select
        class="set-rpe"
        data-action="rpe"
        aria-label="RPE série ${index + 1}"
      >
        <option value="">
          RPE
        </option>

        ${rpeValues
          .map(
            (rpe) => `
              <option
                value="${rpe}"
                ${
                  String(set.rpe) ===
                  String(rpe)
                    ? 'selected'
                    : ''
                }
              >
                ${rpe}
              </option>
            `
          )
          .join('')}

        <option
          value="failed"
          ${
            isFailed
              ? 'selected'
              : ''
          }
        >
          ECHEC
        </option>
      </select>
    `
  }

  function renderSet(
    exercise,
    set,
    index
  ) {
    const isDone =
      set.status === 'done'

    const isFailed =
      set.status === 'failed'

    return `
      <div
        class="
          training-set
          ${
            isDone
              ? 'training-set--done'
              : ''
          }
          ${
            isFailed
              ? 'training-set--failed'
              : ''
          }
        "
        data-exercise-id="${exercise.id}"
        data-set-id="${set.id}"
      >

        <div class="set-number">
          Série ${index + 1}
        </div>

        <div class="set-prescription">
          <strong>
            ${set.reps} reps
          </strong>

          <span>
            ${set.targetLoad} kg prévu
          </span>
        </div>

        <input
          class="set-load"
          type="number"
          inputmode="decimal"
          step="0.5"
          value="${set.load}"
          data-action="load"
          aria-label="Charge série ${index + 1}"
        >

        ${renderRpe(
          exercise,
          set,
          index
        )}

        <button
          class="
            set-check
            ${
              isDone
                ? 'set-check--active'
                : ''
            }
          "
          data-action="toggle"
          aria-label="Valider série ${index + 1}"
        >
          ${
            isDone
              ? '✓'
              : ''
          }
        </button>

      </div>
    `
  }

  function renderExercise(exercise) {
    const completedSets =
      exercise.sets.filter(
        (set) =>
          set.status !== 'pending'
      ).length

    return `
      <section class="training-exercise">

        <header class="exercise-header">

          <div>
            <span class="exercise-type">
              ${exercise.type}
            </span>

            <h2>
              ${exercise.name}
            </h2>
          </div>

          <span class="exercise-progress">
            ${completedSets}
            /
            ${exercise.sets.length}
          </span>

        </header>

        <div class="training-sets">
          ${exercise.sets
            .map(
              (set, index) =>
                renderSet(
                  exercise,
                  set,
                  index
                )
            )
            .join('')}
        </div>

      </section>
    `
  }

  function render() {
    const allSets =
      getAllSets(session)

    const completedSets =
      allSets.filter(
        (set) =>
          set.status !== 'pending'
      ).length

    root.innerHTML = `
      <main class="training-page">

        <header class="training-topbar">

          <button
            class="back-button"
            data-action="back"
          >
            ← Accueil
          </button>

          <div>
            <span class="training-kicker">
              GA COACHING · V2
            </span>

            <h1>
              ${session.day}
            </h1>
          </div>

          <button
            class="reset-button"
            data-action="reset"
          >
            Réinitialiser
          </button>

        </header>

        <section class="training-summary">

          <span>
            Semaine ${session.week}
          </span>

          <strong>
            ${completedSets}
            /
            ${allSets.length}
            séries
          </strong>

        </section>

        <div class="training-exercises">

          ${session.exercises
            .map(
              (exercise) =>
                renderExercise(exercise)
            )
            .join('')}

        </div>

      </main>
    `
  }

  root.onclick = (event) => {
    const action =
      event.target.closest(
        '[data-action]'
      )

    if (!action) {
      return
    }

    const actionName =
      action.dataset.action

    if (actionName === 'back') {
      root.onclick = null
      root.onchange = null

      onBack()
      return
    }

    if (actionName === 'reset') {
      resetSession()
      return
    }

    const row =
      action.closest(
        '.training-set'
      )

    if (!row) {
      return
    }

    const exerciseId =
      row.dataset.exerciseId

    const setId =
      row.dataset.setId

    const set =
      getSet(
        session,
        exerciseId,
        setId
      )

    const exercise =
      getExercise(
        session,
        exerciseId
      )

    if (!set || !exercise) {
      return
    }

    if (actionName === 'toggle') {
      if (set.status === 'done') {
        updateSet(
          exerciseId,
          setId,
          {
            status: 'pending',
            rpe: exercise.usesRpe
              ? set.rpe
              : '',
          }
        )

        return
      }

      updateSet(
        exerciseId,
        setId,
        {
          status: 'done',
        }
      )
    }
  }

  root.onchange = (event) => {
    const input = event.target

    const row =
      input.closest(
        '.training-set'
      )

    if (!row) {
      return
    }

    const exerciseId =
      row.dataset.exerciseId

    const setId =
      row.dataset.setId

    const set =
      getSet(
        session,
        exerciseId,
        setId
      )

    const exercise =
      getExercise(
        session,
        exerciseId
      )

    if (!set || !exercise) {
      return
    }

    if (
      input.dataset.action ===
      'load'
    ) {
      const newLoad =
        Number(input.value)

      updateSet(
        exerciseId,
        setId,
        {
          load: Number.isFinite(newLoad)
            ? newLoad
            : 0,
        }
      )

      return
    }

    if (
      input.dataset.action ===
      'rpe'
    ) {
      if (!exercise.usesRpe) {
        return
      }

      if (
        input.value ===
        'failed'
      ) {
        updateSet(
          exerciseId,
          setId,
          {
            rpe: '',
            status: 'failed',
          }
        )

        return
      }

      if (
        input.value === ''
      ) {
        updateSet(
          exerciseId,
          setId,
          {
            rpe: '',
            status: 'pending',
          }
        )

        return
      }

      updateSet(
        exerciseId,
        setId,
        {
          rpe: input.value,
          status: 'done',
        }
      )
    }
  }

  render()
}