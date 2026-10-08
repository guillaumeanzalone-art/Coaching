import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import { supabase } from './supabase.js'

const DAY_MS = 24 * 60 * 60 * 1000
const TRAINING_WINDOW_DAYS = 7
const TRAINING_HALF_LIFE_HOURS = 36
const RECOVERY_REMINDER_ID = 2100
const RECOVERY_PREFERENCES_TABLE = 'athlete_recovery_preferences_v1'

function clamp(value, min, max) {
  return Math.min(
    max,
    Math.max(min, Number(value) || 0)
  )
}

function safeNumber(value) {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return null
  }

  const number = Number(
    String(value).replace(',', '.')
  )

  return Number.isFinite(number)
    ? number
    : null
}

function localDateKey(date = new Date()) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function nativeNotificationsAvailable() {
  return Capacitor.isNativePlatform()
}

async function getNotificationPermission(
  request = false
) {
  if (!nativeNotificationsAvailable()) {
    return 'mobile-only'
  }

  try {
    let permission =
      await LocalNotifications.checkPermissions()

    if (
      request &&
      permission.display === 'prompt'
    ) {
      permission =
        await LocalNotifications.requestPermissions()
    }

    return permission.display || 'unknown'
  } catch (error) {
    console.warn(
      'RECOVERY NOTIFICATION PERMISSION ERROR',
      error
    )
    return 'error'
  }
}

async function cancelRecoveryReminder(
  state
) {
  if (!nativeNotificationsAvailable()) {
    if (state) {
      state.notificationPermission =
        'mobile-only'
    }
    return
  }

  try {
    await LocalNotifications.cancel({
      notifications: [
        {
          id:
            RECOVERY_REMINDER_ID,
        },
      ],
    })
  } catch (error) {
    console.warn(
      'RECOVERY REMINDER CANCEL ERROR',
      error
    )
  }
}

async function scheduleRecoveryReminder({
  state,
  requestPermission = false,
} = {}) {
  if (!state) {
    return false
  }

  if (
    !state.isOwnAthlete ||
    !state.enabled ||
    !state.reminderEnabled
  ) {
    await cancelRecoveryReminder(
      state
    )
    return false
  }

  const permission =
    await getNotificationPermission(
      requestPermission
    )

  state.notificationPermission =
    permission

  if (permission !== 'granted') {
    return false
  }

  try {
    await LocalNotifications.cancel({
      notifications: [
        {
          id:
            RECOVERY_REMINDER_ID,
        },
      ],
    })

    await LocalNotifications.schedule({
      notifications: [
        {
          id:
            RECOVERY_REMINDER_ID,
          title:
            '❤️ Check-in récupération',
          body:
            'Prends 30 secondes pour renseigner sommeil, hydratation, nutrition et douleurs.',
          schedule: {
            on: {
              hour:
                Number(
                  state.reminderHour
                ) || 21,
              minute:
                Number(
                  state.reminderMinute
                ) || 0,
            },
            repeats: true,
          },
          extra: {
            destination:
              'recovery',
          },
        },
      ],
    })

    state.notificationScheduled =
      true

    return true
  } catch (error) {
    console.error(
      'RECOVERY REMINDER SCHEDULE ERROR',
      error
    )

    state.notificationScheduled =
      false

    return false
  }
}

async function loadRecoveryPreferences(
  athleteSlug,
  state
) {
  const { data, error } =
    await supabase
      .from(
        RECOVERY_PREFERENCES_TABLE
      )
      .select(
        'enabled,reminder_enabled,reminder_hour,reminder_minute'
      )
      .eq(
        'athlete_slug',
        athleteSlug
      )
      .maybeSingle()

  if (error) {
    throw error
  }

  state.enabled =
    data?.enabled !== false

  state.reminderEnabled =
    data?.reminder_enabled !== false

  state.reminderHour =
    Number(
      data?.reminder_hour
    ) || 21

  state.reminderMinute =
    Number(
      data?.reminder_minute
    ) || 0
}

