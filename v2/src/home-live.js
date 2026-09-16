import { supabase } from './supabase.js'
import {
  loadLatestGroupSbdPrs,
} from './sbd-pr.js'
import { SBD_PR_SEED } from './sbd-pr-seed.js'

let presenceTimer = null
let visibilityHandler = null
let currentPresence = null

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

async function sendPresence() {
  if (
    !currentPresence ||
    navigator.onLine === false
  ) {
    return
  }

  const {
    error,
  } =
    await supabase
      .from(
        'app_presence_v2'
      )
      .upsert(
        {
          user_id:
            currentPresence.userId,
          athlete_slug:
            currentPresence.athleteSlug,
          display_name:
            currentPresence.displayName,
          last_seen_at:
            new Date()
              .toISOString(),
        },
        {
          onConflict:
            'user_id',
        }
      )

  if (error) {
    console.error(
      'Presence heartbeat error:',
      error
    )
  }
}

export function stopPresenceHeartbeat() {
  if (presenceTimer) {
    clearInterval(
      presenceTimer
    )
    presenceTimer = null
  }

  if (visibilityHandler) {
    document.removeEventListener(
      'visibilitychange',
      visibilityHandler
    )
    visibilityHandler = null
  }

  currentPresence = null
}

export function startPresenceHeartbeat({
  userId,
  member,
}) {
  stopPresenceHeartbeat()

  if (!userId) {
    return
  }

  currentPresence = {
    userId,
    athleteSlug:
      String(
        member?.athlete_slug ||
        member?.athleteSlug ||
        ''
      ).trim() ||
      null,
    displayName:
      String(
        member?.display_name ||
        member?.email ||
        'Membre GA Coaching'
      ),
  }

  void sendPresence()

  presenceTimer =
    setInterval(
      () => {
        void sendPresence()
      },
      45_000
    )

  visibilityHandler =
    () => {
      if (
        document.visibilityState ===
        'visible'
      ) {
        void sendPresence()
      }
    }

  document.addEventListener(
    'visibilitychange',
    visibilityHandler
  )
}

function athleteForSlug(
  athletes,
  slug
) {
  const wanted =
    String(slug || '')
      .normalize('NFD')
      .replace(
        /[\u0300-\u036f]/g,
        ''
      )
      .toLowerCase()

  return (
    athletes.find(
      (athlete) =>
        [
          athlete.id,
          athlete.cloudSlug,
          athlete.slug,
        ]
          .filter(Boolean)
          .some(
            (value) =>
              String(value)
                .normalize('NFD')
                .replace(
                  /[\u0300-\u036f]/g,
                  ''
                )
                .toLowerCase() ===
              wanted
          )
    ) ||
    null
  )
}

function liftLabel(lift) {
  return {
    squat: 'SQ',
    bench: 'BN',
    deadlift: 'DL',
  }[lift] || 'PR'
}

function activityLift(row) {
  const code = String(
    row?.exercise_code ||
    row?.lift ||
    ''
  ).toLowerCase()

  return {
    sq: 'squat',
    squat: 'squat',
    bn: 'bench',
    bp: 'bench',
    bench: 'bench',
    dl: 'deadlift',
    deadlift: 'deadlift',
  }[code] || null
}

function activityReps(row) {
  const reps = Number(
    row?.actual_reps ??
    row?.reps
  )

  return Number.isFinite(reps) && reps > 0
    ? Math.round(reps)
    : null
}

function seededPreviousLoad(row) {
  const lift = {
    squat: 'sq',
    bench: 'bn',
    deadlift: 'dl',
  }[row?.lift]

  const reps = Number(row?.reps) || 1
  const seed = SBD_PR_SEED[
    String(row?.athlete_slug || '')
      .trim()
      .toLowerCase()
  ]
  const load = Number(seed?.[lift]?.[reps]?.load)
  const current = Number(row?.load_kg)

  return (
    Number.isFinite(load) &&
    load > 0 &&
    load < current
  )
    ? load
    : null
}

async function loadLatestPrProgress(limit = 6) {
  try {
    const { data, error } = await supabase
      .from('workout_activities')
      .select('*')
      .or('new_pr.eq.true,activity_type.eq.pr')
      .order('created_at', { ascending: false })
      .limit(300)

    if (error) {
      throw error
    }

    const bestByKey = new Map()
    const progress = []

    ;(data || [])
      .slice()
      .sort((a, b) => (
        Date.parse(a.created_at || 0) -
        Date.parse(b.created_at || 0)
      ))
      .forEach(row => {
        const lift = activityLift(row)
        const reps = activityReps(row)
        const load = Number(row.load_kg)

        if (!lift || !reps || !Number.isFinite(load) || load <= 0) {
          return
        }

        const key = `${row.athlete_slug}::${lift}::${reps}`
        const previousLoad = bestByKey.get(key) ?? null

        if (previousLoad !== null && load <= previousLoad) {
          return
        }

        progress.push({
          ...row,
          lift,
          reps,
          load_kg: load,
          previous_load_kg: previousLoad,
          achieved_at: row.created_at,
        })

        bestByKey.set(key, load)
      })

    return progress
      .sort((a, b) => (
        Date.parse(b.achieved_at || 0) -
        Date.parse(a.achieved_at || 0)
      ))
      .slice(0, limit)
  } catch (error) {
    console.warn('PR progress history unavailable:', error)
    return []
  }
}

