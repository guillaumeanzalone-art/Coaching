import { supabase } from './supabase.js'
import { getProgramForAthlete } from './program.js'

const STYLE_ID =
  'ga-program-editor-v1-style'

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function clone(value) {
  return JSON.parse(
    JSON.stringify(
      value
    )
  )
}

function slug(value) {
  return String(value || 'item')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'item'
}

function uid(prefix) {
  const rand =
    Math.random()
      .toString(36)
      .slice(2, 8)

  return (
    slug(prefix) +
    '-' +
    Date.now()
      .toString(36) +
    '-' +
    rand
  )
}

function n(value) {
  const parsed =
    Number(value)

  return Number.isFinite(parsed)
    ? parsed
    : null
}

function installStyles() {
  if (
    document.getElementById(
      STYLE_ID
    )
  ) {
    return
  }

  const style =
    document.createElement(
      'style'
    )

  style.id =
    STYLE_ID

  style.textContent = `
.program-editor-shell {
  width: min(1180px, calc(100% - 28px));
  margin: 0 auto;
  padding: 18px 0 48px;
}

.program-editor-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  margin-bottom: 18px;
}

.program-editor-title {
  margin: 0;
  color: #f5f7fb;
  font-size: clamp(24px, 4vw, 38px);
  line-height: 1;
}

.program-editor-kicker {
  display: block;
  margin-bottom: 5px;
  color: #f0c34a;
  font-size: 11px;
  font-weight: 900;
  letter-spacing: .12em;
  text-transform: uppercase;
}

.program-editor-back,
.program-editor-button,
.program-editor-mini {
  border: 1px solid rgba(245, 198, 74, .26);
  border-radius: 12px;
  color: #edf1f8;
  background: rgba(15, 21, 33, .92);
  font: inherit;
  font-weight: 800;
  cursor: pointer;
}

.program-editor-back {
  padding: 10px 14px;
}

.program-editor-layout {
  display: grid;
  grid-template-columns: minmax(240px, 310px) minmax(0, 1fr);
  gap: 18px;
  align-items: start;
}

.program-editor-sidebar,
.program-editor-card {
  border: 1px solid rgba(130, 145, 170, .15);
  border-radius: 18px;
  background:
    radial-gradient(
      circle at 100% 0,
      rgba(89, 40, 79, .18),
      transparent 38%
    ),
    rgba(10, 15, 25, .96);
  box-shadow:
    0 18px 42px rgba(0, 0, 0, .22);
}

.program-editor-sidebar {
  position: sticky;
  top: 14px;
  padding: 15px;
}

.program-editor-sidebar label,
.program-editor-field label {
  display: block;
  margin-bottom: 6px;
  color: #9ba6ba;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: .06em;
  text-transform: uppercase;
}

.program-editor-select,
.program-editor-input,
.program-editor-textarea {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid rgba(137, 151, 176, .18);
  border-radius: 11px;
  outline: none;
  color: #f2f5fa;
  background: #101725;
  font: inherit;
}

.program-editor-select,
.program-editor-input {
  min-height: 42px;
  padding: 9px 11px;
}

.program-editor-textarea {
  min-height: 260px;
  resize: vertical;
  padding: 12px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  line-height: 1.5;
}

.program-editor-select:focus,
.program-editor-input:focus,
.program-editor-textarea:focus {
  border-color: rgba(245, 198, 74, .58);
  box-shadow: 0 0 0 3px rgba(245, 198, 74, .08);
}

.program-editor-source {
  margin-top: 12px;
  padding: 11px;
  border-radius: 12px;
  color: #abb5c8;
  background: rgba(255, 255, 255, .025);
  font-size: 12px;
  line-height: 1.45;
}

.program-editor-source strong {
  color: #f4c956;
}

.program-editor-actions {
  display: grid;
  gap: 8px;
  margin-top: 14px;
}

.program-editor-button {
  min-height: 44px;
  padding: 10px 14px;
}

.program-editor-button.primary {
  border-color: rgba(255, 225, 137, .7);
  color: #17120a;
  background: linear-gradient(180deg, #f8d96d, #dda52e);
}

.program-editor-button.danger {
  border-color: rgba(203, 82, 92, .38);
  color: #ffd9dd;
  background: rgba(82, 29, 38, .5);
}

.program-editor-main {
  display: grid;
  gap: 14px;
}

.program-editor-card {
  padding: 16px;
}

.program-editor-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.program-editor-card h3,
.program-editor-card h4 {
  margin: 0;
  color: #f3f5fa;
}

.program-editor-card h3 {
  font-size: 18px;
}

.program-editor-card h4 {
  font-size: 15px;
}

.program-editor-rowhead {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.program-editor-rowactions {
  display: flex;
  gap: 7px;
  flex-wrap: wrap;
}

.program-editor-mini {
  min-height: 34px;
  padding: 6px 10px;
  font-size: 12px;
}

.program-editor-mini.gold {
  color: #17120a;
  background: #e7b33b;
}

.program-editor-mini.red {
  border-color: rgba(208, 80, 92, .34);
  color: #ffb8bf;
}

.program-editor-week {
  border: 1px solid rgba(123, 138, 162, .14);
  border-radius: 15px;
  background: rgba(14, 20, 32, .74);
  overflow: hidden;
}

.program-editor-week + .program-editor-week {
  margin-top: 12px;
}

.program-editor-week > summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 13px 14px;
  cursor: pointer;
  color: #f0f3f8;
  font-weight: 900;
  list-style: none;
}

.program-editor-week > summary::-webkit-details-marker {
  display: none;
}

.program-editor-week-body {
  padding: 0 13px 13px;
}

.program-editor-day {
  margin-top: 10px;
  padding: 13px;
  border: 1px solid rgba(120, 136, 161, .13);
  border-radius: 14px;
  background: rgba(7, 12, 20, .65);
}

.program-editor-exercise {
  margin-top: 10px;
  padding: 12px;
  border: 1px solid rgba(245, 198, 74, .12);
  border-radius: 13px;
  background: rgba(16, 23, 36, .8);
}

.program-editor-set {
  display: grid;
  grid-template-columns: 1fr 1fr 1.3fr 1fr auto;
  gap: 7px;
  align-items: end;
  margin-top: 8px;
}

.program-editor-set .program-editor-input {
  min-height: 38px;
  padding: 7px 9px;
}

.program-editor-empty {
  padding: 18px;
  border: 1px dashed rgba(133, 148, 172, .2);
  border-radius: 14px;
  color: #8e99ad;
  text-align: center;
}

.program-editor-status {
  min-height: 20px;
  margin-top: 8px;
  color: #9eacc2;
  font-size: 12px;
}

.program-editor-status.ok {
  color: #78d49a;
}

.program-editor-status.error {
  color: #ff8791;
}

.program-editor-advanced {
  margin-top: 14px;
}

.program-editor-advanced summary {
  cursor: pointer;
  color: #a9b4c6;
  font-weight: 800;
}

.program-editor-help {
  margin: 8px 0 0;
  color: #8490a4;
  font-size: 12px;
  line-height: 1.45;
}

@media (max-width: 860px) {
  .program-editor-layout {
    grid-template-columns: 1fr;
  }

  .program-editor-sidebar {
    position: static;
  }

  .program-editor-grid {
    grid-template-columns: 1fr;
  }

  .program-editor-set {
    grid-template-columns: 1fr 1fr;
  }
}
`

  document.head.appendChild(
    style
  )
}

