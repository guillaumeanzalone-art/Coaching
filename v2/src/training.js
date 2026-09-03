import { supabase } from './supabase.js'

import {
  getAthleteBlocksV3,
  getAthleteBlockV3,
} from './program-cloud.js'

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
  const baseCanEdit =
    options.canEdit !== false

  let canEdit =
    baseCanEdit

  // XP INITIAL OUTBOX FLUSH
  if (navigator.onLine !== false) {
    void flushXpOutbox()
  }

  let blocks =
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

  /*
   * GA V3 MIGRATION :
   * conserve la programmation réellement chargée au démarrage.
   * Le snapshot program_json de la table V3 peut être plus ancien
   * pendant la migration et ne doit jamais écraser le bloc courant.
   */
  const v3LiveCurrentProgram =
    program

  const v3LiveCurrentBlockId =
    block.id


  /* ================================================================
     GA V3 — HISTORIQUE DES BLOCS SUPABASE
     ================================================================ */

  let v3ProgramBlocks = []

  let v3BlocksLoading = true

  let v3BlocksError = ''

  let v3SelectedBlockKey =
    block?.id || ''

  let v3SwitchingBlock = false

  let v3OverviewPayload = null

  let v3OverviewLoading = false

  let v3OverviewError = ''

  let showV3Overview = false


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

  /* ================================================================
     GA V3 — CHARGEMENT HISTORIQUE BLOCS SUPABASE
     ================================================================ */

  async function hydrateProgramBlocksV3(
    rerender = true
  ) {
    if (!cloudAthleteSlug) {
      v3ProgramBlocks = []
      v3BlocksLoading = false
      v3BlocksError =
        'Profil cloud introuvable.'

      if (rerender) {
        render()
      }

      return
    }

    v3BlocksLoading = true
    v3BlocksError = ''

    try {
      v3ProgramBlocks =
        await getAthleteBlocksV3(
          cloudAthleteSlug
        )

      const currentBlock =
        v3ProgramBlocks.find(
          item =>
            item.status ===
            'current'
        )

      if (currentBlock) {
        v3SelectedBlockKey =
          currentBlock.block_key
      }

      console.log(
        'V3 BLOCS SUPABASE',
        v3ProgramBlocks
      )

      /*
       * Précharge le payload complet du bloc courant.
       * Cela rend l'Overview instantané à l'ouverture.
       */
      await loadV3OverviewPayload({
        rerender: false,
        force: false,
      })
    } catch (error) {
      console.error(
        'V3 BLOCK HISTORY ERROR',
        error
      )

      v3ProgramBlocks = []

      v3BlocksError =
        error?.message ||
        'Historique indisponible.'
    }

    v3BlocksLoading = false

    if (rerender) {
      render()
    }
  }


  function restoreV3LiveCurrentProgram(
    blockKey
  ) {
    cloudLoadToken += 1

    program =
      v3LiveCurrentProgram

    blocks =
      getBlocks(
        program
      )

    const nextBlock =
      blocks.find(
        item =>
          item.id ===
          v3LiveCurrentBlockId
      ) ||
      blocks.find(
        item =>
          item.id ===
          program.defaultBlockId
      ) ||
      blocks[0]

    if (!nextBlock) {
      throw new Error(
        'Bloc courant introuvable.'
      )
    }

    block =
      nextBlock

    selectedBlockId =
      nextBlock.id

    v3SelectedBlockKey =
      blockKey ||
      nextBlock.id

    canEdit =
      baseCanEdit

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
  }


  async function selectV3ProgramBlock(
    blockKey
  ) {
    const cleanBlockKey =
      String(
        blockKey || ''
      ).trim()

    if (
      !cleanBlockKey ||
      v3SwitchingBlock
    ) {
      return
    }

    const meta =
      v3ProgramBlocks.find(
        item =>
          item.block_key ===
          cleanBlockKey
      )

    /*
     * IMPORTANT :
     * le bouton "bloc actuel" ne recharge PAS program_json.
     * Il revient au programme vivant déjà chargé par l'app.
     */
    if (
      meta?.status ===
        'current'
    ) {
      v3SwitchingBlock = true
      v3BlocksError = ''

      try {
        restoreV3LiveCurrentProgram(
          cleanBlockKey
        )

        /*
         * On peut tout de même récupérer overview_json,
         * sans remplacer le programme d'entraînement.
         */
        try {
          const payload =
            await getAthleteBlockV3(
              cloudAthleteSlug,
              cleanBlockKey
            )

          v3OverviewPayload =
            payload || null

          v3OverviewError = ''
        } catch (overviewError) {
          console.warn(
            'V3 CURRENT OVERVIEW LOAD ERROR',
            overviewError
          )
        }

      } catch (error) {
        console.error(
          'V3 CURRENT BLOCK RESTORE ERROR',
          error
        )

        v3BlocksError =
          error?.message ||
          'Impossible de revenir au bloc actuel.'
      } finally {
        v3SwitchingBlock = false
      }

      render()

      if (!v3BlocksError) {
        void hydrateFromCloud()
        void hydrateSessionsFromCloud()
        void hydrateSbdPrs()
        void hydrateAthleteSteps()
      }

      return
    }

    v3SwitchingBlock = true
    v3BlocksError = ''

    render()

    try {
      const payload =
        await getAthleteBlockV3(
          cloudAthleteSlug,
          cleanBlockKey
        )

      const nextProgram =
        payload?.program

      if (
        !nextProgram ||
        typeof nextProgram !==
          'object'
      ) {
        throw new Error(
          'Programme du bloc introuvable.'
        )
      }

      const nextBlocks =
        getBlocks(
          nextProgram
        )

      if (!nextBlocks.length) {
        throw new Error(
          'Ce bloc ne contient aucune semaine.'
        )
      }

      cloudLoadToken += 1

      program =
        nextProgram

      blocks =
        nextBlocks

      const nextBlock =
        blocks.find(
          item =>
            item.id ===
            cleanBlockKey
        ) ||
        blocks.find(
          item =>
            item.id ===
            nextProgram.defaultBlockId
        ) ||
        blocks[0]

      block =
        nextBlock

      selectedBlockId =
        nextBlock.id

      v3SelectedBlockKey =
        cleanBlockKey

      /*
       * Le même RPC renvoie aussi overview_json :
       * on le garde en cache pour éviter un second appel.
       */
      v3OverviewPayload =
        payload

      v3OverviewLoading =
        false

      v3OverviewError =
        ''

      /*
       * Bloc courant = modifiable selon les droits normaux.
       * Bloc archivé = consultation uniquement.
       */
      canEdit =
        baseCanEdit &&
        (
          meta?.status ===
            'current' ||
          payload?.status ===
            'current'
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

    } catch (error) {
      console.error(
        'V3 BLOCK SWITCH ERROR',
        error
      )

      v3BlocksError =
        error?.message ||
        'Impossible de charger ce bloc.'
    } finally {
      v3SwitchingBlock =
        false
    }

    render()

    if (!v3BlocksError) {
      void hydrateFromCloud()
      void hydrateSessionsFromCloud()
      void hydrateSbdPrs()
      void hydrateAthleteSteps()
    }
  }


  function selectedV3Meta() {
    return (
      v3ProgramBlocks.find(
        item =>
          item.block_key ===
          v3SelectedBlockKey
      ) ||
      v3ProgramBlocks.find(
        item =>
          item.status ===
          'current'
      ) ||
      null
    )
  }


  async function loadV3OverviewPayload({
    rerender = true,
    force = false,
  } = {}) {
    const blockKey =
      String(
        v3SelectedBlockKey ||
        block?.id ||
        ''
      ).trim()

    if (
      !cloudAthleteSlug ||
      !blockKey
    ) {
      v3OverviewPayload = null
      v3OverviewLoading = false
      v3OverviewError =
        'Overview indisponible.'

      if (rerender) {
        render()
      }

      return null
    }

    if (
      !force &&
      v3OverviewPayload?.blockKey ===
        blockKey
    ) {
      return v3OverviewPayload
    }

    v3OverviewLoading = true
    v3OverviewError = ''

    if (rerender) {
      render()
    }

    try {
      const payload =
        await getAthleteBlockV3(
          cloudAthleteSlug,
          blockKey
        )

      v3OverviewPayload =
        payload || null

      return v3OverviewPayload

    } catch (error) {
      console.error(
        'V3 OVERVIEW LOAD ERROR',
        error
      )

      v3OverviewPayload = null

      v3OverviewError =
        error?.message ||
        'Impossible de charger l’Overview.'

      return null

    } finally {
      v3OverviewLoading = false

      if (rerender) {
        render()
      }
    }
  }


  function exactNumber(
    value
  ) {
    const text =
      String(
        value ?? ''
      )
        .trim()
        .replace(',', '.')

    if (
      !text ||
      !/^-?\d+(?:\.\d+)?$/.test(
        text
      )
    ) {
      return null
    }

    const number =
      Number(text)

    return Number.isFinite(number)
      ? number
      : null
  }


  function formatOverviewNumber(
    value,
    maximumFractionDigits = 0
  ) {
    const number =
      Number(value)

    if (
      !Number.isFinite(number)
    ) {
      return '—'
    }

    return number.toLocaleString(
      'fr-FR',
      {
        maximumFractionDigits,
      }
    )
  }


  function formatOverviewTonnage(
    kilograms
  ) {
    const value =
      Number(kilograms)

    if (
      !Number.isFinite(value) ||
      value <= 0
    ) {
      return '—'
    }

    if (value >= 1000) {
      return `${
        (value / 1000)
          .toLocaleString(
            'fr-FR',
            {
              minimumFractionDigits: 1,
              maximumFractionDigits: 1,
            }
          )
      } t`
    }

    return `${
      value.toLocaleString(
        'fr-FR',
        {
          maximumFractionDigits: 0,
        }
      )
    } kg`
  }


  function formatOverviewPercent(
    value
  ) {
    const number =
      Number(value)

    if (!Number.isFinite(number)) {
      return '—'
    }

    return `${
      number.toLocaleString(
        'fr-FR',
        {
          maximumFractionDigits: 1,
        }
      )
    } %`
  }


  function formatOverviewDate(
    value
  ) {
    if (!value) {
      return ''
    }

    const date =
      new Date(value)

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return String(value)
    }

    return new Intl.DateTimeFormat(
      'fr-FR',
      {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }
    ).format(date)
  }


  function buildV3OverviewActuals() {
    const movement = {
      SQ: {
        planned: 0,
        done: 0,
        tonnageKg: 0,
      },
      BN: {
        planned: 0,
        done: 0,
        tonnageKg: 0,
      },
      DL: {
        planned: 0,
        done: 0,
        tonnageKg: 0,
      },
    }

    const weeks = []

    let totalSessions = 0
    let completedSessions = 0
    let startedSessions = 0

    let plannedSets = 0
    let treatedSets = 0
    let doneSets = 0
    let failedSets = 0

    let totalSeconds = 0
    let tonnageKg = 0
    let tonnageSetCount = 0

    const rpes = []

    block.weeks.forEach(
      (
        week,
        weekIndex
      ) => {
        let weekPlannedSets = 0
        let weekTreatedSets = 0
        let weekDoneSets = 0
        let weekFailedSets = 0
        let weekTonnageKg = 0
        let weekCompletedSessions = 0

        week.days.forEach(
          (
            day,
            dayIndex
          ) => {
            totalSessions += 1

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

            if (session.startedAt) {
              startedSessions += 1
            }

            if (
              progress.total > 0 &&
              progress.completed ===
                progress.total
            ) {
              completedSessions += 1
              weekCompletedSessions += 1
            }

            totalSeconds +=
              elapsedSeconds(
                session
              )

            listDaySets(day)
              .forEach(
                ({
                  exercise,
                  sourceSet,
                }) => {
                  plannedSets += 1
                  weekPlannedSets += 1

                  const type =
                    String(
                      exercise?.type ||
                      ''
                    )
                      .trim()
                      .toUpperCase()

                  if (
                    movement[type]
                  ) {
                    movement[
                      type
                    ].planned += 1
                  }

                  const set =
                    getSetState(
                      state,
                      sourceSet
                    )

                  const terminal =
                    set.status ===
                      'done' ||
                    set.status ===
                      'failed'

                  if (terminal) {
                    treatedSets += 1
                    weekTreatedSets += 1
                  }

                  if (
                    set.status ===
                      'failed'
                  ) {
                    failedSets += 1
                    weekFailedSets += 1
                    return
                  }

                  if (
                    set.status !==
                      'done'
                  ) {
                    return
                  }

                  doneSets += 1
                  weekDoneSets += 1

                  if (
                    movement[type]
                  ) {
                    movement[
                      type
                    ].done += 1
                  }

                  const rpe =
                    exactNumber(
                      set.rpe
                    )

                  if (
                    rpe !== null
                  ) {
                    rpes.push(rpe)
                  }

                  const load =
                    exactNumber(
                      set.load
                    )

                  const reps =
                    exactNumber(
                      sourceSet.reps
                    )

                  /*
                   * On ne devine jamais les reps d'une fourchette.
                   * Le tonnage n'utilise que les séries dont charge
                   * ET répétitions sont des valeurs exactes.
                   */
                  if (
                    load === null ||
                    reps === null ||
                    load <= 0 ||
                    reps <= 0
                  ) {
                    return
                  }

                  const setTonnage =
                    load * reps

                  tonnageKg +=
                    setTonnage

                  weekTonnageKg +=
                    setTonnage

                  tonnageSetCount += 1

                  if (
                    movement[type]
                  ) {
                    movement[
                      type
                    ].tonnageKg +=
                      setTonnage
                  }
                }
              )
          }
        )

        weeks.push({
          id:
            week.id,
          label:
            week.label,
          sessions:
            week.days.length,
          completedSessions:
            weekCompletedSessions,
          plannedSets:
            weekPlannedSets,
          treatedSets:
            weekTreatedSets,
          doneSets:
            weekDoneSets,
          failedSets:
            weekFailedSets,
          tonnageKg:
            weekTonnageKg,
        })
      }
    )

    const averageRpe =
      rpes.length
        ? (
            rpes.reduce(
              (
                sum,
                value
              ) =>
                sum + value,
              0
            ) /
            rpes.length
          )
        : null

    return {
      weeks,
      movement,
      totalSessions,
      completedSessions,
      startedSessions,
      plannedSets,
      treatedSets,
      doneSets,
      failedSets,
      totalSeconds,
      tonnageKg,
      tonnageSetCount,
      averageRpe,
      adherence:
        plannedSets > 0
          ? (
              doneSets /
              plannedSets *
              100
            )
          : 0,
      completion:
        plannedSets > 0
          ? (
              treatedSets /
              plannedSets *
              100
            )
          : 0,
    }
  }


  function renderV3OverviewLauncher() {
    const meta =
      selectedV3Meta()

    const title =
      meta?.title ||
      block?.label ||
      'Bloc'

    return `
      <section
        class="training-v3-overview-launcher"
        style="
          margin:0 0 14px;
          padding:14px;
          border:
            1px solid
            rgba(255,159,67,.46);
          border-radius:16px;
          background:
            linear-gradient(
              135deg,
              rgba(118,61,12,.34),
              rgba(24,18,12,.78)
            );
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:14px;
          flex-wrap:wrap;
        "
      >
        <div>
          <span
            style="
              display:block;
              color:#ffb45f;
              font-size:11px;
              font-weight:900;
              letter-spacing:.12em;
              text-transform:uppercase;
            "
          >
            ◈ OVERVIEW DU BLOC
          </span>

          <strong
            style="
              display:block;
              margin-top:4px;
              color:#fff6e9;
              font-size:15px;
            "
          >
            ${escapeHtml(title)}
          </strong>

          <small
            style="
              display:block;
              margin-top:4px;
              color:#aa9b89;
              font-size:11px;
            "
          >
            Planification, volume et réalisation réelle.
          </small>
        </div>

        <button
          type="button"
          data-action="${
            showV3Overview
              ? 'v3-overview-close'
              : 'v3-overview-open'
          }"
          style="
            cursor:pointer;
            min-width:150px;
            padding:10px 14px;
            border-radius:12px;
            border:
              1px solid
              rgba(255,177,91,.65);
            background:
              rgba(205,105,26,.20);
            color:#ffd39d;
            font-size:12px;
            font-weight:900;
            letter-spacing:.04em;
          "
        >
          ${
            showV3Overview
              ? '← RETOUR SÉANCE'
              : 'OUVRIR L’OVERVIEW →'
          }
        </button>
      </section>
    `
  }


  function overviewSetPrescription(
    sourceSet
  ) {
    const parts = []

    const reps =
      String(
        sourceSet?.reps ?? ''
      ).trim()

    if (reps) {
      parts.push(
        `${escapeHtml(reps)} rep${
          reps === '1'
            ? ''
            : 's'
        }`
      )
    }

    if (
      sourceSet?.percent !== null &&
      sourceSet?.percent !== undefined &&
      sourceSet?.percent !== ''
    ) {
      parts.push(
        `${escapeHtml(
          sourceSet.percent
        )}%`
      )
    }

    const range =
      formatLoadRange(
        sourceSet?.loadRange
      )

    if (range) {
      parts.push(
        `${escapeHtml(
          range
        )} kg`
      )
    }

    if (sourceSet?.intensity) {
      parts.push(
        escapeHtml(
          sourceSet.intensity
        )
      )
    }

    return (
      parts.join(' · ') ||
      'Charge libre'
    )
  }


  function overviewExerciseLines(
    day
  ) {
    const rows = []

    const exercises =
      Array.isArray(
        day?.exercises
      )
        ? day.exercises
        : []

    exercises.forEach(
      exercise => {
        const name =
          exercise?.variant
            ? `${
                exercise.name
              } · ${
                exercise.variant
              }`
            : exercise?.name ||
              'Exercice'

        const type =
          String(
            exercise?.type ||
            'AC'
          )
            .trim()
            .toUpperCase()

        const sets =
          Array.isArray(
            exercise?.sets
          )
            ? exercise.sets
            : []

        const prescriptions =
          sets.map(
            sourceSet =>
              overviewSetPrescription(
                sourceSet
              )
          )

        rows.push({
          name,
          type,
          sets:
            sets.length,
          prescriptions,
        })
      }
    )

    return rows
  }


  function renderV3GlobalBlockPlan() {
    return `
      <section
        style="
          margin-bottom:24px;
        "
      >
        <div
          style="
            display:flex;
            justify-content:space-between;
            align-items:flex-end;
            gap:14px;
            flex-wrap:wrap;
          "
        >
          <div>
            <span
              style="
                color:#ff9f43;
                font-size:10px;
                font-weight:900;
                letter-spacing:.14em;
                text-transform:uppercase;
              "
            >
              VISION GLOBALE DU BLOC
            </span>

            <h3
              style="
                margin:5px 0 0;
                color:#fff4e8;
                font-size:20px;
                letter-spacing:-.025em;
              "
            >
              Toutes les séances, sans ouvrir les semaines une par une
            </h3>

            <p
              style="
                margin:6px 0 0;
                color:#8f857a;
                font-size:11px;
                line-height:1.55;
              "
            >
              Chaque jour du bloc est visible directement avec ses exercices
              et ses prescriptions prévues.
            </p>
          </div>

          <span
            style="
              padding:7px 10px;
              border-radius:999px;
              background:rgba(255,159,67,.08);
              border:1px solid rgba(255,159,67,.20);
              color:#bca58c;
              font-size:10px;
              font-weight:800;
            "
          >
            ${block.weeks.reduce(
              (
                total,
                week
              ) =>
                total +
                (
                  Array.isArray(
                    week?.days
                  )
                    ? week.days.length
                    : 0
                ),
              0
            )} séances
          </span>
        </div>

        <div
          style="
            display:grid;
            gap:16px;
            margin-top:14px;
          "
        >
          ${block.weeks.map(
            (
              week,
              weekIndex
            ) => `
              <section
                style="
                  padding:14px;
                  border-radius:16px;
                  border:
                    1px solid
                    rgba(255,255,255,.075);
                  background:
                    rgba(255,255,255,.022);
                "
              >
                <div
                  style="
                    display:flex;
                    align-items:center;
                    justify-content:space-between;
                    gap:12px;
                    margin-bottom:11px;
                  "
                >
                  <div>
                    <span
                      style="
                        color:#c67b3b;
                        font-size:9px;
                        font-weight:900;
                        letter-spacing:.13em;
                        text-transform:uppercase;
                      "
                    >
                      SEMAINE ${
                        week.number ||
                        weekIndex + 1
                      }
                    </span>

                    <strong
                      style="
                        display:block;
                        margin-top:2px;
                        color:#f5eadf;
                        font-size:17px;
                      "
                    >
                      ${escapeHtml(
                        week.label ||
                        `S${weekIndex + 1}`
                      )}
                    </strong>
                  </div>

                  <span
                    style="
                      color:#7e756c;
                      font-size:10px;
                    "
                  >
                    ${
                      Array.isArray(
                        week.days
                      )
                        ? week.days.length
                        : 0
                    } jours
                  </span>
                </div>

                <div
                  style="
                    display:grid;
                    grid-template-columns:
                      repeat(
                        auto-fit,
                        minmax(210px,1fr)
                      );
                    gap:10px;
                  "
                >
                  ${(week.days || []).map(
                    (
                      day,
                      dayIndex
                    ) => {
                      const lines =
                        overviewExerciseLines(
                          day
                        )

                      const totalSets =
                        lines.reduce(
                          (
                            sum,
                            row
                          ) =>
                            sum +
                            row.sets,
                          0
                        )

                      const liftCounts =
                        {
                          SQ: 0,
                          BN: 0,
                          DL: 0,
                          AC: 0,
                        }

                      lines.forEach(
                        row => {
                          if (
                            Object.prototype
                              .hasOwnProperty
                              .call(
                                liftCounts,
                                row.type
                              )
                          ) {
                            liftCounts[
                              row.type
                            ] +=
                              row.sets
                          } else {
                            liftCounts.AC +=
                              row.sets
                          }
                        }
                      )

                      return `
                        <article
                          style="
                            min-width:0;
                            padding:13px;
                            border-radius:14px;
                            border:
                              1px solid
                              rgba(255,255,255,.08);
                            background:
                              linear-gradient(
                                145deg,
                                rgba(255,255,255,.035),
                                rgba(0,0,0,.10)
                              );
                          "
                        >
                          <div
                            style="
                              display:flex;
                              justify-content:space-between;
                              align-items:flex-start;
                              gap:10px;
                            "
                          >
                            <div
                              style="
                                min-width:0;
                              "
                            >
                              <span
                                style="
                                  color:#806f61;
                                  font-size:9px;
                                  font-weight:900;
                                  text-transform:uppercase;
                                  letter-spacing:.10em;
                                "
                              >
                                ${
                                  escapeHtml(
                                    week.label ||
                                    `S${weekIndex + 1}`
                                  )
                                }
                                · JOUR ${
                                  dayIndex + 1
                                }
                              </span>

                              <strong
                                style="
                                  display:block;
                                  margin-top:4px;
                                  color:#fff3e5;
                                  font-size:13px;
                                  line-height:1.35;
                                "
                              >
                                ${
                                  day.emoji
                                    ? `${
                                        escapeHtml(
                                          day.emoji
                                        )
                                      } `
                                    : ''
                                }${escapeHtml(
                                  day.name ||
                                  `Jour ${dayIndex + 1}`
                                )}
                              </strong>
                            </div>

                            <span
                              style="
                                flex:0 0 auto;
                                padding:5px 7px;
                                border-radius:9px;
                                background:
                                  rgba(255,159,67,.08);
                                color:#c79b70;
                                font-size:9px;
                                font-weight:850;
                              "
                            >
                              ${totalSets} séries
                            </span>
                          </div>

                          <div
                            style="
                              display:flex;
                              flex-wrap:wrap;
                              gap:5px;
                              margin-top:9px;
                            "
                          >
                            ${[
                              ['SQ', liftCounts.SQ],
                              ['BN', liftCounts.BN],
                              ['DL', liftCounts.DL],
                              ['AC', liftCounts.AC],
                            ]
                              .filter(
                                (
                                  [
                                    ,
                                    count,
                                  ]
                                ) =>
                                  count > 0
                              )
                              .map(
                                (
                                  [
                                    code,
                                    count,
                                  ]
                                ) => `
                                  <span
                                    style="
                                      padding:4px 6px;
                                      border-radius:8px;
                                      border:
                                        1px solid
                                        rgba(255,255,255,.07);
                                      background:
                                        rgba(255,255,255,.025);
                                      color:#958a7f;
                                      font-size:8px;
                                      font-weight:850;
                                    "
                                  >
                                    ${code}
                                    ·
                                    ${count}
                                  </span>
                                `
                              )
                              .join('')}
                          </div>

                          <div
                            style="
                              display:grid;
                              gap:7px;
                              margin-top:11px;
                            "
                          >
                            ${lines.map(
                              row => `
                                <div
                                  style="
                                    padding-top:7px;
                                    border-top:
                                      1px solid
                                      rgba(255,255,255,.05);
                                  "
                                >
                                  <div
                                    style="
                                      display:flex;
                                      justify-content:space-between;
                                      gap:8px;
                                      align-items:flex-start;
                                    "
                                  >
                                    <strong
                                      style="
                                        min-width:0;
                                        color:#dcd1c5;
                                        font-size:10px;
                                        line-height:1.35;
                                      "
                                    >
                                      ${escapeHtml(
                                        row.name
                                      )}
                                    </strong>

                                    <span
                                      style="
                                        flex:0 0 auto;
                                        color:#b37742;
                                        font-size:8px;
                                        font-weight:900;
                                      "
                                    >
                                      ${escapeHtml(
                                        row.type
                                      )}
                                    </span>
                                  </div>

                                  <div
                                    style="
                                      display:grid;
                                      gap:3px;
                                      margin-top:4px;
                                    "
                                  >
                                    ${row.prescriptions.map(
                                      (
                                        prescription,
                                        setIndex
                                      ) => `
                                        <small
                                          style="
                                            color:#77716b;
                                            font-size:8px;
                                            line-height:1.35;
                                          "
                                        >
                                          S${setIndex + 1}
                                          ·
                                          ${prescription}
                                        </small>
                                      `
                                    ).join('')}
                                  </div>
                                </div>
                              `
                            ).join('')}
                          </div>
                        </article>
                      `
                    }
                  ).join('')}
                </div>
              </section>
            `
          ).join('')}
        </div>
      </section>
    `
  }


  function renderV3OverviewNarrative(
    overview
  ) {
    const sections =
      Array.isArray(
        overview?.sections
      )
        ? overview.sections
        : []

    const notes =
      Array.isArray(
        overview?.notes
      )
        ? overview.notes
        : []

    const instructions =
      Array.isArray(
        overview?.instructions
      )
        ? overview.instructions
        : Array.isArray(
            overview?.coachInstructions
          )
          ? overview.coachInstructions
          : []

    const tiers =
      Array.isArray(
        overview?.tiers
      )
        ? overview.tiers
        : []

    const parts = []

    if (sections.length) {
      parts.push(`
        <section
          style="
            display:grid;
            gap:10px;
          "
        >
          ${sections.map(
            section => `
              <article
                style="
                  padding:15px;
                  border-radius:14px;
                  border:
                    1px solid
                    rgba(255,255,255,.08);
                  background:
                    rgba(255,255,255,.035);
                "
              >
                ${section?.title
                  ? `
                    <strong
                      style="
                        color:#fff4e6;
                        font-size:14px;
                      "
                    >
                      ${escapeHtml(
                        section.title
                      )}
                    </strong>
                  `
                  : ''}

                ${section?.text
                  ? `
                    <p
                      style="
                        margin:7px 0 0;
                        color:#b9afa3;
                        font-size:12px;
                        line-height:1.65;
                      "
                    >
                      ${escapeHtml(
                        section.text
                      )}
                    </p>
                  `
                  : ''}

                ${Array.isArray(
                    section?.items
                  ) &&
                  section.items.length
                  ? `
                    <ul
                      style="
                        margin:9px 0 0;
                        padding-left:18px;
                        color:#c9bdb0;
                        font-size:12px;
                        line-height:1.65;
                      "
                    >
                      ${section.items.map(
                        item => `
                          <li>
                            ${escapeHtml(
                              typeof item ===
                                'string'
                                ? item
                                : item?.text ||
                                  item?.label ||
                                  JSON.stringify(
                                    item
                                  )
                            )}
                          </li>
                        `
                      ).join('')}
                    </ul>
                  `
                  : ''}
              </article>
            `
          ).join('')}
        </section>
      `)
    }

    if (tiers.length) {
      parts.push(`
        <section
          style="
            margin-top:14px;
          "
        >
          <span
            style="
              color:#ffb45f;
              font-size:10px;
              font-weight:900;
              letter-spacing:.12em;
              text-transform:uppercase;
            "
          >
            ARCHITECTURE DU BLOC
          </span>

          <div
            style="
              display:grid;
              gap:8px;
              margin-top:8px;
            "
          >
            ${tiers.map(
              tier => `
                <article
                  style="
                    display:grid;
                    grid-template-columns:
                      minmax(44px,70px)
                      minmax(0,1fr);
                    gap:12px;
                    padding:12px;
                    border-radius:12px;
                    border:
                      1px solid
                      rgba(255,255,255,.08);
                    background:
                      rgba(255,255,255,.03);
                  "
                >
                  <strong
                    style="
                      color:#ffb45f;
                      font-size:24px;
                    "
                  >
                    ${escapeHtml(
                      tier?.code ||
                      tier?.name ||
                      '—'
                    )}
                  </strong>

                  <div>
                    <strong
                      style="
                        color:#f5eee6;
                        font-size:12px;
                      "
                    >
                      ${escapeHtml(
                        tier?.title ||
                        tier?.days ||
                        tier?.label ||
                        ''
                      )}
                    </strong>

                    <p
                      style="
                        margin:4px 0 0;
                        color:#a99d90;
                        font-size:11px;
                        line-height:1.55;
                      "
                    >
                      ${escapeHtml(
                        tier?.role ||
                        tier?.text ||
                        ''
                      )}
                    </p>
                  </div>
                </article>
              `
            ).join('')}
          </div>
        </section>
      `)
    }

    if (
      instructions.length ||
      notes.length
    ) {
      const lines = [
        ...instructions,
        ...notes,
      ]

      parts.push(`
        <section
          style="
            margin-top:14px;
            padding:14px;
            border-radius:14px;
            border:
              1px solid
              rgba(255,177,91,.18);
            background:
              rgba(205,105,26,.055);
          "
        >
          <span
            style="
              color:#ffb45f;
              font-size:10px;
              font-weight:900;
              letter-spacing:.12em;
              text-transform:uppercase;
            "
          >
            CONSIGNES DU BLOC
          </span>

          <ul
            style="
              margin:9px 0 0;
              padding-left:18px;
              color:#c4b8aa;
              font-size:12px;
              line-height:1.65;
            "
          >
            ${lines.map(
              item => `
                <li>
                  ${escapeHtml(
                    typeof item ===
                      'string'
                      ? item
                      : item?.text ||
                        item?.label ||
                        JSON.stringify(
                          item
                        )
                  )}
                </li>
              `
            ).join('')}
          </ul>
        </section>
      `)
    }

    return parts.join('')
  }


  function renderV3Overview() {
    if (v3OverviewLoading) {
      return `
        <section
          style="
            padding:26px;
            border-radius:18px;
            border:
              1px solid
              rgba(255,159,67,.35);
            background:#10100f;
            color:#cbbdac;
          "
        >
          Chargement de l’Overview Supabase…
        </section>
      `
    }

    if (v3OverviewError) {
      return `
        <section
          style="
            padding:20px;
            border-radius:18px;
            border:
              1px solid
              rgba(255,110,110,.35);
            background:
              rgba(55,15,15,.32);
          "
        >
          <strong
            style="
              color:#ff9f91;
            "
          >
            Overview indisponible
          </strong>

          <p
            style="
              color:#c9a39d;
              font-size:12px;
            "
          >
            ${escapeHtml(
              v3OverviewError
            )}
          </p>

          <button
            type="button"
            data-action="v3-overview-retry"
            style="
              cursor:pointer;
              padding:9px 12px;
              border-radius:10px;
              border:
                1px solid
                rgba(255,159,67,.45);
              background:
                rgba(205,105,26,.16);
              color:#ffd19b;
              font-weight:800;
            "
          >
            Réessayer
          </button>
        </section>
      `
    }

    const payload =
      v3OverviewPayload || {}

    const overview =
      payload.overview || {}

    const hero =
      overview.hero || {}

    const planned =
      overview.planned || {}

    const source =
      overview.source || {}

    const meta =
      selectedV3Meta()

    const actual =
      buildV3OverviewActuals()

    const plannedTotalSets =
      Number.isFinite(
        Number(
          planned.totalSets
        )
      )
        ? Number(
            planned.totalSets
          )
        : actual.plannedSets

    const plannedMovement =
      planned.movementSets ||
      {}

    const plannedWeeks =
      Array.isArray(
        planned.setsPerWeek
      )
        ? planned.setsPerWeek
        : []

    const maxWeekTonnage =
      Math.max(
        1,
        ...actual.weeks.map(
          item =>
            item.tonnageKg
        )
      )

    const statusLabel =
      meta?.status ===
        'archived'
        ? 'ARCHIVÉ'
        : 'BLOC ACTUEL'

    const dateText =
      [
        meta?.starts_on
          ? `Début ${formatOverviewDate(
              meta.starts_on
            )}`
          : '',
        meta?.ends_on
          ? `Fin ${formatOverviewDate(
              meta.ends_on
            )}`
          : '',
      ]
        .filter(Boolean)
        .join(' · ')

    return `
      <section
        class="training-v3-overview"
        style="
          border-radius:20px;
          overflow:hidden;
          border:
            1px solid
            rgba(255,159,67,.30);
          background:
            radial-gradient(
              circle at top right,
              rgba(177,78,13,.17),
              transparent 34%
            ),
            #0e0f0f;
          box-shadow:
            0 18px 60px
            rgba(0,0,0,.22);
        "
      >
        <header
          style="
            padding:
              clamp(20px,4vw,34px);
            border-bottom:
              1px solid
              rgba(255,255,255,.07);
            background:
              linear-gradient(
                135deg,
                rgba(118,61,12,.23),
                rgba(8,10,10,.1)
              );
          "
        >
          <div
            style="
              display:flex;
              justify-content:space-between;
              gap:18px;
              flex-wrap:wrap;
              align-items:flex-start;
            "
          >
            <div>
              <span
                style="
                  color:#ff9f43;
                  font-size:10px;
                  font-weight:900;
                  letter-spacing:.18em;
                  text-transform:uppercase;
                "
              >
                GA COACHING · BLOCK OVERVIEW
              </span>

              <h2
                style="
                  margin:8px 0 0;
                  color:#fff7ed;
                  font-size:
                    clamp(28px,5vw,50px);
                  line-height:.95;
                  letter-spacing:-.035em;
                "
              >
                ${escapeHtml(
                  payload.title ||
                  hero.title ||
                  meta?.title ||
                  block.label ||
                  'Bloc'
                )}
              </h2>

              <p
                style="
                  margin:10px 0 0;
                  color:#a99d90;
                  font-size:12px;
                "
              >
                ${escapeHtml(
                  payload.subtitle ||
                  hero.subtitle ||
                  meta?.subtitle ||
                  ''
                )}
              </p>

              ${dateText
                ? `
                  <small
                    style="
                      display:block;
                      margin-top:7px;
                      color:#766f67;
                      font-size:10px;
                    "
                  >
                    ${escapeHtml(
                      dateText
                    )}
                  </small>
                `
                : ''}
            </div>

            <span
              style="
                padding:7px 10px;
                border-radius:999px;
                border:
                  1px solid
                  rgba(255,159,67,.38);
                background:
                  rgba(205,105,26,.12);
                color:#ffb45f;
                font-size:10px;
                font-weight:900;
                letter-spacing:.09em;
              "
            >
              ${statusLabel}
            </span>
          </div>

          <div
            style="
              display:grid;
              grid-template-columns:
                repeat(
                  auto-fit,
                  minmax(120px,1fr)
                );
              gap:9px;
              margin-top:22px;
            "
          >
            ${[
              [
                'Semaines',
                hero.weeks ??
                  block.weeks.length,
              ],
              [
                'Séances',
                hero.sessions ??
                  actual.totalSessions,
              ],
              [
                'Séances / sem.',
                hero.sessionsPerWeek ??
                  (
                    block.weeks.length
                      ? (
                          actual.totalSessions /
                          block.weeks.length
                        ).toLocaleString(
                          'fr-FR',
                          {
                            maximumFractionDigits: 1,
                          }
                        )
                      : '—'
                  ),
              ],
              [
                'Séries prévues',
                plannedTotalSets,
              ],
            ].map(
              ([label, value]) => `
                <div
                  style="
                    padding:12px;
                    border-radius:12px;
                    background:
                      rgba(255,255,255,.035);
                    border:
                      1px solid
                      rgba(255,255,255,.07);
                  "
                >
                  <span
                    style="
                      color:#766f67;
                      font-size:9px;
                      font-weight:800;
                      letter-spacing:.10em;
                      text-transform:uppercase;
                    "
                  >
                    ${escapeHtml(label)}
                  </span>

                  <strong
                    style="
                      display:block;
                      margin-top:4px;
                      color:#f6eee5;
                      font-size:22px;
                    "
                  >
                    ${escapeHtml(value)}
                  </strong>
                </div>
              `
            ).join('')}
          </div>
        </header>


        <div
          style="
            padding:
              clamp(16px,3vw,26px);
          "
        >
          ${renderV3GlobalBlockPlan()}

          <section>
            <span
              style="
                color:#ff9f43;
                font-size:10px;
                font-weight:900;
                letter-spacing:.14em;
                text-transform:uppercase;
              "
            >
              PLANIFIÉ VS RÉALISÉ
            </span>

            <div
              style="
                display:grid;
                grid-template-columns:
                  repeat(
                    auto-fit,
                    minmax(145px,1fr)
                  );
                gap:10px;
                margin-top:9px;
              "
            >
              ${[
                [
                  'Séries réalisées',
                  `${actual.doneSets}/${plannedTotalSets}`,
                  formatOverviewPercent(
                    actual.adherence
                  ),
                ],
                [
                  'Séries traitées',
                  `${actual.treatedSets}/${plannedTotalSets}`,
                  actual.failedSets
                    ? `${actual.failedSets} skip/échec`
                    : 'aucun échec',
                ],
                [
                  'Séances terminées',
                  `${actual.completedSessions}/${actual.totalSessions}`,
                  `${actual.startedSessions} démarrée${
                    actual.startedSessions > 1
                      ? 's'
                      : ''
                  }`,
                ],
                [
                  'RPE moyen',
                  actual.averageRpe ===
                    null
                    ? '—'
                    : actual.averageRpe
                        .toLocaleString(
                          'fr-FR',
                          {
                            minimumFractionDigits: 1,
                            maximumFractionDigits: 2,
                          }
                        ),
                  actual.averageRpe ===
                    null
                    ? 'pas encore de RPE'
                    : `${actual.doneSets} séries validées`,
                ],
                [
                  'Tonnage réel',
                  formatOverviewTonnage(
                    actual.tonnageKg
                  ),
                  actual.tonnageSetCount
                    ? `${actual.tonnageSetCount} séries calculables`
                    : 'charges non renseignées',
                ],
                [
                  'Temps cumulé',
                  actual.totalSeconds
                    ? formatDuration(
                        actual.totalSeconds
                      )
                    : '—',
                  'temps de séance',
                ],
              ].map(
                (
                  [
                    label,
                    value,
                    sub,
                  ]
                ) => `
                  <article
                    style="
                      padding:14px;
                      border-radius:14px;
                      border:
                        1px solid
                        rgba(255,255,255,.07);
                      background:
                        rgba(255,255,255,.028);
                    "
                  >
                    <span
                      style="
                        color:#82786e;
                        font-size:9px;
                        font-weight:800;
                        letter-spacing:.10em;
                        text-transform:uppercase;
                      "
                    >
                      ${escapeHtml(label)}
                    </span>

                    <strong
                      style="
                        display:block;
                        margin-top:5px;
                        color:#fff3e5;
                        font-size:25px;
                        letter-spacing:-.035em;
                      "
                    >
                      ${escapeHtml(value)}
                    </strong>

                    <small
                      style="
                        display:block;
                        margin-top:4px;
                        color:#8f8479;
                        font-size:10px;
                      "
                    >
                      ${escapeHtml(sub)}
                    </small>
                  </article>
                `
              ).join('')}
            </div>
          </section>


          <section
            style="
              margin-top:22px;
            "
          >
            <span
              style="
                color:#ff9f43;
                font-size:10px;
                font-weight:900;
                letter-spacing:.14em;
                text-transform:uppercase;
              "
            >
              RÉPARTITION SBD
            </span>

            <div
              style="
                display:grid;
                grid-template-columns:
                  repeat(
                    3,
                    minmax(0,1fr)
                  );
                gap:9px;
                margin-top:9px;
              "
            >
              ${[
                ['SQ', 'Squat'],
                ['BN', 'Bench'],
                ['DL', 'Deadlift'],
              ].map(
                ([code, label]) => {
                  const plannedValue =
                    Number(
                      plannedMovement[
                        code
                      ]
                    )

                  const plan =
                    Number.isFinite(
                      plannedValue
                    )
                      ? plannedValue
                      : actual
                          .movement[
                            code
                          ].planned

                  const done =
                    actual
                      .movement[
                        code
                      ].done

                  const pct =
                    plan > 0
                      ? (
                          done /
                          plan *
                          100
                        )
                      : 0

                  return `
                    <article
                      style="
                        padding:13px;
                        border-radius:13px;
                        border:
                          1px solid
                          rgba(255,255,255,.07);
                        background:
                          rgba(255,255,255,.026);
                      "
                    >
                      <span
                        style="
                          color:#a28f7b;
                          font-size:9px;
                          font-weight:900;
                        "
                      >
                        ${code}
                      </span>

                      <strong
                        style="
                          display:block;
                          margin-top:3px;
                          color:#f8eee3;
                          font-size:15px;
                        "
                      >
                        ${label}
                      </strong>

                      <div
                        style="
                          margin-top:9px;
                          height:5px;
                          border-radius:999px;
                          overflow:hidden;
                          background:
                            rgba(255,255,255,.07);
                        "
                      >
                        <div
                          style="
                            width:${
                              Math.min(
                                100,
                                Math.max(
                                  0,
                                  pct
                                )
                              )
                            }%;
                            height:100%;
                            background:#d67a2d;
                          "
                        ></div>
                      </div>

                      <small
                        style="
                          display:block;
                          margin-top:7px;
                          color:#8d8379;
                          font-size:10px;
                        "
                      >
                        ${done}/${plan}
                        séries ·
                        ${formatOverviewTonnage(
                          actual
                            .movement[
                              code
                            ].tonnageKg
                        )}
                      </small>
                    </article>
                  `
                }
              ).join('')}
            </div>

            ${
              (
                planned.percentMin !==
                  undefined ||
                planned.percentMax !==
                  undefined ||
                planned.percentAverage !==
                  undefined
              )
                ? `
                  <div
                    style="
                      display:flex;
                      gap:16px;
                      flex-wrap:wrap;
                      margin-top:10px;
                      padding:10px 12px;
                      border-radius:11px;
                      background:
                        rgba(255,159,67,.055);
                      color:#9f9387;
                      font-size:10px;
                    "
                  >
                    <span>
                      Intensité min :
                      <strong
                        style="
                          color:#d6c7b6;
                        "
                      >
                        ${formatOverviewPercent(
                          planned.percentMin
                        )}
                      </strong>
                    </span>

                    <span>
                      moyenne :
                      <strong
                        style="
                          color:#d6c7b6;
                        "
                      >
                        ${formatOverviewPercent(
                          planned.percentAverage
                        )}
                      </strong>
                    </span>

                    <span>
                      max :
                      <strong
                        style="
                          color:#d6c7b6;
                        "
                      >
                        ${formatOverviewPercent(
                          planned.percentMax
                        )}
                      </strong>
                    </span>
                  </div>
                `
                : ''
            }
          </section>


          <section
            style="
              margin-top:22px;
            "
          >
            <span
              style="
                color:#ff9f43;
                font-size:10px;
                font-weight:900;
                letter-spacing:.14em;
                text-transform:uppercase;
              "
            >
              PROGRESSION PAR SEMAINE
            </span>

            <div
              style="
                display:grid;
                gap:9px;
                margin-top:9px;
              "
            >
              ${actual.weeks.map(
                (
                  week,
                  index
                ) => {
                  const plannedWeekSets =
                    Number(
                      plannedWeeks[
                        index
                      ]
                    )

                  const plan =
                    Number.isFinite(
                      plannedWeekSets
                    )
                      ? plannedWeekSets
                      : week.plannedSets

                  const setPct =
                    plan > 0
                      ? (
                          week.doneSets /
                          plan *
                          100
                        )
                      : 0

                  const tonnagePct =
                    week.tonnageKg > 0
                      ? (
                          week.tonnageKg /
                          maxWeekTonnage *
                          100
                        )
                      : 0

                  return `
                    <article
                      style="
                        padding:12px 13px;
                        border-radius:13px;
                        border:
                          1px solid
                          rgba(255,255,255,.07);
                        background:
                          rgba(255,255,255,.026);
                      "
                    >
                      <div
                        style="
                          display:flex;
                          justify-content:space-between;
                          gap:12px;
                          align-items:baseline;
                        "
                      >
                        <strong
                          style="
                            color:#f3e9dd;
                            font-size:13px;
                          "
                        >
                          ${escapeHtml(
                            week.label
                          )}
                        </strong>

                        <span
                          style="
                            color:#958a7f;
                            font-size:10px;
                          "
                        >
                          ${week.completedSessions}/${week.sessions}
                          séances ·
                          ${week.doneSets}/${plan}
                          séries
                        </span>
                      </div>

                      <div
                        style="
                          margin-top:8px;
                          height:6px;
                          border-radius:999px;
                          overflow:hidden;
                          background:
                            rgba(255,255,255,.06);
                        "
                      >
                        <div
                          style="
                            width:${
                              Math.min(
                                100,
                                Math.max(
                                  0,
                                  setPct
                                )
                              )
                            }%;
                            height:100%;
                            background:#cf7125;
                          "
                        ></div>
                      </div>

                      <div
                        style="
                          display:flex;
                          justify-content:space-between;
                          gap:12px;
                          margin-top:7px;
                          color:#7f776f;
                          font-size:9px;
                        "
                      >
                        <span>
                          ${
                            formatOverviewPercent(
                              setPct
                            )
                          }
                          réalisé
                        </span>

                        <span>
                          Tonnage :
                          ${formatOverviewTonnage(
                            week.tonnageKg
                          )}
                        </span>
                      </div>

                      ${
                        week.tonnageKg > 0
                          ? `
                            <div
                              style="
                                margin-top:5px;
                                height:3px;
                                border-radius:999px;
                                overflow:hidden;
                                background:
                                  rgba(255,255,255,.04);
                              "
                            >
                              <div
                                style="
                                  width:${
                                    Math.min(
                                      100,
                                      Math.max(
                                        0,
                                        tonnagePct
                                      )
                                    )
                                  }%;
                                  height:100%;
                                  background:
                                    rgba(
                                      255,
                                      181,
                                      95,
                                      .55
                                    );
                                "
                              ></div>
                            </div>
                          `
                          : ''
                      }
                    </article>
                  `
                }
              ).join('')}
            </div>
          </section>


          ${renderV3OverviewNarrative(
            overview
          )}


          ${
            source?.sourceFile ||
            source?.sourceKey
              ? `
                <footer
                  style="
                    margin-top:18px;
                    padding-top:12px;
                    border-top:
                      1px solid
                      rgba(255,255,255,.055);
                    color:#5f5b56;
                    font-size:9px;
                    line-height:1.55;
                  "
                >
                  Source programme :
                  ${escapeHtml(
                    source.sourceFile ||
                    'Supabase'
                  )}
                  ${
                    source.sourceKey
                      ? ` · ${escapeHtml(
                          source.sourceKey
                        )}`
                      : ''
                  }
                </footer>
              `
              : ''
          }
        </div>
      </section>
    `
  }


  function renderV3BlockHistory() {
    if (v3BlocksLoading) {
      return `
        <section
          class="training-v3-history"
          style="
            margin:14px 0 12px;
            padding:14px;
            border:1px solid rgba(58,210,128,.35);
            border-radius:16px;
            background:linear-gradient(
              135deg,
              rgba(16,82,54,.26),
              rgba(10,22,19,.72)
            );
          "
        >
          <span
            style="
              display:block;
              color:#61e7a2;
              font-size:11px;
              font-weight:900;
              letter-spacing:.12em;
              text-transform:uppercase;
            "
          >
            🗂 ANTÉCÉDENTS DE BLOCS
          </span>

          <div
            style="
              margin-top:8px;
              color:#9db2a7;
              font-size:12px;
            "
          >
            Chargement des blocs Supabase…
          </div>
        </section>
      `
    }

    if (v3BlocksError) {
      return `
        <section
          class="training-v3-history"
          style="
            margin:14px 0 12px;
            padding:14px;
            border:1px solid rgba(255,110,110,.35);
            border-radius:16px;
            background:rgba(55,15,15,.35);
          "
        >
          <span
            style="
              display:block;
              color:#ff9f91;
              font-size:11px;
              font-weight:900;
              letter-spacing:.12em;
              text-transform:uppercase;
            "
          >
            🗂 ANTÉCÉDENTS DE BLOCS
          </span>

          <div
            style="
              margin-top:8px;
              color:#ffb6ab;
              font-size:12px;
            "
          >
            ${escapeHtml(v3BlocksError)}
          </div>
        </section>
      `
    }

    const current =
      v3ProgramBlocks.find(
        item =>
          item.status ===
          'current'
      )

    const archived =
      v3ProgramBlocks.filter(
        item =>
          item.status ===
          'archived'
      )

    const selectedMeta =
      v3ProgramBlocks.find(
        item =>
          item.block_key ===
          v3SelectedBlockKey
      )

    const displayedTitle =
      selectedMeta?.title ||
      current?.title ||
      'Historique des programmations'

    return `
      <section
        class="training-v3-history"
        style="
          margin:14px 0 12px;
          padding:14px;
          border:1px solid rgba(58,210,128,.45);
          border-radius:16px;
          background:linear-gradient(
            135deg,
            rgba(16,82,54,.32),
            rgba(10,22,19,.72)
          );
          box-shadow:
            inset 0 0 0 1px rgba(110,255,177,.04);
        "
      >
        <div
          style="
            display:flex;
            align-items:flex-start;
            justify-content:space-between;
            gap:12px;
            margin-bottom:10px;
          "
        >
          <div>
            <span
              style="
                display:block;
                color:#61e7a2;
                font-size:11px;
                font-weight:900;
                letter-spacing:.12em;
                text-transform:uppercase;
              "
            >
              🗂 ANTÉCÉDENTS DE BLOCS
            </span>

            <strong
              style="
                display:block;
                margin-top:4px;
                color:#f3fff8;
                font-size:15px;
              "
            >
              ${escapeHtml(displayedTitle)}
            </strong>
          </div>

          ${selectedMeta?.status === 'archived'
            ? `
              <span
                style="
                  padding:5px 8px;
                  border-radius:999px;
                  background:rgba(255,255,255,.08);
                  color:#bfc9c3;
                  font-size:10px;
                  font-weight:800;
                  text-transform:uppercase;
                  letter-spacing:.08em;
                  white-space:nowrap;
                "
              >
                CONSULTATION
              </span>
            `
            : current
              ? `
                <span
                  style="
                    padding:5px 8px;
                    border-radius:999px;
                    background:rgba(39,210,120,.14);
                    color:#65eca7;
                    font-size:10px;
                    font-weight:800;
                    text-transform:uppercase;
                    letter-spacing:.08em;
                    white-space:nowrap;
                  "
                >
                  BLOC ACTUEL
                </span>
              `
              : ''}
        </div>

        <div
          style="
            display:flex;
            flex-wrap:wrap;
            gap:8px;
            align-items:center;
          "
        >
          ${current
            ? `
              <button
                type="button"
                data-action="v3-history-block"
                data-v3-block-key="${escapeHtml(current.block_key)}"
                ${
                  v3SwitchingBlock ||
                  (
                    v3SelectedBlockKey ===
                    current.block_key
                  )
                    ? 'disabled'
                    : ''
                }
                style="
                  cursor:${
                    v3SelectedBlockKey ===
                    current.block_key
                      ? 'default'
                      : 'pointer'
                  };
                  padding:9px 12px;
                  border-radius:12px;
                  border:${
                    v3SelectedBlockKey === current.block_key
                      ? '1px solid rgba(87,223,155,.80)'
                      : '1px solid rgba(87,223,155,.35)'
                  };
                  background:${
                    v3SelectedBlockKey === current.block_key
                      ? 'rgba(43,175,108,.28)'
                      : 'rgba(43,175,108,.13)'
                  };
                  color:#eafff2;
                  font-size:12px;
                  font-weight:800;
                "
              >
                ${escapeHtml(current.title)} · actuel
              </button>
            `
            : ''}

          ${archived.length
            ? archived.map(
                item => `
                  <button
                    type="button"
                    data-action="v3-history-block"
                    data-v3-block-key="${escapeHtml(item.block_key)}"
                    ${v3SwitchingBlock ? 'disabled' : ''}
                    style="
                      cursor:pointer;
                      padding:9px 12px;
                      border-radius:12px;
                      border:${
                        v3SelectedBlockKey === item.block_key
                          ? '1px solid rgba(87,223,155,.70)'
                          : '1px solid rgba(255,255,255,.12)'
                      };
                      background:${
                        v3SelectedBlockKey === item.block_key
                          ? 'rgba(43,175,108,.20)'
                          : 'rgba(0,0,0,.18)'
                      };
                      color:#d9e8e0;
                      font-size:12px;
                      font-weight:750;
                    "
                  >
                    ${escapeHtml(item.title)}
                  </button>
                `
              ).join('')
            : `
              <span
                style="
                  color:#90a39a;
                  font-size:12px;
                  padding:8px 2px;
                "
              >
                Aucun bloc précédent pour le moment.
              </span>
            `}
        </div>

        ${v3SwitchingBlock
          ? `
            <div
              style="
                margin-top:9px;
                color:#75e4aa;
                font-size:11px;
                font-weight:700;
              "
            >
              Chargement du bloc…
            </div>
          `
          : ''}

        ${selectedMeta?.status === 'archived'
          ? `
            <div
              style="
                margin-top:10px;
                padding:8px 10px;
                border-radius:10px;
                background:rgba(255,255,255,.05);
                color:#aebbb4;
                font-size:11px;
              "
            >
              Ancien bloc en lecture seule · aucune série ne peut être modifiée.
            </div>
          `
          : ''}
      </section>
    `
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

    const trainingBody =
      showV3Overview
        ? renderV3Overview()
        : `
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
        `

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
              GA COACHING · V3
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

        ${renderV3BlockHistory()}

        ${renderV3OverviewLauncher()}

        ${trainingBody}

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
        'v3-overview-open'
    ) {
      showV3Overview = true
      render()

      void loadV3OverviewPayload({
        rerender: true,
        force: false,
      })

      return
    }

    if (
      actionName ===
        'v3-overview-close'
    ) {
      showV3Overview = false
      render()
      return
    }

    if (
      actionName ===
        'v3-overview-retry'
    ) {
      void loadV3OverviewPayload({
        rerender: true,
        force: true,
      })
      return
    }

    if (
      actionName ===
        'v3-history-block'
    ) {
      void selectV3ProgramBlock(
        action.dataset.v3BlockKey
      )
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

  void hydrateProgramBlocksV3()

  void hydrateFromCloud()
  void hydrateSessionsFromCloud()
  void hydrateSbdPrs()
  void hydrateAthleteSteps()
  void flushSbdPrOutbox()
}
