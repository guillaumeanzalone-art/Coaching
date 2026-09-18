import { supabase } from './supabase.js'
import { analyzeTrainingBlock } from './block-analytics.js'
import { getProgramForAthlete } from './program.js'

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
    .trim()
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

  if (
    Array.isArray(program.weeks)
  ) {
    return [{
      id:
        program.id ||
        'programme',
      label:
        program.label ||
        'Programme',
      sourceKey:
        program.id ||
        'programme',
      weeks:
        program.weeks,
    }]
  }

  return []
}

function selectCurrentBlock(
  program,
  preferredBlockKey = ''
) {
  const blocks =
    getBlocks(program)

  if (!blocks.length) {
    return null
  }

  const wanted =
    normalize(
      preferredBlockKey
    )

  return (
    blocks.find(
      block =>
        normalize(
          block.id
        ) === wanted ||
        normalize(
          block.sourceKey
        ) === wanted
    ) ||
    blocks.find(
      block =>
        block.id ===
        program?.defaultBlockId
    ) ||
    blocks[
      blocks.length - 1
    ]
  )
}

function blockProgramKey(
  program,
  block
) {
  return String(
    block?.sourceKey ||
    block?.id ||
    program?.id ||
    'programme'
  )
}

function clampIndex(
  value,
  max
) {
  const index =
    Number.parseInt(
      value,
      10
    )

  if (
    !Number.isFinite(index) ||
    index < 0
  ) {
    return 0
  }

  return Math.min(
    Math.max(
      0,
      max - 1
    ),
    index
  )
}

function formatScore(value) {
  return Math.round(
    Number(value) || 0
  )
}

function scopeLabel(scope) {
  return scope === 'week'
    ? 'Semaine actuelle'
    : 'Bloc actuel'
}

export function createDifficultyLeaderboardState() {
  return {
    rows: [],
    busy: false,
    loaded: false,
    error: '',
    scope:
      localStorage.getItem(
        'ga-difficulty-leaderboard-scope-v1'
      ) === 'week'
        ? 'week'
        : 'block',
  }
}

export function isDifficultyLeaderboardScope(
  value
) {
  return (
    value === 'block' ||
    value === 'week'
  )
}

export async function loadDifficultyLeaderboard({
  state,
  athletes = [],
  force = false,
} = {}) {
  if (
    !state ||
    state.busy ||
    (
      state.loaded &&
      !force
    )
  ) {
    return state
  }

  state.busy = true
  state.error = ''

  try {
    const {
      data:
        serverRows,
      error:
        serverError,
    } =
      await supabase.rpc(
        'get_difficulty_leaderboard_inputs_v252'
      )

    if (
      serverError
    ) {
      throw serverError
    }

    const bySlug =
      new Map(
        (serverRows || [])
          .map(
            row => [
              normalize(
                row.athlete_slug
              ),
              row,
            ]
          )
      )

    const rows =
      await Promise.all(
        athletes.map(
          async athlete => {
            const slug =
              athleteSlug(
                athlete
              )

            const input =
              bySlug.get(
                normalize(
                  slug
                )
              ) ||
              null

            let program =
              input?.program_json ||
              null

            if (!program) {
              try {
                program =
                  await getProgramForAthlete(
                    athlete.id
                  )
              } catch (
                error
              ) {
                console.warn(
                  'Difficulty leaderboard local fallback failed',
                  slug,
                  error
                )
              }
            }

            const block =
              selectCurrentBlock(
                program,
                input?.block_key
              )

            if (
              !block ||
              !Array.isArray(
                block.weeks
              ) ||
              !block.weeks.length
            ) {
              return {
                athlete_slug:
                  slug,
                athlete_name:
                  athlete.name ||
                  slug,
                ranked:
                  false,
                reason:
                  'Bloc actuel indisponible',
              }
            }

            const bodyWeight =
              Number(
                program?.athlete
                  ?.bodyWeight
              ) ||
              Number(
                input
                  ?.profile_body_weight
              ) ||
              Number(
                athlete.bodyWeight
              ) ||
              80

            const glMultiplier =
              Math.max(
                0.01,
                Number(
                  input?.gl_multiplier
                ) || 1
              )

            const blockAnalytics =
              analyzeTrainingBlock({
                block,
                state: {},
                bodyWeight,
                glMultiplier,
              })

            const currentKey =
              normalize(
                blockProgramKey(
                  program,
                  block
                )
              )

            const latestKey =
              normalize(
                input
                  ?.latest_program_key
              )

            const weekIndex =
              currentKey &&
              latestKey &&
              currentKey ===
                latestKey
                ? clampIndex(
                    input
                      ?.latest_week_index,
                    block.weeks.length
                  )
                : 0

            const week =
              block.weeks[
                weekIndex
              ] ||
              block.weeks[0]

            const weekAnalytics =
              analyzeTrainingBlock({
                block: {
                  ...block,
                  weeks: [
                    week,
                  ],
                },
                state: {},
                bodyWeight,
                glMultiplier,
                referenceMaxes:
                  blockAnalytics
                    .theoreticalMaxes,
              })

            return {
              athlete_slug:
                slug,
              athlete_name:
                athlete.name ||
                slug,
              ranked:
                true,
              block_label:
                block.label ||
                input
                  ?.block_title ||
                'Bloc actuel',
              block_number:
                input
                  ?.block_number ||
                null,
              block_score:
                blockAnalytics
                  .difficultyScore,
              block_tier:
                blockAnalytics
                  .tier,
              block_factors:
                blockAnalytics
                  .factors,
              week_index:
                weekIndex,
              week_number:
                weekIndex + 1,
              week_count:
                block.weeks.length,
              week_label:
                week?.label ||
                `Semaine ${
                  weekIndex + 1
                }`,
              week_score:
                weekAnalytics
                  .difficultyScore,
              week_tier:
                weekAnalytics
                  .tier,
              week_factors:
                weekAnalytics
                  .factors,
              latest_activity_at:
                input
                  ?.latest_activity_at ||
                null,
            }
          }
        )
      )

    state.rows =
      rows

    state.loaded =
      true
  } catch (error) {
    state.error =
      error?.message ||
      'Leaderboard difficulté indisponible.'
  } finally {
    state.busy =
      false
  }

  return state
}

