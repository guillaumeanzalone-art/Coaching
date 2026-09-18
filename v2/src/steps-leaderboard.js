import { supabase } from './supabase.js'

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

function dateLabel(dateKey) {
  const parts = String(dateKey || '').split('-').map(Number)

  if (parts.length !== 3 || parts.some(value => !Number.isFinite(value))) {
    return 'Aujourd’hui'
  }

  const date = new Date(parts[0], parts[1] - 1, parts[2])

  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date)
}

function formatSteps(value) {
  return Math.max(0, Number(value) || 0)
    .toLocaleString('fr-FR', {
      maximumFractionDigits: 0,
    })
}

function syncLabel(value) {
  if (!value) {
    return 'Synchronisation récente'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Synchronisation récente'
  }

  return `Synchro ${new Intl.DateTimeFormat('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)}`
}

export function createStepsLeaderboardState() {
  return {
    rows: [],
    busy: false,
    error: '',
    loaded: false,
    dateKey: localDateKey(),
    syncedCount: 0,
    totalAthletes: 0,
    loadedAt: null,
  }
}

export async function loadStepsLeaderboard({
  state,
  athletes = [],
  force = false,
} = {}) {
  if (!state || state.busy) {
    return state
  }

  const dateKey = localDateKey()

  if (
    state.loaded &&
    !force &&
    state.dateKey === dateKey
  ) {
    return state
  }

  state.busy = true
  state.error = ''
  state.dateKey = dateKey
  state.totalAthletes = athletes.length

  try {
    const slugs = athletes
      .map(athleteSlug)
      .filter(Boolean)

    if (!slugs.length) {
      state.rows = []
      state.syncedCount = 0
      state.loaded = true
      state.loadedAt = new Date()
      return state
    }

    const { data, error } = await supabase
      .from('athlete_daily_wellness')
      .select('athlete_slug,activity_date,steps,step_source,step_synced_at')
      .eq('activity_date', dateKey)
      .in('athlete_slug', slugs)

    if (error) {
      throw error
    }

    const bySlug = new Map(
      (data || []).map(row => [
        normalize(row.athlete_slug),
        row,
      ])
    )

    state.rows = athletes
      .flatMap(athlete => {
        const slug = athleteSlug(athlete)
        const row = bySlug.get(normalize(slug))

        if (!row || !row.step_synced_at) {
          return []
        }

        return [{
          athlete_slug: slug,
          athlete_name: athlete.name || slug,
          steps: Math.max(0, Number(row.steps) || 0),
          step_source: row.step_source || '',
          step_synced_at: row.step_synced_at || null,
        }]
      })
      .sort((a, b) => (
        Number(b.steps) - Number(a.steps) ||
        String(a.athlete_name).localeCompare(
          String(b.athlete_name),
          'fr'
        )
      ))

    state.syncedCount = state.rows.length
    state.loaded = true
    state.loadedAt = new Date()
  } catch (error) {
    state.error = error?.message || 'Classement Steps indisponible.'
  } finally {
    state.busy = false
  }

  return state
}

export function renderStepsLeaderboard({
  state,
} = {}) {
  const rows = state?.rows || []
  const synced = Number(state?.syncedCount) || 0
  const total = Number(state?.totalAthletes) || 0

  return `
    <section class="sbd-leaderboard">
      <div class="sbd-leaderboard__intro">
        <div>
          <span>CLASSEMENT DE LA BRIGADE</span>
          <h2>Leaderboard Steps</h2>
          <p>
            ${esc(dateLabel(state?.dateKey))}
            · ${synced}/${total} athlètes synchronisés aujourd’hui.
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

      ${state?.error ? `
        <div class="sbd-leaderboard__empty">
          ${esc(state.error)}
        </div>
      ` : rows.length ? `
        <div class="sbd-leaderboard__table">
          ${rows.map((row, index) => {
            const progress = Math.min(
              100,
              Math.round((Number(row.steps) || 0) / 100)
            )

            return `
              <article
                class="sbd-leaderboard__row${index < 3 ? ` is-podium is-podium--${index + 1}` : ''}"
              >
                <span class="sbd-leaderboard__rank">
                  ${index + 1}
                </span>

                <div class="sbd-leaderboard__athlete">
                  <strong>${esc(row.athlete_name)}</strong>
                  <small>${esc(syncLabel(row.step_synced_at))}</small>
                </div>

                <div class="sbd-leaderboard__load">
                  <strong>${progress}% objectif</strong>
                  <small>Base 10 000 pas</small>
                </div>

                <div class="sbd-leaderboard__gl">
                  <strong>${esc(formatSteps(row.steps))}</strong>
                  <small>pas</small>
                </div>
              </article>
            `
          }).join('')}
        </div>
      ` : `
        <div class="sbd-leaderboard__empty">
          Aucun athlète n’a encore synchronisé ses pas aujourd’hui.
          Le classement se remplit automatiquement après une synchronisation Apple Health.
        </div>
      `}
    </section>
  `
}