async function persistRecoveryPreferences(
  athleteSlug,
  state
) {
  const patch = {
    enabled:
      Boolean(state.enabled),
    reminder_enabled:
      Boolean(
        state.reminderEnabled
      ),
    reminder_hour:
      Number(
        state.reminderHour
      ) || 21,
    reminder_minute:
      Number(
        state.reminderMinute
      ) || 0,
    updated_at:
      new Date().toISOString(),
  }

  let result =
    await supabase
      .from(
        RECOVERY_PREFERENCES_TABLE
      )
      .update(patch)
      .eq(
        'athlete_slug',
        athleteSlug
      )
      .select(
        'athlete_slug'
      )

  if (
    !result.error &&
    Array.isArray(result.data) &&
    result.data.length
  ) {
    return
  }

  result =
    await supabase
      .from(
        RECOVERY_PREFERENCES_TABLE
      )
      .insert({
        athlete_slug:
          athleteSlug,
        ...patch,
      })

  if (result.error) {
    throw result.error
  }
}

function sleepWeightedAverage(rows, fallback) {
  const values = []

  for (const row of rows || []) {
    const sleep = safeNumber(row?.sleep_hours)

    if (sleep !== null) {
      values.push(sleep)
    }

    if (values.length >= 3) {
      break
    }
  }

  if (!values.length && fallback !== null) {
    values.push(fallback)
  }

  if (!values.length) {
    return null
  }

  const weights =
    values.length === 1
      ? [1]
      : values.length === 2
        ? [0.65, 0.35]
        : [0.55, 0.30, 0.15]

  const denominator =
    weights
      .slice(0, values.length)
      .reduce((sum, value) => sum + value, 0)

  return values.reduce(
    (sum, value, index) =>
      sum + value * weights[index],
    0
  ) / denominator
}

function awakeHoursFromTime(
  wakeTime,
  now = new Date()
) {
  const text =
    String(wakeTime || '').trim()

  if (!/^\d{2}:\d{2}/.test(text)) {
    return null
  }

  const [hours, minutes] =
    text.slice(0, 5)
      .split(':')
      .map(Number)

  if (
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes)
  ) {
    return null
  }

  const wake =
    new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      hours,
      minutes,
      0,
      0
    )

  if (wake.getTime() > now.getTime()) {
    wake.setDate(wake.getDate() - 1)
  }

  return clamp(
    (now.getTime() - wake.getTime()) /
      (60 * 60 * 1000),
    0,
    36
  )
}

function exerciseStressFactor(code) {
  const value =
    String(code || '')
      .trim()
      .toLowerCase()

  if (value === 'sq' || value === 'dl') {
    return 1.2
  }

  if (value === 'bn') {
    return 1
  }

  return 0.65
}

function trainingStress(rows, now = new Date()) {
  let raw = 0
  let recentSets = 0

  for (const row of rows || []) {
    if (!row?.completed_at) {
      continue
    }

    const completedAt =
      new Date(row.completed_at)

    const ageHours =
      Math.max(
        0,
        (
          now.getTime() -
          completedAt.getTime()
        ) /
          (60 * 60 * 1000)
      )

    if (
      !Number.isFinite(ageHours) ||
      ageHours >
        TRAINING_WINDOW_DAYS * 24
    ) {
      continue
    }

    const decay =
      Math.pow(
        0.5,
        ageHours /
          TRAINING_HALF_LIFE_HOURS
      )

    const rpe =
      safeNumber(row.rpe)

    const rpeFactor =
      rpe === null
        ? 0.85
        : clamp(
            0.65 +
              Math.max(0, rpe - 5) *
                0.12,
            0.65,
            1.3
          )

    const outcomePenalty =
      row.set_outcome === 'failed'
        ? 0.35
        : 0

    raw +=
      (
        exerciseStressFactor(
          row.exercise_code
        ) *
          rpeFactor +
        outcomePenalty
      ) *
      decay

    recentSets += 1
  }

  return {
    raw,
    recentSets,
    penalty:
      clamp(raw * 1.25, 0, 35),
  }
}