export function renderDifficultyLeaderboard({
  state,
} = {}) {
  const scope =
    isDifficultyLeaderboardScope(
      state?.scope
    )
      ? state.scope
      : 'block'

  const rankedRows =
    (state?.rows || [])
      .filter(
        row =>
          row.ranked
      )
      .sort(
        (a, b) =>
          Number(
            scope === 'week'
              ? b.week_score
              : b.block_score
          ) -
            Number(
              scope === 'week'
                ? a.week_score
                : a.block_score
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

  const unrankedRows =
    (state?.rows || [])
      .filter(
        row =>
          !row.ranked
      )
      .sort(
        (a, b) =>
          String(
            a.athlete_name
          ).localeCompare(
            String(
              b.athlete_name
            ),
            'fr'
          )
      )

  const rows = [
    ...rankedRows,
    ...unrankedRows,
  ]

  return `
    <section class="sbd-leaderboard">
      <div class="sbd-leaderboard__intro">
        <div>
          <span>CLASSEMENT DE LA BRIGADE</span>
          <h2>Leaderboard Difficulté</h2>
          <p>
            ${esc(
              scopeLabel(
                scope
              )
            )}
            · même moteur /100 que l’écran Difficulté.
          </p>
        </div>

        <button
          type="button"
          data-action="difficulty-leaderboard-refresh"
          ${state?.busy ? 'disabled' : ''}
        >
          ${state?.busy ? 'Chargement…' : 'Actualiser'}
        </button>
      </div>

      <div
        class="sbd-leaderboard__lifts"
        style="grid-template-columns:repeat(2,minmax(0,1fr));margin-bottom:14px"
        role="tablist"
        aria-label="Type de difficulté"
      >
        <button
          type="button"
          role="tab"
          class="${scope === 'block' ? 'active' : ''}"
          aria-selected="${scope === 'block' ? 'true' : 'false'}"
          data-action="difficulty-scope"
          data-scope="block"
        >
          <b>🧱 Bloc</b>
          <span>Bloc actuel</span>
        </button>

        <button
          type="button"
          role="tab"
          class="${scope === 'week' ? 'active' : ''}"
          aria-selected="${scope === 'week' ? 'true' : 'false'}"
          data-action="difficulty-scope"
          data-scope="week"
        >
          <b>📅 Semaine</b>
          <span>Semaine actuelle</span>
        </button>
      </div>

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
            ) => {
              if (
                !row.ranked
              ) {
                return `
                  <article class="sbd-leaderboard__row">
                    <span class="sbd-leaderboard__rank">—</span>

                    <div class="sbd-leaderboard__athlete">
                      <strong>
                        ${esc(
                          row.athlete_name
                        )}
                      </strong>
                      <small>
                        ${esc(
                          row.reason ||
                          'Non classé'
                        )}
                      </small>
                    </div>

                    <div class="sbd-leaderboard__load">
                      <strong>—</strong>
                      <small>Données manquantes</small>
                    </div>

                    <div class="sbd-leaderboard__gl">
                      <strong>—</strong>
                      <small>/100</small>
                    </div>
                  </article>
                `
              }

              const score =
                scope === 'week'
                  ? row.week_score
                  : row.block_score

              const tier =
                scope === 'week'
                  ? row.week_tier
                  : row.block_tier

              const factors =
                scope === 'week'
                  ? row.week_factors
                  : row.block_factors

              const detail =
                scope === 'week'
                  ? `Semaine ${row.week_number}/${row.week_count} · ${row.week_label}`
                  : row.block_label

              return `
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
                        detail
                      )}
                    </small>
                  </div>

                  <div class="sbd-leaderboard__load">
                    <strong>
                      Volume ${formatScore(
                        factors?.volume
                      )}/100
                    </strong>
                    <small>
                      Intensité ${formatScore(
                        factors?.intensity
                      )}
                      · Fréq. ${formatScore(
                        factors?.frequency
                      )}
                    </small>
                  </div>

                  <div class="sbd-leaderboard__gl">
                    <strong>
                      ${formatScore(
                        score
                      )}
                    </strong>
                    <small>
                      ${esc(
                        tier?.label ||
                        '/100'
                      )}
                    </small>
                  </div>
                </article>
              `
            }
          ).join('')}
        </div>
      ` : `
        <div class="sbd-leaderboard__empty">
          Aucun bloc disponible.
        </div>
      `}

      <p class="sbd-leaderboard__footnote">
        La semaine actuelle correspond à la dernière semaine active du programme courant enregistrée dans le cloud. Sans activité sur le nouveau bloc, la semaine 1 est utilisée.
      </p>
    </section>
  `
}
