import { supabase } from './supabase.js'
import { awardSetXp, flushXpOutbox } from './xp.js'
/* GA V2 SYNC HOTFIX OUTBOX 2026-08-11 */
import {
  buildWorkoutSetPayload,
  flushWorkoutOutbox,
  isPayloadPending,
  loadRemoteWorkoutSets,
  pendingWorkoutSetCount,
  queueWorkoutSet,
  remoteIdentityKey,
  remoteRowToLocalState,
} from './workout-sync.js'

import {
  buildTrainingSessionPayload,
  flushTrainingSessionOutbox,
  isTrainingSessionPending,
  loadRemoteTrainingSessions,
  queueTrainingSession,
  remoteTrainingSessionToLocalState,
  trainingSessionIdentity,
} from './training-session-sync.js'

import {
  exportBlockReportPdf,
} from './block-report-pdf.js'

import {
  athleteThemeStyle,
  getAthleteTheme,
} from './athlete-themes.js'

import {
  flushSbdPrOutbox,
  loadAthleteSbdRepPrs,
  recordValidatedSbdSet,
} from './sbd-pr.js'

/* GA V1.2 HOME PR THEMES SKIP V7 */

/* GA V1.1 SESSION CLOUD + PDF V3 */

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
        sourceKey:
          program.id,
        weeks:
          program.weeks,
      },
    ]
  }

  return []
}

function blockProgramKey(
  program,
  block
) {
  return (
    String(
      block?.sourceKey ||
      block?.id ||
      program?.id ||
      'programme'
    )
  )
}

function createBlockSelectionKey(
  program
) {
  return (
    `ga-v2-selected-block:${program.id}`
  )
}

function createStorageKey(
  program,
  block
) {
  return (
    `ga-v2-training-progress:${program.id}:${block.id}`
  )
}

function createDefaultState(
  block
) {
  return {
    selectedWeekId:
      block.weeks[0]?.id ??
      null,

    selectedDayId:
      block.weeks[0]
        ?.days[0]?.id ??
      null,

    sets: {},
    sessions: {},
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
      sessions:
        parsed.sessions || {},
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
    state.sets[
      sourceSet.id
    ]

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

function isMeaningfulState(
  setState
) {
  return (
    setState.status !==
      'pending' ||
    String(
      setState.load ?? ''
    ).trim() !== '' ||
    String(
      setState.rpe ?? ''
    ).trim() !== ''
  )
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
          set.status ===
            'done' ||
          set.status ===
            'failed'
        )
      }
    ).length

  return {
    completed,
    total:
      sets.length,
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

/*
 * set_index de workout_sets est global à la séance,
 * comme dans l'ancienne application : 0,1,2...
 * en parcourant tous les exercices dans l'ordre.
 */
function listDaySets(
  day
) {
  const rows = []

  day.exercises.forEach(
    (
      exercise,
      exerciseIndex
    ) => {
      exercise.sets.forEach(
        (
          sourceSet,
          setInExerciseIndex
        ) => {
          rows.push({
            exercise,
            exerciseIndex,
            sourceSet,
            setInExerciseIndex,
            setIndex:
              rows.length,
          })
        }
      )
    }
  )

  return rows
}

function findSourceSet(
  block,
  setId
) {
  for (
    let weekIndex = 0;
    weekIndex <
      block.weeks.length;
    weekIndex += 1
  ) {
    const week =
      block.weeks[
        weekIndex
      ]

    for (
      let dayIndex = 0;
      dayIndex <
        week.days.length;
      dayIndex += 1
    ) {
      const day =
        week.days[
          dayIndex
        ]

      const rows =
        listDaySets(day)

      const found =
        rows.find(
          (row) =>
            row.sourceSet.id ===
            setId
        )

      if (found) {
        return {
          week,
          day,
          weekIndex,
          dayIndex,
          ...found,
        }
      }
    }
  }

  return null
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll(
      '&',
      '&amp;'
    )
    .replaceAll(
      '<',
      '&lt;'
    )
    .replaceAll(
      '>',
      '&gt;'
    )
    .replaceAll(
      '"',
      '&quot;'
    )
    .replaceAll(
      "'",
      '&#39;'
    )
}

function formatReps(value) {
  const text =
    String(value ?? '')
      .trim()

  if (!text) {
    return '—'
  }

  if (
    /^\d+(?:[.,]\d+)?(?:\s*-\s*\d+(?:[.,]\d+)?)?$/.test(
      text
    )
  ) {
    return `${text} reps`
  }

  return text
}

function formatLoadRange(
  value
) {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return ''
  }

  return String(value)
    .replace(
      /\s*-\s*/g,
      ' – '
    )
    .trim()
}