function recoveryLabel(score) {
  if (score >= 85) {
    return {
      label: 'Très frais',
      tone: 'excellent',
      advice:
        'Bonne marge de récupération.',
    }
  }

  if (score >= 70) {
    return {
      label: 'Disponible',
      tone: 'good',
      advice:
        'Fatigue présente mais bien gérée.',
    }
  }

  if (score >= 55) {
    return {
      label: 'Fatigue modérée',
      tone: 'medium',
      advice:
        'Surveille les sensations et la technique.',
    }
  }

  if (score >= 40) {
    return {
      label: 'Fatigué',
      tone: 'low',
      advice:
        'La récupération commence à limiter la disponibilité.',
    }
  }

  return {
    label: 'Récupération prioritaire',
    tone: 'critical',
    advice:
      'Accumulation importante de fatigue : prudence sur l’intensité.',
  }
}

export function calculateRecoveryScore({
  metrics = {},
  wellnessHistory = [],
  trainingRows = [],
  bodyWeight = null,
  steps = 0,
  now = new Date(),
} = {}) {
  const sleepHours =
    safeNumber(metrics.sleepHours)

  const sleepAverage =
    sleepWeightedAverage(
      wellnessHistory,
      sleepHours
    )

  const awakeHours =
    awakeHoursFromTime(
      metrics.wakeTime,
      now
    )

  const hydration =
    safeNumber(
      metrics.hydrationLiters
    )

  const nutrition =
    safeNumber(
      metrics.nutritionScore
    )

  const painUpper =
    safeNumber(metrics.painUpper)

  const painLower =
    safeNumber(metrics.painLower)

  const painValues =
    [
      painUpper,
      painLower,
    ].filter(value => value !== null)

  const maxPain =
    painValues.length
      ? Math.max(...painValues)
      : null

  const bw =
    safeNumber(bodyWeight)

  const hydrationTarget =
    bw !== null
      ? clamp(bw * 0.03, 1.8, 4.5)
      : 2.3

  const training =
    trainingStress(
      trainingRows,
      now
    )

  const sleepPenalty =
    sleepAverage === null
      ? 0
      : clamp(
          Math.max(
            0,
            8 - sleepAverage
          ) * 4.5,
          0,
          24
        )

  const awakePenalty =
    awakeHours === null
      ? 0
      : clamp(
          Math.max(
            0,
            awakeHours - 14
          ) * 2,
          0,
          18
        )

  const hydrationPenalty =
    hydration === null
      ? 0
      : clamp(
          (
            1 -
            Math.min(
              1,
              hydration /
                hydrationTarget
            )
          ) * 10,
          0,
          10
        )

  const nutritionPenalty =
    nutrition === null
      ? 0
      : clamp(
          (5 - nutrition) * 2.5,
          0,
          10
        )

  const painPenalty =
    maxPain === null
      ? 0
      : clamp(
          maxPain * 1.8,
          0,
          18
        )

  const stepPenalty =
    clamp(
      Math.max(
        0,
        Number(steps || 0) -
          15000
      ) /
        3000,
      0,
      5
    )

  const score =
    Math.round(
      clamp(
        100 -
          training.penalty -
          sleepPenalty -
          awakePenalty -
          hydrationPenalty -
          nutritionPenalty -
          painPenalty -
          stepPenalty,
        0,
        100
      )
    )

  let confidence = 30

  if (sleepAverage !== null) {
    confidence += 20
  }

  if (awakeHours !== null) {
    confidence += 10
  }

  if (hydration !== null) {
    confidence += 10
  }

  if (nutrition !== null) {
    confidence += 10
  }

  if (maxPain !== null) {
    confidence += 15
  }

  if (
    Number.isFinite(
      Number(steps)
    )
  ) {
    confidence += 5
  }

  const status =
    recoveryLabel(score)

  return {
    score,
    confidence:
      clamp(confidence, 0, 100),
    ...status,
    sleepAverage,
    awakeHours,
    hydrationTarget,
    recentSets:
      training.recentSets,
    breakdown: [
      {
        key: 'training',
        label: 'Stress entraînement',
        value:
          -Math.round(
            training.penalty
          ),
        known: true,
      },
      {
        key: 'sleep',
        label: 'Sommeil',
        value:
          -Math.round(
            sleepPenalty
          ),
        known:
          sleepAverage !== null,
      },
      {
        key: 'awake',
        label: 'Temps éveillé',
        value:
          -Math.round(
            awakePenalty
          ),
        known:
          awakeHours !== null,
      },
      {
        key: 'hydration',
        label: 'Hydratation',
        value:
          -Math.round(
            hydrationPenalty
          ),
        known:
          hydration !== null,
      },
      {
        key: 'nutrition',
        label: 'Nutrition',
        value:
          -Math.round(
            nutritionPenalty
          ),
        known:
          nutrition !== null,
      },
      {
        key: 'pain',
        label: 'Douleurs',
        value:
          -Math.round(
            painPenalty
          ),
        known:
          maxPain !== null,
      },
      {
        key: 'activity',
        label: 'Activité',
        value:
          -Math.round(
            stepPenalty
          ),
        known: true,
      },
    ],
  }
}