function formatPrDate(value) {
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
    return ''
  }

  return new Intl.DateTimeFormat(
    'fr-FR',
    {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }
  ).format(date)
}

function liveWording(count) {
  const safeCount =
    Math.max(
      0,
      Number(count) || 0
    )

  return {
    count: safeCount,
    people:
      safeCount === 1
        ? 'personne'
        : 'personnes',
  }
}

export async function loadHomeLiveDashboard({
  athletes = [],
} = {}) {
  const container =
    document.querySelector(
      '[data-home-live]'
    )

  if (!container) {
    return
  }

  const cutoff =
    new Date(
      Date.now() -
      5 * 60 * 1000
    ).toISOString()

  const [
    presenceResult,
    latestProgress,
    latestLegacyPrs,
  ] =
    await Promise.all([
      supabase
        .from(
          'app_presence_v2'
        )
        .select(
          'user_id,athlete_slug,display_name,last_seen_at'
        )
        .gte(
          'last_seen_at',
          cutoff
        )
        .order('last_seen_at', { ascending: false }),

      loadLatestPrProgress(6),

      loadLatestGroupSbdPrs(
        6
      ),
    ])

  const activeCount =
    presenceResult.error
      ? null
      : (presenceResult.data || []).length

  const activePeople =
    (presenceResult.data || [])
      .map(row => {
        const athlete = athleteForSlug(
          athletes,
          row.athlete_slug
        )

        return {
          name: String(
            row.display_name ||
            athlete?.name ||
            row.athlete_slug ||
            'Membre'
          ).trim(),
          athleteName: athlete?.name || '',
        }
      })
      .filter((row, index, list) => (
        list.findIndex(item => item.name === row.name) === index
      ))

  const live =
    liveWording(
      activeCount
    )

  const latestPrs = latestProgress.length
    ? latestProgress
    : latestLegacyPrs

  const prRows =
    latestPrs
      .map(
        (row) => {
          const athlete =
            athleteForSlug(
              athletes,
              row.athlete_slug
            )

          const name =
            athlete?.name ||
            row.athlete_name ||
            row.athlete_slug ||
            'Athlète'

          const reps = Number(row.reps) || 1
          const previous = Number(
            row.previous_load_kg ??
            seededPreviousLoad(row)
          )
          const hasPrevious = Number.isFinite(previous) && previous > 0

          return `
            <article class="home-pr-row">
              <span class="home-pr-lift home-pr-lift--${escapeHtml(row.lift)}">
                ${liftLabel(row.lift)}
              </span>

              <div>
                <strong>
                  ${escapeHtml(name)}
                </strong>

                <span>
                  ×${escapeHtml(reps)} rep${reps > 1 ? 's' : ''}
                  ·
                  ${escapeHtml(formatPrDate(row.achieved_at))}
                </span>
              </div>

              <div class="home-pr-change">
                <small>${hasPrevious ? `${escapeHtml(previous)} kg` : '—'}</small>
                <span aria-hidden="true">→</span>
                <b>${escapeHtml(row.load_kg)} kg</b>
              </div>
            </article>
          `
        }
      )
      .join('')

  const liveContent =
    activeCount === null
      ? `
        <div class="home-live-presence home-live-presence--error">
          <strong class="home-live-count">
            —
          </strong>

          <span class="home-live-training-text">
            présence live indisponible
          </span>
        </div>
      `
      : `
        <div class="home-live-presence">
          <span class="home-live-dot"></span>

          <div class="home-live-copy">
            <strong class="home-live-count">
              ${escapeHtml(live.count)}
            </strong>

            <span class="home-live-training-text">
              ${escapeHtml(live.people)}
              s'entraînent en ce moment
            </span>
          </div>
        </div>

        <div class="home-live-people">
          ${activePeople.length
            ? activePeople.map(person => `
                <span>
                  <i aria-hidden="true"></i>
                  ${escapeHtml(person.name)}
                </span>
              `).join('')
            : '<small>Personne en ligne pour le moment.</small>'}
        </div>
      `

  container.innerHTML = `
    <div class="home-live-tabs" role="tablist" aria-label="Actualité du groupe">
      <button
        type="button"
        role="tab"
        class="active"
        aria-selected="true"
        data-action="home-live-tab"
        data-tab="training"
      >
        <span class="home-live-dot"></span>
        Qui s’entraîne
        <b>${activeCount === null ? '—' : escapeHtml(live.count)}</b>
      </button>

      <button
        type="button"
        role="tab"
        aria-selected="false"
        data-action="home-live-tab"
        data-tab="prs"
      >
        🏆 Derniers PR
        <b>${escapeHtml(latestPrs.length)}</b>
      </button>
    </div>

    <section class="home-live-card home-live-card--presence active" data-home-live-panel="training">
      <span class="home-live-kicker">
        QUI S’ENTRAÎNE
      </span>

      ${liveContent}

      <small>
        Actifs dans les 5 dernières minutes
      </small>
    </section>

    <section class="home-live-card home-live-card--prs" data-home-live-panel="prs" hidden>
      <div class="home-live-head">
        <div>
          <span class="home-live-kicker">
            DERNIERS PR
          </span>

          <h2>
            Squat · Bench · Deadlift
          </h2>
        </div>
      </div>

      <div class="home-pr-list">
        ${
          prRows ||
          `
            <div class="home-pr-empty">
              Les prochains PR SBD apparaîtront ici automatiquement.
            </div>
          `
        }
      </div>
    </section>
  `
}
