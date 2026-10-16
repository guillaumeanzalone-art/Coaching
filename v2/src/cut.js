import { supabase } from './supabase.js'

const CACHE_PREFIX =
  'ga-cut-tracker-v1'

const TEMPLATES = [
  {
    key:'clara-76-2025',
    name:'Clara · -76 kg',
    subtitle:'Water Cut n°9 · référence 21/10/2025',
    category:'-76',
    eventDate:'2025-10-21',
    startBodyweight:78,
    targetBodyweight:76,
    days:[
      {
        waterTarget:null,
        waterMultiplier:'',
        saltTarget:null,
        saltMultiplier:'',
        note:'D1 : valeurs de base à renseigner.',
      },
      {
        waterTarget:4.5,
        waterMultiplier:'x1.5',
        saltTarget:5,
        saltMultiplier:'x2',
      },
      {
        waterTarget:5.25,
        waterMultiplier:'x1.75',
        saltTarget:6.25,
        saltMultiplier:'x2.5',
      },
      {
        waterTarget:5.25,
        waterMultiplier:'x1.75',
        saltTarget:6.25,
        saltMultiplier:'x2.5',
      },
      {
        waterTarget:5.25,
        waterMultiplier:'x1.75',
        saltTarget:0,
        saltMultiplier:'0',
        note:'Sel : arrêt après le repas de midi.',
      },
      {
        waterTarget:null,
        waterMultiplier:'Selon PDC',
        saltTarget:0,
        saltMultiplier:'0',
        note:'Eau : arrêt / adaptation selon le poids de corps.',
      },
      {
        waterTarget:null,
        waterMultiplier:'Comp',
        saltTarget:null,
        saltMultiplier:'Comp',
        note:'Jour de compétition.',
      },
    ],
  },
  {
    key:'custom-7',
    name:'Personnalisé · 7 jours',
    subtitle:'Plan coach entièrement modifiable',
    days:Array.from(
      { length:7 },
      () => ({})
    ),
  },
  {
    key:'custom-5',
    name:'Personnalisé · 5 jours',
    subtitle:'Plan coach entièrement modifiable',
    days:Array.from(
      { length:5 },
      () => ({})
    ),
  },
  {
    key:'custom-3',
    name:'Personnalisé · 3 jours',
    subtitle:'Plan coach entièrement modifiable',
    days:Array.from(
      { length:3 },
      () => ({})
    ),
  },
]

function esc(value) {
  return String(value ?? '')
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
}

function normalizedSlug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
}

function numberOrNull(value) {
  const raw =
    String(value ?? '')
      .trim()
      .replace(',','.')

  if (!raw) {
    return null
  }

  const number =
    Number(raw)

  return Number.isFinite(number)
    ? number
    : null
}

function clamp(
  value,
  min,
  max
) {
  return Math.max(
    min,
    Math.min(
      max,
      Number(value) || 0
    )
  )
}

function round2(value) {
  return Math.round(
    (Number(value) || 0) *
    100
  ) / 100
}

function cacheKey(
  athleteSlug,
  protocolKey
) {
  return [
    CACHE_PREFIX,
    normalizedSlug(
      athleteSlug
    ),
    protocolKey,
  ].join(':')
}

function readCache(
  athleteSlug,
  protocolKey
) {
  try {
    const raw =
      localStorage.getItem(
        cacheKey(
          athleteSlug,
          protocolKey
        )
      )

    return raw
      ? JSON.parse(raw)
      : null
  } catch {
    return null
  }
}

function writeCache(
  athleteSlug,
  protocolKey,
  value
) {
  try {
    localStorage.setItem(
      cacheKey(
        athleteSlug,
        protocolKey
      ),
      JSON.stringify(
        value
      )
    )
  } catch {
    // Cloud persistence remains the primary storage.
  }
}

function templateByKey(key) {
  return (
    TEMPLATES.find(
      template =>
        template.key === key
    ) ||
    TEMPLATES[0]
  )
}

function emptyFoodDay(day) {
  return {
    day,
    targetMassG:null,
    entries:[],
    fiberG:null,
    lastMeal:'',
    notes:'',
  }
}

function createStateFromTemplate(
  template
) {
  const days =
    template.days.map(
      (
        day,
        index
      ) => ({
        day:index + 1,
        waterTarget:
          day.waterTarget ??
          null,
        waterMultiplier:
          day.waterMultiplier ||
          '',
        saltTarget:
          day.saltTarget ??
          null,
        saltMultiplier:
          day.saltMultiplier ||
          '',
        note:
          day.note || '',
        bwMorning:null,
        bwEvening:null,
        bottles:[],
        saltEntries:[],
      })
    )

  return {
    version:1,
    protocolKey:
      template.key,
    title:
      template.name,
    category:
      template.category ||
      '',
    eventDate:
      template.eventDate ||
      '',
    startBodyweight:
      template.startBodyweight ??
      null,
    targetBodyweight:
      template.targetBodyweight ??
      null,
    selectedDay:1,
    selectedFoodDay:1,
    waterDays:days,
    foodDays:days.map(
      (_, index) =>
        emptyFoodDay(
          index + 1
        )
    ),
  }
}

