import { supabase } from './supabase.js'
import { SBD_PR_SEED } from './sbd-pr-seed.js'

const REP_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9]

const LIFTS = {
  squat: {
    label: 'Squat',
    short: 'SQ',
    seed: 'sq',
  },
  bench: {
    label: 'Bench',
    short: 'BN',
    seed: 'bn',
  },
  deadlift: {
    label: 'Deadlift',
    short: 'DL',
    seed: 'dl',
  },
}

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

function athleteForSlug(athletes, slug) {
  const wanted = normalize(slug)
  return athletes.find(athlete => (
    [athlete.id, athlete.slug, athlete.cloudSlug, athlete.name]
      .filter(Boolean)
      .some(value => normalize(value) === wanted)
  )) || null
}

function emptyGrid() {
  return {
    squat: {},
    bench: {},
    deadlift: {},
  }
}

function mergeRecord(grid, lift, reps, row, force = false) {
  const safeReps = Number(reps)
  const load = Number(row?.load_kg)

  if (
    !grid[lift] ||
    !REP_OPTIONS.includes(safeReps) ||
    !Number.isFinite(load) ||
    load <= 0
  ) {
    return
  }

  const current = grid[lift][safeReps]
  if (force || !current || load >= Number(current.load_kg || 0)) {
    grid[lift][safeReps] = {
      ...row,
      reps: safeReps,
      load_kg: load,
    }
  }
}

function seededGrid(slug) {
  const grid = emptyGrid()
  const seed = SBD_PR_SEED[normalize(slug)]

  if (!seed) {
    return grid
  }

  Object.entries(LIFTS).forEach(([lift, config]) => {
    Object.entries(seed[config.seed] || {}).forEach(([reps, entry]) => {
      mergeRecord(grid, lift, Number(reps), {
        athlete_slug: slug,
        lift,
        reps: Number(reps),
        load_kg: Number(entry?.load),
        achieved_label: entry?.date || '',
        source_label: seed.source || 'Historique',
        seeded: true,
      })
    })
  })

  return grid
}

function format(value, digits = 1) {
  return Number(value || 0).toLocaleString('fr-FR', {
    maximumFractionDigits: digits,
  })
}

function movementGlPoints(
  loadKg,
  bodyweight,
  sex
) {
  const load =
    Number(loadKg)

  const bw =
    Number(bodyweight)

  const normalizedSex =
    String(sex || '')
      .trim()
      .toUpperCase()

  if (
    !Number.isFinite(load) ||
    load <= 0 ||
    !Number.isFinite(bw) ||
    bw <= 0 ||
    !['M', 'F'].includes(
      normalizedSex
    )
  ) {
    return null
  }

  const coefficients =
    normalizedSex === 'F'
      ? {
          a: 610.32796,
          b: 1045.59282,
          c: 0.03048,
        }
      : {
          a: 1199.72839,
          b: 1025.18162,
          c: 0.00921,
        }

  const denominator =
    coefficients.a -
    coefficients.b *
      Math.exp(
        -coefficients.c * bw
      )

  if (
    !Number.isFinite(
      denominator
    ) ||
    denominator <= 0
  ) {
    return null
  }

  return (
    100 *
    load /
    denominator
  )
}

export function createSbdLeaderboardState() {
  return {
    lift: 'squat',
    reps: 1,
    rows: [],
    busy: false,
    error: '',
    loaded: false,
  }
}

