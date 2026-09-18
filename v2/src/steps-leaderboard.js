import { supabase } from './supabase.js'

const STEPS_PERIODS = {
  daily: 'Quotidien',
  weekly: 'Hebdomadaire',
  monthly: 'Mensuel',
  yearly: 'Annuel',
}

const FIRST_ARCHIVE_YEAR = 2026

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function athleteSlug(athlete) {
  return String(
    athlete?.cloudSlug ||
    athlete?.slug ||
    athlete?.id ||
    ''
  ).trim()
}

function localDateKey(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function dateFromKey(value) {
  const [year, month, day] =
    String(value || '')
      .split('-')
      .map(Number)

  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day)
  ) {
    return null
  }

  return new Date(
    year,
    month - 1,
    day,
    12
  )
}

function addDays(date, amount) {
  const next = new Date(date)
  next.setDate(next.getDate() + amount)
  return next
}

function startOfWeek(date) {
  const next = new Date(date)
  const day = next.getDay()
  const offset = day === 0 ? -6 : 1 - day
  next.setHours(12, 0, 0, 0)
  next.setDate(next.getDate() + offset)
  return next
}

function endOfWeek(date) {
  return addDays(startOfWeek(date), 6)
}

function endOfMonth(date) {
  return new Date(
    date.getFullYear(),
    date.getMonth() + 1,
    0,
    12
  )
}

function supportedYears() {
  const currentYear =
    new Date().getFullYear()

  const lastYear =
    Math.max(
      2027,
      currentYear + 1
    )

  return Array.from(
    {
      length:
        lastYear -
        FIRST_ARCHIVE_YEAR +
        1,
    },
    (_, index) =>
      FIRST_ARCHIVE_YEAR +
      index
  )
}

function rangeForState(state) {
  const now = new Date()

  if (
    state.period ===
    'yearly'
  ) {
    const year =
      Number(state.year) ||
      now.getFullYear()

    return {
      start:
        localDateKey(
          new Date(year, 0, 1, 12)
        ),
      end:
        localDateKey(
          new Date(year, 11, 31, 12)
        ),
    }
  }

  if (
    state.period ===
    'weekly'
  ) {
    return {
      start:
        localDateKey(
          startOfWeek(now)
        ),
      end:
        localDateKey(
          endOfWeek(now)
        ),
    }
  }

  if (
    state.period ===
    'monthly'
  ) {
    return {
      start:
        localDateKey(
          new Date(
            now.getFullYear(),
            now.getMonth(),
            1,
            12
          )
        ),
      end:
        localDateKey(
          endOfMonth(now)
        ),
    }
  }

  const today =
    localDateKey(now)

  return {
    start: today,
    end: today,
  }
}

function periodLabel(
  state,
  range
) {
  const start =
    dateFromKey(range.start)

  const end =
    dateFromKey(range.end)

  if (
    !start ||
    !end
  ) {
    return 'Période en cours'
  }

  if (
    state.period ===
    'daily'
  ) {
    return new Intl.DateTimeFormat(
      'fr-FR',
      {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }
    ).format(start)
  }

  if (
    state.period ===
    'weekly'
  ) {
    const startText =
      new Intl.DateTimeFormat(
        'fr-FR',
        {
          day: 'numeric',
          month: 'short',
        }
      ).format(start)

    const endText =
      new Intl.DateTimeFormat(
        'fr-FR',
        {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        }
      ).format(end)

    return `Semaine du ${startText} au ${endText}`
  }

  if (
    state.period ===
    'monthly'
  ) {
    return new Intl.DateTimeFormat(
      'fr-FR',
      {
        month: 'long',
        year: 'numeric',
      }
    ).format(start)
  }

  return `Année ${Number(state.year) || start.getFullYear()}`
}

function formatSteps(value) {
  return Math.max(
    0,
    Number(value) || 0
  ).toLocaleString(
    'fr-FR',
    {
      maximumFractionDigits: 0,
    }
  )
}

function syncLabel(value) {
  if (!value) {
    return 'Synchronisation récente'
  }

  const date =
    new Date(value)

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return 'Synchronisation récente'
  }

  return `Dernière synchro ${new Intl.DateTimeFormat(
    'fr-FR',
    {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }
  ).format(date)}`
}

