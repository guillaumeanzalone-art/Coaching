import {
  Capacitor,
  registerPlugin,
} from '@capacitor/core'

import {
  LocalNotifications,
} from '@capacitor/local-notifications'

const RestTimerNative =
  registerPlugin(
    'RestTimerNative'
  )

const ACTIVE_PREFIX =
  'ga-rest-timer-active-v1'

const PREF_PREFIX =
  'ga-rest-timer-prefs-v1'

const FALLBACK_NOTIFICATION_ID =
  47017

function normalizedSlug(value) {
  return String(
    value || ''
  )
    .trim()
    .toLowerCase()
}

function safeInteger(
  value,
  fallback = 0
) {
  const parsed =
    Number.parseInt(
      String(value),
      10
    )

  return Number.isFinite(parsed)
    ? parsed
    : fallback
}

function safeSeconds(
  value,
  fallback = 90
) {
  const seconds =
    safeInteger(
      value,
      fallback
    )

  return Math.max(
    15,
    Math.min(
      60 * 60,
      seconds
    )
  )
}

function readJson(
  key,
  fallback = null
) {
  try {
    const raw =
      localStorage.getItem(
        key
      )

    return raw
      ? JSON.parse(raw)
      : fallback
  } catch {
    return fallback
  }
}

function writeJson(
  key,
  value
) {
  try {
    localStorage.setItem(
      key,
      JSON.stringify(value)
    )
  } catch {
    // Timer remains usable in memory/native even if storage is unavailable.
  }
}

function removeStored(
  key
) {
  try {
    localStorage.removeItem(
      key
    )
  } catch {
    // Ignore storage failures.
  }
}

function activeKey(
  athleteSlug
) {
  return (
    ACTIVE_PREFIX +
    ':' +
    normalizedSlug(
      athleteSlug
    )
  )
}

function preferenceKey(
  athleteSlug
) {
  return (
    PREF_PREFIX +
    ':' +
    normalizedSlug(
      athleteSlug
    )
  )
}

