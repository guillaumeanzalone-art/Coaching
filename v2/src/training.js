function createStorageKey(program) {
  return `ga-v2-training-progress:${program.id}`
}

function createDefaultState(program) {
  return {
    selectedWeekId:
      program.weeks[0]?.id ?? null,

    selectedDayId:
      program.weeks[0]?.days[0]?.id ?? null,

    sets: {},
  }
}

function loadState(
  storageKey,
  program
) {
  try {
    const saved =
      localStorage.getItem(
        storageKey
      )

    if (!saved) {
      return createDefaultState(
        program
      )
    }

    const parsed =
      JSON.parse(saved)

    return {
      ...createDefaultState(
        program
      ),

      ...parsed,

      sets:
        parsed.sets || {},
    }
  } catch {
    return createDefaultState(
      program
    )
  }
}

function saveState(
  storageKey,
  state
) {
  localStorage.setItem(
    storageKey,
    JSON.stringify(state)
  )
}

function findWeek(
  program,
  weekId
) {
  return program.weeks.find(
    (week) =>
      week.id === weekId
  )
}

function findDay(
  week,
  dayId
) {
  if (!week) {
    return null
  }

  return week.days.find(
    (day) =>
      day.id === dayId
  )
}

function getSetState(
  state,
  sourceSet
) {
  const saved =
    state.sets[sourceSet.id]

  if (!saved) {
    return {
      load:
        sourceSet.load ??
        sourceSet.targetLoad ??
        0,

      rpe:
        sourceSet.rpe ?? '',

      status:
        sourceSet.status ??
        'pending',
    }
  }

  return {
    load:
      saved.load ??
      sourceSet.load ??
      sourceSet.targetLoad ??
      0,

    rpe:
      saved.rpe ?? '',

    status:
      saved.status ??
      'pending',
  }
}

function countDayProgress(
  state,
  day
) {
  if (!day) {
    return {
      completed: 0,
      total: 0,
    }
  }

  const sets =
    day.exercises.flatMap(
      (exercise) =>
        exercise.sets
    )

  const completed =
    sets.filter(
      (sourceSet) => {
        const set =
          getSetState(
            state,
            sourceSet
          )

        return (
          set.status === 'done' ||
          set.status === 'failed'
        )
      }
    ).length

  return {
    completed,
    total: sets.length,
  }
}

function countWeekProgress(
  state,
  week
) {
  if (!week) {
    return {
      completed: 0,
      total: 0,
    }
  }

  let completed = 0
  let total = 0

  week.days.forEach(
    (day) => {
      const progress =
        countDayProgress(
          state,
          day
        )

      completed +=
        progress.completed

      total +=
        progress.total
    }
  )

  return {
    completed,
    total,
  }
}

function findSourceSet(
  program,
  setId
) {
  for (
    const week
    of program.weeks
  ) {
    for (
      const day
      of week.days
    ) {
      for (
        const exercise
        of day.exercises
      ) {
        const sourceSet =
          exercise.sets.find(
            (set) =>
              set.id === setId
          )

        if (sourceSet) {
          return {
            week,
            day,
            exercise,
            sourceSet,
          }
        }
      }
    }
  }

  return null
}