export function createRecoveryState() {
  return {
    loading: true,
    saving: false,
    error: '',
    dateKey:
      localDateKey(),
    metrics: {
      sleepHours: null,
      wakeTime: '',
      nutritionScore: null,
      hydrationLiters: null,
      painUpper: null,
      painLower: null,
    },
    wellnessHistory: [],
    trainingRows: [],
    bodyWeight: null,
    steps: 0,
    score: null,
    confidence: 0,
    label: 'Chargement…',
    tone: 'medium',
    advice: '',
    breakdown: [],
    sleepAverage: null,
    awakeHours: null,
    hydrationTarget: 2.3,
    recentSets: 0,
    enabled: true,
    reminderEnabled: true,
    reminderHour: 21,
    reminderMinute: 0,
    isOwnAthlete: false,
    preferenceSaving: false,
    notificationPermission:
      nativeNotificationsAvailable()
        ? 'unknown'
        : 'mobile-only',
    notificationScheduled: false,
  }
}

function applyScore(
  state,
  now = new Date()
) {
  const result =
    calculateRecoveryScore({
      metrics:
        state.metrics,
      wellnessHistory:
        state.wellnessHistory,
      trainingRows:
        state.trainingRows,
      bodyWeight:
        state.bodyWeight,
      steps:
        state.steps,
      now,
    })

  Object.assign(
    state,
    result
  )
}

function dailyRowToMetrics(
  row
) {
  return {
    sleepHours:
      safeNumber(
        row?.sleep_hours
      ),
    wakeTime:
      row?.wake_time
        ? String(row.wake_time)
            .slice(0, 5)
        : '',
    nutritionScore:
      safeNumber(
        row?.nutrition_score
      ),
    hydrationLiters:
      safeNumber(
        row?.hydration_liters
      ),
    painUpper:
      safeNumber(
        row?.pain_upper
      ),
    painLower:
      safeNumber(
        row?.pain_lower
      ),
  }
}

function mergeSessionFallback(
  metrics,
  rows
) {
  const result = {
    ...metrics,
  }

  const fields = [
    ['sleepHours', 'sleep_hours'],
    ['hydrationLiters', 'hydration_liters'],
    ['painUpper', 'pain_upper'],
    ['painLower', 'pain_lower'],
  ]

  for (
    const [target, source]
    of fields
  ) {
    if (result[target] !== null) {
      continue
    }

    for (const row of rows || []) {
      const value =
        safeNumber(
          row?.[source]
        )

      if (value !== null) {
        result[target] = value
        break
      }
    }
  }

  return result
}