function hydrateState(
  template,
  raw
) {
  const base =
    createStateFromTemplate(
      template
    )

  if (
    !raw ||
    typeof raw !== 'object'
  ) {
    return base
  }

  const waterDays =
    base.waterDays.map(
      (day, index) => ({
        ...day,
        ...(
          raw.waterDays?.[
            index
          ] || {}
        ),
        bottles:
          Array.isArray(
            raw.waterDays?.[
              index
            ]?.bottles
          )
            ? raw.waterDays[
                index
              ].bottles
            : [],
        saltEntries:
          Array.isArray(
            raw.waterDays?.[
              index
            ]?.saltEntries
          )
            ? raw.waterDays[
                index
              ].saltEntries
            : [],
      })
    )

  const foodDays =
    base.foodDays.map(
      (day, index) => ({
        ...day,
        ...(
          raw.foodDays?.[
            index
          ] || {}
        ),
        entries:
          Array.isArray(
            raw.foodDays?.[
              index
            ]?.entries
          )
            ? raw.foodDays[
                index
              ].entries
            : [],
      })
    )

  return {
    ...base,
    ...raw,
    protocolKey:
      template.key,
    waterDays,
    foodDays,
    selectedDay:
      clamp(
        raw.selectedDay || 1,
        1,
        waterDays.length
      ),
    selectedFoodDay:
      clamp(
        raw.selectedFoodDay || 1,
        1,
        foodDays.length
      ),
  }
}

function sum(
  values
) {
  return round2(
    values.reduce(
      (
        total,
        value
      ) =>
        total +
        (
          Number(value) ||
          0
        ),
      0
    )
  )
}

function waterConsumed(day) {
  return sum(
    day?.bottles || []
  )
}

function saltConsumed(day) {
  return sum(
    day?.saltEntries || []
  )
}

function foodConsumed(day) {
  return Math.round(
    sum(
      day?.entries || []
    )
  )
}

function formatDecimal(
  value,
  digits = 2
) {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return '—'
  }

  return Number(value)
    .toLocaleString(
      'fr-FR',
      {
        maximumFractionDigits:
          digits,
      }
    )
}

function percent(
  value,
  target
) {
  const max =
    Number(target) || 0

  if (max <= 0) {
    return 0
  }

  return clamp(
    (
      Number(value) ||
      0
    ) /
      max *
      100,
    0,
    100
  )
}

function weightValue(day) {
  const evening =
    numberOrNull(
      day?.bwEvening
    )

  if (evening !== null) {
    return evening
  }

  return numberOrNull(
    day?.bwMorning
  )
}

function weightTrendSvg(
  days,
  targetBodyweight
) {
  const points =
    days.map(
      (
        day,
        index
      ) => ({
        index,
        weight:
          weightValue(
            day
          ),
      })
    )
      .filter(
        item =>
          item.weight !==
          null
      )

  if (!points.length) {
    return `
      <div class="cut-weight-empty">
        Renseigne le poids quotidien pour afficher la courbe.
      </div>
    `
  }

  const values =
    points.map(
      point =>
        point.weight
    )

  const target =
    numberOrNull(
      targetBodyweight
    )

  if (target !== null) {
    values.push(
      target
    )
  }

  const min =
    Math.min(
      ...values
    ) - 0.25

  const max =
    Math.max(
      ...values
    ) + 0.25

  const range =
    Math.max(
      0.5,
      max - min
    )

  const x =
    index =>
      8 +
      (
        index /
        Math.max(
          1,
          days.length - 1
        )
      ) *
      84

  const y =
    weight =>
      84 -
      (
        (
          weight - min
        ) /
        range
      ) *
      66

  const path =
    points.map(
      (
        point,
        index
      ) =>
        (
          index === 0
            ? 'M'
            : 'L'
        ) +
        x(
          point.index
        ) +
        ' ' +
        y(
          point.weight
        )
    ).join(' ')

  const targetLine =
    target === null
      ? ''
      : `
          <line
            x1="7"
            x2="93"
            y1="${y(target)}"
            y2="${y(target)}"
            class="cut-weight-target-line"
          />
          <text
            x="92"
            y="${Math.max(
              10,
              y(target) - 3
            )}"
            text-anchor="end"
            class="cut-weight-target-label"
          >
            ${formatDecimal(target)} kg
          </text>
        `

  return `
    <svg
      class="cut-weight-chart"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-label="Évolution du poids"
    >
      ${targetLine}
      <path
        d="${path}"
        class="cut-weight-path"
      />
      ${points.map(
        point => `
          <circle
            cx="${x(point.index)}"
            cy="${y(point.weight)}"
            r="2.4"
            class="cut-weight-dot"
          />
        `
      ).join('')}
    </svg>
  `
}

