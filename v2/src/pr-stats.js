import { supabase } from './supabase.js'

const LIFT_META = {
  sq: {
    key: 'squat',
    label: 'Squat',
    short: 'SQ',
  },
  bn: {
    key: 'bench',
    label: 'Bench',
    short: 'BN',
  },
  dl: {
    key: 'deadlift',
    label: 'Deadlift',
    short: 'DL',
  },
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function num(value) {
  const parsed =
    Number(
      String(value ?? '')
        .replace(',', '.')
    )

  return Number.isFinite(parsed)
    ? parsed
    : 0
}

function formatKg(value) {
  const amount =
    num(value)

  return amount.toLocaleString(
    'fr-FR',
    {
      minimumFractionDigits:
        Number.isInteger(amount)
          ? 0
          : 1,
      maximumFractionDigits: 1,
    }
  )
}

function formatDate(value) {
  if (!value) {
    return '—'
  }

  const date =
    new Date(value)

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return '—'
  }

  return new Intl.DateTimeFormat(
    'fr-FR',
    {
      day: '2-digit',
      month: 'short',
      year: '2-digit',
    }
  ).format(date)
}

function historyForLift(
  rows,
  code,
  reps
) {
  return (rows || [])
    .filter(
      row =>
        row.exercise_code === code &&
        Number(row.reps) ===
          Number(reps)
    )
    .slice()
    .sort(
      (a, b) =>
        new Date(a.achieved_at)
          .getTime() -
        new Date(b.achieved_at)
          .getTime()
    )
}

function buildChartGeometry(
  rows
) {
  if (!rows.length) {
    return null
  }

  const values =
    rows.map(
      row =>
        num(
          row.new_load_kg
        )
    )

  const minValue =
    Math.min(
      ...values
    )

  const maxValue =
    Math.max(
      ...values
    )

  const firstTime =
    new Date(
      rows[0].achieved_at
    ).getTime()

  const lastTime =
    new Date(
      rows[
        rows.length - 1
      ].achieved_at
    ).getTime()

  const range =
    Math.max(
      2.5,
      maxValue -
      minValue
    )

  const yMin =
    Math.max(
      0,
      Math.floor(
        (
          minValue -
          range * .16
        ) /
        2.5
      ) *
      2.5
    )

  const yMax =
    Math.ceil(
      (
        maxValue +
        range * .16
      ) /
      2.5
    ) *
    2.5

  const x1 = 42
  const x2 = 398
  const y1 = 18
  const y2 = 142

  const timeSpan =
    Math.max(
      1,
      lastTime -
      firstTime
    )

  const valueSpan =
    Math.max(
      1,
      yMax -
      yMin
    )

  const points =
    rows.map(
      (row, index) => {
        const timestamp =
          new Date(
            row.achieved_at
          ).getTime()

        const ratioX =
          rows.length === 1
            ? .5
            : (
                timestamp -
                firstTime
              ) /
              timeSpan

        const ratioY =
          (
            num(
              row.new_load_kg
            ) -
            yMin
          ) /
          valueSpan

        return {
          x:
            x1 +
            ratioX *
            (
              x2 -
              x1
            ),
          y:
            y2 -
            ratioY *
            (
              y2 -
              y1
            ),
          row,
          index,
        }
      }
    )

  return {
    points,
    yMin,
    yMax,
    x1,
    x2,
    y1,
    y2,
  }
}