export async function loadRecovery({
  athleteSlug,
  state,
  bodyWeight = null,
  steps = 0,
  isOwnAthlete = false,
}) {
  if (!athleteSlug || !state) {
    return
  }

  state.loading = true
  state.error = ''
  state.bodyWeight =
    safeNumber(bodyWeight)
  state.isOwnAthlete =
    Boolean(isOwnAthlete)
  state.steps =
    Math.max(
      0,
      Number(steps) || 0
    )

  const today =
    localDateKey()

  state.dateKey = today

  const since =
    new Date(
      Date.now() -
        TRAINING_WINDOW_DAYS *
          DAY_MS
    ).toISOString()

  try {
    const [
      wellnessResult,
      trainingResult,
      sessionResult,
      preferencesResult,
    ] = await Promise.all([
      supabase
        .from(
          'athlete_daily_recovery_v1'
        )
        .select(
          'activity_date,sleep_hours,wake_time,nutrition_score,hydration_liters,pain_upper,pain_lower,updated_at'
        )
        .eq(
          'athlete_slug',
          athleteSlug
        )
        .order(
          'activity_date',
          {
            ascending: false,
          }
        )
        .limit(7),

      supabase
        .from('workout_sets')
        .select(
          'completed_at,rpe,exercise_code,set_outcome'
        )
        .eq(
          'athlete_slug',
          athleteSlug
        )
        .eq(
          'completed',
          true
        )
        .gte(
          'completed_at',
          since
        ),

      supabase
        .from(
          'training_sessions_v2'
        )
        .select(
          'sleep_hours,hydration_liters,pain_upper,pain_lower,updated_at'
        )
        .eq(
          'athlete_slug',
          athleteSlug
        )
        .order(
          'updated_at',
          {
            ascending: false,
          }
        )
        .limit(6),

      supabase
        .from(
          RECOVERY_PREFERENCES_TABLE
        )
        .select(
          'enabled,reminder_enabled,reminder_hour,reminder_minute'
        )
        .eq(
          'athlete_slug',
          athleteSlug
        )
        .maybeSingle(),
    ])

    if (wellnessResult.error) {
      throw wellnessResult.error
    }

    if (trainingResult.error) {
      throw trainingResult.error
    }

    if (preferencesResult.error) {
      throw preferencesResult.error
    }

    state.enabled =
      preferencesResult.data?.enabled !== false

    state.reminderEnabled =
      preferencesResult.data?.reminder_enabled !== false

    state.reminderHour =
      Number(
        preferencesResult.data?.reminder_hour
      ) || 21

    state.reminderMinute =
      Number(
        preferencesResult.data?.reminder_minute
      ) || 0

    const history =
      wellnessResult.data || []

    const todayRow =
      history.find(
        row =>
          row.activity_date ===
          today
      ) || null

    state.wellnessHistory =
      history

    state.trainingRows =
      trainingResult.data || []

    state.metrics =
      mergeSessionFallback(
        dailyRowToMetrics(
          todayRow
        ),
        sessionResult.error
          ? []
          : sessionResult.data
      )

    applyScore(state)

    await scheduleRecoveryReminder({
      state,
      requestPermission:
        state.isOwnAthlete &&
        state.enabled &&
        state.reminderEnabled,
    })
  } catch (error) {
    console.error(
      'RECOVERY LOAD ERROR',
      error
    )

    state.error =
      String(
        error?.message ||
        'Score de récupération indisponible.'
      )

    applyScore(state)
  } finally {
    state.loading = false
  }
}

