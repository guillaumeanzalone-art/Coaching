const STORAGE_KEY = 'ga-v2-training-demo'

const defaultSession = {
  athlete: 'Test',
  week: 1,
  day: 'Séance test',
  exercises: [
    {
      id: 'squat-1',
      name: 'Comp Squat',
      type: 'SQ',
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
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
}

function getSet(session, exerciseId, setId) {
  const exercise = session.exercises.find(
    (item) => item.id === exerciseId
  )

  if (!exercise) return null

  return exercise.sets.find(
    (item) => item.id === setId
  )
}

export function mountTraining(root, onBack) {
  let session = loadSession()

  function updateSet(exerciseId, setId, changes) {
    const set = getSet(session, exerciseId, setId)

    if (!set) return

    Object.assign(set, changes)

    saveSession(session)
    render()
  }

  function resetSession() {
    session = cloneDefaultSession()
    saveSession(session)
    render()
  }

  function renderSet(exercise, set, index) {
    const isDone = set.status === 'done'
    const isFailed = set.status === 'failed'

    return `
      <div
        class="training-set
          ${isDone ? 'training-set--done' : ''}
          ${isFailed ? 'training-set--failed' : ''}"
        data-exercise-id="${exercise.id}"
        data-set-id="${set.id}"
      >

        <div class="set-number">
          Série ${index + 1}
        </div>

        <div class="set-prescription">
          <strong>${set.reps} reps</strong>
          <span>${set.targetLoad} kg prévu</span>
        </div>

        <input
          class="set-load"
          type="number"
          inputmode="decimal"
          value="${set.load}"
          data-action="load"
          aria-label="Charge série ${index + 1}"
        >

        <select
          class="set-rpe"
          data-action="rpe"
          aria-label="RPE série ${index + 1}"
        >
          <option value="">RPE</option>
          ${[6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10]
            .map(
              (rpe) => `
                <option
                  value="${rpe}"
                  ${String(set.rpe) === String(rpe) ? 'selected' : ''}
                >
                  ${rpe}
                </option>
              `
            )
            .join('')}
          <option
            value="failed"
            ${isFailed ? 'selected' : ''}
          >
            ECHEC
          </option>
        </select>

        <button
          class="set-check ${isDone ? 'set-check--active' : ''}"
          data-action="toggle"
          aria-label="Valider série ${index + 1}"
        >
          ${isDone ? '✓' : ''}
        </button>

      </div>
    `
  }

  function renderExercise(exercise) {
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
            ${
              exercise.sets.filter(
                (set) => set.status !== 'pending'
              ).length
            }/${exercise.sets.length}
          </span>
        </header>

        <div class="training-sets">
          ${exercise.sets
            .map((set, index) =>
              renderSet(exercise, set, index)
            )
            .join('')}
        </div>

      </section>
    `
  }

  function render() {
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
            ${
              session.exercises
                .flatMap((exercise) => exercise.sets)
                .filter((set) => set.status !== 'pending')
                .length
            }
            /
            ${
              session.exercises
                .flatMap((exercise) => exercise.sets)
                .length
            }
            séries
          </strong>
        </section>

        ${session.exercises
          .map(renderExercise)
          .join('')}

      </main>
    `
  }

  root.addEventListener('click', (event) => {
    const action = event.target.closest('[data-action]')

    if (!action) return

    const actionName = action.dataset.action

    if (actionName === 'back') {
      onBack()
      return
    }

    if (actionName === 'reset') {
      resetSession()
      return
    }

    const row = action.closest('.training-set')

    if (!row) return

    const exerciseId = row.dataset.exerciseId
    const setId = row.dataset.setId
    const set = getSet(session, exerciseId, setId)

    if (!set) return

    if (actionName === 'toggle') {
      updateSet(
        exerciseId,
        setId,
        {
          status:
            set.status === 'done'
              ? 'pending'
              : 'done',
        }
      )
    }
  })

  root.addEventListener('change', (event) => {
    const input = event.target
    const row = input.closest('.training-set')

    if (!row) return

    const exerciseId = row.dataset.exerciseId
    const setId = row.dataset.setId

    if (input.dataset.action === 'load') {
      updateSet(
        exerciseId,
        setId,
        {
          load: Number(input.value),
        }
      )
    }

    if (input.dataset.action === 'rpe') {
      if (input.value === 'failed') {
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

      updateSet(
        exerciseId,
        setId,
        {
          rpe: input.value,
          status:
            input.value
              ? 'done'
              : 'pending',
        }
      )
    }
  })

  render()
}