function ensureProgramShape(
  program,
  athlete
) {
  const value =
    clone(
      program ||
      {}
    )

  value.id =
    value.id ||
    `ga-${athlete.id}-cloud`

  value.athlete =
    value.athlete ||
    {
      id:
        athlete.id,
      name:
        athlete.name,
    }

  value.programKey =
    value.programKey ||
    athlete.programKey ||
    athlete.id

  if (
    !Array.isArray(
      value.blocks
    )
  ) {
    value.blocks =
      []
  }

  if (!value.blocks.length) {
    const blockId =
      uid(
        `${athlete.id}-block`
      )

    value.blocks.push(
      {
        id:
          blockId,
        label:
          'Nouveau bloc',
        kicker:
          '',
        weeks:
          [],
      }
    )

    value.defaultBlockId =
      blockId
  }

  value.defaultBlockId =
    value.defaultBlockId ||
    value.blocks[0]?.id ||
    ''

  return value
}

function defaultSet(
  exerciseId
) {
  return {
    id:
      uid(
        `${exerciseId}-set`
      ),
    reps:
      '5',
    percent:
      null,
    loadRange:
      '',
    intensity:
      null,
    source:
      null,
    load:
      '',
    rpe:
      '',
    status:
      'pending',
  }
}

function defaultExercise(
  dayId
) {
  const id =
    uid(
      `${dayId}-exercise`
    )

  return {
    id,
    name:
      'Nouvel exercice',
    type:
      'OTHER',
    variant:
      '',
    usesRpe:
      true,
    sets:
      [
        defaultSet(
          id
        ),
      ],
  }
}