async function persistRecoveryField({
  athleteSlug,
  dateKey,
  field,
  value,
}) {
  const columns = {
    sleepHours: 'sleep_hours',
    wakeTime: 'wake_time',
    nutritionScore:
      'nutrition_score',
    hydrationLiters:
      'hydration_liters',
    painUpper: 'pain_upper',
    painLower: 'pain_lower',
  }

  const column =
    columns[field]

  if (!column) {
    throw new Error(
      'Champ de récupération inconnu.'
    )
  }

  const patch = {
    [column]: value,
    updated_at:
      new Date().toISOString(),
  }

  let result =
    await supabase
      .from(
        'athlete_daily_recovery_v1'
      )
      .update(patch)
      .eq(
        'athlete_slug',
        athleteSlug
      )
      .eq(
        'activity_date',
        dateKey
      )
      .select(
        'athlete_slug'
      )

  if (
    !result.error &&
    Array.isArray(result.data) &&
    result.data.length
  ) {
    return
  }

  result =
    await supabase
      .from(
        'athlete_daily_recovery_v1'
      )
      .insert({
        athlete_slug:
          athleteSlug,
        activity_date:
          dateKey,
        ...patch,
      })

  if (result.error) {
    throw result.error
  }
}

export async function handleRecoveryInput({
  input,
  athleteSlug,
  state,
  bodyWeight = null,
  steps = 0,
  canEdit = false,
  isOwnAthlete = false,
}) {
  if (
    !input ||
    !state ||
    !athleteSlug ||
    !input.matches(
      '[data-recovery-input-v1]'
    )
  ) {
    return false
  }

  if (!canEdit || state.saving) {
    return true
  }

  const field =
    input.dataset.recoveryField

  let value =
    input.value

  if (field !== 'wakeTime') {
    value =
      value === ''
        ? null
        : safeNumber(value)
  } else {
    value =
      String(value || '')
        .trim() || null
  }

  state.metrics[field] = value
  state.saving = true
  state.error = ''
  applyScore(state)

  try {
    await persistRecoveryField({
      athleteSlug,
      dateKey:
        state.dateKey ||
        localDateKey(),
      field,
      value,
    })

    await loadRecovery({
      athleteSlug,
      state,
      bodyWeight,
      steps,
      isOwnAthlete,
    })
  } catch (error) {
    console.error(
      'RECOVERY SAVE ERROR',
      error
    )

    state.error =
      String(
        error?.message ||
        'Sauvegarde récupération impossible.'
      )
  } finally {
    state.saving = false
  }

  return true
}

export async function handleRecoveryToggle({
  input,
  athleteSlug,
  state,
  canEdit = false,
  isOwnAthlete = false,
} = {}) {
  if (
    !input ||
    !state ||
    !athleteSlug ||
    !input.matches(
      '[data-recovery-toggle-v1]'
    )
  ) {
    return false
  }

  if (
    !canEdit ||
    state.preferenceSaving
  ) {
    return true
  }

  const key =
    input.dataset.recoveryToggle

  if (
    key !== 'enabled' &&
    key !== 'reminder'
  ) {
    return false
  }

  state.isOwnAthlete =
    Boolean(isOwnAthlete)

  if (key === 'enabled') {
    state.enabled =
      Boolean(input.checked)
  }

  if (key === 'reminder') {
    state.reminderEnabled =
      Boolean(input.checked)
  }

  state.preferenceSaving = true
  state.error = ''

  try {
    await persistRecoveryPreferences(
      athleteSlug,
      state
    )

    if (
      state.isOwnAthlete &&
      state.enabled &&
      state.reminderEnabled
    ) {
      await scheduleRecoveryReminder({
        state,
        requestPermission: true,
      })
    } else if (
      state.isOwnAthlete
    ) {
      await cancelRecoveryReminder(
        state
      )
      state.notificationScheduled =
        false
    }
  } catch (error) {
    console.error(
      'RECOVERY PREFERENCE SAVE ERROR',
      error
    )

    state.error =
      String(
        error?.message ||
        'Impossible de modifier les préférences de récupération.'
      )
  } finally {
    state.preferenceSaving = false
  }

  return true
}

