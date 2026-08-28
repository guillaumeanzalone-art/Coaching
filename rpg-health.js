import {
  Capacitor,
  registerPlugin,
} from '@capacitor/core'

import { supabase } from './supabase.js'

const HealthSteps =
  registerPlugin('HealthSteps')

const DAY_MS =
  24 * 60 * 60 * 1000

const HEALTH_CACHE_PREFIX =
  'ga-rpg-health-v47'

const MOBILITY_SET_PREFIX =
  'ga-rpg-mobility-sets-v47'

const MOBILITY_ROUTINES = [
  {
    key: 'hip',
    icon: '🦵',
    title: 'Mobilité hanche',
    subtitle: 'Ouverture + adducteurs · ~16 min',
    exercises: [
      {
        key: 'cossack',
        title: 'Cossack squat',
        prescription: '3 séries · 6 reps par côté',
        cue: 'Pied de la jambe tendue vers le plafond, bassin bas, buste gainé.',
        sets: 3,
        visual: 'cossack',
      },
      {
        key: '9090',
        title: 'Transitions 90/90',
        prescription: '3 séries · 8 transitions',
        cue: 'Genoux au sol si possible, passe lentement d’un côté à l’autre sans t’aider des mains.',
        sets: 3,
        visual: '9090',
      },
      {
        key: 'rockback',
        title: 'Adductor rock-back',
        prescription: '2 séries · 10 reps par côté',
        cue: 'Une jambe tendue sur le côté, recule les hanches sans arrondir le bas du dos.',
        sets: 2,
        visual: 'rockback',
      },
    ],
  },
  {
    key: 'shoulder',
    icon: '🏹',
    title: 'Mobilité épaule',
    subtitle: 'Scapulas + ouverture · ~15 min',
    exercises: [
      {
        key: 'wallslide',
        title: 'Wall slide',
        prescription: '3 séries · 10 reps',
        cue: 'Dos contre le mur, côtes basses, fais glisser les bras vers le haut sans cambrer.',
        sets: 3,
        visual: 'wallslide',
      },
      {
        key: 'scappush',
        title: 'Pompe scapulaire',
        prescription: '3 séries · 10 reps',
        cue: 'Bras tendus, laisse les omoplates se rapprocher puis pousse le sol sans plier les coudes.',
        sets: 3,
        visual: 'scappush',
      },
      {
        key: 'doorpec',
        title: 'Étirement pectoral à la porte',
        prescription: '2 séries · 45 s par côté',
        cue: 'Avant-bras sur le montant, avance doucement le buste sans forcer l’épaule vers l’avant.',
        sets: 2,
        visual: 'doorpec',
      },
    ],
  },
  {
    key: 'low_back',
    icon: '🛡️',
    title: 'Soin bas du dos',
    subtitle: 'McGill Big 3 · ~15 min',
    exercises: [
      {
        key: 'mcgill',
        title: 'McGill curl-up',
        prescription: '3 séries · 6 reps · maintien 8–10 s',
        cue: 'Une jambe pliée, mains sous les lombaires, soulève légèrement tête et épaules sans écraser le bas du dos.',
        sets: 3,
        visual: 'mcgill',
      },
      {
        key: 'birddog',
        title: 'Bird-dog',
        prescription: '3 séries · 6 reps par côté · maintien 5 s',
        cue: 'À quatre pattes, tends bras et jambe opposée sans tourner le bassin ni cambrer.',
        sets: 3,
        visual: 'birddog',
      },
      {
        key: 'sideplank',
        title: 'Planche latérale',
        prescription: '3 séries · 20–30 s par côté',
        cue: 'Épaules, bassin et chevilles alignés. Garde les côtes rentrées et pousse le sol.',
        sets: 3,
        visual: 'sideplank',
      },
    ],
  },
  {
    key: 'ankle',
    icon: '🦶',
    title: 'Mobilité cheville',
    subtitle: 'Dorsiflexion + mollet · ~15 min',
    exercises: [
      {
        key: 'kneewall',
        title: 'Genou au mur',
        prescription: '3 séries · 10 reps par côté',
        cue: 'Talon collé au sol, avance le genou vers le mur dans l’axe du pied puis reviens.',
        sets: 3,
        visual: 'kneewall',
      },
      {
        key: 'soleus',
        title: 'Étirement soléaire',
        prescription: '3 séries · 45 s par côté',
        cue: 'Talon au sol, genou légèrement fléchi, avance doucement le tibia sans laisser le pied s’effondrer.',
        sets: 3,
        visual: 'soleus',
      },
      {
        key: 'calfraise',
        title: 'Mollets contrôlés',
        prescription: '3 séries · 12 reps lentes',
        cue: 'Monte en 2 s, marque 1 s en haut puis redescends en 3 s avec le pied stable.',
        sets: 3,
        visual: 'calfraise',
      },
    ],
  },
]

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function localDateKey(date = new Date()) {
  const year =
    date.getFullYear()

  const month =
    String(date.getMonth() + 1)
      .padStart(2, '0')

  const day =
    String(date.getDate())
      .padStart(2, '0')

  return `${year}-${month}-${day}`
}