export function restTimerExerciseKey(
  exercise
) {
  return [
    exercise?.type,
    exercise?.name,
    exercise?.variant,
  ]
    .map(value =>
      String(value || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(
          /[\u0300-\u036f]/g,
          ''
        )
        .replace(
          /[^a-z0-9]+/g,
          '-'
        )
        .replace(
          /^-+|-+$/g,
          ''
        )
    )
    .filter(Boolean)
    .join(':')
}

export function defaultRestSeconds(
  {
    isSbd = false,
    exercise = null,
  } = {}
) {
  const type =
    String(
      exercise?.type || ''
    )
      .toLowerCase()

  if (isSbd) {
    return 180
  }

  if (
    type.includes(
      'access'
    ) ||
    type.includes(
      'isolation'
    )
  ) {
    return 90
  }

  return 120
}

export function loadRestPreference(
  athleteSlug,
  exercise,
  fallbackSeconds = 90
) {
  const prefs =
    readJson(
      preferenceKey(
        athleteSlug
      ),
      {}
    ) || {}

  const key =
    typeof exercise ===
      'string'
      ? exercise
      : restTimerExerciseKey(
          exercise
        )

  if (
    Object.prototype
      .hasOwnProperty.call(
        prefs,
        key
      ) &&
    Number(prefs[key]) === 0
  ) {
    return 0
  }

  return safeSeconds(
    prefs[key],
    fallbackSeconds
  )
}

export function saveRestPreference(
  athleteSlug,
  exercise,
  seconds
) {
  const storageKey =
    preferenceKey(
      athleteSlug
    )

  const prefs =
    readJson(
      storageKey,
      {}
    ) || {}

  const key =
    typeof exercise ===
      'string'
      ? exercise
      : restTimerExerciseKey(
          exercise
        )

  prefs[key] =
    Number(seconds) === 0
      ? 0
      : safeSeconds(
          seconds
        )

  writeJson(
    storageKey,
    prefs
  )

  return prefs[key]
}

export function formatRestDuration(
  seconds
) {
  const value =
    Math.max(
      0,
      safeInteger(
        seconds,
        0
      )
    )

  const minutes =
    Math.floor(
      value / 60
    )

  const remainder =
    value % 60

  if (minutes <= 0) {
    return (
      remainder +
      ' s'
    )
  }

  if (remainder === 0) {
    return (
      minutes +
      ' min'
    )
  }

  return (
    minutes +
    ':' +
    String(remainder)
      .padStart(
        2,
        '0'
      )
  )
}

export function restTimerRemaining(
  timer,
  now = Date.now()
) {
  if (!timer?.endAt) {
    return 0
  }

  return Math.max(
    0,
    Math.ceil(
      (
        Number(timer.endAt) -
        Number(now)
      ) /
      1000
    )
  )
}

export function isRestTimerActive(
  timer,
  now = Date.now()
) {
  return (
    restTimerRemaining(
      timer,
      now
    ) > 0
  )
}

export function loadActiveRestTimer(
  athleteSlug
) {
  const timer =
    readJson(
      activeKey(
        athleteSlug
      ),
      null
    )

  if (
    !timer ||
    normalizedSlug(
      timer.athleteSlug
    ) !==
      normalizedSlug(
        athleteSlug
      )
  ) {
    return null
  }

  if (
    restTimerRemaining(
      timer
    ) <= 0
  ) {
    removeStored(
      activeKey(
        athleteSlug
      )
    )

    return null
  }

  return timer
}

function storeActive(
  timer
) {
  writeJson(
    activeKey(
      timer.athleteSlug
    ),
    timer
  )

  return timer
}

function nativeTimerAvailable() {
  if (!Capacitor.isNativePlatform()) {
    return false
  }

  const platform =
    Capacitor.getPlatform()

  return (
    platform === 'ios' ||
    platform === 'android'
  )
}

async function requestFallbackPermission() {
  if (
    !Capacitor.isNativePlatform()
  ) {
    return
  }

  try {
    const current =
      await LocalNotifications
        .checkPermissions()

    if (
      current?.display !==
        'granted'
    ) {
      await LocalNotifications
        .requestPermissions()
    }
  } catch {
    // Notification is a bonus; in-app timer still works.
  }
}

async function cancelFallbackNotification() {
  try {
    await LocalNotifications
      .cancel({
        notifications:[
          {
            id:
              FALLBACK_NOTIFICATION_ID,
          },
        ],
      })
  } catch {
    // No scheduled notification.
  }
}

async function scheduleFallbackNotification(
  timer
) {
  if (
    !Capacitor.isNativePlatform()
  ) {
    return
  }

  await requestFallbackPermission()
  await cancelFallbackNotification()

  const at =
    new Date(
      Number(
        timer.endAt
      )
    )

  if (
    at.getTime() <=
      Date.now()
  ) {
    return
  }

  const next =
    [
      timer.nextSet,
      timer.nextLoad,
      timer.nextReps,
    ]
      .filter(Boolean)
      .join(' · ')

  try {
    await LocalNotifications
      .schedule({
        notifications:[
          {
            id:
              FALLBACK_NOTIFICATION_ID,
            title:
              'Repos terminé · ' +
              timer.exerciseName,
            body:
              next
                ? (
                    'À toi : ' +
                    next
                  )
                : 'Prêt pour la prochaine série.',
            schedule:{
              at,
              allowWhileIdle:
                true,
            },
            sound:null,
          },
        ],
      })
  } catch {
    // Lock-screen fallback unavailable; active in-app timer still works.
  }
}

function nativePayload(
  timer
) {
  return {
    athleteSlug:
      timer.athleteSlug,
    exerciseName:
      timer.exerciseName,
    completedSet:
      timer.completedSet || '',
    nextSet:
      timer.nextSet || '',
    nextLoad:
      timer.nextLoad || '',
    nextReps:
      timer.nextReps || '',
    durationSeconds:
      timer.durationSeconds,
    endAt:
      new Date(
        timer.endAt
      ).toISOString(),
    endAtEpochMs:
      Number(
        timer.endAt
      ),
  }
}

async function updateSystemTimer(
  timer,
  mode = 'update'
) {
  if (nativeTimerAvailable()) {
    try {
      await RestTimerNative[
        mode === 'start'
          ? 'start'
          : 'update'
      ](
        nativePayload(
          timer
        )
      )

      return
    } catch (
      error
    ) {
      console.warn(
        'REST TIMER LIVE ACTIVITY',
        error
      )
    }
  }

  await scheduleFallbackNotification(
    timer
  )
}

export async function requestRestTimerPermissions() {
  if (nativeTimerAvailable()) {
    try {
      return await RestTimerNative
        .requestPermissions()
    } catch {
      // Fall through to local notifications.
    }
  }

  await requestFallbackPermission()

  return {
    granted:true,
  }
}

export async function startRestTimer(
  {
    athleteSlug,
    exerciseName,
    exerciseKey,
    durationSeconds,
    completedSet = '',
    nextSet = '',
    nextLoad = '',
    nextReps = '',
  }
) {
  const duration =
    safeSeconds(
      durationSeconds
    )

  const now =
    Date.now()

  const timer = {
    version:1,
    athleteSlug:
      normalizedSlug(
        athleteSlug
      ),
    exerciseName:
      String(
        exerciseName ||
        'Exercice'
      ),
    exerciseKey:
      String(
        exerciseKey || ''
      ),
    durationSeconds:
      duration,
    startedAt:
      now,
    endAt:
      now +
      duration * 1000,
    completedSet:
      String(
        completedSet || ''
      ),
    nextSet:
      String(
        nextSet || ''
      ),
    nextLoad:
      String(
        nextLoad || ''
      ),
    nextReps:
      String(
        nextReps || ''
      ),
  }

  storeActive(
    timer
  )

  await updateSystemTimer(
    timer,
    'start'
  )

  return timer
}

export async function adjustRestTimer(
  timer,
  deltaSeconds
) {
  if (!timer) {
    return null
  }

  const remaining =
    restTimerRemaining(
      timer
    )

  const adjusted =
    Math.max(
      5,
      Math.min(
        60 * 60,
        remaining +
        safeInteger(
          deltaSeconds,
          0
        )
      )
    )

  const next = {
    ...timer,
    endAt:
      Date.now() +
      adjusted * 1000,
    durationSeconds:
      Math.max(
        adjusted,
        safeSeconds(
          timer.durationSeconds,
          adjusted
        )
      ),
  }

  storeActive(
    next
  )

  await updateSystemTimer(
    next,
    'update'
  )

  return next
}

export async function stopRestTimer(
  timer,
  {
    immediate = true,
  } = {}
) {
  if (timer?.athleteSlug) {
    removeStored(
      activeKey(
        timer.athleteSlug
      )
    )
  }

  await cancelFallbackNotification()

  if (nativeTimerAvailable()) {
    try {
      await RestTimerNative
        .end({
          immediate,
        })
    } catch {
      // Nothing active natively.
    }
  }

  return null
}

export async function syncRestTimerFromNative(
  athleteSlug
) {
  if (!nativeTimerAvailable()) {
    return loadActiveRestTimer(
      athleteSlug
    )
  }

  try {
    const native =
      await RestTimerNative
        .getCurrent()

    if (
      !native?.active ||
      !native?.endAt
    ) {
      removeStored(
        activeKey(
          athleteSlug
        )
      )

      return null
    }

    const slug =
      normalizedSlug(
        native.athleteSlug
      )

    if (
      slug !==
      normalizedSlug(
        athleteSlug
      )
    ) {
      return loadActiveRestTimer(
        athleteSlug
      )
    }

    const nativeEndAt =
      Number(
        native.endAtEpochMs
      ) ||
      new Date(
        native.endAt
      ).getTime()

    const timer = {
      version:1,
      athleteSlug:slug,
      exerciseName:
        String(
          native.exerciseName ||
          'Exercice'
        ),
      exerciseKey:
        String(
          native.exerciseKey ||
          ''
        ),
      durationSeconds:
        safeSeconds(
          native.durationSeconds,
          90
        ),
      startedAt:
        Number(
          native.startedAt
        ) ||
        Date.now(),
      endAt:
        nativeEndAt,
      completedSet:
        String(
          native.completedSet ||
          ''
        ),
      nextSet:
        String(
          native.nextSet ||
          ''
        ),
      nextLoad:
        String(
          native.nextLoad ||
          ''
        ),
      nextReps:
        String(
          native.nextReps ||
          ''
        ),
    }

    if (
      restTimerRemaining(
        timer
      ) <= 0
    ) {
      return null
    }

    return storeActive(
      timer
    )
  } catch {
    return loadActiveRestTimer(
      athleteSlug
    )
  }
}