function recoveryNotificationCopy(
  state
) {
  if (!state.isOwnAthlete) {
    return 'Le rappel 21h sera appliqué sur le téléphone de l’athlète.'
  }

  if (
    state.notificationPermission ===
      'denied'
  ) {
    return 'Notifications bloquées dans les réglages du téléphone.'
  }

  if (
    state.notificationPermission ===
      'granted'
  ) {
    return 'Notification quotidienne programmée à 21h.'
  }

  if (
    state.notificationPermission ===
      'mobile-only'
  ) {
    return 'Le rappel 21h s’active dans l’app mobile.'
  }

  return 'Autorisation de notification requise au premier usage.'
}

function scoreText(state) {
  return Number.isFinite(
    Number(state?.score)
  )
    ? String(
        Math.round(
          Number(state.score)
        )
      )
    : '—'
}

export function renderRecoverySnapshot({
  state,
} = {}) {
  if (!state || !state.enabled) {
    return ''
  }

  const score =
    clamp(
      Number(state.score) || 0,
      0,
      100
    )

  return `
    <section
      class="recovery-hp-v1 recovery-hp-v1--${esc(state.tone || 'medium')}"
      aria-label="Points de vie récupération"
    >
      <div class="recovery-hp-v1__head">
        <div>
          <span>❤️ PV RÉCUPÉRATION</span>
          <strong>
            ${state.loading
              ? 'Calcul…'
              : `${scoreText(state)} / 100`}
          </strong>
        </div>

        <div class="recovery-hp-v1__status">
          <b>${esc(state.label || 'À compléter')}</b>
          <small>
            Fiabilité ${Math.round(
              Number(
                state.confidence
              ) || 0
            )} %
          </small>
        </div>
      </div>

      <div
        class="recovery-hp-v1__track"
        role="progressbar"
        aria-valuemin="0"
        aria-valuemax="100"
        aria-valuenow="${Math.round(score)}"
      >
        <span
          class="recovery-hp-v1__fill"
          style="width:${score}%"
        ></span>
      </div>

      <div class="recovery-hp-v1__meta">
        <span>${esc(state.advice || 'Complète les données du jour pour affiner le score.')}</span>
        <span>
          ${Math.max(
            0,
            Number(
              state.recentSets
            ) || 0
          )} séries récentes
        </span>
      </div>
    </section>
  `
}

function metricValue(
  value
) {
  return value === null ||
    value === undefined
      ? ''
      : esc(value)
}

function renderBreakdown(state) {
  return `
    <div class="recovery-breakdown-v1">
      ${(state.breakdown || [])
        .map(item => `
          <div class="${item.known ? '' : 'unknown'}">
            <span>${esc(item.label)}</span>
            <strong>
              ${item.known
                ? `${item.value} PV`
                : 'à renseigner'}
            </strong>
          </div>
        `)
        .join('')}
    </div>
  `
}

function renderRecoverySettings({
  state,
  canEdit = false,
}) {
  return `
    <section class="recovery-settings-v1">
      <div class="recovery-settings-v1__row">
        <div>
          <strong>Suivi récupération</strong>
          <small>Affiche les PV et le check-in quotidien.</small>
        </div>

        <label class="recovery-switch-v1">
          <input
            type="checkbox"
            data-recovery-toggle-v1
            data-recovery-toggle="enabled"
            ${state.enabled ? 'checked' : ''}
            ${canEdit ? '' : 'disabled'}
          >
          <span></span>
        </label>
      </div>

      <div class="recovery-settings-v1__row ${state.enabled ? '' : 'disabled'}">
        <div>
          <strong>Rappel quotidien · 21h</strong>
          <small>${esc(recoveryNotificationCopy(state))}</small>
        </div>

        <label class="recovery-switch-v1">
          <input
            type="checkbox"
            data-recovery-toggle-v1
            data-recovery-toggle="reminder"
            ${state.reminderEnabled ? 'checked' : ''}
            ${canEdit && state.enabled ? '' : 'disabled'}
          >
          <span></span>
        </label>
      </div>

      ${state.preferenceSaving
        ? '<div class="recovery-panel-v1__notice">Enregistrement des préférences…</div>'
        : ''}
    </section>
  `
}