function emptyMessage(state) {
  if (
    state.period ===
    'yearly'
  ) {
    return `Aucune donnée Steps synchronisée pour ${state.year}.`
  }

  return `Aucune donnée Steps synchronisée pour cette période.`
}

export function createStepsLeaderboardState() {
  const currentYear =
    new Date().getFullYear()

  return {
    rows: [],
    busy: false,
    error: '',
    loaded: false,
    period:
      localStorage.getItem(
        'ga-steps-period-v2'
      ) || 'daily',
    year:
      Number(
        localStorage.getItem(
          'ga-steps-year-v2'
        )
      ) ||
      currentYear,
    rangeKey: '',
    range: null,
    syncedCount: 0,
    totalAthletes: 0,
    loadedAt: null,
  }
}

export function isStepsLeaderboardPeriod(
  value
) {
  return Object.prototype
    .hasOwnProperty.call(
      STEPS_PERIODS,
      value
    )
}

export function isStepsLeaderboardYear(
  value
) {
  return supportedYears()
    .includes(
      Number(value)
    )
}

export function stepsLeaderboardYears() {
  return supportedYears()
}

export async function loadStepsLeaderboard({
  state,
  athletes = [],
  force = false,
} = {}) {
  if (
    !state ||
    state.busy
  ) {
    return state
  }

  if (
    !isStepsLeaderboardPeriod(
      state.period
    )
  ) {
    state.period =
      'daily'
  }

  if (
    !isStepsLeaderboardYear(
      state.year
    )
  ) {
    state.year =
      new Date().getFullYear()
  }

  const range =
    rangeForState(state)

  const rangeKey = [
    state.period,
    state.year,
    range.start,
    range.end,
  ].join('|')

  if (
    state.loaded &&
    !force &&
    state.rangeKey ===
      rangeKey
  ) {
    return state
  }

  state.busy = true
  state.error = ''
  state.totalAthletes =
    athletes.length
  state.range =
    range
  state.rangeKey =
    rangeKey

  try {
    const slugs =
      athletes
        .map(
          athleteSlug
        )
        .filter(Boolean)

    if (
      !slugs.length
    ) {
      state.rows = []
      state.syncedCount = 0
      state.loaded = true
      state.loadedAt =
        new Date()
      return state
    }

    const {
      data,
      error,
    } =
      await supabase
        .from(
          'athlete_daily_wellness'
        )
        .select(
          'athlete_slug,activity_date,steps,step_source,step_synced_at'
        )
        .gte(
          'activity_date',
          range.start
        )
        .lte(
          'activity_date',
          range.end
        )
        .in(
          'athlete_slug',
          slugs
        )

    if (error) {
      throw error
    }

    const aggregate =
      new Map()

    ;(data || [])
      .forEach(row => {
        if (
          !row.step_synced_at
        ) {
          return
        }

        const key =
          normalize(
            row.athlete_slug
          )

        const current =
          aggregate.get(key) ||
          {
            steps: 0,
            days: new Set(),
            lastSyncedAt: null,
          }

        current.steps +=
          Math.max(
            0,
            Number(
              row.steps
            ) || 0
          )

        current.days.add(
          row.activity_date
        )

        if (
          !current.lastSyncedAt ||
          Date.parse(
            row.step_synced_at
          ) >
          Date.parse(
            current.lastSyncedAt
          )
        ) {
          current.lastSyncedAt =
            row.step_synced_at
        }

        aggregate.set(
          key,
          current
        )
      })

    state.rows =
      athletes
        .flatMap(
          athlete => {
            const slug =
              athleteSlug(
                athlete
              )

            const row =
              aggregate.get(
                normalize(
                  slug
                )
              )

            if (!row) {
              return []
            }

            const trackedDays =
              Math.max(
                1,
                row.days.size
              )

            return [
              {
                athlete_slug:
                  slug,
                athlete_name:
                  athlete.name ||
                  slug,
                steps:
                  row.steps,
                tracked_days:
                  trackedDays,
                average_steps:
                  row.steps /
                  trackedDays,
                step_synced_at:
                  row.lastSyncedAt,
              },
            ]
          }
        )
        .sort(
          (a, b) => (
            Number(
              b.steps
            ) -
              Number(
                a.steps
              ) ||
            String(
              a.athlete_name
            ).localeCompare(
              String(
                b.athlete_name
              ),
              'fr'
            )
          )
        )

    state.syncedCount =
      state.rows.length

    state.loaded =
      true

    state.loadedAt =
      new Date()
  } catch (error) {
    state.error =
      error?.message ||
      'Classement Steps indisponible.'
  } finally {
    state.busy =
      false
  }

  return state
}