export function mountTraining(
  root,
  onBack,
  program,
  options = {}
) {
  const canEdit =
    options.canEdit !== false

  // XP INITIAL OUTBOX FLUSH
  if (navigator.onLine !== false) {
    void flushXpOutbox()
  }

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

  const cloudAthleteSlug =
    String(
      options.cloudAthleteSlug ||
      program.athlete?.slug ||
      program.athlete?.id ||
      ''
    ).trim()

  const athleteTheme =
    getAthleteTheme(
      cloudAthleteSlug
    )

  const SBD_REP_SELECTION_KEY =
    `ga-v2-sbd-rep-selection:${cloudAthleteSlug}`

  let selectedSbdReps =
    Math.max(
      1,
      Math.min(
        9,
        Number(
          localStorage.getItem(
            SBD_REP_SELECTION_KEY
          )
        ) || 1
      )
    )

  let sbdPrs = {
    squat: {},
    bench: {},
    deadlift: {},
  }

  let athleteSteps = {
    steps: 0,
    mobilityCompleted: false,
    syncedAt: null,
    loading: true,
  }

  let prFlash = null
  let prFlashTimer = null

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

  let cloudLoadToken = 0
  let sessionTimerInterval = null
  let sessionNoteFlushTimer = null
  let showBlockReport = false

  let syncStatus = {
    kind: 'local',
    label:
      'Sauvegarde locale',
  }

  function setSyncStatus(
    kind,
    label
  ) {
    syncStatus = {
      kind,
      label,
    }

    const element =
      root.querySelector(
        '#trainingSyncStatus'
      )

    if (element) {
      element.className =
        `training-sync training-sync--${kind}`

      element.textContent =
        label
    }
  }

  function persist() {
    saveState(
      STORAGE_KEY,
      state
    )
  }

  function programKey() {
    return blockProgramKey(
      program,
      block
    )
  }

/* GA V1.1 SESSION TRACKING CORE V2 */

  function liftLabel(
    lift
  ) {
    return {
      squat: 'Squat',
      bench: 'Bench',
      deadlift: 'Deadlift',
    }[lift] || lift
  }

  function renderAthleteThemeBanner() {
    const quote =
      String(
        athleteTheme?.quote ||
        athleteTheme?.noteText ||
        ''
      ).trim()

    const cite =
      String(
        athleteTheme?.cite ||
        athleteTheme?.noteTitle ||
        ''
      ).trim()

    if (!quote) {
      return ''
    }

    return `
      <section class="athlete-theme-banner">
        <span class="athlete-theme-banner__mark">
          🕷
        </span>

        <blockquote>
          ${escapeHtml(
            quote
          )}
        </blockquote>

        ${cite
          ? `
            <cite>
              ${escapeHtml(
                cite
              )}
            </cite>
          `
          : ''}
      </section>
    `
  }

  function formatPrDate(row) {
    if (!row) {
      return 'Aucun PR'
    }

    const historical =
      String(
        row.achieved_label || ''
      ).trim()

    if (historical) {
      return historical
    }

    if (row.achieved_at) {
      const date =
        new Date(
          row.achieved_at
        )

      if (
        !Number.isNaN(
          date.getTime()
        )
      ) {
        return new Intl.DateTimeFormat(
          'fr-FR',
          {
            day: '2-digit',
            month: '2-digit',
            year: '2-digit',
          }
        ).format(date)
      }
    }

    return String(
      row.source_label ||
      'Historique'
    )
  }

  function renderSbdPrPanel() {
    const rows = [
      ['squat', 'SQ'],
      ['bench', 'BN'],
      ['deadlift', 'DL'],
    ]

    return `
      <section class="athlete-pr-panel athlete-pr-panel--v249">
        <div class="athlete-pr-panel__head">
          <div>
            <span>
              RECORDS SBD
            </span>

            <strong>
              PR de ${escapeHtml(
                program.athlete?.name ||
                cloudAthleteSlug
              )}
            </strong>
          </div>

          <small>
            ×${selectedSbdReps} reps · historique + V2
          </small>
        </div>

        <div class="athlete-pr-reps-v249" role="tablist" aria-label="Nombre de répétitions">
          ${Array.from(
            { length: 9 },
            (_, index) => index + 1
          ).map(reps => `
            <button
              type="button"
              role="tab"
              class="${reps === selectedSbdReps ? 'active' : ''}"
              aria-selected="${reps === selectedSbdReps ? 'true' : 'false'}"
              data-action="select-sbd-reps"
              data-reps="${reps}"
            >
              ×${reps}
            </button>
          `).join('')}
        </div>

        ${prFlash
          ? `
            <div class="athlete-pr-flash">
              🏆 Nouveau PR
              ${escapeHtml(
                liftLabel(
                  prFlash.lift
                )
              )}
              ·
              ${escapeHtml(
                prFlash.currentLoad
              )} kg
              ${prFlash.reps
                ? `×${escapeHtml(prFlash.reps)}`
                : ''}
            </div>
          `
          : ''}

        <div class="athlete-pr-grid">
          ${rows.map(
            ([lift, shortLabel]) => {
              const row =
                sbdPrs[lift]?.[
                  selectedSbdReps
                ] || null

              return `
                <article class="athlete-pr-card athlete-pr-card--${lift}">
                  <span>
                    ${shortLabel}
                  </span>

                  <strong>
                    ${row
                      ? `${escapeHtml(
                          row.load_kg
                        )}<small>kg</small>`
                      : '—'}
                  </strong>

                  <small>
                    ${escapeHtml(
                      formatPrDate(row)
                    )}
                  </small>
                </article>
              `
            }
          ).join('')}
        </div>
      </section>
    `
  }

  function stepsXpMultiplierForPanel(
    value
  ) {
    const steps =
      Math.max(
        0,
        Number(value) || 0
      )

    if (steps <= 10000) {
      return 1 + steps / 10000
    }

    return Math.min(
      2.5,
      2 +
        (steps - 10000) /
        20000
    )
  }

  function renderAthleteStepsPanel() {
    const steps =
      Math.max(
        0,
        Math.floor(
          Number(
            athleteSteps.steps
          ) || 0
        )
      )

    const progress =
      Math.min(
        100,
        steps / 20000 * 100
      )

    const multiplier =
      stepsXpMultiplierForPanel(
        steps
      )

    return `
      <section class="athlete-steps-panel-v249">
        <div class="athlete-steps-head-v249">
          <div>
            <span>🚶 ACTIVITÉ DU JOUR</span>
            <strong>
              ${athleteSteps.loading
                ? 'Synchronisation…'
                : `${steps.toLocaleString('fr-FR')} pas`}
            </strong>
          </div>

          <div class="athlete-steps-bonus-v249">
            <small>XP séance demain</small>
            <strong>
              ×${multiplier.toLocaleString('fr-FR', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </strong>
          </div>
        </div>

        <div class="athlete-steps-track-v249">
          <div
            class="athlete-steps-fill-v249"
            style="width:${progress}%"
          ></div>
          <i class="athlete-steps-marker-v249" aria-hidden="true"></i>
        </div>

        <div class="athlete-steps-scale-v249">
          <span>0</span>
          <span>10k · XP ×2</span>
          <span>20k · XP ×2,5</span>
        </div>

        ${athleteSteps.mobilityCompleted
          ? `
            <div class="athlete-steps-daily-v249 done">
              ✓ Daily mobilité validée · DROP ×2 actif aujourd’hui
            </div>
          `
          : `
            <div class="athlete-steps-daily-v249">
              Daily mobilité non validée
            </div>
          `}
      </section>
    `
  }

  function localActivityDateKey() {
    const now = new Date()
    return [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
    ].join('-')
  }

  async function hydrateAthleteSteps(
    rerender = true
  ) {
    athleteSteps = {
      ...athleteSteps,
      loading: true,
    }

    try {
      const { data, error } =
        await supabase
          .from(
            'athlete_daily_wellness'
          )
          .select(
            'steps,step_synced_at,mobility_completed_at'
          )
          .eq(
            'athlete_slug',
            cloudAthleteSlug
          )
          .eq(
            'activity_date',
            localActivityDateKey()
          )
          .maybeSingle()

      if (error) {
        throw error
      }

      athleteSteps = {
        steps:
          Number(data?.steps || 0),
        mobilityCompleted:
          Boolean(
            data?.mobility_completed_at
          ),
        syncedAt:
          data?.step_synced_at || null,
        loading: false,
      }
    } catch (error) {
      console.warn(
        'ATHLETE STEPS LOAD ERROR',
        error
      )

      athleteSteps = {
        ...athleteSteps,
        loading: false,
      }
    }

    if (rerender) {
      render()
    }
  }

  async function hydrateSbdPrs(
    rerender = true
  ) {
    sbdPrs =
      await loadAthleteSbdRepPrs(
        cloudAthleteSlug
      )

    if (rerender) {
      render()
    }
  }

  function capturePrForFound(
    found
  ) {
    if (!found) {
      return
    }

    const setState =
      getSetState(
        state,
        found.sourceSet
      )

    if (
      setState.status !==
      'done'
    ) {
      return
    }

    void recordValidatedSbdSet({
      athleteSlug:
        cloudAthleteSlug,
      exercise:
        found.exercise,
      load:
        setState.load,
      reps:
        found.sourceSet.reps,
      programKey:
        programKey(),
      weekIndex:
        found.weekIndex,
      dayIndex:
        found.dayIndex,
      setIndex:
        found.setIndex,
    })
      .then(
        async (result) => {
          if (
            !result ||
            result.queued ||
            !result.isPr
          ) {
            return
          }

          sbdPrs =
            await loadAthleteSbdRepPrs(
              cloudAthleteSlug
            )

          prFlash = {
            lift:
              result.lift,
            currentLoad:
              result.currentLoad,
            reps:
              result.reps ||
              parseInt(
                String(found.sourceSet.reps || '1'),
                10
              ) || 1,
          }

          if (prFlashTimer) {
            clearTimeout(
              prFlashTimer
            )
          }

          render()

          prFlashTimer =
            setTimeout(
              () => {
                prFlash = null
                render()
              },
              4500
            )
        }
      )
      .catch(
        (error) => {
          console.error(
            'SBD PR capture error:',
            error
          )
        }
      )
  }

  function sessionKey(
    weekIndex,
    dayIndex
  ) {
    return `${weekIndex}:${dayIndex}`
  }

  function emptySessionState() {
    return {
      startedAt: null,
      completedAt: null,
      durationSeconds: null,
      note: '',
      hydrationLiters: null,
      sleepHours: null,
      painUpper: null,
      painLower: null,
      steps: null,
      status: 'pending',
    }
  }

  function getSessionState(
    weekIndex,
    dayIndex
  ) {
    const key =
      sessionKey(
        weekIndex,
        dayIndex
      )

    return {
      ...emptySessionState(),
      ...(
        state.sessions?.[key] ||
        {}
      ),
    }
  }

  function setSessionState(
    weekIndex,
    dayIndex,
    next
  ) {
    state.sessions =
      state.sessions || {}

    const key =
      sessionKey(
        weekIndex,
        dayIndex
      )

    state.sessions[key] = {
      ...emptySessionState(),
      ...next,
    }

    return state.sessions[key]
  }

  function sessionPayload(
    weekIndex,
    dayIndex,
    overrideSession = null
  ) {
    return buildTrainingSessionPayload({
      athleteSlug:
        cloudAthleteSlug,

      programKey:
        programKey(),

      weekIndex,
      dayIndex,

      session:
        overrideSession ||
        getSessionState(
          weekIndex,
          dayIndex
        ),
    })
  }

  function queueSessionState(
    weekIndex,
    dayIndex,
    overrideSession = null
  ) {
    if (!cloudAthleteSlug) {
      return
    }

    queueTrainingSession(
      sessionPayload(
        weekIndex,
        dayIndex,
        overrideSession
      )
    )

    setSyncStatus(
      navigator.onLine === false
        ? 'offline'
        : 'syncing',

      navigator.onLine === false
        ? 'Hors ligne · sauvegardé localement'
        : 'Synchronisation…'
    )

    void flushTrainingSessionOutbox(
      setSyncStatus
    )
  }

  function scheduleSessionFlush(
    weekIndex,
    dayIndex
  ) {
    if (
      sessionNoteFlushTimer
    ) {
      clearTimeout(
        sessionNoteFlushTimer
      )
    }

    sessionNoteFlushTimer =
      setTimeout(
        () => {
          queueSessionState(
            weekIndex,
            dayIndex
          )
        },
        650
      )
  }

  async function hydrateSessionsFromCloud() {
    if (
      !cloudAthleteSlug ||
      navigator.onLine === false
    ) {
      return
    }

    const activeBlock =
      block

    const activeProgramKey =
      programKey()

    const result =
      await loadRemoteTrainingSessions({
        athleteSlug:
          cloudAthleteSlug,

        programKey:
          activeProgramKey,
      })

    if (
      activeBlock !== block
    ) {
      return
    }

    if (result.error) {
      console.error(
        'Chargement training_sessions_v2 impossible :',
        result.error
      )
      return
    }

    const remoteMap =
      new Map(
        (
          result.data ||
          []
        ).map(
          (row) => [
            trainingSessionIdentity({
              athleteSlug:
                cloudAthleteSlug,

              programKey:
                activeProgramKey,

              weekIndex:
                row.week_index,

              dayIndex:
                row.day_index,
            }),
            row,
          ]
        )
      )

    block.weeks.forEach(
      (
        week,
        weekIndex
      ) => {
        week.days.forEach(
          (
            day,
            dayIndex
          ) => {
            const payload =
              sessionPayload(
                weekIndex,
                dayIndex
              )

            if (
              isTrainingSessionPending(
                payload
              )
            ) {
              return
            }

            const identity =
              trainingSessionIdentity({
                athleteSlug:
                  cloudAthleteSlug,

                programKey:
                  activeProgramKey,

                weekIndex,
                dayIndex,
              })

            const remote =
              remoteMap.get(
                identity
              )

            if (remote) {
              setSessionState(
                weekIndex,
                dayIndex,
                remoteTrainingSessionToLocalState(
                  remote
                )
              )

              return
            }

            const local =
              getSessionState(
                weekIndex,
                dayIndex
              )

            const meaningful =
              Boolean(
                local.startedAt ||
                local.completedAt ||
                local.note ||
                local.hydrationLiters !== null ||
                local.sleepHours !== null ||
                local.painUpper !== null ||
                local.painLower !== null ||
                local.steps !== null
              )

            if (meaningful) {
              queueTrainingSession(
                payload
              )
            }
          }
        )
      }
    )

    persist()
    render()

    await flushTrainingSessionOutbox(
      setSyncStatus
    )
  }

  function isTerminalStatus(
    status
  ) {
    return (
      status === 'done' ||
      status === 'failed'
    )
  }

  function reconcileSessionClock(
    weekIndex,
    dayIndex
  ) {
    const week =
      block.weeks[weekIndex]

    const day =
      week?.days?.[dayIndex]

    if (!day) {
      return
    }

    const rows =
      listDaySets(day)

    const doneCount =
      rows.filter(
        ({ sourceSet }) =>
          isTerminalStatus(
            getSetState(
              state,
              sourceSet
            ).status
          )
      ).length

    const current =
      getSessionState(
        weekIndex,
        dayIndex
      )

    const next = {
      ...current,
    }

    const now =
      new Date()

    if (
      doneCount > 0 &&
      !next.startedAt
    ) {
      next.startedAt =
        now.toISOString()

      next.status =
        'in_progress'
    }

    if (
      rows.length > 0 &&
      doneCount ===
        rows.length &&
      next.startedAt
    ) {
      if (
        !next.completedAt
      ) {
        next.completedAt =
          now.toISOString()
      }

      next.durationSeconds =
        Math.max(
          0,
          Math.round(
            (
              Date.parse(
                next.completedAt
              ) -
              Date.parse(
                next.startedAt
              )
            ) / 1000
          )
        )

      next.status =
        'completed'
    } else if (
      next.startedAt
    ) {
      next.completedAt =
        null

      next.durationSeconds =
        null

      next.status =
        'in_progress'
    } else {
      next.completedAt =
        null
      next.durationSeconds =
        null
      next.status =
        'pending'
    }

    setSessionState(
      weekIndex,
      dayIndex,
      next
    )
  }

  function formatDuration(
    rawSeconds
  ) {
    const total =
      Math.max(
        0,
        Math.floor(
          Number(
            rawSeconds
          ) || 0
        )
      )

    const hours =
      Math.floor(
        total / 3600
      )

    const minutes =
      Math.floor(
        (
          total % 3600
        ) / 60
      )

    const seconds =
      total % 60

    return [
      hours,
      minutes,
      seconds,
    ]
      .map(
        (value) =>
          String(value)
            .padStart(
              2,
              '0'
            )
      )
      .join(':')
  }

  function elapsedSeconds(
    session
  ) {
    if (
      session.completedAt &&
      Number.isFinite(
        Number(
          session.durationSeconds
        )
      )
    ) {
      return Math.max(
        0,
        Number(
          session.durationSeconds
        )
      )
    }

    if (!session.startedAt) {
      return 0
    }

    return Math.max(
      0,
      Math.floor(
        (
          Date.now() -
          Date.parse(
            session.startedAt
          )
        ) / 1000
      )
    )
  }

  function currentSessionContext() {
    const {
      week,
      day,
    } =
      normalizeSelection()

    if (!week || !day) {
      return null
    }

    const weekIndex =
      block.weeks.findIndex(
        (item) =>
          item.id ===
          week.id
      )

    const dayIndex =
      week.days.findIndex(
        (item) =>
          item.id ===
          day.id
      )

    if (
      weekIndex < 0 ||
      dayIndex < 0
    ) {
      return null
    }

    return {
      week,
      day,
      weekIndex,
      dayIndex,
      session:
        getSessionState(
          weekIndex,
          dayIndex
        ),
    }
  }

  function updateDisplayedTimer() {
    const node =
      root.querySelector(
        '#trainingSessionTimer'
      )

    if (!node) {
      return
    }

    const context =
      currentSessionContext()

    node.textContent =
      context
        ? formatDuration(
            elapsedSeconds(
              context.session
            )
          )
        : '00:00:00'
  }

  function renderSessionTracking(
    week,
    day
  ) {
    const weekIndex =
      block.weeks.findIndex(
        (item) =>
          item.id ===
          week.id
      )

    const dayIndex =
      week.days.findIndex(
        (item) =>
          item.id ===
          day.id
      )

    const session =
      getSessionState(
        weekIndex,
        dayIndex
      )

    const statusLabel =
      session.status ===
        'completed'
        ? 'Terminée'
        : session.status ===
            'in_progress'
          ? 'En cours'
          : 'En attente'

    return `
      <section class="training-session-v11">
        <div class="training-session-v11__top">
          <div>
            <span class="training-session-v11__kicker">
              CHRONO DE SÉANCE
            </span>

            <strong
              id="trainingSessionTimer"
              class="training-session-v11__timer"
            >
              ${formatDuration(
                elapsedSeconds(
                  session
                )
              )}
            </strong>
          </div>

          <span
            class="training-session-v11__status training-session-v11__status--${escapeHtml(session.status)}"
          >
            ${escapeHtml(
              statusLabel
            )}
          </span>
        </div>

        <p class="training-session-v11__hint">
          Démarre à la première série validée et se fige automatiquement à la dernière série terminée.
        </p>

        <div class="training-session-v11__metrics">
          <label>
            <span>Hydratation</span>
            <div>
              <input
                type="number"
                min="0"
                max="20"
                step="0.1"
                inputmode="decimal"
                data-action="session-metric"
                data-field="hydrationLiters"
                data-week-index="${weekIndex}"
                data-day-index="${dayIndex}"
                value="${escapeHtml(
                  session.hydrationLiters ?? ''
                )}"
                ${canEdit ? '' : 'disabled'}
              >
              <small>L</small>
            </div>
          </label>

          <label>
            <span>Sommeil</span>
            <div>
              <input
                type="number"
                min="0"
                max="24"
                step="0.1"
                inputmode="decimal"
                data-action="session-metric"
                data-field="sleepHours"
                data-week-index="${weekIndex}"
                data-day-index="${dayIndex}"
                value="${escapeHtml(
                  session.sleepHours ?? ''
                )}"
                ${canEdit ? '' : 'disabled'}
              >
              <small>h</small>
            </div>
          </label>

          <label>
            <span>Douleur upper</span>
            <div>
              <input
                type="number"
                min="0"
                max="10"
                step="1"
                inputmode="numeric"
                data-action="session-metric"
                data-field="painUpper"
                data-week-index="${weekIndex}"
                data-day-index="${dayIndex}"
                value="${escapeHtml(
                  session.painUpper ?? ''
                )}"
                ${canEdit ? '' : 'disabled'}
              >
              <small>/10</small>
            </div>
          </label>

          <label>
            <span>Douleur lower</span>
            <div>
              <input
                type="number"
                min="0"
                max="10"
                step="1"
                inputmode="numeric"
                data-action="session-metric"
                data-field="painLower"
                data-week-index="${weekIndex}"
                data-day-index="${dayIndex}"
                value="${escapeHtml(
                  session.painLower ?? ''
                )}"
                ${canEdit ? '' : 'disabled'}
              >
              <small>/10</small>
            </div>
          </label>

          <label class="training-session-v11__metric-wide">
            <span>Nombre de pas</span>
            <div>
              <input
                type="number"
                min="0"
                max="200000"
                step="1"
                inputmode="numeric"
                data-action="session-metric"
                data-field="steps"
                data-week-index="${weekIndex}"
                data-day-index="${dayIndex}"
                value="${escapeHtml(
                  session.steps ?? ''
                )}"
                ${canEdit ? '' : 'disabled'}
              >
              <small>pas</small>
            </div>
          </label>
        </div>

        <label class="training-session-v11__note-label">
          Notes de la séance
        </label>

        <textarea
          class="training-session-v11__note"
          data-action="session-note"
          data-week-index="${weekIndex}"
          data-day-index="${dayIndex}"
          ${canEdit ? '' : 'disabled'}
          placeholder="Sensations, douleur, technique, contexte de séance…"
        >${escapeHtml(session.note)}</textarea>
      </section>
    `
  }

  function buildBlockReport() {
    const sessions = []

    let totalSets = 0
    let completedSets = 0
    let completedDays = 0
    let totalSeconds = 0

    block.weeks.forEach(
      (
        week,
        weekIndex
      ) => {
        week.days.forEach(
          (
            day,
            dayIndex
          ) => {
            const progress =
              countDayProgress(
                state,
                day
              )

            const session =
              getSessionState(
                weekIndex,
                dayIndex
              )

            const duration =
              elapsedSeconds(
                session
              )

            totalSets +=
              progress.total

            completedSets +=
              progress.completed

            if (
              progress.total > 0 &&
              progress.completed ===
                progress.total
            ) {
              completedDays += 1
            }

            totalSeconds +=
              duration

            sessions.push({
              weekLabel:
                week.label,
              dayName:
                day.name,
              completed:
                progress.completed,
              total:
                progress.total,
              duration,
              note:
                session.note,
              hydrationLiters:
                session.hydrationLiters,
              sleepHours:
                session.sleepHours,
              painUpper:
                session.painUpper,
              painLower:
                session.painLower,
              steps:
                session.steps,
            })
          }
        )
      }
    )

    return {
      sessions,
      totalDays:
        sessions.length,
      completedDays,
      totalSets,
      completedSets,
      totalSeconds,
    }
  }

  function renderBlockSummary() {
    const report =
      buildBlockReport()

    return `
      <section class="training-block-report-v11">
        <div class="training-block-report-v11__head">
          <div>
            <span class="training-block-report-v11__kicker">
              COMPTE RENDU TOTAL DU BLOC
            </span>
            <h2>
              ${escapeHtml(
                block.label
              )}
            </h2>
          </div>

          <strong>
            ${report.completedDays}/${report.totalDays}
            séances
          </strong>
        </div>

        <div class="training-block-report-v11__stats">
          <div>
            <span>Séries réalisées</span>
            <strong>
              ${report.completedSets}/${report.totalSets}
            </strong>
          </div>

          <div>
            <span>Temps cumulé</span>
            <strong>
              ${formatDuration(
                report.totalSeconds
              )}
            </strong>
          </div>
        </div>

        <div class="training-block-report-v11__actions">
          <button
            class="training-block-report-v11__toggle"
            data-action="block-report"
          >
            ${showBlockReport
              ? 'Masquer le détail'
              : 'Voir le compte rendu complet'}
          </button>

          <button
            class="training-block-report-v11__pdf"
            data-action="block-report-pdf"
          >
            Compte rendu PDF
          </button>
        </div>

        ${showBlockReport
          ? `
            <div class="training-block-report-v11__list">
              ${report.sessions.map(
                (item) => `
                  <article class="training-block-report-v11__session">
                    <div class="training-block-report-v11__session-head">
                      <strong>
                        ${escapeHtml(
                          item.weekLabel
                        )}
                        ·
                        ${escapeHtml(
                          item.dayName
                        )}
                      </strong>

                      <span>
                        ${item.completed}/${item.total}
                        séries
                      </span>
                    </div>

                    <div class="training-block-report-v11__duration">
                      ⏱
                      ${formatDuration(
                        item.duration
                      )}
                    </div>

                    <p>
                      ${item.note
                        ? escapeHtml(
                            item.note
                          )
                        : 'Aucune note pour cette séance.'}
                    </p>
                  </article>
                `
              ).join('')}
            </div>
          `
          : ''}
      </section>
    `
  }

  function payloadForFound(
    found,
    overrideState = null
  ) {
    return buildWorkoutSetPayload({
      athleteSlug:
        cloudAthleteSlug,

      athleteName:
        program.athlete?.name ||
        cloudAthleteSlug,

      programKey:
        programKey(),

      weekIndex:
        found.weekIndex,

      dayIndex:
        found.dayIndex,

      setIndex:
        found.setIndex,

      exercise:
        found.exercise,

      sourceSet:
        found.sourceSet,

      setState:
        overrideState ||
        getSetState(
          state,
          found.sourceSet
        ),
    })
  }

  function queueFoundSet(
    found,
    overrideState = null
  ) {
    const payload =
      payloadForFound(
        found,
        overrideState
      )

    queueWorkoutSet(
      payload
    )

    setSyncStatus(
      navigator.onLine === false
        ? 'offline'
        : 'syncing',

      navigator.onLine === false
        ? 'Hors ligne · sauvegardé localement'
        : 'Synchronisation…'
    )

    void flushWorkoutOutbox(
      setSyncStatus
    )
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
    if (!canEdit) {
      return
    }

    const current =
      getSetState(
        state,
        sourceSet
      )

    state.sets[
      sourceSet.id
    ] = {
      ...current,
      ...changes,
    }

    const found =
      findSourceSet(
        block,
        sourceSet.id
      )

    if (found) {
      reconcileSessionClock(
        found.weekIndex,
        found.dayIndex
      )
    }

    persist()

    if (found) {
      queueFoundSet(
        found
      )

      queueSessionState(
        found.weekIndex,
        found.dayIndex
      )

      capturePrForFound(
        found
      )
    }

    render()
  }

  function saveLoadWithoutRender(
    sourceSet,
    value,
    syncCloud = false
  ) {
    // READ ONLY LOAD GUARD
    if (!canEdit) {
      return
    }

    const current =
      getSetState(
        state,
        sourceSet
      )

    state.sets[
      sourceSet.id
    ] = {
      ...current,
      load:
        String(value ?? ''),
    }

    persist()

    if (syncCloud) {
      const found =
        findSourceSet(
          block,
          sourceSet.id
        )

      if (found) {
        queueFoundSet(
          found
        )

        capturePrForFound(
          found
        )
      }
    }
  }

  function resetCurrentDay() {
    const {
      week,
      day,
    } =
      normalizeSelection()

    if (!week || !day) {
      return
    }

    const weekIndex =
      block.weeks.findIndex(
        (item) =>
          item.id ===
          week.id
      )

    const dayIndex =
      week.days.findIndex(
        (item) =>
          item.id ===
          day.id
      )

    const setsToReset =
      listDaySets(day)

    setsToReset.forEach(
      ({ sourceSet }) => {
        delete state.sets[
          sourceSet.id
        ]
      }
    )

    const resetSession =
      emptySessionState()

    setSessionState(
      weekIndex,
      dayIndex,
      resetSession
    )

    persist()
    render()

    queueSessionState(
      weekIndex,
      dayIndex,
      resetSession
    )

    setsToReset.forEach(
      ({ sourceSet }) => {
        const found =
          findSourceSet(
            block,
            sourceSet.id
          )

        if (found) {
          queueFoundSet(
            found,
            {
              load: '',
              rpe: '',
              status:
                'pending',
            }
          )
        }
      }
    )
  }

  async function hydrateFromCloud() {
    const token =
      ++cloudLoadToken

    if (!cloudAthleteSlug) {
      setSyncStatus(
        'error',
        'Profil cloud introuvable'
      )
      return
    }

    setSyncStatus(
      navigator.onLine === false
        ? 'offline'
        : 'syncing',

      navigator.onLine === false
        ? 'Hors ligne · données locales'
        : 'Chargement cloud…'
    )

    if (
      navigator.onLine === false
    ) {
      return
    }

    const activeBlock =
      block

    const activeProgramKey =
      programKey()

    const result =
      await loadRemoteWorkoutSets({
        athleteSlug:
          cloudAthleteSlug,

        programKey:
          activeProgramKey,
      })

    if (
      token !==
        cloudLoadToken ||
      activeBlock !== block
    ) {
      return
    }

    if (result.error) {
      console.error(
        'Chargement workout_sets impossible :',
        result.error
      )

      setSyncStatus(
        'error',
        'Cloud indisponible · données locales'
      )
      return
    }

    const remoteMap =
      new Map(
        (result.data || [])
          .map(
            (row) => [
              remoteIdentityKey({
                athleteSlug:
                  cloudAthleteSlug,

                programKey:
                  activeProgramKey,

                weekIndex:
                  row.week_index,

                dayIndex:
                  row.day_index,

                setIndex:
                  row.set_index,
              }),
              row,
            ]
          )
      )

    /*
     * Le cloud gagne lorsqu'il possède une ligne,
     * sauf si une modification locale attend encore
     * dans l'outbox. Une ancienne progression locale
     * sans ligne cloud est automatiquement migrée.
     */
    block.weeks.forEach(
      (
        week,
        weekIndex
      ) => {
        week.days.forEach(
          (
            day,
            dayIndex
          ) => {
            listDaySets(day)
              .forEach(
                (row) => {
                  const found = {
                    ...row,
                    week,
                    day,
                    weekIndex,
                    dayIndex,
                  }

                  const payload =
                    payloadForFound(
                      found
                    )

                  if (
                    isPayloadPending(
                      payload
                    )
                  ) {
                    return
                  }

                  const identity =
                    remoteIdentityKey({
                      athleteSlug:
                        cloudAthleteSlug,

                      programKey:
                        activeProgramKey,

                      weekIndex,
                      dayIndex,

                      setIndex:
                        row.setIndex,
                    })

                  const remote =
                    remoteMap.get(
                      identity
                    )

                  if (remote) {
                    state.sets[
                      row.sourceSet.id
                    ] =
                      remoteRowToLocalState(
                        remote
                      )

                    return
                  }

                  const local =
                    getSetState(
                      state,
                      row.sourceSet
                    )

                  if (
                    isMeaningfulState(
                      local
                    )
                  ) {
                    queueWorkoutSet(
                      payloadForFound(
                        found,
                        local
                      )
                    )
                  }
                }
              )
          }
        )
      }
    )

    persist()
    render()

    await flushWorkoutOutbox(
      setSyncStatus
    )

    if (
      !pendingWorkoutSetCount()
    ) {
      setSyncStatus(
        'synced',
        'Synchronisé'
      )
    }
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

    cloudLoadToken += 1

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
    void hydrateFromCloud()
    void hydrateSessionsFromCloud()
    void hydrateSbdPrs()
    void hydrateAthleteSteps()
  }

  function renderBlocks() {
    if (
      blocks.length <= 1
    ) {
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
              item.id ===
              block.id

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
        ${canEdit ? '' : 'disabled'}
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
          SKIP / ÉCHEC
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
      set.status ===
        'done'

    const isFailed =
      set.status ===
        'failed'

    const meta = []

    if (
      sourceSet.percent !==
        null &&
      sourceSet.percent !==
        undefined &&
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

    if (
      sourceSet.intensity
    ) {
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
                    meta.join(
                      ' · '
                    )
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
          ${canEdit ? '' : 'readonly'}
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
          ${canEdit ? '' : 'disabled'}
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
        <button
          class="set-skip ${isFailed ? 'set-skip--undo' : ''}"
          ${canEdit ? '' : 'disabled'}
          data-action="skip-set"
          data-set-id="${escapeHtml(sourceSet.id)}"
          type="button"
        >
          <strong>
            ${isFailed
              ? '↩ REVENIR'
              : '☠ SKIP'}
          </strong>

          <small>
            ${isFailed
              ? 'reprendre ma série'
              : 'la barre a gagné'}
          </small>
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
            set.status ===
              'done' ||
            set.status ===
              'failed'
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
            (
              sourceSet,
              index
            ) =>
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
        data-athlete-theme
        style="${escapeHtml(
          athleteThemeStyle(
            athleteTheme
          )
        )}"
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
            ${canEdit ? '' : 'disabled'}
            data-action="reset"
          >
            Réinitialiser
          </button>
        </header>

        ${renderAthleteThemeBanner()}
        <div class="athlete-insights-grid-v249">
          ${renderSbdPrPanel()}
          ${renderAthleteStepsPanel()}
        </div>

        <div
          id="trainingSyncStatus"
          class="training-sync training-sync--${syncStatus.kind}"
        >
          ${escapeHtml(syncStatus.label)}
        </div>

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

        ${renderSessionTracking(
          week,
          day
        )}

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
        ${renderBlockSummary()}

      </main>
    `

    updateDisplayedTimer()

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
      actionName ===
        'select-sbd-reps'
    ) {
      const nextReps =
        Math.max(
          1,
          Math.min(
            9,
            Number(
              action.dataset.reps
            ) || 1
          )
        )

      selectedSbdReps =
        nextReps

      localStorage.setItem(
        SBD_REP_SELECTION_KEY,
        String(nextReps)
      )

      render()
      return
    }

    // READ ONLY CLICK GUARD
    if (
      !canEdit &&
      (
        actionName === 'reset' ||
        actionName === 'toggle' ||
        actionName === 'skip-set'
      )
    ) {
      return
    }

    if (
      actionName === 'back'
    ) {
      cloudLoadToken += 1
      root.onclick = null
      root.onchange = null
      root.oninput = null

      if (
        sessionTimerInterval
      ) {
        clearInterval(
          sessionTimerInterval
        )
      }

      if (
        sessionNoteFlushTimer
      ) {
        clearTimeout(
          sessionNoteFlushTimer
        )
      }

      if (
        prFlashTimer
      ) {
        clearTimeout(
          prFlashTimer
        )
      }

      onBack()
      return
    }

    if (
      actionName ===
        'reset'
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
      actionName ===
        'block'
    ) {
      selectBlock(
        action.dataset.blockId
      )
      return
    }

    if (
      actionName ===
        'week'
    ) {
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

    if (
      actionName ===
        'day'
    ) {
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

    if (
      actionName ===
        'block-report'
    ) {
      showBlockReport =
        !showBlockReport

      render()
      return
    }

    if (
      actionName ===
        'block-report-pdf'
    ) {
      exportBlockReportPdf({
        athleteName:
          program.athlete?.name ||
          cloudAthleteSlug ||
          'Athlète',

        blockLabel:
          block.label ||
          'Bloc',

        report:
          buildBlockReport(),
      })

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

        if (
      actionName ===
        'skip-set'
    ) {
      if (
        set.status ===
          'failed'
      ) {
        updateSet(
          sourceSet,
          {
            rpe: '',
            status:
              'pending',
          }
        )
      } else {
        updateSet(
          sourceSet,
          {
            rpe: '',
            status:
              'failed',
          }
        )
      }

      return
    }

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

      const xpPayload =
        payloadForFound(found)

      const exerciseCode =
        String(
          xpPayload[
            'exercise' + '_' + 'code'
          ] || ''
        ).toLowerCase()

      const dayRows =
        listDaySets(found.day)

      const sbdSets =
        dayRows.filter((row) => {
          const rowPayload =
            payloadForFound({
              ...row,
              weekIndex:
                found.weekIndex,
              dayIndex:
                found.dayIndex,
            })

          const code =
            String(
              rowPayload[
                'exercise' + '_' + 'code'
              ] || ''
            ).toLowerCase()

          return [
            'sq',
            'bn',
            'dl',
          ].includes(code)
        }).length

      const totalSets =
        dayRows.length

      const accessorySets =
        Math.max(
          0,
          totalSets - sbdSets
        )

      void awardSetXp({
        athleteSlug:
          cloudAthleteSlug,

        programKey:
          programKey(),

        weekIndex:
          found.weekIndex,

        dayIndex:
          found.dayIndex,

        setIndex:
          found.setIndex,

        exerciseCode,

        isPr:
          false,

        previousPrKg:
          null,

        totalSets,
        sbdSets,
        accessorySets,
      })
        .then((result) => {
          if (
            !result ||
            result.offline
          ) {
            return
          }

          console.log(
            'XP RESULT',
            {
              duplicate:
                result.duplicate,
              setPoints:
                result.setPoints,
              totalXp:
                result.totalXp,
              level:
                result.level,
              packEarned:
                result.packEarned,
            }
          )
        })
        .catch((error) => {
          console.error(
            'XP ERROR',
            error
          )
        })
    }
  }

  root.oninput = (
    event
  ) => {

    // READ ONLY INPUT GUARD
    if (!canEdit) {
      return
    }
    const input =
      event.target

    const actionName =
      input.dataset.action

    if (
      actionName ===
        'session-note' ||
      actionName ===
        'session-metric'
    ) {
      const weekIndex =
        Number.parseInt(
          input.dataset.weekIndex,
          10
        )

      const dayIndex =
        Number.parseInt(
          input.dataset.dayIndex,
          10
        )

      if (
        !Number.isFinite(
          weekIndex
        ) ||
        !Number.isFinite(
          dayIndex
        )
      ) {
        return
      }

      const current =
        getSessionState(
          weekIndex,
          dayIndex
        )

      const next = {
        ...current,
      }

      if (
        actionName ===
          'session-note'
      ) {
        next.note =
          input.value
      } else {
        const field =
          input.dataset.field

        if (!field) {
          return
        }

        next[field] =
          input.value === ''
            ? null
            : Number(
                String(
                  input.value
                )
                  .replace(
                    ',',
                    '.'
                  )
              )
      }

      setSessionState(
        weekIndex,
        dayIndex,
        next
      )

      persist()

      scheduleSessionFlush(
        weekIndex,
        dayIndex
      )

      return
    }

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

    /*
     * CHARGE :
     * - sauvegarde locale à chaque frappe ;
     * - mise en outbox immédiate, même avant le blur ;
     * - l'envoi réseau reste déclenché au change/blur.
     *
     * Résultat : même si l'app est fermée juste après
     * la saisie ou si Internet coupe, la modification
     * attend bien dans ga-v2-workout-outbox-v1.
     */
    if (
      actionName ===
        'load'
    ) {
      saveLoadWithoutRender(
        found.sourceSet,
        input.value,
        false
      )

      queueWorkoutSet(
        payloadForFound(
          found
        )
      )

      setSyncStatus(
        navigator.onLine === false
          ? 'offline'
          : 'local',

        navigator.onLine === false
          ? 'Hors ligne · sauvegardé localement'
          : 'Modification locale…'
      )

      return
    }

    /*
     * Certains navigateurs mobiles déclenchent
     * input sur un <select> avant change.
     * On traite donc aussi le RPE ici afin que
     * l'état ne dépende pas d'un seul événement.
     */
    if (
      actionName ===
        'rpe'
    ) {
      const {
        exercise,
        sourceSet,
      } =
        found

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

  root.onchange = (
    event
  ) => {

    // READ ONLY CHANGE GUARD
    if (!canEdit) {
      return
    }
    const input =
      event.target

    const actionName =
      input.dataset.action

    if (
      actionName ===
        'session-note' ||
      actionName ===
        'session-metric'
    ) {
      const weekIndex =
        Number.parseInt(
          input.dataset.weekIndex,
          10
        )

      const dayIndex =
        Number.parseInt(
          input.dataset.dayIndex,
          10
        )

      if (
        Number.isFinite(
          weekIndex
        ) &&
        Number.isFinite(
          dayIndex
        )
      ) {
        queueSessionState(
          weekIndex,
          dayIndex
        )
      }

      return
    }

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

    if (
      actionName ===
        'load'
    ) {
      saveLoadWithoutRender(
        sourceSet,
        input.value,
        true
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

  window.addEventListener(
    'online',
    () => {
      void flushWorkoutOutbox(
        setSyncStatus
      )

      void flushXpOutbox()
        .then((result) => {
          if (
            result?.flushed > 0
          ) {
            console.log(
              'XP OUTBOX FLUSHED',
              result
            )
          }
        })
        .catch((error) => {
          console.error(
            'XP OUTBOX FLUSH ERROR',
            error
          )
        })

      void hydrateFromCloud()
      void hydrateSessionsFromCloud()
      void flushTrainingSessionOutbox(
        setSyncStatus
      )

      void flushSbdPrOutbox()
        .then(
          (result) => {
            if (
              result?.flushed > 0
            ) {
              void hydrateSbdPrs()
              void hydrateAthleteSteps()
            }
          }
        )
    },
    {
      once: false,
    }
  )

  window.addEventListener(
    'offline',
    () => {
      setSyncStatus(
        'offline',
        'Hors ligne · sauvegardé localement'
      )
    },
    {
      once: false,
    }
  )

  sessionTimerInterval =
    setInterval(
      updateDisplayedTimer,
      1000
    )

  render()
  void hydrateFromCloud()
  void hydrateSessionsFromCloud()
  void hydrateSbdPrs()
  void hydrateAthleteSteps()
  void flushSbdPrOutbox()
}