export function renderRecoveryPanel({
  state,
  canEdit = false,
} = {}) {
  if (!state) {
    return ''
  }

  const settings =
    renderRecoverySettings({
      state,
      canEdit,
    })

  if (!state.enabled) {
    return `
      ${settings}
      <section class="recovery-panel-v1 recovery-panel-v1--disabled">
        <strong>Suivi récupération désactivé</strong>
        <span>La barre de PV et le check-in sont masqués. Réactive le switch quand tu veux.</span>
      </section>
    `
  }

  return `
    ${settings}
    <section class="recovery-panel-v1">
      <div class="recovery-panel-v1__title">
        <div>
          <span>CHECK-IN DU JOUR</span>
          <strong>Fatigue & récupération</strong>
        </div>

        <small>
          ${state.sleepAverage === null
            ? 'Sommeil moyen : —'
            : `Sommeil pondéré : ${state.sleepAverage.toFixed(1)} h`}
          ·
          ${state.awakeHours === null
            ? 'éveil : —'
            : `éveillé depuis ${state.awakeHours.toFixed(1)} h`}
        </small>
      </div>

      <div class="recovery-input-grid-v1">
        <label>
          <span>Sommeil</span>
          <div>
            <input
              type="number"
              min="0"
              max="24"
              step="0.1"
              inputmode="decimal"
              value="${metricValue(state.metrics.sleepHours)}"
              data-recovery-input-v1
              data-recovery-field="sleepHours"
              ${canEdit ? '' : 'disabled'}
            >
            <small>h</small>
          </div>
        </label>

        <label>
          <span>Heure de réveil</span>
          <div>
            <input
              type="time"
              value="${metricValue(state.metrics.wakeTime)}"
              data-recovery-input-v1
              data-recovery-field="wakeTime"
              ${canEdit ? '' : 'disabled'}
            >
          </div>
        </label>

        <label>
          <span>Hydratation</span>
          <div>
            <input
              type="number"
              min="0"
              max="20"
              step="0.1"
              inputmode="decimal"
              value="${metricValue(state.metrics.hydrationLiters)}"
              data-recovery-input-v1
              data-recovery-field="hydrationLiters"
              ${canEdit ? '' : 'disabled'}
            >
            <small>L</small>
          </div>
        </label>

        <label>
          <span>Nutrition</span>
          <div>
            <select
              data-recovery-input-v1
              data-recovery-field="nutritionScore"
              ${canEdit ? '' : 'disabled'}
            >
              <option value="">—</option>
              ${[
                [1, '1 · insuffisante'],
                [2, '2 · faible'],
                [3, '3 · correcte'],
                [4, '4 · bonne'],
                [5, '5 · optimale'],
              ].map(([value, label]) => `
                <option
                  value="${value}"
                  ${Number(state.metrics.nutritionScore) === value ? 'selected' : ''}
                >
                  ${label}
                </option>
              `).join('')}
            </select>
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
              value="${metricValue(state.metrics.painUpper)}"
              data-recovery-input-v1
              data-recovery-field="painUpper"
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
              value="${metricValue(state.metrics.painLower)}"
              data-recovery-input-v1
              data-recovery-field="painLower"
              ${canEdit ? '' : 'disabled'}
            >
            <small>/10</small>
          </div>
        </label>
      </div>

      ${renderBreakdown(state)}

      <div class="recovery-panel-v1__footer">
        <span>
          Hydratation cible indicative :
          ~${Number(
            state.hydrationTarget || 2.3
          ).toFixed(1)} L
        </span>
        <span>
          Le stress des séries décroît progressivement sur 7 jours.
        </span>
      </div>

      ${state.saving
        ? '<div class="recovery-panel-v1__notice">Synchronisation…</div>'
        : ''}

      ${state.error
        ? `<div class="recovery-panel-v1__error">${esc(state.error)}</div>`
        : ''}

      <p class="recovery-panel-v1__disclaimer">
        Indicateur de charge et de récupération pour le coaching, pas un diagnostic médical.
      </p>
    </section>
  `
}