export function renderStepsLeaderboard({
  state,
} = {}) {
  const rows =
    state?.rows || []

  const synced =
    Number(
      state?.syncedCount
    ) || 0

  const total =
    Number(
      state?.totalAthletes
    ) || 0

  const range =
    state?.range ||
    rangeForState(state)

  const years =
    supportedYears()

  return `
    <section class="sbd-leaderboard">
      <div class="sbd-leaderboard__intro">
        <div>
          <span>CLASSEMENT DE LA BRIGADE</span>
          <h2>Leaderboard Steps</h2>
          <p>
            ${esc(
              periodLabel(
                state,
                range
              )
            )}
            · ${synced}/${total} athlètes classés.
          </p>
        </div>

        <button
          type="button"
          data-action="steps-leaderboard-refresh"
          ${state?.busy ? 'disabled' : ''}
        >
          ${state?.busy ? 'Chargement…' : 'Actualiser'}
        </button>
      </div>

      <div
        class="sbd-leaderboard__reps"
        role="tablist"
        aria-label="Période du classement Steps"
      >
        ${Object.entries(
          STEPS_PERIODS
        ).map(
          ([
            period,
            label,
          ]) => `
            <button
              type="button"
              role="tab"
              class="${state?.period === period ? 'active' : ''}"
              aria-selected="${state?.period === period ? 'true' : 'false'}"
              data-action="steps-period"
              data-period="${period}"
            >
              ${esc(label)}
            </button>
          `
        ).join('')}
      </div>

      ${state?.period === 'yearly' ? `
        <div
          class="sbd-leaderboard__reps"
          role="tablist"
          aria-label="Année du classement Steps"
        >
          ${years.map(
            year => `
              <button
                type="button"
                role="tab"
                class="${Number(state?.year) === year ? 'active' : ''}"
                aria-selected="${Number(state?.year) === year ? 'true' : 'false'}"
                data-action="steps-year"
                data-year="${year}"
              >
                ${year}
              </button>
            `
          ).join('')}
        </div>
      ` : ''}

      ${state?.error ? `
        <div class="sbd-leaderboard__empty">
          ${esc(
            state.error
          )}
        </div>
      ` : rows.length ? `
        <div class="sbd-leaderboard__table">
          ${rows.map(
            (
              row,
              index
            ) => `
              <article
                class="sbd-leaderboard__row${index < 3 ? ` is-podium is-podium--${index + 1}` : ''}"
              >
                <span class="sbd-leaderboard__rank">
                  ${index + 1}
                </span>

                <div class="sbd-leaderboard__athlete">
                  <strong>
                    ${esc(
                      row.athlete_name
                    )}
                  </strong>
                  <small>
                    ${esc(
                      syncLabel(
                        row.step_synced_at
                      )
                    )}
                  </small>
                </div>

                <div class="sbd-leaderboard__load">
                  <strong>
                    ${esc(
                      formatSteps(
                        row.average_steps
                      )
                    )} / jour
                  </strong>
                  <small>
                    ${row.tracked_days}
                    jour${row.tracked_days > 1 ? 's' : ''}
                    synchronisé${row.tracked_days > 1 ? 's' : ''}
                  </small>
                </div>

                <div class="sbd-leaderboard__gl">
                  <strong>
                    ${esc(
                      formatSteps(
                        row.steps
                      )
                    )}
                  </strong>
                  <small>
                    pas
                  </small>
                </div>
              </article>
            `
          ).join('')}
        </div>
      ` : `
        <div class="sbd-leaderboard__empty">
          ${esc(
            emptyMessage(
              state
            )
          )}
        </div>
      `}
    </section>
  `
}
