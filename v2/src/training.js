function getBlocks(program) {
  if (!program) {
    return []
  }

  if (
    Array.isArray(program.blocks) &&
    program.blocks.length
  ) {
    return program.blocks
  }

  if (Array.isArray(program.weeks)) {
    return [
      {
        id: 'default',
        label: 'Programme',
        kicker: '',
        weeks: program.weeks,
      },
    ]
  }

  return []
}

function createBlockSelectionKey(program) {
  return `ga-v2-selected-block:${program.id}`
}

function createStorageKey(program, block) {
  return `ga-v2-training-progress:${program.id}:${block.id}`
}

function createDefaultState(block) {
  return {
    selectedWeekId:
      block.weeks[0]?.id ?? null,

    selectedDayId:
      block.weeks[0]?.days[0]?.id ?? null,

    sets: {},
  }
}

function loadState(
  storageKey,
  block
) {
  try {
    const saved =
      localStorage.getItem(
        storageKey
      )

    if (!saved) {
      return createDefaultState(
        block
      )
    }

    const parsed =
      JSON.parse(saved)

    return {
      ...createDefaultState(
        block
      ),
      ...parsed,
      sets:
        parsed.sets || {},
    }
  } catch {
    return createDefaultState(
      block
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
  block,
  weekId
) {
  return block.weeks.find(
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
        sourceSet.load ?? '',
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
      '',
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
  block,
  setId
) {
  for (
    const week
    of block.weeks
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

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function formatReps(value) {
  const text =
    String(value ?? '').trim()

  if (!text) {
    return '—'
  }

  if (
    /^\d+(?:[.,]\d+)?(?:\s*-\s*\d+(?:[.,]\d+)?)?$/.test(text)
  ) {
    return `${text} reps`
  }

  return text
}

function formatLoadRange(value) {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return ''
  }

  return String(value)
    .replace(/\s*-\s*/g, ' – ')
    .trim()
}

export function mountTraining(
  root,
  onBack,
  program
) {
  const blocks =
    getBlocks(program)

  if (!blocks.length) {
    root.innerHTML = `
      <main class="training-page">
        <p>
          Programme introuvable.
        </p>
      </main>
    `
    return
  }

  const BLOCK_SELECTION_KEY =
    createBlockSelectionKey(
      program
    )

  let selectedBlockId =
    localStorage.getItem(
      BLOCK_SELECTION_KEY
    ) ||
    program.defaultBlockId ||
    blocks[0].id

  let block =
    blocks.find(
      (item) =>
        item.id ===
        selectedBlockId
    ) ||
    blocks[0]

  selectedBlockId =
    block.id

  let STORAGE_KEY =
    createStorageKey(
      program,
      block
    )

  let state =
    loadState(
      STORAGE_KEY,
      block
    )

  function persist() {
    saveState(
      STORAGE_KEY,
      state
    )
  }

  function selectBlock(
    blockId
  ) {
    const nextBlock =
      blocks.find(
        (item) =>
          item.id === blockId
      )

    if (!nextBlock) {
      return
    }

    selectedBlockId =
      nextBlock.id

    block =
      nextBlock

    localStorage.setItem(
      BLOCK_SELECTION_KEY,
      selectedBlockId
    )

    STORAGE_KEY =
      createStorageKey(
        program,
        block
      )

    state =
      loadState(
        STORAGE_KEY,
        block
      )

    normalizeSelection()
    render()
  }

  function normalizeSelection() {
    let week =
      findWeek(
        block,
        state.selectedWeekId
      )

    if (!week) {
      week =
        block.weeks[0]

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

  function saveLoadWithoutRender(
    sourceSet,
    value
  ) {
    const current =
      getSetState(
        state,
        sourceSet
      )

    state.sets[sourceSet.id] = {
      ...current,
      load:
        String(value ?? ''),
    }

    persist()
  }

  function resetCurrentDay() {
    const { day } =
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

  function renderBlocks() {
    if (blocks.length <= 1) {
      return ''
    }

    return `
      <div
        class="week-tabs"
        style="--tab-count:${blocks.length}"
      >
        ${blocks.map(
          (item) => {
            const active =
              item.id === block.id

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
                data-action="block"
                data-block-id="${escapeHtml(item.id)}"
              >
                <strong>
                  ${escapeHtml(item.label)}
                </strong>

                <span>
                  ${escapeHtml(item.kicker || '')}
                </span>
              </button>
            `
          }
        ).join('')}
      </div>
    `
  }

  function renderWeeks(
    currentWeek
  ) {
    return `
      <div
        class="week-tabs"
        style="--tab-count:${Math.max(block.weeks.length, 1)}"
      >
        ${block.weeks.map(
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
                data-week-id="${escapeHtml(week.id)}"
              >
                <strong>
                  ${escapeHtml(week.label)}
                </strong>

                <span>
                  ${progress.completed}/${progress.total}
                </span>
              </button>
            `
          }
        ).join('')}
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
      <div
        class="day-tabs-v2"
        style="--tab-count:${Math.max(currentWeek.days.length, 1)}"
      >
        ${currentWeek.days.map(
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
                data-day-id="${escapeHtml(day.id)}"
              >
                <strong>
                  ${
                    day.emoji
                      ? `${escapeHtml(day.emoji)} `
                      : ''
                  }${escapeHtml(day.name)}
                </strong>

                <span>
                  ${progress.completed}/${progress.total}
                </span>
              </button>
            `
          }
        ).join('')}
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
        data-set-id="${escapeHtml(sourceSet.id)}"
        aria-label="RPE série ${index + 1}"
      >
        <option value="">
          RPE
        </option>

        ${values.map(
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
        ).join('')}

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

    const meta = []

    if (
      sourceSet.percent !== null &&
      sourceSet.percent !== undefined &&
      sourceSet.percent !== ''
    ) {
      meta.push(
        `${sourceSet.percent} %`
      )
    }

    const loadRange =
      formatLoadRange(
        sourceSet.loadRange
      )

    if (loadRange) {
      meta.push(
        `${loadRange} kg`
      )
    }

    if (sourceSet.intensity) {
      meta.push(
        String(
          sourceSet.intensity
        )
      )
    }

    const placeholder =
      loadRange || 'kg'

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
        data-set-id="${escapeHtml(sourceSet.id)}"
      >
        <div class="set-number">
          Série ${index + 1}
        </div>

        <div class="set-prescription">
          <strong>
            ${escapeHtml(
              formatReps(
                sourceSet.reps
              )
            )}
          </strong>

          <span>
            ${
              meta.length
                ? escapeHtml(
                    meta.join(' · ')
                  )
                : 'Charge libre'
            }
          </span>
        </div>

        <input
          class="set-load"
          type="text"
          inputmode="decimal"
          autocomplete="off"
          value="${escapeHtml(set.load)}"
          placeholder="${escapeHtml(placeholder)}"
          data-action="load"
          data-set-id="${escapeHtml(sourceSet.id)}"
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
          data-set-id="${escapeHtml(sourceSet.id)}"
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

    const displayName =
      exercise.variant
        ? `${exercise.name} · ${exercise.variant}`
        : exercise.name

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
              ${escapeHtml(exercise.type)}
            </span>

            <h2>
              ${escapeHtml(displayName)}
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
          ${exercise.sets.map(
            (sourceSet, index) =>
              renderSet(
                exercise,
                sourceSet,
                index
              )
          ).join('')}
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
            ← Athlètes
          </button>

          <div>
            <span
              class="training-kicker"
            >
              GA COACHING · V2
            </span>

            <h1>
              ${escapeHtml(
                program.athlete.name
              )}
            </h1>
          </div>

          <button
            class="reset-button"
            data-action="reset"
          >
            Réinitialiser
          </button>
        </header>

        ${renderBlocks()}

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
            ${escapeHtml(block.label)}
            ·
            ${escapeHtml(week.label)}
            ·
            ${escapeHtml(day.name)}
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
          ${day.exercises.map(
            (exercise) =>
              renderExercise(
                exercise
              )
          ).join('')}
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
      root.oninput = null
      onBack()
      return
    }

    if (actionName === 'reset') {
      const confirmed =
        window.confirm(
          'Réinitialiser uniquement cette séance ?'
        )

      if (confirmed) {
        resetCurrentDay()
      }
      return
    }

    if (actionName === 'block') {
      selectBlock(
        action.dataset.blockId
      )
      return
    }

    if (actionName === 'week') {
      const week =
        findWeek(
          block,
          action.dataset.weekId
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

    if (actionName === 'day') {
      const { week } =
        normalizeSelection()

      const day =
        findDay(
          week,
          action.dataset.dayId
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
        block,
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

    if (actionName === 'toggle') {
      if (
        set.status === 'done'
      ) {
        updateSet(
          sourceSet,
          {
            status: 'pending',
          }
        )
        return
      }

      updateSet(
        sourceSet,
        {
          status: 'done',
          rpe:
            exercise.usesRpe
              ? set.rpe
              : '',
        }
      )
    }
  }

  root.oninput = (event) => {
    const input =
      event.target

    if (
      input.dataset.action !==
      'load'
    ) {
      return
    }

    const found =
      findSourceSet(
        block,
        input.dataset.setId
      )

    if (!found) {
      return
    }

    saveLoadWithoutRender(
      found.sourceSet,
      input.value
    )
  }

  root.onchange = (event) => {
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
        block,
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

    if (actionName === 'load') {
      saveLoadWithoutRender(
        sourceSet,
        input.value
      )
      return
    }

    if (actionName === 'rpe') {
      if (!exercise.usesRpe) {
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
            status: 'failed',
          }
        )
        return
      }

      if (input.value === '') {
        updateSet(
          sourceSet,
          {
            rpe: '',
            status: 'pending',
          }
        )
        return
      }

      updateSet(
        sourceSet,
        {
          rpe: input.value,
          status: 'done',
        }
      )
    }
  }

  render()
}