function bottleVisual(
  consumed,
  target
) {
  const progress =
    percent(
      consumed,
      target
    )

  return `
    <div
      class="cut-bottle"
      aria-label="${Math.round(progress)} % de l'objectif eau"
    >
      <div class="cut-bottle__cap"></div>
      <div class="cut-bottle__body">
        <div
          class="cut-bottle__fill"
          style="height:${progress}%"
        >
          <span></span>
        </div>

        <div class="cut-bottle__marks">
          <i></i>
          <i></i>
          <i></i>
          <i></i>
        </div>

        <strong>
          ${Math.round(progress)}%
        </strong>
      </div>
    </div>
  `
}

function saltVisual(
  consumed,
  target
) {
  const progress =
    percent(
      consumed,
      target
    )

  return `
    <div
      class="cut-salt-visual"
      aria-label="${Math.round(progress)} % de l'objectif sel"
    >
      <div class="cut-salt-grains">
        <i></i><i></i><i></i><i></i><i></i>
      </div>

      <div class="cut-salt-mound">
        <div
          class="cut-salt-mound__fill"
          style="height:${progress}%"
        ></div>
      </div>

      <strong>
        ${Math.round(progress)}%
      </strong>
    </div>
  `
}

function plateVisual(
  consumed,
  target
) {
  const progress =
    percent(
      consumed,
      target
    )

  return `
    <div class="cut-food-plate">
      <div
        class="cut-food-plate__fill"
        style="--food-progress:${progress}%"
      ></div>

      <div class="cut-food-plate__inner">
        <strong>
          ${Math.round(progress)}%
        </strong>
        <span>food mass</span>
      </div>
    </div>
  `
}

async function loadCloudStates(
  athleteSlug
) {
  const {
    data,
    error,
  } =
    await supabase
      .from(
        'athlete_cut_protocols_v1'
      )
      .select(
        'protocol_key,title,category,event_date,start_bodyweight,target_bodyweight,data,updated_at'
      )
      .eq(
        'athlete_slug',
        athleteSlug
      )

  if (error) {
    throw error
  }

  const map =
    new Map()

  ;(
    data || []
  ).forEach(
    row => {
      map.set(
        row.protocol_key,
        {
          ...row.data,
          title:
            row.title,
          category:
            row.category,
          eventDate:
            row.event_date ||
            '',
          startBodyweight:
            row.start_bodyweight,
          targetBodyweight:
            row.target_bodyweight,
        }
      )
    }
  )

  return map
}

async function saveCloudState(
  athleteSlug,
  state
) {
  const {
    error,
  } =
    await supabase
      .from(
        'athlete_cut_protocols_v1'
      )
      .upsert(
        {
          athlete_slug:
            athleteSlug,
          protocol_key:
            state.protocolKey,
          title:
            state.title ||
            'CUT',
          category:
            state.category ||
            '',
          event_date:
            state.eventDate ||
            null,
          start_bodyweight:
            numberOrNull(
              state.startBodyweight
            ),
          target_bodyweight:
            numberOrNull(
              state.targetBodyweight
            ),
          data:
            state,
          updated_by:
            (
              await supabase.auth
                .getUser()
            ).data?.user?.id ||
            null,
          updated_at:
            new Date()
              .toISOString(),
        },
        {
          onConflict:
            'athlete_slug,protocol_key',
        }
      )

  if (error) {
    throw error
  }
}