function tomorrowLabel() {
  const date =
    new Date(Date.now() + DAY_MS)

  return date.toLocaleDateString(
    'fr-FR',
    {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
    }
  )
}

function daySerial(date = new Date()) {
  const anchor = Date.UTC(2026, 0, 5, 12)
  const localMidday = Date.UTC(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    12
  )
  return Math.floor((localMidday - anchor) / DAY_MS)
}

function routineForDate(date = new Date()) {
  const serial = daySerial(date)
  const index = ((serial % MOBILITY_ROUTINES.length) + MOBILITY_ROUTINES.length) % MOBILITY_ROUTINES.length
  return MOBILITY_ROUTINES[index]
}

export function stepsXpMultiplier(
  value
) {
  const steps =
    Math.max(
      0,
      Math.floor(
        Number(value) || 0
      )
    )

  if (steps <= 10000) {
    return 1 + steps / 10000
  }

  return Math.min(
    2.5,
    2 + (steps - 10000) / 20000
  )
}

function formatNumber(value) {
  return Number(value || 0)
    .toLocaleString('fr-FR', {
      maximumFractionDigits: 0,
    })
}

function formatMultiplier(value) {
  return Number(value || 1)
    .toLocaleString('fr-FR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
}

function cacheKey(athleteSlug) {
  return `${HEALTH_CACHE_PREFIX}:${athleteSlug}`
}

function setCacheKey(
  athleteSlug,
  dateKey,
  routineKey
) {
  return `${MOBILITY_SET_PREFIX}:${athleteSlug}:${dateKey}:${routineKey}`
}

function readJson(key, fallback) {
  try {
    const raw =
      localStorage.getItem(key)

    return raw
      ? JSON.parse(raw)
      : fallback
  } catch {
    return fallback
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(
      key,
      JSON.stringify(value)
    )
  } catch {
    // Le stockage local est seulement un secours UI.
  }
}

function sourceLabel(source) {
  if (source === 'healthkit') {
    return 'Apple Health'
  }

  if (source === 'server') {
    return 'Dernière synchronisation'
  }

  return 'Non synchronisé'
}

function platformCanUseHealthKit() {
  return (
    Capacitor.isNativePlatform() &&
    Capacitor.getPlatform() === 'ios'
  )
}

function exerciseVisual(kind) {
  const common = `
    <defs>
      <marker id="arrow-${kind}" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
        <path d="M0,0 L7,3.5 L0,7 Z" fill="currentColor"></path>
      </marker>
    </defs>
  `

  const body = {
    cossack: `
      <circle cx="78" cy="26" r="9"/><path d="M78 36 L67 65 L48 72 M68 63 L96 62 L122 78 M48 72 L27 87 M122 78 L142 86"/><path class="motion" d="M104 31 C125 38 133 48 139 61" marker-end="url(#arrow-${kind})"/>
    `,
    '9090': `
      <circle cx="74" cy="28" r="9"/><path d="M74 38 L72 66 L50 76 L30 92 M72 66 L98 77 L126 72"/><path class="motion" d="M42 44 C68 26 103 30 123 49" marker-end="url(#arrow-${kind})"/>
    `,
    rockback: `
      <circle cx="61" cy="34" r="8"/><path d="M62 43 L73 64 L93 69 L123 69 M73 64 L55 78 L39 91 M93 69 L124 88"/><path class="ground" d="M20 96 H145"/><path class="motion" d="M67 48 C48 48 38 55 31 65" marker-end="url(#arrow-${kind})"/>
    `,
    wallslide: `
      <path class="wall" d="M132 16 V100"/><circle cx="82" cy="32" r="8"/><path d="M82 41 V72 M82 51 L62 36 M82 51 L103 35 M82 72 L68 96 M82 72 L98 96"/><path class="motion" d="M58 70 C57 48 61 28 69 18" marker-end="url(#arrow-${kind})"/><path class="motion" d="M106 70 C108 48 105 28 98 18" marker-end="url(#arrow-${kind})"/>
    `,
    scappush: `
      <circle cx="48" cy="47" r="7"/><path d="M55 50 L86 58 L118 70 M85 58 L83 84 M118 70 L142 83 M83 84 L55 88"/><path class="ground" d="M25 93 H150"/><path class="motion" d="M78 43 C88 35 99 36 109 44" marker-end="url(#arrow-${kind})"/>
    `,
    doorpec: `
      <path class="wall" d="M126 14 V100"/><circle cx="77" cy="31" r="8"/><path d="M78 40 V70 M78 50 L105 47 L126 34 M78 70 L63 96 M78 70 L93 96"/><path class="motion" d="M74 58 C59 58 49 53 42 46" marker-end="url(#arrow-${kind})"/>
    `,
    mcgill: `
      <path class="ground" d="M20 88 H148"/><circle cx="54" cy="67" r="8"/><path d="M62 70 L94 76 L119 76 M95 76 L112 51 L129 77 M87 76 L69 87"/><path class="motion" d="M47 69 C46 56 52 48 63 44" marker-end="url(#arrow-${kind})"/>
    `,
    birddog: `
      <circle cx="70" cy="45" r="7"/><path d="M76 50 L95 61 L116 63 M91 60 L72 78 L49 79 M113 63 L142 45 M72 78 L50 96"/><path class="ground" d="M31 100 H147"/><path class="motion" d="M123 60 C132 54 139 49 145 43" marker-end="url(#arrow-${kind})"/>
    `,
    sideplank: `
      <circle cx="56" cy="52" r="7"/><path d="M63 55 L91 66 L125 78 M79 61 L68 83 M125 78 L143 84"/><path class="ground" d="M30 91 H150"/><path class="motion" d="M92 79 V53" marker-end="url(#arrow-${kind})"/>
    `,
    kneewall: `
      <path class="wall" d="M132 14 V100"/><circle cx="72" cy="28" r="8"/><path d="M72 37 V62 M72 50 L90 62 M72 62 L58 95 M72 62 L102 83 L125 83"/><path class="ground" d="M35 99 H145"/><path class="motion" d="M100 78 C112 72 120 66 128 58" marker-end="url(#arrow-${kind})"/>
    `,
    soleus: `
      <path class="wall" d="M131 16 V100"/><circle cx="75" cy="29" r="8"/><path d="M75 38 V62 M75 49 L99 58 L127 45 M75 62 L61 95 M75 62 L104 84 L125 84"/><path class="ground" d="M38 99 H145"/><path class="motion" d="M102 80 C112 73 120 66 126 57" marker-end="url(#arrow-${kind})"/>
    `,
    calfraise: `
      <circle cx="80" cy="28" r="8"/><path d="M80 37 V68 M80 47 L61 59 M80 47 L100 59 M80 68 L68 95 M80 68 L95 95"/><path class="ground" d="M45 100 H119"/><path class="motion" d="M112 94 V63" marker-end="url(#arrow-${kind})"/>
    `,
  }

  return `
    <svg class="rpg-mobility-visual-v47" viewBox="0 0 170 112" role="img" aria-label="Schéma de l’exercice">
      ${common}
      ${body[kind] || body.cossack}
    </svg>
  `
}

function readMobilitySets(
  athleteSlug,
  dateKey,
  routine
) {
  const saved =
    readJson(
      setCacheKey(
        athleteSlug,
        dateKey,
        routine.key
      ),
      {}
    )

  const sets = {}

  for (const exercise of routine.exercises) {
    sets[exercise.key] =
      Array.from(
        { length: exercise.sets },
        (_, index) =>
          Boolean(
            saved?.[exercise.key]?.[index]
          )
      )
  }

  return sets
}

function writeMobilitySets(
  athleteSlug,
  dateKey,
  routine,
  sets
) {
  writeJson(
    setCacheKey(
      athleteSlug,
      dateKey,
      routine.key
    ),
    sets
  )
}

function allSetsDone(state) {
  const routine =
    state.routine

  if (!routine) {
    return false
  }

  return routine.exercises.every(
    exercise =>
      (state.mobilitySets?.[exercise.key] || [])
        .slice(0, exercise.sets)
        .every(value => value === 'done' || value === true)
  )
}

function applyServerRow(
  state,
  row
) {
  if (!row) {
    return
  }

  state.steps =
    Math.max(
      0,
      Number(row.steps || 0)
    )

  state.source =
    row.step_source ||
    state.source ||
    'server'

  state.syncedAt =
    row.step_synced_at ||
    state.syncedAt ||
    null

  state.mobilityCompleted =
    Boolean(
      row.mobility_completed_at &&
      row.mobility_focus ===
        state.routine?.key
    )

  state.mobilityCompletedAt =
    row.mobility_completed_at ||
    null
}

async function fetchTodayRow(
  athleteSlug,
  dateKey
) {
  const { data, error } =
    await supabase
      .from('athlete_daily_wellness')
      .select('*')
      .eq('athlete_slug', athleteSlug)
      .eq('activity_date', dateKey)
      .maybeSingle()

  if (error) {
    throw error
  }

  return data || null
}

async function pushSteps(
  athleteSlug,
  dateKey,
  steps,
  source
) {
  const { data, error } =
    await supabase.rpc(
      'sync_athlete_steps_v247',
      {
        p_athlete_slug:
          athleteSlug,
        p_activity_date:
          dateKey,
        p_steps:
          Math.max(
            0,
            Math.floor(steps)
          ),
        p_source:
          source,
      }
    )

  if (error) {
    throw error
  }

  return Array.isArray(data)
    ? data[0]
    : data
}

async function syncFromHealthKit(
  athleteSlug,
  state,
  requestPermission = false
) {
  if (!platformCanUseHealthKit()) {
    return false
  }

  try {
    const available =
      await HealthSteps.isAvailable()

    if (!available?.available) {
      state.healthAvailable = false
      return false
    }

    state.healthAvailable = true

    if (requestPermission) {
      await HealthSteps.requestAuthorization()
    }

    const result =
      await HealthSteps.getTodaySteps()

    const steps =
      Math.max(
        0,
        Math.floor(
          Number(result?.steps) || 0
        )
      )

    const row =
      await pushSteps(
        athleteSlug,
        state.dateKey,
        steps,
        'healthkit'
      )

    state.steps = steps
    state.source = 'healthkit'
    state.syncedAt =
      row?.step_synced_at ||
      new Date().toISOString()

    writeJson(
      cacheKey(athleteSlug),
      {
        dateKey:
          state.dateKey,
        steps,
        source:
          state.source,
        syncedAt:
          state.syncedAt,
      }
    )

    return true
  } catch (error) {
    console.warn(
      'HEALTHKIT STEP SYNC ERROR',
      error
    )

    state.healthError =
      String(
        error?.message ||
        'Synchronisation Apple Health impossible.'
      )

    return false
  }
}

export function createRpgHealthState() {
  const now = new Date()
  const routine =
    routineForDate(now)

  return {
    athleteSlug: '',
    busy: false,
    dateKey:
      localDateKey(now),
    steps: 0,
    source: '',
    syncedAt: null,
    healthAvailable:
      platformCanUseHealthKit(),
    healthError: '',
    routine,
    mobilitySets: {},
    mobilityRuns: {},
    mobilityCompleted: false,
    mobilityCompletedAt: null,
    notice: '',
  }
}

export async function loadRpgHealth({
  athleteSlug,
  state,
}) {
  if (!athleteSlug || !state) {
    return
  }

  const now = new Date()
  const dateKey =
    localDateKey(now)
  const routine =
    routineForDate(now)

  state.athleteSlug =
    athleteSlug
  state.dateKey = dateKey
  state.routine = routine
  state.notice = ''
  state.healthError = ''
  state.mobilityCompleted = false
  state.mobilityCompletedAt = null
  state.mobilityRuns = {}
  state.mobilitySets =
    Object.fromEntries(routine.exercises.map(exercise => [exercise.key, Array(exercise.sets).fill('idle')]))

  /* v4.8 : l'état de séries vient du serveur pour l'anti-cheat. */
  try {
    const { data: runs, error: runsError } = await supabase
      .from('athlete_mobility_set_runs_v248')
      .select('exercise_key,set_index,started_at,completed_at')
      .eq('athlete_slug', athleteSlug)
      .eq('activity_date', dateKey)
      .eq('mobility_focus', routine.key)
    if (!runsError && Array.isArray(runs)) {
      for (const run of runs) {
        const values = state.mobilitySets?.[run.exercise_key]
        if (Array.isArray(values) && run.set_index >= 0 && run.set_index < values.length) {
          values[run.set_index] = run.completed_at ? 'done' : 'running'
        }
      }
    }
  } catch (error) {
    console.warn('MOBILITY RUN LOAD ERROR', error)
  }

  /* ancienne sauvegarde locale ignorée : elle ne peut plus valider une série. */
  void readMobilitySets(
      athleteSlug,
      dateKey,
      routine
    )

  const cached =
    readJson(
      cacheKey(athleteSlug),
      null
    )

  if (
    cached?.dateKey ===
    dateKey
  ) {
    state.steps =
      Number(cached.steps || 0)
    state.source =
      cached.source || ''
    state.syncedAt =
      cached.syncedAt || null
  } else {
    state.steps = 0
    state.source = ''
    state.syncedAt = null
  }

  try {
    const row =
      await fetchTodayRow(
        athleteSlug,
        dateKey
      )

    applyServerRow(
      state,
      row
    )
  } catch (error) {
    console.warn(
      'RPG WELLNESS LOAD ERROR',
      error
    )
  }

  // Une autorisation déjà accordée se resynchronise sans rouvrir la feuille iOS.
  if (platformCanUseHealthKit()) {
    await syncFromHealthKit(
      athleteSlug,
      state,
      true
    )
  }
}

function multiplierCopy(steps) {
  const multiplier = stepsXpMultiplier(steps)

  if (steps < 10000) {
    return {
      title: `XP ×${formatMultiplier(multiplier)} demain`,
      text: `${formatNumber(10000 - steps)} pas avant XP ×2.`,
    }
  }

  if (steps < 20000) {
    return {
      title: `XP ×${formatMultiplier(multiplier)} demain`,
      text: `${formatNumber(20000 - steps)} pas avant XP ×2,5.`,
    }
  }

  return {
    title: 'XP ×2,5 demain',
    text: 'Cap quotidien atteint.',
  }
}

function renderStepPanel(state) {
  const steps =
    Math.max(
      0,
      Number(state.steps || 0)
    )

  const progress =
    Math.min(
      100,
      steps / 20000 * 100
    )

  const copy =
    multiplierCopy(steps)

  const native =
    platformCanUseHealthKit()

  const syncLabel =
    state.busy
      ? 'Synchronisation…'
      : native
        ? 'Synchroniser Apple Health'
        : 'Apple Health sur iPhone'

  return `
    <section class="rpg-health-steps-v47">
      <div class="rpg-health-head-v47">
        <div>
          <span>🚶 ACTIVITÉ DU JOUR</span>
          <strong>${formatNumber(steps)} pas</strong>
        </div>

        <div class="rpg-health-mult-v47">
          <small>Bonus entraînement ${esc(tomorrowLabel())}</small>
          <b>${esc(copy.title)}</b>
        </div>
      </div>

      <div class="rpg-step-track-v47" aria-label="Progression des pas jusqu’à 20 000">
        <span class="rpg-step-fill-v47" style="width:${progress}%"></span>
        <i class="rpg-step-marker-v47 at-10k"><em>10k</em><b>XP ×2</b></i>
        <i class="rpg-step-marker-v47 at-20k"><em>20k</em><b>XP ×2,5</b></i>
      </div>

      <div class="rpg-step-copy-v47">
        <span>${esc(copy.text)}</span>
        <span>${esc(sourceLabel(state.source))}</span>
      </div>

      <div class="rpg-health-actions-v47">
        <button
          type="button"
          data-rpg-health-sync-v47
          ${(!native || state.busy) ? 'disabled' : ''}
        >
          ${state.busy ? '<span class="rpg-mini-spinner-v47"></span>' : '♥︎'}
          ${esc(syncLabel)}
        </button>

        <small>
          ${native
            ? 'Seul le total de pas du jour est synchronisé.'
            : 'Sur localhost, la dernière valeur serveur est affichée. La lecture HealthKit fonctionne dans l’app iPhone.'}
        </small>
      </div>

      ${state.healthError
        ? `<div class="rpg-health-error-v47">${esc(state.healthError)}</div>`
        : ''}
    </section>
  `
}

function renderMobilityExercise(state, exercise) {
  const statuses = state.mobilitySets?.[exercise.key] || []

  return `
    <article class="rpg-mobility-exercise-v47">
      <div class="rpg-mobility-figure-v47">${exerciseVisual(exercise.visual)}</div>
      <div class="rpg-mobility-copy-v47">
        <strong>${esc(exercise.title)}</strong>
        <span>${esc(exercise.prescription)}</span>
        <small>${esc(exercise.cue)}</small>
        <div class="rpg-mobility-sets-v47" aria-label="Séries réalisées">
          ${Array.from({ length: exercise.sets }, (_, index) => {
            const status = statuses[index] || 'idle'
            return `
              <button
                type="button"
                class="${status === 'done' ? 'done' : status === 'running' ? 'running' : ''}"
                data-rpg-mobility-set-v47
                data-exercise-key="${esc(exercise.key)}"
                data-set-index="${index}"
                ${state.mobilityCompleted ? 'disabled' : ''}
              >
                ${status === 'done' ? '✓' : status === 'running' ? '⏱ Valider' : `▶ Série ${index + 1}`}
              </button>
            `
          }).join('')}
        </div>
        <small class="rpg-mobility-anticheat-v48">Chaque série doit durer au moins 30 s. Un clic trop rapide est refusé côté serveur.</small>
      </div>
    </article>
  `
}

function renderMobilityPanel(state) {
  const routine =
    state.routine

  if (!routine) {
    return ''
  }

  const ready =
    allSetsDone(state)

  return `
    <section class="rpg-mobility-v47 ${state.mobilityCompleted ? 'completed' : ''}">
      <div class="rpg-mobility-head-v47">
        <div>
          <span>DAILY MISSION · MOBILITÉ DU JOUR</span>
          <strong>${routine.icon} ${esc(routine.title)}</strong>
          <small>${esc(routine.subtitle)} · une mobilité différente chaque jour</small>
        </div>

        <div class="rpg-mobility-status-v47">
          ${state.mobilityCompleted
            ? '<b>✓ DAILY VALIDÉE</b><small>🎁 Coffres : DROP ×2 jusqu’à minuit</small>'
            : '<b>DAILY · ≤ 20 MIN</b><small>🎁 Récompense : DROP ×2 coffres</small>'}
        </div>
      </div>

      <div class="rpg-mobility-list-v47">
        ${routine.exercises
          .map(exercise =>
            renderMobilityExercise(
              state,
              exercise
            )
          )
          .join('')}
      </div>

      <button
        type="button"
        class="rpg-mobility-validate-v47"
        data-rpg-mobility-validate-v47
        ${(!ready || state.mobilityCompleted || state.busy) ? 'disabled' : ''}
      >
        ${state.mobilityCompleted
          ? '✓ Daily terminée · DROP ×2 actif'
          : ready
            ? 'Valider la DAILY du jour'
            : 'Termine les séries pour valider'}
      </button>

      ${state.notice
        ? `<div class="rpg-mobility-notice-v47">${esc(state.notice)}</div>`
        : ''}
    </section>
  `
}

export function renderRpgHealth({
  state,
  canEdit = false,
}) {
  if (!state) {
    return ''
  }

  return `
    <section class="rpg-wellness-v47">
      <div class="rpg-section-title rpg-wellness-title-v47">
        Activité & récupération
      </div>

      ${renderStepPanel(state)}

      ${canEdit
        ? renderMobilityPanel(state)
        : `
          <section class="rpg-mobility-v47 readonly">
            <div class="rpg-mobility-head-v47">
              <div>
                <span>DAILY MISSION · MOBILITÉ DU JOUR</span>
                <strong>${state.routine?.icon || '🧘'} ${esc(state.routine?.title || 'Mobilité')}</strong>
                <small>Le suivi des séries est réservé à l’athlète.</small>
              </div>
            </div>
          </section>
        `}
    </section>
  `
}

async function validateMobility(
  athleteSlug,
  state
) {
  const routine =
    state.routine

  if (!routine || !allSetsDone(state)) {
    state.notice =
      'Termine toutes les séries avant de valider.'
    return
  }

  try {
    const { data, error } =
      await supabase.rpc(
        'validate_mobility_day_v248',
        {
          p_athlete_slug:
            athleteSlug,
          p_activity_date:
            state.dateKey,
          p_mobility_focus:
            routine.key,
        }
      )

    if (error) {
      throw error
    }

    const row =
      Array.isArray(data)
        ? data[0]
        : data

    state.mobilityCompleted = true
    state.mobilityCompletedAt =
      row?.mobility_completed_at ||
      new Date().toISOString()
    state.notice =
      'DAILY terminée : DROP ×2 est actif sur les coffres standards jusqu’à minuit.'
  } catch (error) {
    console.error(
      'MOBILITY VALIDATION ERROR',
      error
    )

    state.notice =
      'Validation impossible pour le moment. Tes séries cochées restent enregistrées sur cet appareil.'
  }
}

export async function handleRpgHealthAction({
  element,
  athleteSlug,
  state,
  canEdit = false,
}) {
  if (!element || !state || !athleteSlug) {
    return false
  }

  const sync =
    element.closest(
      '[data-rpg-health-sync-v47]'
    )

  if (sync) {
    if (!canEdit || state.busy) {
      return true
    }

    state.busy = true
    state.healthError = ''

    await syncFromHealthKit(
      athleteSlug,
      state,
      true
    )

    state.busy = false
    return true
  }

  const setButton =
    element.closest('[data-rpg-mobility-set-v47]')

  if (setButton) {
    if (!canEdit || state.mobilityCompleted || state.busy) return true

    const exerciseKey = setButton.dataset.exerciseKey
    const setIndex = Math.max(0, Number(setButton.dataset.setIndex) || 0)
    const values = state.mobilitySets?.[exerciseKey]
    if (!Array.isArray(values) || setIndex >= values.length) return true

    state.busy = true
    try {
      if (values[setIndex] === 'running') {
        const { error } = await supabase.rpc('complete_mobility_set_v248', {
          p_athlete_slug: athleteSlug,
          p_activity_date: state.dateKey,
          p_mobility_focus: state.routine.key,
          p_exercise_key: exerciseKey,
          p_set_index: setIndex,
        })
        if (error) throw error
        values[setIndex] = 'done'
        state.notice = `✓ Série ${setIndex + 1} validée.`
      } else if (values[setIndex] !== 'done') {
        const { error } = await supabase.rpc('start_mobility_set_v248', {
          p_athlete_slug: athleteSlug,
          p_activity_date: state.dateKey,
          p_mobility_focus: state.routine.key,
          p_exercise_key: exerciseKey,
          p_set_index: setIndex,
        })
        if (error) throw error
        values[setIndex] = 'running'
        state.notice = '⏱ Série lancée. Fais réellement la série puis reviens valider après 30 secondes minimum.'
      }
    } catch (error) {
      const message = String(error?.message || '')
      state.notice = /30|rapide|seconds|secondes/i.test(message)
        ? '🚨 Anti-cheat : série validée trop vite. Minimum 30 secondes par série — tu te fous de la gueule du coach ? 😭'
        : `Validation de série impossible : ${message || 'réessaie.'}`
    } finally {
      state.busy = false
    }
    return true
  }

  const validate =
    element.closest(
      '[data-rpg-mobility-validate-v47]'
    )

  if (validate) {
    if (!canEdit || state.busy) {
      return true
    }

    state.busy = true
    await validateMobility(
      athleteSlug,
      state
    )
    state.busy = false

    return true
  }

  return false
}
