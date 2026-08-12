import { supabase } from './supabase.js'
import {
  loadLatestGroupSbdPrs,
} from './sbd-pr.js'

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

  if (
    visibilityHandler
  ) {
    document.removeEventListener(
      'visibilitychange',
      visibilityHandler
    )
    visibilityHandler =
      null
  }

  currentPresence =
    null
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
    latestPrs,
  ] =
    await Promise.all([
      supabase
        .from(
          'app_presence_v2'
        )
        .select(
          'user_id',
          {
            count: 'exact',
            head: true,
          }
        )
        .gte(
          'last_seen_at',
          cutoff
        ),

      loadLatestGroupSbdPrs(
        6
      ),
    ])

  const activeCount =
    presenceResult.error
      ? null
      : (
          presenceResult.count ??
          0
        )

  const presenceText =
    activeCount === null
      ? 'Présence live indisponible'
      : activeCount === 1
        ? '1 personne utilise cette appli'
        : `${activeCount} personnes utilisent cette appli`

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
            row.athlete_slug ||
            'Athlète'

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
                  ${escapeHtml(
                    formatPrDate(
                      row.achieved_at
                    )
                  )}
                </span>
              </div>

              <b>
                ${escapeHtml(row.load_kg)}
                kg
              </b>
            </article>
          `
        }
      )
      .join('')

  container.innerHTML = `
    <section class="home-live-card home-live-card--presence">
      <span class="home-live-kicker">
        GROUPE EN DIRECT
      </span>

      <div class="home-live-presence">
        <span class="home-live-dot"></span>
        <strong>
          ${escapeHtml(
            presenceText
          )}
        </strong>
      </div>

      <small>
        Actif dans les 5 dernières minutes
      </small>
    </section>

    <section class="home-live-card home-live-card--prs">
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
