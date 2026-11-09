import { supabase } from './supabase.js'
import {
  loadLatestGroupSbdPrs,
} from './sbd-pr.js'
import { mergeLatestSbdRecords } from './home-pr-feed.js'

let presenceTimer = null
let visibilityHandler = null
let currentPresence = null

let homeLiveRefreshTimer = null
let homeLiveVisibilityHandler = null
let homeLiveAthletes = []
let homeLiveRequestVersion = 0

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

// The old workout_activities PR events stopped updating in August 2026.
// Current records are written to these SBD PR tables when a set is validated.
async function loadLatestRecordedSbdPrs(limit = 6) {
  const fetchLimit = Math.max(30, Number(limit) * 6)

  const [repetitionResult, globalPrs] = await Promise.all([
    supabase
      .from('athlete_sbd_rep_prs_v249')
      .select('athlete_slug,lift,reps,load_kg,exercise_name,achieved_at')
      .not('achieved_at', 'is', null)
      .order('achieved_at', { ascending: false })
      .limit(fetchLimit),
    loadLatestGroupSbdPrs(fetchLimit),
  ])

  if (repetitionResult.error) {
    console.warn('Recent SBD repetition PRs unavailable:', repetitionResult.error)
  }

  return mergeLatestSbdRecords(
    repetitionResult.error ? [] : repetitionResult.data,
    globalPrs,
    limit
  )
}

export function stopHomeLiveRefresh() {
  if (homeLiveRefreshTimer) {
    clearInterval(homeLiveRefreshTimer)
    homeLiveRefreshTimer = null
  }
  if (homeLiveVisibilityHandler) {
    document.removeEventListener('visibilitychange', homeLiveVisibilityHandler)
    homeLiveVisibilityHandler = null
  }
  homeLiveRequestVersion += 1
}

function ensureHomeLiveRefresh(athletes) {
  homeLiveAthletes = athletes

  if (homeLiveRefreshTimer) {
    return
  }

  const refresh = () => {
    // The dashboard is not visible once another app screen is open.
    // Stop polling rather than keeping obsolete requests alive.
    if (!document.querySelector('[data-home-live]')) {
      stopHomeLiveRefresh()
      return
    }

    if (document.visibilityState === 'hidden') {
      return
    }

    void loadHomeLiveDashboard({ athletes: homeLiveAthletes })
  }

  homeLiveRefreshTimer = setInterval(refresh, 60_000)
  homeLiveVisibilityHandler = () => {
    if (document.visibilityState === 'visible') {
      refresh()
    }
  }

  document.addEventListener('visibilitychange', homeLiveVisibilityHandler)
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

  ensureHomeLiveRefresh(athletes)
  const requestVersion = ++homeLiveRequestVersion
  const cutoff =
    new Date(
      Date.now() -
      5 * 60 * 1000
    ).toISOString()

  const [
    presenceResult,
    latestProgress,
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

      loadLatestRecordedSbdPrs(6),
    ])

  // A slower previous request must not overwrite more recent PRs,
  // and an unmounted home screen must not be redrawn.
  if (
    requestVersion !== homeLiveRequestVersion ||
    document.querySelector('[data-home-live]') !== container
  ) {
    return
  }

  // Read the tab after the requests complete: the user may have switched
  // tabs during the network call, and refresh must never reset that choice.
  const activeTab = container.querySelector('[data-action="home-live-tab"][aria-selected="true"]')?.dataset.tab === 'prs'
    ? 'prs'
    : 'training'

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

  const latestPrs = latestProgress

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
          const previous = Number(row.previous_load_kg)
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
        class="${activeTab === 'training' ? 'active' : ''}"
        aria-selected="${activeTab === 'training'}"
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
        class="${activeTab === 'prs' ? 'active' : ''}"
        aria-selected="${activeTab === 'prs'}"
        data-action="home-live-tab"
        data-tab="prs"
      >
        🏆 Derniers PR
        <b>${escapeHtml(latestPrs.length)}</b>
      </button>
    </div>

    <section class="home-live-card home-live-card--presence ${activeTab === 'training' ? 'active' : ''}" data-home-live-panel="training" ${activeTab === 'training' ? '' : 'hidden'}>
      <span class="home-live-kicker">
        QUI S’ENTRAÎNE
      </span>

      ${liveContent}

      <small>
        Actifs dans les 5 dernières minutes
      </small>
    </section>

    <section class="home-live-card home-live-card--prs ${activeTab === 'prs' ? 'active' : ''}" data-home-live-panel="prs" ${activeTab === 'prs' ? '' : 'hidden'}>
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