export async function loadSbdLeaderboard({
  state,
  athletes = [],
  force = false,
} = {}) {
  if (!state || state.busy || (state.loaded && !force)) {
    return state
  }

  state.busy = true
  state.error = ''

  try {
    const slugs = athletes
      .map(athleteSlug)
      .filter(Boolean)

    const [
      recordsResult,
      glProfilesResult,
      progressResult,
    ] = await Promise.all([
      supabase
        .from('athlete_sbd_rep_prs_v249')
        .select('athlete_slug,lift,reps,load_kg,achieved_label,achieved_at,source_label')
        .in('athlete_slug', slugs),

      supabase
        .from('athlete_program_gl_v171')
        .select('athlete_slug,bodyweight,sex,is_current')
        .eq('is_current', true)
        .in('athlete_slug', slugs),

      supabase
        .from('athlete_progress')
        .select('athlete_slug,gl_bodyweight,gl_sex')
        .in('athlete_slug', slugs),
    ])

    const glProfilesBySlug =
      new Map()

    ;(progressResult.data || [])
      .forEach(row => {
        const bodyweight =
          Number(
            row.gl_bodyweight
          )

        const sex =
          String(
            row.gl_sex || ''
          )
            .trim()
            .toUpperCase()

        if (
          Number.isFinite(
            bodyweight
          ) &&
          bodyweight > 0 &&
          ['M', 'F'].includes(
            sex
          )
        ) {
          glProfilesBySlug.set(
            normalize(
              row.athlete_slug
            ),
            {
              bodyweight,
              sex,
            }
          )
        }
      })

    ;(glProfilesResult.data || [])
      .forEach(row => {
        const bodyweight =
          Number(row.bodyweight)

        const sex =
          String(
            row.sex || ''
          )
            .trim()
            .toUpperCase()

        if (
          Number.isFinite(
            bodyweight
          ) &&
          bodyweight > 0 &&
          ['M', 'F'].includes(
            sex
          )
        ) {
          glProfilesBySlug.set(
            normalize(
              row.athlete_slug
            ),
            {
              bodyweight,
              sex,
            }
          )
        }
      })

    const grids = new Map()
    athletes.forEach(athlete => {
      const slug = athleteSlug(athlete)
      grids.set(normalize(slug), seededGrid(slug))
    })

    if (!recordsResult.error) {
      ;(recordsResult.data || []).forEach(row => {
        const key = normalize(row.athlete_slug)
        const grid = grids.get(key) || seededGrid(row.athlete_slug)
        mergeRecord(grid, row.lift, row.reps, row, true)
        grids.set(key, grid)
      })
    }

    state.rows = athletes.flatMap(athlete => {
      const slug =
        athleteSlug(athlete)

      const grid =
        grids.get(
          normalize(slug)
        ) ||
        emptyGrid()

      const glProfile =
        glProfilesBySlug.get(
          normalize(slug)
        ) ||
        null

      return Object.entries(
        LIFTS
      ).flatMap(
        ([lift]) => (
          REP_OPTIONS.map(
            reps => {
              const record =
                grid[lift]?.[reps] ||
                null

              const loadKg =
                record
                  ? Number(
                      record.load_kg
                    )
                  : null

              const glPoints =
                (
                  record &&
                  glProfile
                )
                  ? movementGlPoints(
                      loadKg,
                      glProfile.bodyweight,
                      glProfile.sex
                    )
                  : null

              return {
                athlete_slug:
                  slug,
                athlete_name:
                  athlete.name ||
                  slug,
                lift,
                reps,
                load_kg:
                  Number.isFinite(loadKg)
                    ? loadKg
                    : null,
                bodyweight:
                  glProfile?.bodyweight ??
                  Number(
                    athlete.bodyWeight
                  ) ??
                  null,
                sex:
                  glProfile?.sex ||
                  '',
                gl_points:
                  Number.isFinite(
                    glPoints
                  )
                    ? glPoints
                    : null,
                achieved_label:
                  record?.achieved_label ||
                  '',
                achieved_at:
                  record?.achieved_at ||
                  null,
                has_pr:
                  Boolean(record),
                has_gl_profile:
                  Boolean(glProfile),
              }
            }
          )
        )
      )
    })

    if (recordsResult.error) {
      console.warn(
        'SBD leaderboard records unavailable:',
        recordsResult.error
      )
    }


    state.loaded = true
  } catch (error) {
    state.error = error?.message || 'Classement indisponible.'
  } finally {
    state.busy = false
  }

  return state
}