export function mountTraining(
  root,
  onBack,
  program
) {
  if (
    !program ||
    !Array.isArray(program.weeks)
  ) {
    root.innerHTML = `
      <main class="training-page">
        <p>
          Programme introuvable.
        </p>
      </main>
    `

    return
  }

  const STORAGE_KEY =
    createStorageKey(
      program
    )

  let state =
    loadState(
      STORAGE_KEY,
      program
    )

  function persist() {
    saveState(
      STORAGE_KEY,
      state
    )
  }

  function normalizeSelection() {
    let week =
      findWeek(
        program,
        state.selectedWeekId
      )

    if (!week) {
      week =
        program.weeks[0]

      state.selectedWeekId =
        week?.id ?? null
    }

    let day =
      findDay(
        week,
        state.selectedDayId
      )

    if (!day) {
      day =
        week?.days[0]

      state.selectedDayId =
        day?.id ?? null
    }

    persist()

    return {
      week,
      day,
    }
  }

  function updateSet(
    sourceSet,
    changes
  ) {
    const current =
      getSetState(
        state,
        sourceSet
      )

    state.sets[sourceSet.id] = {
      ...current,
      ...changes,
    }

    persist()
    render()
  }

  function resetCurrentDay() {
    const {
      day,
    } =
      normalizeSelection()

    if (!day) {
      return
    }

    day.exercises.forEach(
      (exercise) => {
        exercise.sets.forEach(
          (sourceSet) => {
            delete state.sets[
              sourceSet.id
            ]
          }
        )
      }
    )

    persist()
    render()
  }

  function renderWeeks(
    currentWeek
  ) {
    return `
      <div class="week-tabs">

        ${program.weeks
          .map(
            (week) => {
              const progress =
                countWeekProgress(
                  state,
                  week
                )

              const active =
                week.id ===
                currentWeek?.id

              return `
                <button
                  class="
                    week-tab
                    ${
                      active
                        ? 'week-tab--active'
                        : ''
                    }
                  "
                  data-action="week"
                  data-week-id="${week.id}"
                >

                  <strong>
                    ${week.label}
                  </strong>

                  <span>
                    ${progress.completed}/${progress.total}
                  </span>

                </button>
              `
            }
          )
          .join('')}

      </div>
    `
  }

  function renderDays(
    currentWeek,
    currentDay
  ) {
    if (!currentWeek) {
      return ''
    }

    return `
      <div class="day-tabs-v2">

        ${currentWeek.days
          .map(
            (day) => {
              const progress =
                countDayProgress(
                  state,
                  day
                )

              const active =
                day.id ===
                currentDay?.id

              return `
                <button
                  class="
                    day-tab-v2
                    ${
                      active
                        ? 'day-tab-v2--active'
                        : ''
                    }
                  "
                  data-action="day"
                  data-day-id="${day.id}"
                >

                  <strong>
                    ${day.name}
                  </strong>

                  <span>
                    ${progress.completed}/${progress.total}
                  </span>

                </button>
              `
            }
          )
          .join('')}

      </div>
    `
  }

  function renderRpe(
    exercise,
    sourceSet,
    set,
    index
  ) {
    if (!exercise.usesRpe) {
      return `
        <div
          class="set-rpe-placeholder"
          aria-hidden="true"
        ></div>
      `
    }

    const values = [
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
        data-set-id="${sourceSet.id}"
        aria-label="RPE série ${index + 1}"
      >

        <option value="">
          RPE
        </option>

        ${values
          .map(
            (value) => `
              <option
                value="${value}"
                ${
                  String(set.rpe) ===
                  String(value)
                    ? 'selected'
                    : ''
                }
              >
                ${value}
              </option>
            `
          )
          .join('')}

        <option
          value="failed"
          ${
            set.status ===
            'failed'
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
    sourceSet,
    index
  ) {
    const set =
      getSetState(
        state,
        sourceSet
      )

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
        data-set-id="${sourceSet.id}"
      >

        <div class="set-number">
          Série ${index + 1}
        </div>

        <div class="set-prescription">

          <strong>
            ${sourceSet.reps} reps
          </strong>

          <span>
            ${sourceSet.targetLoad} kg prévu
          </span>

        </div>

        <input
          class="set-load"
          type="number"
          inputmode="decimal"
          step="0.5"
          value="${set.load}"
          data-action="load"
          data-set-id="${sourceSet.id}"
          aria-label="Charge série ${index + 1}"
        >

        ${renderRpe(
          exercise,
          sourceSet,
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
          data-set-id="${sourceSet.id}"
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

  function renderExercise(
    exercise
  ) {
    const completed =
      exercise.sets.filter(
        (sourceSet) => {
          const set =
            getSetState(
              state,
              sourceSet
            )

          return (
            set.status === 'done' ||
            set.status === 'failed'
          )
        }
      ).length

    return `
      <section
        class="training-exercise"
      >

        <header
          class="exercise-header"
        >

          <div>

            <span
              class="exercise-type"
            >
              ${exercise.type}
            </span>

            <h2>
              ${exercise.name}
            </h2>

          </div>

          <span
            class="exercise-progress"
          >
            ${completed}
            /
            ${exercise.sets.length}
          </span>

        </header>

        <div
          class="training-sets"
        >

          ${exercise.sets
            .map(
              (sourceSet, index) =>
                renderSet(
                  exercise,
                  sourceSet,
                  index
                )
            )
            .join('')}

        </div>

      </section>
    `
  }

  function render() {
    const {
      week,
      day,
    } =
      normalizeSelection()

    if (!week || !day) {
      root.innerHTML = `
        <main
          class="training-page"
        >
          <p>
            Aucun programme disponible.
          </p>
        </main>
      `

      return
    }

    const progress =
      countDayProgress(
        state,
        day
      )

    root.innerHTML = `
      <main
        class="training-page"
      >

        <header
          class="training-topbar"
        >

          <button
            class="back-button"
            data-action="back"
          >
            ← Accueil
          </button>

          <div>

            <span
              class="training-kicker"
            >
              GA COACHING · V2
            </span>

            <h1>
              ${program.athlete.name}
            </h1>

          </div>

          <button
            class="reset-button"
            data-action="reset"
          >
            Réinitialiser
          </button>

        </header>

        ${renderWeeks(
          week
        )}

        ${renderDays(
          week,
          day
        )}

        <section
          class="training-summary"
        >

          <span>
            ${week.label}
            ·
            ${day.name}
          </span>

          <strong>
            ${progress.completed}
            /
            ${progress.total}
            séries
          </strong>

        </section>

        <div
          class="training-exercises"
        >

          ${day.exercises
            .map(
              (exercise) =>
                renderExercise(
                  exercise
                )
            )
            .join('')}

        </div>

      </main>
    `
  }

  root.onclick = (
    event
  ) => {
    const action =
      event.target.closest(
        '[data-action]'
      )

    if (!action) {
      return
    }

    const actionName =
      action.dataset.action

    if (
      actionName === 'back'
    ) {
      root.onclick = null
      root.onchange = null

      onBack()
      return
    }

    if (
      actionName === 'reset'
    ) {
      const confirmed =
        window.confirm(
          'Réinitialiser uniquement cette séance ?'
        )

      if (confirmed) {
        resetCurrentDay()
      }

      return
    }

    if (
      actionName === 'week'
    ) {
      const weekId =
        action.dataset.weekId

      const week =
        findWeek(
          program,
          weekId
        )

      if (!week) {
        return
      }

      state.selectedWeekId =
        week.id

      state.selectedDayId =
        week.days[0]?.id ??
        null

      persist()
      render()

      return
    }

    if (
      actionName === 'day'
    ) {
      const {
        week,
      } =
        normalizeSelection()

      const dayId =
        action.dataset.dayId

      const day =
        findDay(
          week,
          dayId
        )

      if (!day) {
        return
      }

      state.selectedDayId =
        day.id

      persist()
      render()

      return
    }

    const setId =
      action.dataset.setId

    if (!setId) {
      return
    }

    const found =
      findSourceSet(
        program,
        setId
      )

    if (!found) {
      return
    }

    const {
      exercise,
      sourceSet,
    } =
      found

    const set =
      getSetState(
        state,
        sourceSet
      )

    if (
      actionName ===
      'toggle'
    ) {
      if (
        set.status ===
        'done'
      ) {
        updateSet(
          sourceSet,
          {
            status:
              'pending',
          }
        )

        return
      }

      updateSet(
        sourceSet,
        {
          status:
            'done',

          rpe:
            exercise.usesRpe
              ? set.rpe
              : '',
        }
      )
    }
  }

  root.onchange = (
    event
  ) => {
    const input =
      event.target

    const actionName =
      input.dataset.action

    const setId =
      input.dataset.setId

    if (
      !actionName ||
      !setId
    ) {
      return
    }

    const found =
      findSourceSet(
        program,
        setId
      )

    if (!found) {
      return
    }

    const {
      exercise,
      sourceSet,
    } =
      found

    if (
      actionName ===
      'load'
    ) {
      const load =
        Number(
          input.value
        )

      updateSet(
        sourceSet,
        {
          load:
            Number.isFinite(load)
              ? load
              : 0,
        }
      )

      return
    }

    if (
      actionName ===
      'rpe'
    ) {
      if (
        !exercise.usesRpe
      ) {
        return
      }

      if (
        input.value ===
        'failed'
      ) {
        updateSet(
          sourceSet,
          {
            rpe: '',
            status:
              'failed',
          }
        )

        return
      }

      if (
        input.value === ''
      ) {
        updateSet(
          sourceSet,
          {
            rpe: '',
            status:
              'pending',
          }
        )

        return
      }

      updateSet(
        sourceSet,
        {
          rpe:
            input.value,

          status:
            'done',
        }
      )
    }
  }

  render()
}