export async function mountCut(
  root,
  {
    athletes = [],
    initialSlug = '',
    allowAthleteSelection = false,
    onBack = () => {},
  } = {}
) {
  let athleteSlug =
    normalizedSlug(
      initialSlug ||
      athletes[0]?.cloudSlug ||
      athletes[0]?.id ||
      ''
    )

  let activeTab =
    'water'

  let protocolKey =
    TEMPLATES[0].key

  let cloudStates =
    new Map()

  let state =
    hydrateState(
      templateByKey(
        protocolKey
      ),
      readCache(
        athleteSlug,
        protocolKey
      )
    )

  let loading =
    true

  let saveTimer = null

  let saveStatus =
    'Sauvegarde locale'

  function selectedAthlete() {
    return (
      athletes.find(
        athlete =>
          normalizedSlug(
            athlete.cloudSlug ||
            athlete.id
          ) ===
          athleteSlug
      ) ||
      athletes[0] ||
      null
    )
  }

  async function hydrateAthlete() {
    loading = true
    render()

    try {
      cloudStates =
        await loadCloudStates(
          athleteSlug
        )
    } catch (
      error
    ) {
      console.warn(
        'CUT CLOUD LOAD',
        error
      )

      cloudStates =
        new Map()
    }

    const remote =
      cloudStates.get(
        protocolKey
      )

    state =
      hydrateState(
        templateByKey(
          protocolKey
        ),
        remote ||
        readCache(
          athleteSlug,
          protocolKey
        )
      )

    loading = false
    render()
  }

  function saveLocal() {
    writeCache(
      athleteSlug,
      protocolKey,
      state
    )

    saveStatus =
      navigator.onLine === false
        ? 'Hors ligne · sauvegardé localement'
        : 'Modification locale…'
  }

  function queueSave() {
    saveLocal()

    if (saveTimer) {
      clearTimeout(
        saveTimer
      )
    }

    saveTimer =
      setTimeout(
        async () => {
          try {
            await saveCloudState(
              athleteSlug,
              state
            )

            cloudStates.set(
              protocolKey,
              structuredClone(
                state
              )
            )

            saveStatus =
              'Synchronisé'

            updateSaveStatus()
          } catch (
            error
          ) {
            console.warn(
              'CUT CLOUD SAVE',
              error
            )

            saveStatus =
              'Sauvegardé localement'

            updateSaveStatus()
          }
        },
        550
      )
  }

  function updateSaveStatus() {
    const element =
      root.querySelector(
        '[data-cut-save-status]'
      )

    if (element) {
      element.textContent =
        saveStatus
    }
  }

  function switchProtocol(
    nextKey
  ) {
    protocolKey =
      templateByKey(
        nextKey
      ).key

    const template =
      templateByKey(
        protocolKey
      )

    state =
      hydrateState(
        template,
        cloudStates.get(
          protocolKey
        ) ||
        readCache(
          athleteSlug,
          protocolKey
        )
      )

    render()
  }

  function dayByIndex(
    index,
    type = 'water'
  ) {
    const days =
      type === 'food'
        ? state.foodDays
        : state.waterDays

    return days[
      clamp(
        index,
        1,
        days.length
      ) - 1
    ]
  }

  function renderAthleteSelect() {
    if (
      !allowAthleteSelection
    ) {
      const athlete =
        selectedAthlete()

      return `
        <div class="cut-athlete-static">
          <span>ATHLÈTE</span>
          <strong>
            ${esc(
              athlete?.name ||
              athleteSlug ||
              'Athlète'
            )}
          </strong>
        </div>
      `
    }

    return `
      <label class="cut-athlete-select">
        <span>ATHLÈTE</span>

        <select
          data-action="cut-athlete"
        >
          ${athletes.map(
            athlete => {
              const slug =
                normalizedSlug(
                  athlete.cloudSlug ||
                  athlete.id
                )

              return `
                <option
                  value="${esc(slug)}"
                  ${slug === athleteSlug ? 'selected' : ''}
                >
                  ${esc(athlete.name)}
                </option>
              `
            }
          ).join('')}
        </select>
      </label>
    `
  }

  function renderProtocolSelect() {
    return `
      <div class="cut-protocol-selector">
        ${TEMPLATES.map(
          template => `
            <button
              type="button"
              class="${template.key === protocolKey ? 'active' : ''}"
              data-action="cut-protocol"
              data-protocol-key="${esc(template.key)}"
            >
              <strong>
                ${esc(template.name)}
              </strong>

              <span>
                ${esc(template.subtitle)}
              </span>
            </button>
          `
        ).join('')}
      </div>
    `
  }

  function renderOverview() {
    const start =
      numberOrNull(
        state.startBodyweight
      )

    const target =
      numberOrNull(
        state.targetBodyweight
      )

    const delta =
      (
        start !== null &&
        target !== null &&
        start > 0
      )
        ? (
            (
              target - start
            ) /
            start *
            100
          )
        : null

    return `
      <section class="cut-overview">
        <div class="cut-overview__meta">
          <label>
            <span>DATE / COMPÉTITION</span>
            <input
              type="date"
              data-action="cut-meta"
              data-field="eventDate"
              value="${esc(state.eventDate || '')}"
            >
          </label>

          <label>
            <span>CATÉGORIE</span>
            <input
              type="text"
              data-action="cut-meta"
              data-field="category"
              value="${esc(state.category || '')}"
              placeholder="-66 / -76…"
            >
          </label>

          <label>
            <span>BW DÉPART</span>
            <input
              type="number"
              inputmode="decimal"
              step="0.05"
              data-action="cut-meta"
              data-field="startBodyweight"
              value="${state.startBodyweight ?? ''}"
              placeholder="kg"
            >
          </label>

          <label>
            <span>BW CIBLE</span>
            <input
              type="number"
              inputmode="decimal"
              step="0.05"
              data-action="cut-meta"
              data-field="targetBodyweight"
              value="${state.targetBodyweight ?? ''}"
              placeholder="kg"
            >
          </label>
        </div>

        <div class="cut-overview__weight">
          <div class="cut-overview__weight-copy">
            <span>TRAJECTOIRE</span>

            <strong>
              ${start === null
                ? '—'
                : formatDecimal(start)}
              <small>kg</small>
              <i>→</i>
              ${target === null
                ? '—'
                : formatDecimal(target)}
              <small>kg</small>
            </strong>

            <b>
              ${delta === null
                ? 'Objectif non défini'
                : (
                    delta.toLocaleString(
                      'fr-FR',
                      {
                        maximumFractionDigits:2,
                      }
                    ) +
                    ' %'
                  )}
            </b>
          </div>

          <div class="cut-overview__chart">
            ${weightTrendSvg(
              state.waterDays,
              state.targetBodyweight
            )}
          </div>
        </div>
      </section>
    `
  }

  function renderDayRail(
    type
  ) {
    const days =
      type === 'food'
        ? state.foodDays
        : state.waterDays

    const selected =
      type === 'food'
        ? state.selectedFoodDay
        : state.selectedDay

    return `
      <div class="cut-day-rail">
        ${days.map(
          day => {
            const relatedWater =
              state.waterDays[
                day.day - 1
              ]

            const weight =
              weightValue(
                relatedWater
              )

            return `
              <button
                type="button"
                class="${day.day === selected ? 'active' : ''}"
                data-action="cut-day"
                data-cut-type="${type}"
                data-day="${day.day}"
              >
                <b>D${day.day}</b>
                <span>
                  ${weight === null
                    ? '—'
                    : (
                        formatDecimal(
                          weight
                        ) +
                        ' kg'
                      )}
                </span>
              </button>
            `
          }
        ).join('')}
      </div>
    `
  }

  function renderWater() {
    const day =
      dayByIndex(
        state.selectedDay,
        'water'
      )

    const water =
      waterConsumed(
        day
      )

    const salt =
      saltConsumed(
        day
      )

    const waterTarget =
      numberOrNull(
        day.waterTarget
      )

    const saltTarget =
      numberOrNull(
        day.saltTarget
      )

    return `
      <section class="cut-panel">
        ${renderDayRail('water')}

        <div class="cut-day-header">
          <div>
            <span>
              JOUR ${day.day}
            </span>

            <h2>
              Eau & sel
            </h2>
          </div>

          <div class="cut-day-weight-inputs">
            <label>
              <span>BW MATIN</span>
              <input
                type="number"
                step="0.05"
                inputmode="decimal"
                data-action="cut-water-field"
                data-field="bwMorning"
                value="${day.bwMorning ?? ''}"
                placeholder="kg"
              >
            </label>

            <label>
              <span>BW SOIR</span>
              <input
                type="number"
                step="0.05"
                inputmode="decimal"
                data-action="cut-water-field"
                data-field="bwEvening"
                value="${day.bwEvening ?? ''}"
                placeholder="kg"
              >
            </label>
          </div>
        </div>

        <div class="cut-hydration-grid">
          <article class="cut-gauge-card cut-gauge-card--water">
            <header>
              <div>
                <span>EAU</span>
                <strong>
                  ${formatDecimal(water)} L
                  <small>
                    / ${waterTarget === null ? '—' : formatDecimal(waterTarget)} L
                  </small>
                </strong>
              </div>

              <div class="cut-target-inline">
                <label>
                  <span>OBJECTIF L</span>
                  <input
                    type="number"
                    step="0.25"
                    inputmode="decimal"
                    data-action="cut-water-field"
                    data-field="waterTarget"
                    value="${day.waterTarget ?? ''}"
                    placeholder="L"
                  >
                </label>

                <label>
                  <span>REPÈRE</span>
                  <input
                    type="text"
                    data-action="cut-water-field"
                    data-field="waterMultiplier"
                    value="${esc(day.waterMultiplier || '')}"
                    placeholder="x1.5"
                  >
                </label>
              </div>
            </header>

            <div class="cut-gauge-card__body">
              ${bottleVisual(
                water,
                waterTarget
              )}

              <div class="cut-quick-log">
                <span>
                  J'ai bu
                </span>

                <div>
                  ${[
                    0.5,
                    1,
                    1.5,
                    2,
                  ].map(
                    size => `
                      <button
                        type="button"
                        data-action="cut-add-water"
                        data-amount="${size}"
                      >
                        +${String(size).replace('.',',')} L
                      </button>
                    `
                  ).join('')}
                </div>

                <div class="cut-log-chips">
                  ${day.bottles.length
                    ? day.bottles.map(
                        (
                          size,
                          index
                        ) => `
                          <button
                            type="button"
                            data-action="cut-remove-water"
                            data-entry-index="${index}"
                            title="Retirer cette bouteille"
                          >
                            ✓ ${String(size).replace('.',',')} L
                          </button>
                        `
                      ).join('')
                    : '<span class="cut-log-empty">Aucune bouteille cochée</span>'}
                </div>
              </div>
            </div>
          </article>

          <article class="cut-gauge-card cut-gauge-card--salt">
            <header>
              <div>
                <span>SEL</span>
                <strong>
                  ${formatDecimal(salt)} g
                  <small>
                    / ${saltTarget === null ? '—' : formatDecimal(saltTarget)} g
                  </small>
                </strong>
              </div>

              <div class="cut-target-inline">
                <label>
                  <span>OBJECTIF G</span>
                  <input
                    type="number"
                    step="0.25"
                    inputmode="decimal"
                    data-action="cut-water-field"
                    data-field="saltTarget"
                    value="${day.saltTarget ?? ''}"
                    placeholder="g"
                  >
                </label>

                <label>
                  <span>REPÈRE</span>
                  <input
                    type="text"
                    data-action="cut-water-field"
                    data-field="saltMultiplier"
                    value="${esc(day.saltMultiplier || '')}"
                    placeholder="x2"
                  >
                </label>
              </div>
            </header>

            <div class="cut-gauge-card__body">
              ${saltVisual(
                salt,
                saltTarget
              )}

              <div class="cut-quick-log">
                <span>
                  J'ai pris
                </span>

                <div>
                  ${[
                    0.5,
                    1,
                    2.5,
                  ].map(
                    size => `
                      <button
                        type="button"
                        data-action="cut-add-salt"
                        data-amount="${size}"
                      >
                        +${String(size).replace('.',',')} g
                      </button>
                    `
                  ).join('')}
                </div>

                <div class="cut-log-chips cut-log-chips--salt">
                  ${day.saltEntries.length
                    ? day.saltEntries.map(
                        (
                          size,
                          index
                        ) => `
                          <button
                            type="button"
                            data-action="cut-remove-salt"
                            data-entry-index="${index}"
                            title="Retirer cette prise"
                          >
                            ✓ ${String(size).replace('.',',')} g
                          </button>
                        `
                      ).join('')
                    : '<span class="cut-log-empty">Aucune prise cochée</span>'}
                </div>
              </div>
            </div>
          </article>
        </div>

        <label class="cut-note-field">
          <span>CONSIGNE / TIMING DU JOUR</span>

          <textarea
            data-action="cut-water-field"
            data-field="note"
            rows="3"
            placeholder="Ex : arrêter après le repas de midi…"
          >${esc(day.note || '')}</textarea>
        </label>

        <div class="cut-safety-note">
          Le module sert au suivi. Toute restriction d’eau ou de sodium doit rester
          définie et validée par l’encadrement de l’athlète.
        </div>
      </section>
    `
  }

  function renderFood() {
    const day =
      dayByIndex(
        state.selectedFoodDay,
        'food'
      )

    const consumed =
      foodConsumed(
        day
      )

    const target =
      numberOrNull(
        day.targetMassG
      )

    return `
      <section class="cut-panel">
        ${renderDayRail('food')}

        <div class="cut-day-header">
          <div>
            <span>
              JOUR ${day.day}
            </span>

            <h2>
              Food Mass
            </h2>
          </div>

          <div class="cut-food-summary">
            <b>
              ${formatDecimal(consumed,0)} g
            </b>

            <span>
              / ${target === null ? '—' : formatDecimal(target,0)} g
            </span>
          </div>
        </div>

        <div class="cut-food-grid">
          <article class="cut-food-gauge-card">
            ${plateVisual(
              consumed,
              target
            )}

            <div>
              <span class="cut-food-label">
                MASSE ALIMENTAIRE DU JOUR
              </span>

              <strong>
                ${formatDecimal(consumed,0)}
                <small>
                  g consommés
                </small>
              </strong>

              <div class="cut-food-quick">
                ${[
                  100,
                  250,
                  500,
                ].map(
                  grams => `
                    <button
                      type="button"
                      data-action="cut-add-food"
                      data-amount="${grams}"
                    >
                      +${grams} g
                    </button>
                  `
                ).join('')}
              </div>

              <div class="cut-log-chips cut-log-chips--food">
                ${day.entries.length
                  ? day.entries.map(
                      (
                        grams,
                        index
                      ) => `
                        <button
                          type="button"
                          data-action="cut-remove-food"
                          data-entry-index="${index}"
                        >
                          ✓ ${grams} g
                        </button>
                      `
                    ).join('')
                  : '<span class="cut-log-empty">Aucune prise enregistrée</span>'}
              </div>
            </div>
          </article>

          <div class="cut-food-fields">
            <label>
              <span>OBJECTIF FOOD MASS</span>
              <input
                type="number"
                step="10"
                inputmode="numeric"
                data-action="cut-food-field"
                data-field="targetMassG"
                value="${day.targetMassG ?? ''}"
                placeholder="g"
              >
            </label>

            <label>
              <span>FIBRES DU JOUR</span>
              <input
                type="number"
                step="0.5"
                inputmode="decimal"
                data-action="cut-food-field"
                data-field="fiberG"
                value="${day.fiberG ?? ''}"
                placeholder="g"
              >
            </label>

            <label>
              <span>DERNIER REPAS</span>
              <input
                type="time"
                data-action="cut-food-field"
                data-field="lastMeal"
                value="${esc(day.lastMeal || '')}"
              >
            </label>

            <label class="cut-food-fields__notes">
              <span>NOTES / ALIMENTS PRÉVUS</span>
              <textarea
                rows="5"
                data-action="cut-food-field"
                data-field="notes"
                placeholder="Plan alimentaire, horaires, consignes…"
              >${esc(day.notes || '')}</textarea>
            </label>
          </div>
        </div>

        <div class="cut-safety-note">
          Food Mass reste un outil de suivi : les quantités et choix alimentaires
          sont configurables par le coach, sans recommandation automatique de l’app.
        </div>
      </section>
    `
  }

  function render() {
    const athlete =
      selectedAthlete()

    root.innerHTML = `
      <main class="cut-page">
        <header class="cut-topbar">
          <button
            type="button"
            class="back-button"
            data-action="cut-back"
          >
            ← Accueil
          </button>

          <div class="cut-title">
            <span>
              GA COACHING · COMPÉTITION
            </span>

            <h1>
              CUT
            </h1>
          </div>

          <div
            class="cut-save-status"
            data-cut-save-status
          >
            ${esc(saveStatus)}
          </div>
        </header>

        <section class="cut-hero">
          <div class="cut-hero__copy">
            <span>
              WATER CUT · FOOD MASS
            </span>

            <h2>
              Pilote la descente de poids jour après jour.
            </h2>

            <p>
              Poids, eau, sel et masse alimentaire réunis dans un seul suivi.
            </p>
          </div>

          <div class="cut-hero__athlete">
            ${renderAthleteSelect()}

            <div>
              <span>PROFIL</span>
              <strong>
                ${esc(
                  athlete?.name ||
                  'Athlète'
                )}
              </strong>
            </div>
          </div>
        </section>

        <section class="cut-tabs">
          <button
            type="button"
            class="${activeTab === 'water' ? 'active' : ''}"
            data-action="cut-tab"
            data-tab="water"
          >
            <span>💧</span>
            <b>Water Cut</b>
            <small>Eau · sel · BW</small>
          </button>

          <button
            type="button"
            class="${activeTab === 'food' ? 'active' : ''}"
            data-action="cut-tab"
            data-tab="food"
          >
            <span>◉</span>
            <b>Food Mass</b>
            <small>Masse · fibres · horaires</small>
          </button>
        </section>

        <section class="cut-protocols">
          <header>
            <div>
              <span>PROTOCOLE</span>
              <h3>
                Choisir une base
              </h3>
            </div>

            <p>
              Le modèle Clara reprend le water cut de référence fourni.
              Les modèles personnalisés démarrent vides.
            </p>
          </header>

          ${renderProtocolSelect()}
        </section>

        ${renderOverview()}

        ${loading
          ? `
              <section class="cut-loading">
                Synchronisation du CUT…
              </section>
            `
          : (
              activeTab === 'water'
                ? renderWater()
                : renderFood()
            )}
      </main>
    `

    updateSaveStatus()
  }

  root.onclick =
    async event => {
      const action =
        event.target.closest(
          '[data-action]'
        )

      if (!action) {
        return
      }

      const name =
        action.dataset.action

      if (
        name === 'cut-back'
      ) {
        if (saveTimer) {
          clearTimeout(
            saveTimer
          )

          try {
            await saveCloudState(
              athleteSlug,
              state
            )
          } catch {
            // Local cache has already been saved.
          }
        }

        root.onclick = null
        root.onchange = null
        root.oninput = null
        onBack()
        return
      }

      if (
        name === 'cut-tab'
      ) {
        activeTab =
          action.dataset.tab ===
            'food'
            ? 'food'
            : 'water'

        render()
        return
      }

      if (
        name ===
          'cut-protocol'
      ) {
        switchProtocol(
          action.dataset
            .protocolKey
        )
        return
      }

      if (
        name === 'cut-day'
      ) {
        const day =
          Number(
            action.dataset.day
          ) || 1

        if (
          action.dataset.cutType ===
            'food'
        ) {
          state.selectedFoodDay =
            clamp(
              day,
              1,
              state.foodDays.length
            )
        } else {
          state.selectedDay =
            clamp(
              day,
              1,
              state.waterDays.length
            )
        }

        saveLocal()
        render()
        return
      }

      if (
        name ===
          'cut-add-water'
      ) {
        const day =
          dayByIndex(
            state.selectedDay
          )

        day.bottles.push(
          Number(
            action.dataset.amount
          ) || 0
        )

        queueSave()
        render()
        return
      }

      if (
        name ===
          'cut-remove-water'
      ) {
        const day =
          dayByIndex(
            state.selectedDay
          )

        day.bottles.splice(
          Number(
            action.dataset
              .entryIndex
          ),
          1
        )

        queueSave()
        render()
        return
      }

      if (
        name ===
          'cut-add-salt'
      ) {
        const day =
          dayByIndex(
            state.selectedDay
          )

        day.saltEntries.push(
          Number(
            action.dataset.amount
          ) || 0
        )

        queueSave()
        render()
        return
      }

      if (
        name ===
          'cut-remove-salt'
      ) {
        const day =
          dayByIndex(
            state.selectedDay
          )

        day.saltEntries.splice(
          Number(
            action.dataset
              .entryIndex
          ),
          1
        )

        queueSave()
        render()
        return
      }

      if (
        name ===
          'cut-add-food'
      ) {
        const day =
          dayByIndex(
            state.selectedFoodDay,
            'food'
          )

        day.entries.push(
          Number(
            action.dataset.amount
          ) || 0
        )

        queueSave()
        render()
        return
      }

      if (
        name ===
          'cut-remove-food'
      ) {
        const day =
          dayByIndex(
            state.selectedFoodDay,
            'food'
          )

        day.entries.splice(
          Number(
            action.dataset
              .entryIndex
          ),
          1
        )

        queueSave()
        render()
      }
    }

  root.onchange =
    async event => {
      const input =
        event.target

      const action =
        input.dataset.action

      if (
        action === 'cut-athlete'
      ) {
        athleteSlug =
          normalizedSlug(
            input.value
          )

        cloudStates =
          new Map()

        state =
          hydrateState(
            templateByKey(
              protocolKey
            ),
            readCache(
              athleteSlug,
              protocolKey
            )
          )

        await hydrateAthlete()
        return
      }

      if (
        action === 'cut-meta'
      ) {
        const field =
          input.dataset.field

        if (
          field ===
            'startBodyweight' ||
          field ===
            'targetBodyweight'
        ) {
          state[field] =
            numberOrNull(
              input.value
            )
        } else {
          state[field] =
            input.value
        }

        queueSave()
        render()
        return
      }

      if (
        action ===
          'cut-water-field'
      ) {
        const day =
          dayByIndex(
            state.selectedDay
          )

        const field =
          input.dataset.field

        if (
          [
            'bwMorning',
            'bwEvening',
            'waterTarget',
            'saltTarget',
          ].includes(
            field
          )
        ) {
          day[field] =
            numberOrNull(
              input.value
            )
        } else {
          day[field] =
            input.value
        }

        queueSave()
        render()
        return
      }

      if (
        action ===
          'cut-food-field'
      ) {
        const day =
          dayByIndex(
            state.selectedFoodDay,
            'food'
          )

        const field =
          input.dataset.field

        if (
          [
            'targetMassG',
            'fiberG',
          ].includes(
            field
          )
        ) {
          day[field] =
            numberOrNull(
              input.value
            )
        } else {
          day[field] =
            input.value
        }

        queueSave()
        render()
      }
    }

  root.oninput =
    event => {
      const input =
        event.target

      const action =
        input.dataset.action

      if (
        action ===
          'cut-water-field' &&
        [
          'note',
          'waterMultiplier',
          'saltMultiplier',
        ].includes(
          input.dataset.field
        )
      ) {
        const day =
          dayByIndex(
            state.selectedDay
          )

        day[
          input.dataset.field
        ] =
          input.value

        saveLocal()
        return
      }

      if (
        action ===
          'cut-food-field' &&
        input.dataset.field ===
          'notes'
      ) {
        const day =
          dayByIndex(
            state.selectedFoodDay,
            'food'
          )

        day.notes =
          input.value

        saveLocal()
      }
    }

  render()
  await hydrateAthlete()
}