function renderChart(
  rows,
  code,
  reps
) {
  const meta =
    LIFT_META[code]

  const history =
    historyForLift(
      rows,
      code,
      reps
    )

  if (!history.length) {
    return `
      <article class="pr-stats-chart pr-stats-chart--${meta.key}">
        <header>
          <div>
            <span>${meta.short}</span>
            <strong>${meta.label}</strong>
          </div>
          <em>Aucun PR ×${reps}</em>
        </header>

        <div class="pr-stats-empty">
          <b>Pas encore de courbe</b>
          <small>
            Les nouveaux PR validés apparaîtront ici automatiquement.
          </small>
        </div>
      </article>
    `
  }

  const first =
    history[0]

  const latest =
    history[
      history.length - 1
    ]

  const baseline =
    num(
      first.previous_load_kg
    ) > 0
      ? num(
          first.previous_load_kg
        )
      : num(
          first.new_load_kg
        )

  const gain =
    num(
      latest.new_load_kg
    ) -
    baseline

  const geometry =
    buildChartGeometry(
      history
    )

  const polyline =
    geometry.points
      .map(
        point =>
          `${point.x.toFixed(1)},${point.y.toFixed(1)}`
      )
      .join(' ')

  const areaPoints =
    [
      `${geometry.x1},${geometry.y2}`,
      polyline,
      `${geometry.x2},${geometry.y2}`,
    ].join(' ')

  const gridLines =
    [0, .25, .5, .75, 1]
      .map(
        ratio => {
          const y =
            geometry.y1 +
            (
              geometry.y2 -
              geometry.y1
            ) *
            ratio

          return `
            <line
              x1="${geometry.x1}"
              x2="${geometry.x2}"
              y1="${y.toFixed(1)}"
              y2="${y.toFixed(1)}"
            />
          `
        }
      )
      .join('')

  const dots =
    geometry.points
      .map(
        point => `
          <g class="pr-stats-dot">
            <circle
              cx="${point.x.toFixed(1)}"
              cy="${point.y.toFixed(1)}"
              r="${point.index === geometry.points.length - 1 ? 5.5 : 4}"
            />
            <title>
              ${escapeHtml(formatDate(point.row.achieved_at))}
              · ${escapeHtml(formatKg(point.row.new_load_kg))} kg
            </title>
          </g>
        `
      )
      .join('')

  return `
    <article class="pr-stats-chart pr-stats-chart--${meta.key}">
      <header>
        <div>
          <span>${meta.short}</span>
          <strong>${meta.label}</strong>
        </div>

        <div class="pr-stats-chart__current">
          <strong>
            ${escapeHtml(
              formatKg(
                latest.new_load_kg
              )
            )}
            <small>kg</small>
          </strong>

          <em class="${gain > 0 ? 'positive' : ''}">
            ${gain > 0 ? '+' : ''}${escapeHtml(formatKg(gain))} kg
          </em>
        </div>
      </header>

      <div class="pr-stats-svg-wrap">
        <svg
          class="pr-stats-svg"
          viewBox="0 0 440 170"
          role="img"
          aria-label="Progression des PR ${escapeHtml(meta.label)} ×${reps}"
          preserveAspectRatio="none"
        >
          <g class="pr-stats-grid">
            ${gridLines}
          </g>

          <polygon
            class="pr-stats-area"
            points="${areaPoints}"
          />

          <polyline
            class="pr-stats-line"
            points="${polyline}"
          />

          ${dots}

          <text
            x="4"
            y="${geometry.y1 + 5}"
            class="pr-stats-axis-label"
          >
            ${escapeHtml(formatKg(geometry.yMax))} kg
          </text>

          <text
            x="4"
            y="${geometry.y2 + 4}"
            class="pr-stats-axis-label"
          >
            ${escapeHtml(formatKg(geometry.yMin))} kg
          </text>
        </svg>
      </div>

      <footer>
        <span>
          ${escapeHtml(
            formatDate(
              first.achieved_at
            )
          )}
        </span>

        <b>
          ${history.length}
          nouveau${history.length > 1 ? 'x' : ''}
          PR
        </b>

        <span>
          ${escapeHtml(
            formatDate(
              latest.achieved_at
            )
          )}
        </span>
      </footer>
    </article>
  `
}

export async function loadAthletePrHistory(
  athleteSlug
) {
  if (!athleteSlug) {
    return []
  }

  const {
    data,
    error,
  } =
    await supabase
      .from(
        'pr_history'
      )
      .select(
        [
          'id',
          'athlete_slug',
          'exercise_code',
          'exercise_name',
          'set_label',
          'reps',
          'new_load_kg',
          'previous_load_kg',
          'achieved_at',
          'program_key',
          'week_label',
          'day_name',
          'source_label',
        ].join(',')
      )
      .eq(
        'athlete_slug',
        athleteSlug
      )
      .in(
        'exercise_code',
        [
          'sq',
          'bn',
          'dl',
        ]
      )
      .order(
        'achieved_at',
        {
          ascending: true,
        }
      )

  if (error) {
    throw error
  }

  return data || []
}