export function renderSbdLeaderboard({ state } = {}) {
  const rows = (state?.rows || [])
    .filter(row => (
      row.lift === state.lift &&
      Number(row.reps) === Number(state.reps)
    ))
    .sort((a, b) => {
      const aRanked =
        Number.isFinite(
          Number(
            a.gl_points
          )
        ) &&
        a.gl_points !== null

      const bRanked =
        Number.isFinite(
          Number(
            b.gl_points
          )
        ) &&
        b.gl_points !== null

      if (
        aRanked !==
        bRanked
      ) {
        return bRanked
          ? 1
          : -1
      }

      if (
        aRanked &&
        bRanked
      ) {
        return (
          Number(
            b.gl_points
          ) -
            Number(
              a.gl_points
            ) ||
          Number(
            b.load_kg
          ) -
            Number(
              a.load_kg
            )
        )
      }

      return String(
        a.athlete_name
      ).localeCompare(
        String(
          b.athlete_name
        ),
        'fr'
      )
    })

  let rankedIndex = 0

  const rankedCount =
    rows.filter(
      row =>
        row.gl_points !== null &&
        Number.isFinite(
          Number(
            row.gl_points
          )
        )
    ).length

  return `
    <section class="sbd-leaderboard">
      <div class="sbd-leaderboard__intro">
        <div>
          <span>CLASSEMENT DE LA BRIGADE</span>
          <h2>Leaderboard GL</h2>
          <p>GL du mouvement calculé avec la formule IPF homme/femme · ${rows.length} athlètes affichés · ${rankedCount} classés.</p>
        </div>

        <button type="button" data-action="leaderboard-refresh" ${state?.busy ? 'disabled' : ''}>
          ${state?.busy ? 'Chargement…' : 'Actualiser'}
        </button>
      </div>

      <div class="sbd-leaderboard__lifts" role="tablist" aria-label="Mouvement">
        ${Object.entries(LIFTS).map(([lift, config]) => `
          <button
            type="button"
            role="tab"
            class="${state?.lift === lift ? 'active' : ''}"
            aria-selected="${state?.lift === lift ? 'true' : 'false'}"
            data-action="leaderboard-lift"
            data-lift="${lift}"
          >
            <b>${config.short}</b>
            <span>${config.label}</span>
          </button>
        `).join('')}
      </div>

      <div class="sbd-leaderboard__reps" role="tablist" aria-label="Nombre de répétitions">
        ${REP_OPTIONS.map(reps => `
          <button
            type="button"
            role="tab"
            class="${Number(state?.reps) === reps ? 'active' : ''}"
            aria-selected="${Number(state?.reps) === reps ? 'true' : 'false'}"
            data-action="leaderboard-reps"
            data-reps="${reps}"
          >×${reps}</button>
        `).join('')}
      </div>

      ${state?.error ? `
        <div class="sbd-leaderboard__empty">${esc(state.error)}</div>
      ` : rows.length ? `
        <div class="sbd-leaderboard__table">
          ${rows.map((row) => {
            const ranked =
              row.gl_points !== null &&
              Number.isFinite(
                Number(
                  row.gl_points
                )
              )

            const rank =
              ranked
                ? ++rankedIndex
                : null

            const missingText =
              !row.has_pr
                ? `Aucun PR ×${row.reps}`
                : !row.has_gl_profile
                  ? 'Profil GL à compléter'
                  : 'Non classé'

            return `
              <article class="sbd-leaderboard__row${rank && rank <= 3 ? ` is-podium is-podium--${rank}` : ''}">
                <span class="sbd-leaderboard__rank">
                  ${rank || '—'}
                </span>

                <div class="sbd-leaderboard__athlete">
                  <strong>
                    ${esc(
                      row.athlete_name
                    )}
                  </strong>
                  <small>
                    ${LIFTS[row.lift].label}
                    ×${row.reps}
                  </small>
                </div>

                <div class="sbd-leaderboard__load">
                  <strong>
                    ${row.has_pr
                      ? `${format(row.load_kg)} kg`
                      : '—'}
                  </strong>
                  <small>
                    ${row.has_gl_profile
                      ? `${row.sex === 'F' ? 'Femme' : 'Homme'} · ${format(row.bodyweight)} kg PDC`
                      : 'Profil GL incomplet'}
                  </small>
                </div>

                <div class="sbd-leaderboard__gl">
                  <strong>
                    ${ranked
                      ? format(
                          row.gl_points
                        )
                      : '—'}
                  </strong>
                  <small>
                    ${ranked
                      ? 'GL'
                      : esc(
                          missingText
                        )}
                  </small>
                </div>
              </article>
            `
          }).join('')}
        </div>
      ` : `
        <div class="sbd-leaderboard__empty">
          Aucun PR ×${Number(state?.reps) || 1} enregistré pour ce mouvement.
        </div>
      `}
    </section>
  `
}

export function isSbdLeaderboardLift(value) {
  return Object.prototype.hasOwnProperty.call(LIFTS, value)
}

export function isSbdLeaderboardReps(value) {
  return REP_OPTIONS.includes(Number(value))
}