function defaultDay(
  weekId
) {
  const id =
    uid(
      `${weekId}-day`
    )

  return {
    id,
    name:
      'Nouvelle séance',
    emoji:
      '🏋️',
    exercises:
      [
        defaultExercise(
          id
        ),
      ],
  }
}

function defaultWeek(
  blockId,
  number
) {
  const id =
    uid(
      `${blockId}-week-${number}`
    )

  return {
    id,
    number,
    label:
      `S${number}`,
    days:
      [
        defaultDay(
          id
        ),
      ],
  }
}

async function loadCloudMeta(
  athleteSlug
) {
  const {
    data,
    error,
  } =
    await supabase
      .from(
        'program_versions_v2'
      )
      .select(
        'id,program_key,version,status,current_week,program_json,published_at,updated_at'
      )
      .eq(
        'athlete_slug',
        athleteSlug
      )
      .order(
        'version',
        {
          ascending:
            false,
        }
      )
      .limit(
        20
      )

  if (error) {
    throw error
  }

  const rows =
    Array.isArray(
      data
    )
      ? data
      : []

  return {
    rows,
    active:
      rows.find(
        row =>
          row.status ===
          'active'
      ) ||
      null,
    draft:
      rows.find(
        row =>
          row.status ===
          'draft'
      ) ||
      null,
  }
}