export function renderPrStatsPanel({
  athleteName,
  rows,
  reps = 1,
  loading = false,
  error = '',
}) {
  const safeReps =
    Math.max(
      1,
      Math.min(
        9,
        Number(reps) || 1
      )
    )

  if (loading) {
    return `
      <section class="pr-stats-panel">
        <div class="pr-stats-loading">
          <i></i>
          <strong>
            Chargement des progressions…
          </strong>
          <small>
            Lecture de l’historique des nouveaux PR.
          </small>
        </div>
      </section>
    `
  }

  if (error) {
    return `
      <section class="pr-stats-panel">
        <div class="pr-stats-error">
          <strong>
            Impossible de charger les statistiques
          </strong>
          <small>
            ${escapeHtml(error)}
          </small>
          <button
            type="button"
            data-action="reload-pr-stats"
          >
            Réessayer
          </button>
        </div>
      </section>
    `
  }

  const selected =
    (rows || [])
      .filter(
        row =>
          Number(
            row.reps
          ) === safeReps
      )

  const latest =
    selected
      .slice()
      .sort(
        (a, b) =>
          new Date(b.achieved_at)
            .getTime() -
          new Date(a.achieved_at)
            .getTime()
      )[0] ||
    null

  const totalGain =
    ['sq', 'bn', 'dl']
      .reduce(
        (sum, code) => {
          const history =
            historyForLift(
              rows,
              code,
              safeReps
            )

          if (!history.length) {
            return sum
          }

          const first =
            history[0]

          const last =
            history[
              history.length - 1
            ]

          const start =
            num(
              first.previous_load_kg
            ) > 0
              ? num(
                  first.previous_load_kg
                )
              : num(
                  first.new_load_kg
                )

          return (
            sum +
            Math.max(
              0,
              num(
                last.new_load_kg
              ) -
              start
            )
          )
        },
        0
      )

  const recent =
    selected
      .slice()
      .sort(
        (a, b) =>
          new Date(b.achieved_at)
            .getTime() -
          new Date(a.achieved_at)
            .getTime()
      )
      .slice(
        0,
        8
      )

  return `
    <section class="pr-stats-panel">
      <header class="pr-stats-hero">
        <div>
          <span>
            📈 STATISTIQUES · PROGRESSION
          </span>

          <h2>
            Progression des PR de
            ${escapeHtml(
              athleteName ||
              'l’athlète'
            )}
          </h2>

          <p>
            Chaque point correspond à un nouveau record réellement enregistré en séance.
          </p>
        </div>

        <div class="pr-stats-hero__badge">
          <small>
            REP RANGE
          </small>
          <strong>
            ×${safeReps}
          </strong>
        </div>
      </header>

      <div
        class="pr-stats-reps"
        role="tablist"
        aria-label="Nombre de répétitions pour les statistiques"
      >
        ${Array.from(
          {
            length: 9,
          },
          (_, index) =>
            index + 1
        )
          .map(
            item => `
              <button
                type="button"
                role="tab"
                class="${item === safeReps ? 'active' : ''}"
                aria-selected="${item === safeReps ? 'true' : 'false'}"
                data-action="select-sbd-reps"
                data-reps="${item}"
              >
                ×${item}
              </button>
            `
          )
          .join('')}
      </div>

      <div class="pr-stats-summary">
        <article>
          <small>
            NOUVEAUX PR
          </small>
          <strong>
            ${selected.length}
          </strong>
        </article>

        <article>
          <small>
            GAIN CUMULÉ SBD
          </small>
          <strong>
            +${escapeHtml(
              formatKg(
                totalGain
              )
            )}
            <em>kg</em>
          </strong>
        </article>

        <article>
          <small>
            DERNIER PR
          </small>
          <strong class="date">
            ${latest
              ? escapeHtml(
                  formatDate(
                    latest.achieved_at
                  )
                )
              : '—'}
          </strong>
        </article>
      </div>

      <div class="pr-stats-charts">
        ${renderChart(
          rows,
          'sq',
          safeReps
        )}

        ${renderChart(
          rows,
          'bn',
          safeReps
        )}

        ${renderChart(
          rows,
          'dl',
          safeReps
        )}
      </div>

      <section class="pr-stats-history">
        <header>
          <div>
            <span>
              HISTORIQUE
            </span>
            <strong>
              Derniers nouveaux PR ×${safeReps}
            </strong>
          </div>

          <small>
            ${recent.length}
            affiché${recent.length > 1 ? 's' : ''}
          </small>
        </header>

        ${recent.length
          ? `
            <div class="pr-stats-history__list">
              ${recent
                .map(
                  row => {
                    const meta =
                      LIFT_META[
                        row.exercise_code
                      ] ||
                      {
                        short:
                          String(
                            row.exercise_code ||
                            'PR'
                          ).toUpperCase(),
                        label:
                          row.exercise_name ||
                          'PR',
                      }

                    const previous =
                      num(
                        row.previous_load_kg
                      )

                    const gain =
                      previous > 0
                        ? num(
                            row.new_load_kg
                          ) -
                          previous
                        : 0

                    return `
                      <article>
                        <span class="lift">
                          ${escapeHtml(
                            meta.short
                          )}
                        </span>

                        <div>
                          <strong>
                            ${escapeHtml(
                              meta.label
                            )}
                            ×${safeReps}
                          </strong>
                          <small>
                            ${escapeHtml(
                              formatDate(
                                row.achieved_at
                              )
                            )}
                            ${row.week_label
                              ? ` · ${escapeHtml(row.week_label)}`
                              : ''}
                          </small>
                        </div>

                        <div class="load">
                          <strong>
                            ${escapeHtml(
                              formatKg(
                                row.new_load_kg
                              )
                            )}
                            kg
                          </strong>

                          ${gain > 0
                            ? `
                              <small>
                                +${escapeHtml(
                                  formatKg(
                                    gain
                                  )
                                )} kg
                              </small>
                            `
                            : ''}
                        </div>
                      </article>
                    `
                  }
                )
                .join('')}
            </div>
          `
          : `
            <div class="pr-stats-history__empty">
              Aucun nouveau PR ×${safeReps} enregistré pour le moment.
            </div>
          `
        }
      </section>
    </section>
  `
}