export function mountProgramEditor(
  root,
  options = {}
) {
  installStyles()

  const athletes =
    Array.isArray(
      options.athletes
    )
      ? options.athletes
      : []

  const onBack =
    typeof options.onBack ===
      'function'
      ? options.onBack
      : () => {}

  const state = {
    athleteId:
      athletes[0]?.id ||
      '',
    athlete:
      athletes[0] ||
      null,
    program:
      null,
    cloudMeta:
      null,
    blockIndex:
      0,
    status:
      '',
    statusKind:
      '',
    busy:
      false,
  }

  function selectedBlock() {
    return (
      state.program
        ?.blocks?.[
          state.blockIndex
        ] ||
      null
    )
  }

  function setStatus(
    text,
    kind = ''
  ) {
    state.status =
      text || ''

    state.statusKind =
      kind

    const el =
      root.querySelector(
        '[data-program-editor-status]'
      )

    if (el) {
      el.textContent =
        state.status

      el.className =
        `program-editor-status ${kind}`
    }
  }

  async function loadAthlete(
    athleteId
  ) {
    const athlete =
      athletes.find(
        item =>
          item.id ===
          athleteId
      )

    if (!athlete) {
      return
    }

    state.athleteId =
      athlete.id

    state.athlete =
      athlete

    state.busy =
      true

    render()

    try {
      const athleteSlug =
        athlete.cloudSlug ||
        athlete.slug ||
        athlete.id

      const [
        program,
        cloudMeta,
      ] =
        await Promise.all(
          [
            getProgramForAthlete(
              athlete.id
            ),
            loadCloudMeta(
              athleteSlug
            ),
          ]
        )

      state.cloudMeta =
        cloudMeta

      state.program =
        ensureProgramShape(
          cloudMeta.draft
            ?.program_json ||
          cloudMeta.active
            ?.program_json ||
          program,
          athlete
        )

      const declaredCurrentWeek =
        Number(
          cloudMeta.draft
            ?.current_week ??
          cloudMeta.active
            ?.current_week ??
          state.program
            ?.currentWeek ??
          1
        )

      state.program.currentWeek =
        Number.isFinite(
          declaredCurrentWeek
        )
          ? Math.max(
              1,
              Math.round(
                declaredCurrentWeek
              )
            )
          : 1

      state.blockIndex =
        Math.max(
          0,
          state.program.blocks.length -
          1
        )

      state.status =
        ''

      state.statusKind =
        ''
    } catch (
      error
    ) {
      console.error(
        error
      )

      state.program =
        ensureProgramShape(
          null,
          athlete
        )

      state.cloudMeta =
        {
          rows: [],
          active: null,
          draft: null,
        }

      state.status =
        'Chargement cloud impossible : édition locale de secours.'

      state.statusKind =
        'error'
    } finally {
      state.busy =
        false

      render()
    }
  }

  function mutateField(
    path,
    value
  ) {
    if (!state.program) {
      return
    }

    let target =
      state.program

    for (
      let index = 0;
      index <
      path.length - 1;
      index++
    ) {
      target =
        target[
          path[index]
        ]
    }

    target[
      path[
        path.length - 1
      ]
    ] =
      value
  }

  function renderSet(
    set,
    weekIndex,
    dayIndex,
    exerciseIndex,
    setIndex
  ) {
    return `
      <div class="program-editor-set">
        <div class="program-editor-field">
          <label>Reps</label>
          <input
            class="program-editor-input"
            data-program-path="${weekIndex}.${dayIndex}.${exerciseIndex}.${setIndex}.reps"
            value="${esc(set.reps)}"
          >
        </div>

        <div class="program-editor-field">
          <label>%</label>
          <input
            class="program-editor-input"
            type="number"
            step="0.5"
            data-program-path="${weekIndex}.${dayIndex}.${exerciseIndex}.${setIndex}.percent"
            value="${set.percent ?? ''}"
          >
        </div>

        <div class="program-editor-field">
          <label>Charge / fourchette</label>
          <input
            class="program-editor-input"
            data-program-path="${weekIndex}.${dayIndex}.${exerciseIndex}.${setIndex}.loadRange"
            value="${esc(set.loadRange)}"
          >
        </div>

        <div class="program-editor-field">
          <label>Intensité</label>
          <input
            class="program-editor-input"
            data-program-path="${weekIndex}.${dayIndex}.${exerciseIndex}.${setIndex}.intensity"
            value="${esc(set.intensity ?? '')}"
          >
        </div>

        <button
          class="program-editor-mini red"
          type="button"
          data-program-action="remove-set"
          data-week-index="${weekIndex}"
          data-day-index="${dayIndex}"
          data-exercise-index="${exerciseIndex}"
          data-set-index="${setIndex}"
        >
          Supprimer
        </button>
      </div>
    `
  }

  function renderExercise(
    exercise,
    weekIndex,
    dayIndex,
    exerciseIndex
  ) {
    const sets =
      Array.isArray(
        exercise.sets
      )
        ? exercise.sets
        : []

    return `
      <div class="program-editor-exercise">
        <div class="program-editor-rowhead">
          <h4>
            ${esc(exercise.name || 'Exercice')}
          </h4>

          <div class="program-editor-rowactions">
            <button
              class="program-editor-mini"
              type="button"
              data-program-action="add-set"
              data-week-index="${weekIndex}"
              data-day-index="${dayIndex}"
              data-exercise-index="${exerciseIndex}"
            >
              + Série
            </button>

            <button
              class="program-editor-mini red"
              type="button"
              data-program-action="remove-exercise"
              data-week-index="${weekIndex}"
              data-day-index="${dayIndex}"
              data-exercise-index="${exerciseIndex}"
            >
              Supprimer exercice
            </button>
          </div>
        </div>

        <div class="program-editor-grid">
          <div class="program-editor-field">
            <label>Nom</label>
            <input
              class="program-editor-input"
              data-program-exercise-field="name"
              data-week-index="${weekIndex}"
              data-day-index="${dayIndex}"
              data-exercise-index="${exerciseIndex}"
              value="${esc(exercise.name)}"
            >
          </div>

          <div class="program-editor-field">
            <label>Type</label>
            <select
              class="program-editor-select"
              data-program-exercise-field="type"
              data-week-index="${weekIndex}"
              data-day-index="${dayIndex}"
              data-exercise-index="${exerciseIndex}"
            >
              ${[
                'SQ',
                'BN',
                'DL',
                'ACCESSORY',
                'OTHER',
              ].map(
                type => `
                  <option
                    value="${type}"
                    ${exercise.type === type ? 'selected' : ''}
                  >
                    ${type}
                  </option>
                `
              ).join('')}
            </select>
          </div>

          <div class="program-editor-field">
            <label>Variante</label>
            <input
              class="program-editor-input"
              data-program-exercise-field="variant"
              data-week-index="${weekIndex}"
              data-day-index="${dayIndex}"
              data-exercise-index="${exerciseIndex}"
              value="${esc(exercise.variant)}"
            >
          </div>
        </div>

        ${
          sets.length
            ? sets.map(
                (set, setIndex) =>
                  renderSet(
                    set,
                    weekIndex,
                    dayIndex,
                    exerciseIndex,
                    setIndex
                  )
              ).join('')
            : `
              <div class="program-editor-empty">
                Aucune série.
              </div>
            `
        }
      </div>
    `
  }

  function renderDay(
    day,
    weekIndex,
    dayIndex
  ) {
    const exercises =
      Array.isArray(
        day.exercises
      )
        ? day.exercises
        : []

    return `
      <div class="program-editor-day">
        <div class="program-editor-rowhead">
          <h4>
            ${esc(day.emoji || '🏋️')}
            ${esc(day.name || 'Séance')}
          </h4>

          <div class="program-editor-rowactions">
            <button
              class="program-editor-mini"
              type="button"
              data-program-action="add-exercise"
              data-week-index="${weekIndex}"
              data-day-index="${dayIndex}"
            >
              + Exercice
            </button>

            <button
              class="program-editor-mini red"
              type="button"
              data-program-action="remove-day"
              data-week-index="${weekIndex}"
              data-day-index="${dayIndex}"
            >
              Supprimer séance
            </button>
          </div>
        </div>

        <div class="program-editor-grid">
          <div class="program-editor-field">
            <label>Nom séance</label>
            <input
              class="program-editor-input"
              data-program-day-field="name"
              data-week-index="${weekIndex}"
              data-day-index="${dayIndex}"
              value="${esc(day.name)}"
            >
          </div>

          <div class="program-editor-field">
            <label>Emoji</label>
            <input
              class="program-editor-input"
              data-program-day-field="emoji"
              data-week-index="${weekIndex}"
              data-day-index="${dayIndex}"
              value="${esc(day.emoji)}"
            >
          </div>
        </div>

        ${
          exercises.length
            ? exercises.map(
                (
                  exercise,
                  exerciseIndex
                ) =>
                  renderExercise(
                    exercise,
                    weekIndex,
                    dayIndex,
                    exerciseIndex
                  )
              ).join('')
            : `
              <div class="program-editor-empty">
                Aucun exercice.
              </div>
            `
        }
      </div>
    `
  }

  function renderWeek(
    week,
    weekIndex
  ) {
    const days =
      Array.isArray(
        week.days
      )
        ? week.days
        : []

    return `
      <details
        class="program-editor-week"
        ${weekIndex === 0 ? 'open' : ''}
      >
        <summary>
          <span>
            Semaine ${week.number ?? weekIndex + 1}
            · ${esc(week.label || '')}
          </span>

          <span>
            ${days.length} séance(s)
          </span>
        </summary>

        <div class="program-editor-week-body">
          <div class="program-editor-grid">
            <div class="program-editor-field">
              <label>Numéro semaine</label>
              <input
                class="program-editor-input"
                type="number"
                min="1"
                data-program-week-field="number"
                data-week-index="${weekIndex}"
                value="${week.number ?? weekIndex + 1}"
              >
            </div>

            <div class="program-editor-field">
              <label>Libellé</label>
              <input
                class="program-editor-input"
                data-program-week-field="label"
                data-week-index="${weekIndex}"
                value="${esc(week.label)}"
              >
            </div>
          </div>

          <div class="program-editor-rowactions" style="margin-top:10px">
            <button
              class="program-editor-mini"
              type="button"
              data-program-action="add-day"
              data-week-index="${weekIndex}"
            >
              + Séance
            </button>

            <button
              class="program-editor-mini red"
              type="button"
              data-program-action="remove-week"
              data-week-index="${weekIndex}"
            >
              Supprimer semaine
            </button>
          </div>

          ${
            days.length
              ? days.map(
                  (
                    day,
                    dayIndex
                  ) =>
                    renderDay(
                      day,
                      weekIndex,
                      dayIndex
                    )
                ).join('')
              : `
                <div class="program-editor-empty">
                  Aucune séance.
                </div>
              `
          }
        </div>
      </details>
    `
  }

  function render() {
    const athlete =
      state.athlete

    const program =
      state.program

    const block =
      selectedBlock()

    const weeks =
      Array.isArray(
        block?.weeks
      )
        ? block.weeks
        : []

    const active =
      state.cloudMeta?.active

    const draft =
      state.cloudMeta?.draft

    root.innerHTML = `
      <main class="program-editor-shell">
        <header class="program-editor-topbar">
          <div>
            <span class="program-editor-kicker">
              COACH · PROGRAM CLOUD
            </span>

            <h1 class="program-editor-title">
              Éditeur de programmation
            </h1>
          </div>

          <button
            class="program-editor-back"
            type="button"
            data-program-action="back"
          >
            ← Accueil
          </button>
        </header>

        <div class="program-editor-layout">
          <aside class="program-editor-sidebar">
            <label>
              Athlète
            </label>

            <select
              class="program-editor-select"
              data-program-athlete
            >
              ${athletes.map(
                item => `
                  <option
                    value="${esc(item.id)}"
                    ${item.id === state.athleteId ? 'selected' : ''}
                  >
                    ${esc(item.name)}
                  </option>
                `
              ).join('')}
            </select>

            ${
              state.busy
                ? `
                  <div class="program-editor-source">
                    Chargement…
                  </div>
                `
                : athlete && program
                  ? `
                    <div class="program-editor-source">
                      <strong>
                        ${esc(athlete.name)}
                      </strong>
                      <br>
                      Version active :
                      ${active?.version ?? '—'}
                      <br>
                      Brouillon récent :
                      ${draft?.version ?? '—'}
                      <br>
                      Program key :
                      ${esc(program.programKey || athlete.programKey || athlete.id)}
                    </div>

                    <div class="program-editor-field" style="margin-top:12px">
                      <label>
                        Bloc édité
                      </label>

                      <select
                        class="program-editor-select"
                        data-program-block
                      >
                        ${program.blocks.map(
                          (item, index) => `
                            <option
                              value="${index}"
                              ${index === state.blockIndex ? 'selected' : ''}
                            >
                              Bloc ${index + 1}
                              · ${esc(item.label || 'Sans titre')}
                            </option>
                          `
                        ).join('')}
                      </select>
                    </div>

                    <div class="program-editor-actions">
                      <button
                        class="program-editor-button"
                        type="button"
                        data-program-action="add-block"
                      >
                        + Nouveau bloc
                      </button>

                      <button
                        class="program-editor-button"
                        type="button"
                        data-program-action="save-draft"
                      >
                        Enregistrer brouillon
                      </button>

                      <button
                        class="program-editor-button primary"
                        type="button"
                        data-program-action="publish"
                      >
                        Publier maintenant
                      </button>
                    </div>

                    <div
                      class="program-editor-status ${state.statusKind}"
                      data-program-editor-status
                    >
                      ${esc(state.status)}
                    </div>
                  `
                  : ''
            }
          </aside>

          <section class="program-editor-main">
            ${
              state.busy
                ? `
                  <div class="program-editor-card">
                    Chargement de la programmation…
                  </div>
                `
                : program && block
                  ? `
                    <div class="program-editor-card">
                      <div class="program-editor-rowhead">
                        <h3>
                          Paramètres du programme
                        </h3>

                        <div class="program-editor-rowactions">
                          <button
                            class="program-editor-mini gold"
                            type="button"
                            data-program-action="add-week"
                          >
                            + Semaine
                          </button>
                        </div>
                      </div>

                      <div class="program-editor-grid">
                        <div class="program-editor-field">
                          <label>
                            Nom du bloc
                          </label>

                          <input
                            class="program-editor-input"
                            data-program-top-field="block-label"
                            value="${esc(block.label || '')}"
                          >
                        </div>

                        <div class="program-editor-field">
                          <label>
                            Semaine actuelle
                          </label>

                          <input
                            class="program-editor-input"
                            type="number"
                            min="1"
                            data-program-top-field="current-week"
                            value="${program.currentWeek ?? 1}"
                          >
                        </div>

                        <div class="program-editor-field">
                          <label>
                            Nombre de semaines
                          </label>

                          <input
                            class="program-editor-input"
                            value="${weeks.length}"
                            disabled
                          >
                        </div>
                      </div>

                      <p class="program-editor-help">
                        Modifier ici change uniquement le brouillon en mémoire.
                        Rien n'arrive chez l'athlète avant « Publier maintenant ».
                      </p>
                    </div>

                    <div class="program-editor-card">
                      <div class="program-editor-rowhead">
                        <h3>
                          Semaines · séances · exercices
                        </h3>
                      </div>

                      ${
                        weeks.length
                          ? weeks.map(
                              (
                                week,
                                weekIndex
                              ) =>
                                renderWeek(
                                  week,
                                  weekIndex
                                )
                            ).join('')
                          : `
                            <div class="program-editor-empty">
                              Aucune semaine dans ce bloc.
                            </div>
                          `
                      }
                    </div>

                    <details class="program-editor-card program-editor-advanced">
                      <summary>
                        Mode JSON avancé
                      </summary>

                      <p class="program-editor-help">
                        Utile uniquement pour les champs spéciaux non exposés dans l'éditeur visuel.
                      </p>

                      <textarea
                        class="program-editor-textarea"
                        data-program-json
                      >${esc(JSON.stringify(program, null, 2))}</textarea>

                      <div class="program-editor-rowactions" style="margin-top:10px">
                        <button
                          class="program-editor-mini"
                          type="button"
                          data-program-action="apply-json"
                        >
                          Appliquer le JSON
                        </button>
                      </div>
                    </details>
                  `
                  : `
                    <div class="program-editor-card">
                      Aucune programmation chargée.
                    </div>
                  `
            }
          </section>
        </div>
      </main>
    `
  }

  async function save(
    publish
  ) {
    if (
      state.busy ||
      !state.program ||
      !state.athlete
    ) {
      return
    }

    state.busy =
      true

    setStatus(
      publish
        ? 'Publication en cours…'
        : 'Enregistrement du brouillon…'
    )

    try {
      const athleteSlug =
        state.athlete.cloudSlug ||
        state.athlete.slug ||
        state.athlete.id

      const programKey =
        state.program.programKey ||
        state.athlete.programKey ||
        state.athlete.id

      const currentWeek =
        Math.max(
          1,
          Math.round(
            Number(
              state.program.currentWeek ||
              1
            )
          )
        )

      const {
        data,
        error,
      } =
        await supabase.rpc(
          'save_program_version_v2',
          {
            p_athlete_slug:
              athleteSlug,
            p_program_key:
              programKey,
            p_program_json:
              state.program,
            p_current_week:
              currentWeek,
            p_publish:
              Boolean(
                publish
              ),
            p_notes:
              publish
                ? 'Publication depuis l’éditeur Coach V1'
                : 'Brouillon depuis l’éditeur Coach V1',
          }
        )

      if (error) {
        throw error
      }

      state.cloudMeta =
        await loadCloudMeta(
          athleteSlug
        )

      setStatus(
        publish
          ? `Publié avec succès · version ${state.cloudMeta.active?.version ?? ''}`
          : `Brouillon enregistré · version ${state.cloudMeta.draft?.version ?? ''}`,
        'ok'
      )

      return data
    } catch (
      error
    ) {
      console.error(
        error
      )

      setStatus(
        error?.message ||
        'Erreur lors de la sauvegarde.',
        'error'
      )
    } finally {
      state.busy =
        false
    }
  }

  root.onchange =
    async (
      event
    ) => {
      const target =
        event.target

      if (
        target.matches(
          '[data-program-athlete]'
        )
      ) {
        await loadAthlete(
          target.value
        )

        return
      }

      if (
        target.matches(
          '[data-program-block]'
        )
      ) {
        state.blockIndex =
          Number(
            target.value
          ) || 0

        render()
        return
      }

      const weekIndex =
        Number(
          target.dataset
            .weekIndex
        )

      const dayIndex =
        Number(
          target.dataset
            .dayIndex
        )

      const exerciseIndex =
        Number(
          target.dataset
            .exerciseIndex
        )

      const block =
        selectedBlock()

      if (
        target.dataset
          .programTopField ===
        'block-label'
      ) {
        block.label =
          target.value

        return
      }

      if (
        target.dataset
          .programTopField ===
        'current-week'
      ) {
        state.program.currentWeek =
          Math.max(
            1,
            Number(
              target.value
            ) || 1
          )

        return
      }

      if (
        target.dataset
          .programWeekField
      ) {
        const week =
          block.weeks[
            weekIndex
          ]

        if (!week) {
          return
        }

        const field =
          target.dataset
            .programWeekField

        week[field] =
          field === 'number'
            ? Math.max(
                1,
                Number(
                  target.value
                ) || 1
              )
            : target.value

        return
      }

      if (
        target.dataset
          .programDayField
      ) {
        const day =
          block.weeks[
            weekIndex
          ]?.days?.[
            dayIndex
          ]

        if (!day) {
          return
        }

        day[
          target.dataset
            .programDayField
        ] =
          target.value

        return
      }

      if (
        target.dataset
          .programExerciseField
      ) {
        const exercise =
          block.weeks[
            weekIndex
          ]?.days?.[
            dayIndex
          ]?.exercises?.[
            exerciseIndex
          ]

        if (!exercise) {
          return
        }

        exercise[
          target.dataset
            .programExerciseField
        ] =
          target.value

        return
      }

      if (
        target.dataset
          .programPath
      ) {
        const [
          w,
          d,
          e,
          s,
          field,
        ] =
          target.dataset
            .programPath
            .split('.')

        const set =
          block.weeks[
            Number(w)
          ]?.days?.[
            Number(d)
          ]?.exercises?.[
            Number(e)
          ]?.sets?.[
            Number(s)
          ]

        if (!set) {
          return
        }

        set[field] =
          field === 'percent'
            ? n(
                target.value
              )
            : target.value
      }
    }

  root.onclick =
    async (
      event
    ) => {
      const action =
        event.target.closest(
          '[data-program-action]'
        )

      if (!action) {
        return
      }

      const name =
        action.dataset
          .programAction

      if (
        name ===
        'back'
      ) {
        root.onclick =
          null

        root.onchange =
          null

        onBack()
        return
      }

      if (
        !state.program
      ) {
        return
      }

      const block =
        selectedBlock()

      const weekIndex =
        Number(
          action.dataset
            .weekIndex
        )

      const dayIndex =
        Number(
          action.dataset
            .dayIndex
        )

      const exerciseIndex =
        Number(
          action.dataset
            .exerciseIndex
        )

      const setIndex =
        Number(
          action.dataset
            .setIndex
        )

      if (
        name ===
        'add-block'
      ) {
        const blockId =
          uid(
            `${state.athlete.id}-block`
          )

        state.program.blocks.push(
          {
            id:
              blockId,
            label:
              `Bloc ${state.program.blocks.length + 1}`,
            kicker:
              '',
            weeks:
              [],
          }
        )

        state.blockIndex =
          state.program.blocks.length -
          1

        render()
        return
      }

      if (
        name ===
        'add-week'
      ) {
        const number =
          block.weeks.length +
          1

        block.weeks.push(
          defaultWeek(
            block.id ||
            state.athlete.id,
            number
          )
        )

        render()
        return
      }

      if (
        name ===
        'remove-week'
      ) {
        if (
          !window.confirm(
            'Supprimer cette semaine du brouillon ?'
          )
        ) {
          return
        }

        block.weeks.splice(
          weekIndex,
          1
        )

        render()
        return
      }

      if (
        name ===
        'add-day'
      ) {
        const week =
          block.weeks[
            weekIndex
          ]

        week.days =
          Array.isArray(
            week.days
          )
            ? week.days
            : []

        week.days.push(
          defaultDay(
            week.id ||
            `week-${weekIndex + 1}`
          )
        )

        render()
        return
      }

      if (
        name ===
        'remove-day'
      ) {
        if (
          !window.confirm(
            'Supprimer cette séance du brouillon ?'
          )
        ) {
          return
        }

        block.weeks[
          weekIndex
        ].days.splice(
          dayIndex,
          1
        )

        render()
        return
      }

      if (
        name ===
        'add-exercise'
      ) {
        const day =
          block.weeks[
            weekIndex
          ].days[
            dayIndex
          ]

        day.exercises =
          Array.isArray(
            day.exercises
          )
            ? day.exercises
            : []

        day.exercises.push(
          defaultExercise(
            day.id ||
            `day-${dayIndex + 1}`
          )
        )

        render()
        return
      }

      if (
        name ===
        'remove-exercise'
      ) {
        if (
          !window.confirm(
            'Supprimer cet exercice du brouillon ?'
          )
        ) {
          return
        }

        block.weeks[
          weekIndex
        ].days[
          dayIndex
        ].exercises.splice(
          exerciseIndex,
          1
        )

        render()
        return
      }

      if (
        name ===
        'add-set'
      ) {
        const exercise =
          block.weeks[
            weekIndex
          ].days[
            dayIndex
          ].exercises[
            exerciseIndex
          ]

        exercise.sets =
          Array.isArray(
            exercise.sets
          )
            ? exercise.sets
            : []

        exercise.sets.push(
          defaultSet(
            exercise.id ||
            `exercise-${exerciseIndex + 1}`
          )
        )

        render()
        return
      }

      if (
        name ===
        'remove-set'
      ) {
        block.weeks[
          weekIndex
        ].days[
          dayIndex
        ].exercises[
          exerciseIndex
        ].sets.splice(
          setIndex,
          1
        )

        render()
        return
      }

      if (
        name ===
        'apply-json'
      ) {
        const textarea =
          root.querySelector(
            '[data-program-json]'
          )

        try {
          const parsed =
            JSON.parse(
              textarea.value
            )

          state.program =
            ensureProgramShape(
              parsed,
              state.athlete
            )

          state.blockIndex =
            Math.min(
              state.blockIndex,
              state.program.blocks.length -
              1
            )

          state.blockIndex =
            Math.max(
              0,
              state.blockIndex
            )

          state.status =
            'JSON appliqué au brouillon.'

          state.statusKind =
            'ok'

          render()
        } catch (
          error
        ) {
          setStatus(
            'JSON invalide : ' +
            error.message,
            'error'
          )
        }

        return
      }

      if (
        name ===
        'save-draft'
      ) {
        await save(
          false
        )

        render()
        return
      }

      if (
        name ===
        'publish'
      ) {
        const ok =
          window.confirm(
            `Publier cette programmation pour ${state.athlete.name} ?\n\nLa version active actuelle sera archivée.`
          )

        if (!ok) {
          return
        }

        await save(
          true
        )

        render()
      }
    }

  render()

  if (
    state.athleteId
  ) {
    void loadAthlete(
      state.athleteId
    )
  }
}
