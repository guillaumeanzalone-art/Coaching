const IPF_LIFTS = [
  {
    key: 'squat',
    label: 'Squat',
    short: 'SQ',
  },
  {
    key: 'bench',
    label: 'Bench press',
    short: 'BP',
  },
  {
    key: 'deadlift',
    label: 'Deadlift',
    short: 'DL',
  },
]

const ATTEMPT_STATUSES =
  new Set([
    'pending',
    'good',
    'failed',
  ])

const IPF_GL_CLASSIC_POWERLIFTING = {
  male: {
    A: 1199.72839,
    B: 1025.18162,
    C: 0.00921,
    minBodyWeight: 40,
  },
  female: {
    A: 610.32796,
    B: 1045.59282,
    C: 0.03048,
    minBodyWeight: 35,
  },
}

function numeric(value) {
  const parsed = Number(
    String(value ?? '')
      .replace(',', '.')
  )

  return Number.isFinite(parsed)
    ? parsed
    : 0
}

function positiveLoad(value) {
  const load = numeric(value)
  return load > 0 && load <= 1000
    ? load
    : null
}

function positiveGl(value) {
  const gl = numeric(value)
  return gl > 0 && gl <= 300
    ? gl
    : null
}

function normalizeSex(value) {
  return value === 'female'
    ? 'female'
    : 'male'
}

function positiveBodyWeight(
  value,
  sex = 'male'
) {
  const bodyWeight =
    numeric(value)

  const config =
    IPF_GL_CLASSIC_POWERLIFTING[
      normalizeSex(sex)
    ]

  return (
    bodyWeight >=
      config.minBodyWeight &&
    bodyWeight <= 400
  )
    ? bodyWeight
    : null
}

export function calculateIpfGlCoefficient(
  bodyWeight,
  sex = 'male'
) {
  const normalizedSex =
    normalizeSex(sex)

  const weight =
    positiveBodyWeight(
      bodyWeight,
      normalizedSex
    )

  if (!weight) return null

  const {
    A,
    B,
    C,
  } =
    IPF_GL_CLASSIC_POWERLIFTING[
      normalizedSex
    ]

  const denominator =
    A -
    B *
    Math.exp(
      -C * weight
    )

  if (
    !Number.isFinite(
      denominator
    ) ||
    denominator <= 0
  ) {
    return null
  }

  return 100 / denominator
}

export function calculateIpfGlPoints(
  total,
  bodyWeight,
  sex = 'male'
) {
  const result =
    positiveLoad(total)

  const coefficient =
    calculateIpfGlCoefficient(
      bodyWeight,
      sex
    )

  if (
    !result ||
    !coefficient
  ) {
    return null
  }

  return (
    result *
    coefficient
  )
}

export function calculateTotalForIpfGl(
  targetGl,
  bodyWeight,
  sex = 'male'
) {
  const gl =
    positiveGl(targetGl)

  const coefficient =
    calculateIpfGlCoefficient(
      bodyWeight,
      sex
    )

  if (
    !gl ||
    !coefficient
  ) {
    return null
  }

  return roundIpfLoad(
    gl / coefficient,
    'up'
  )
}

export function roundIpfLoad(
  value,
  direction = 'nearest'
) {
  const load = numeric(value)

  if (load <= 0) return 0

  const units = load / 2.5

  if (direction === 'up') {
    return Math.ceil(units) * 2.5
  }

  if (direction === 'down') {
    return Math.floor(units) * 2.5
  }

  return Math.round(units) * 2.5
}

function emptyAttempt() {
  return {
    kg: null,
    status: 'pending',
  }
}

function normalizeAttempt(
  attempt
) {
  return {
    kg:
      positiveLoad(
        attempt?.kg
      ),
    status:
      ATTEMPT_STATUSES.has(
        attempt?.status
      )
        ? attempt.status
        : 'pending',
  }
}

function normalizeLift(
  lift
) {
  const attempts =
    Array.isArray(
      lift?.attempts
    )
      ? lift.attempts
      : []

  return {
    attempts:
      Array.from(
        { length: 3 },
        (_, index) =>
          normalizeAttempt(
            attempts[index] ||
              emptyAttempt()
          )
      ),
  }
}

export function createIpfMatchState(
  saved = null
) {
  const sex =
    normalizeSex(
      saved?.sex
    )

  return {
    version: 2,
    targetEnabled:
      saved?.targetEnabled !==
      false,
    targetMode:
      saved?.targetMode === 'gl'
        ? 'gl'
        : 'total',
    targetTotal:
      positiveLoad(
        saved?.targetTotal
      ),
    targetGl:
      positiveGl(
        saved?.targetGl
      ),
    bodyWeight:
      positiveBodyWeight(
        saved?.bodyWeight,
        sex
      ),
    sex,
    lifts:
      Object.fromEntries(
        IPF_LIFTS.map(
          ({ key }) => [
            key,
            normalizeLift(
              saved?.lifts?.[
                key
              ]
            ),
          ]
        )
      ),
  }
}

export function loadIpfMatchState(
  storageKey
) {
  try {
    const raw =
      localStorage.getItem(
        storageKey
      )

    return createIpfMatchState(
      raw
        ? JSON.parse(raw)
        : null
    )
  } catch {
    return createIpfMatchState()
  }
}

export function saveIpfMatchState(
  storageKey,
  state
) {
  localStorage.setItem(
    storageKey,
    JSON.stringify(
      createIpfMatchState(
        state
      )
    )
  )
}

export function hasIpfMatchData(
  state
) {
  if (
    positiveLoad(
      state?.targetTotal
    ) ||
    positiveGl(
      state?.targetGl
    )
  ) {
    return true
  }

  return IPF_LIFTS.some(
    ({ key }) =>
      state?.lifts?.[
        key
      ]?.attempts?.some(
        attempt =>
          positiveLoad(
            attempt?.kg
          )
      )
  )
}

function oneRepPr(
  sbdPrs,
  lift
) {
  return positiveLoad(
    sbdPrs?.[lift]?.[1]
      ?.load_kg
  )
}

export function seedIpfMatchFromPrs(
  state,
  sbdPrs
) {
  const next =
    createIpfMatchState(
      state
    )

  const prs = {}

  IPF_LIFTS.forEach(
    ({ key }) => {
      const pr =
        oneRepPr(
          sbdPrs,
          key
        )

      prs[key] = pr

      if (!pr) return

      next.lifts[
        key
      ].attempts = [
        0.9,
        0.96,
        1,
      ].map(ratio => ({
        kg:
          roundIpfLoad(
            pr * ratio
          ),
        status: 'pending',
      }))
    }
  )

  const prTotal =
    IPF_LIFTS.reduce(
      (sum, { key }) =>
        sum +
        (prs[key] || 0),
      0
    )

  if (
    prTotal > 0 &&
    (
      next.targetMode !==
        'gl' ||
      !next.targetGl
    )
  ) {
    next.targetTotal =
      roundIpfLoad(
        prTotal
      )
  }

  return next
}

export function updateIpfMatchField(
  state,
  {
    field,
    lift,
    attemptIndex,
    value,
  }
) {
  const next =
    createIpfMatchState(
      state
    )

  if (
    field === 'targetTotal'
  ) {
    next.targetTotal =
      positiveLoad(value)
    return next
  }

  if (
    field === 'targetGl'
  ) {
    next.targetGl =
      positiveGl(value)
    return next
  }

  if (
    field === 'bodyWeight'
  ) {
    next.bodyWeight =
      positiveBodyWeight(
        value,
        next.sex
      )
    return next
  }

  if (
    field === 'sex'
  ) {
    next.sex =
      normalizeSex(value)

    next.bodyWeight =
      positiveBodyWeight(
        next.bodyWeight,
        next.sex
      )

    return next
  }

  if (
    field === 'targetMode'
  ) {
    next.targetMode =
      value === 'gl'
        ? 'gl'
        : 'total'
    return next
  }

  if (
    field === 'targetEnabled'
  ) {
    next.targetEnabled =
      Boolean(value)
    return next
  }

  const attempt =
    next.lifts?.[
      lift
    ]?.attempts?.[
      attemptIndex
    ]

  if (!attempt) return next

  if (field === 'kg') {
    attempt.kg =
      positiveLoad(value)
  }

  if (
    field === 'status' &&
    ATTEMPT_STATUSES.has(
      value
    )
  ) {
    attempt.status = value
  }

  return next
}

export function bestSuccessfulLoad(
  state,
  lift
) {
  return Math.max(
    0,
    ...(
      state?.lifts?.[
        lift
      ]?.attempts || []
    )
      .filter(
        attempt =>
          attempt.status ===
          'good'
      )
      .map(
        attempt =>
          positiveLoad(
            attempt.kg
          ) || 0
      )
  )
}

export function projectedLiftLoad(
  state,
  lift
) {
  const attempts =
    state?.lifts?.[
      lift
    ]?.attempts || []

  const resolved =
    attempts.length === 3 &&
    attempts.every(
      attempt =>
        attempt.status !==
        'pending'
    )

  const best =
    bestSuccessfulLoad(
      state,
      lift
    )

  if (resolved) return best

  return Math.max(
    best,
    ...attempts
      .filter(
        attempt =>
          attempt.status !==
          'failed'
      )
      .map(
        attempt =>
          positiveLoad(
            attempt.kg
          ) || 0
      )
  )
}

export function effectiveIpfTargetTotal(
  state
) {
  const safeState =
    createIpfMatchState(
      state
    )

  if (
    safeState.targetMode ===
      'gl'
  ) {
    return (
      calculateTotalForIpfGl(
        safeState.targetGl,
        safeState.bodyWeight,
        safeState.sex
      ) || 0
    )
  }

  return (
    positiveLoad(
      safeState.targetTotal
    ) || 0
  )
}

export function calculateIpfMatchSummary(
  state
) {
  const safeState =
    createIpfMatchState(
      state
    )

  const securedTotal =
    IPF_LIFTS.reduce(
      (sum, { key }) =>
        sum +
        bestSuccessfulLoad(
          safeState,
          key
        ),
      0
    )

  const projectedTotal =
    IPF_LIFTS.reduce(
      (sum, { key }) =>
        sum +
        projectedLiftLoad(
          safeState,
          key
        ),
      0
    )

  const targetTotal =
    effectiveIpfTargetTotal(
      safeState
    )

  const securedGl =
    calculateIpfGlPoints(
      securedTotal,
      safeState.bodyWeight,
      safeState.sex
    )

  const projectedGl =
    calculateIpfGlPoints(
      projectedTotal,
      safeState.bodyWeight,
      safeState.sex
    )

  const targetGl =
    safeState.targetMode ===
      'gl'
      ? (
          positiveGl(
            safeState.targetGl
          ) || 0
        )
      : (
          calculateIpfGlPoints(
            targetTotal,
            safeState.bodyWeight,
            safeState.sex
          ) || 0
        )

  return {
    securedTotal,
    projectedTotal,
    targetTotal,
    securedGl,
    projectedGl,
    targetGl,
    targetMode:
      safeState.targetMode,
    bodyWeight:
      safeState.bodyWeight,
    sex:
      safeState.sex,
    securedGap:
      targetTotal > 0
        ? targetTotal -
          securedTotal
        : 0,
    projectedGap:
      targetTotal > 0
        ? targetTotal -
          projectedTotal
        : 0,
    projectedGlGap:
      targetGl > 0 &&
      projectedGl !== null
        ? targetGl -
          projectedGl
        : 0,
  }
}

export function recommendIpfAttempt(
  state,
  lift,
  attemptIndex = 2
) {
  const liftState =
    state?.lifts?.[lift]

  if (
    !liftState ||
    ![
      1,
      2,
    ].includes(
      attemptIndex
    )
  ) {
    return null
  }

  const attempts =
    liftState.attempts

  const attempt =
    attempts[attemptIndex]

  if (
    !attempt ||
    attempt.status !==
    'pending'
  ) {
    return null
  }

  const previous =
    attempts[
      attemptIndex - 1
    ]

  const previousLoad =
    positiveLoad(
      previous?.kg
    )

  if (!previousLoad) {
    return null
  }

  if (
    previous.status ===
    'failed'
  ) {
    return {
      kg: previousLoad,
      reason:
        `Reprendre la barre ratée à ${previousLoad} kg.`,
      kind: 'repeat',
    }
  }

  if (
    attemptIndex !== 2 ||
    state?.targetEnabled ===
      false
  ) {
    return null
  }

  const target =
    effectiveIpfTargetTotal(
      state
    )

  if (!target) return null

  const otherLoads =
    IPF_LIFTS
      .filter(
        item =>
          item.key !== lift
      )
      .map(
        item =>
          projectedLiftLoad(
            state,
            item.key
          )
      )

  if (
    otherLoads.some(
      load => load <= 0
    )
  ) {
    return null
  }

  const otherTotal =
    otherLoads.reduce(
      (sum, load) =>
        sum + load,
      0
    )

  const minimum =
    Math.max(
      previousLoad,
      bestSuccessfulLoad(
        state,
        lift
      )
    )

  const required =
    roundIpfLoad(
      target - otherTotal,
      'up'
    )

  const kg =
    Math.max(
      minimum,
      required
    )

  const projectedTotal =
    otherTotal + kg

  const projectedGl =
    calculateIpfGlPoints(
      projectedTotal,
      state?.bodyWeight,
      state?.sex
    )

  return {
    kg,
    reason:
      state?.targetMode ===
        'gl' &&
      projectedGl !== null
        ? `${kg} kg porte la projection à ${projectedTotal} kg, soit ~${projectedGl.toFixed(2)} GL.`
        : `${kg} kg porte la projection à ${projectedTotal} kg.`,
    kind: 'target',
    projectedTotal,
    projectedGl,
  }
}

export function applyIpfRecommendation(
  state,
  lift,
  attemptIndex
) {
  const recommendation =
    recommendIpfAttempt(
      state,
      lift,
      attemptIndex
    )

  if (!recommendation) {
    return createIpfMatchState(
      state
    )
  }

  return updateIpfMatchField(
    state,
    {
      field: 'kg',
      lift,
      attemptIndex,
      value:
        recommendation.kg,
    }
  )
}

const WARMUP_TEMPLATES = {
  squat: [
    ['5', null],
    ['5', 0.4],
    ['3', 0.55],
    ['2', 0.725],
    ['1', 0.825],
    ['1', 0.925],
  ],
  bench: [
    ['8', null],
    ['5', 0.4],
    ['3', 0.55],
    ['2', 0.725],
    ['1', 0.825],
    ['1', 0.925],
  ],
  deadlift: [
    ['5', null],
    ['3', 0.4],
    ['2', 0.55],
    ['1–2', 0.725],
    ['1', 0.825],
    ['1', 0.925],
  ],
}

export function generateIpfWarmups(
  opener,
  lift
) {
  const firstAttempt =
    positiveLoad(opener)

  if (!firstAttempt) return []

  return (
    WARMUP_TEMPLATES[lift] ||
    WARMUP_TEMPLATES.squat
  ).map(
    ([reps, ratio]) => ({
      reps,
      percent:
        ratio
          ? Math.round(
              ratio * 1000
            ) / 10
          : null,
      kg:
        ratio
          ? Math.max(
              20,
              roundIpfLoad(
                firstAttempt *
                  ratio
              )
            )
          : 20,
    })
  )
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function formatKg(value) {
  const load = numeric(value)

  return load.toLocaleString(
    'fr-FR',
    {
      maximumFractionDigits: 1,
    }
  )
}

function prLabel(
  sbdPrs,
  lift
) {
  const pr =
    oneRepPr(
      sbdPrs,
      lift
    )

  return pr
    ? `${formatKg(pr)} kg`
    : 'Non renseigné'
}

export function renderIpfMatchTool({
  state,
  sbdPrs = {},
  athleteName = '',
  canEdit = true,
  bodyWeight = null,
} = {}) {
  const safeState =
    createIpfMatchState(
      state
    )

  if (
    !safeState.bodyWeight &&
    bodyWeight
  ) {
    safeState.bodyWeight =
      positiveBodyWeight(
        bodyWeight,
        safeState.sex
      )
  }

  const summary =
    calculateIpfMatchSummary(
      safeState
    )

  const disabled =
    canEdit
      ? ''
      : 'disabled'

  const targetInput =
    safeState.targetMode ===
      'gl'
      ? (
          safeState.targetGl ||
          ''
        )
      : (
          safeState.targetTotal ||
          ''
        )

  const targetUnit =
    safeState.targetMode ===
      'gl'
      ? 'GL'
      : 'kg'

  const glTargetTotal =
    safeState.targetMode ===
      'gl'
      ? summary.targetTotal
      : 0

  return `
    <section class="ipf-match-tool">
      <header class="ipf-match-hero">
        <div>
          <span>MATCH DESK · IPF</span>
          <h2>Plan de match de ${escapeHtml(athleteName)}</h2>
          <p>Prépare les neuf barres, valide les essais et ajuste la route vers le total.</p>
        </div>

        <div class="ipf-match-target ipf-match-target--advanced">
          <label class="ipf-match-target-mode">
            <span>OBJECTIF</span>
            <select
              data-action="ipf-match-field"
              data-ipf-field="targetMode"
              ${disabled}
            >
              <option value="total" ${safeState.targetMode === 'total' ? 'selected' : ''}>Total</option>
              <option value="gl" ${safeState.targetMode === 'gl' ? 'selected' : ''}>GL Points</option>
            </select>
          </label>

          <label class="ipf-match-target-value">
            <span>${safeState.targetMode === 'gl' ? 'OBJECTIF GL' : 'OBJECTIF TOTAL'}</span>
            <div>
              <input
                type="number"
                min="1"
                max="${safeState.targetMode === 'gl' ? '300' : '1500'}"
                step="${safeState.targetMode === 'gl' ? '0.01' : '2.5'}"
                inputmode="decimal"
                value="${targetInput}"
                placeholder="${safeState.targetMode === 'gl' ? '90' : '770'}"
                data-action="ipf-match-field"
                data-ipf-field="${safeState.targetMode === 'gl' ? 'targetGl' : 'targetTotal'}"
                ${disabled}
              >
              <b>${targetUnit}</b>
            </div>
          </label>

          <label>
            <span>BODYWEIGHT</span>
            <div>
              <input
                type="number"
                min="${safeState.sex === 'female' ? '35' : '40'}"
                max="400"
                step="0.1"
                inputmode="decimal"
                value="${safeState.bodyWeight || ''}"
                placeholder="83.0"
                data-action="ipf-match-field"
                data-ipf-field="bodyWeight"
                ${disabled}
              >
              <b>kg</b>
            </div>
          </label>

          <label>
            <span>CATÉGORIE GL</span>
            <select
              data-action="ipf-match-field"
              data-ipf-field="sex"
              ${disabled}
            >
              <option value="male" ${safeState.sex === 'male' ? 'selected' : ''}>Homme · Classic</option>
              <option value="female" ${safeState.sex === 'female' ? 'selected' : ''}>Femme · Classic</option>
            </select>
          </label>

          ${safeState.targetMode === 'gl' ? `
            <div class="ipf-match-gl-conversion ${glTargetTotal ? 'is-ready' : ''}">
              <span>TOTAL À ATTEINDRE</span>
              <strong>${glTargetTotal ? `${formatKg(glTargetTotal)} kg` : 'Renseigne GL + bodyweight'}</strong>
              <small>${glTargetTotal ? 'Arrondi au 2,5 kg supérieur pour atteindre au moins le GL visé.' : 'La formule GL dépend du poids de corps et de la catégorie.'}</small>
            </div>
          ` : ''}
        </div>
      </header>

      <div class="ipf-match-controls">
        <label class="ipf-match-switch">
          <input
            type="checkbox"
            ${safeState.targetEnabled ? 'checked' : ''}
            data-action="ipf-match-field"
            data-ipf-field="targetEnabled"
            ${disabled}
          >
          <span>Adapter les 3es barres à l’objectif</span>
        </label>

        <div class="ipf-match-control-actions">
          <button type="button" data-action="ipf-match-seed" ${disabled}>
            Préremplir avec les PR
          </button>
          <button type="button" data-action="ipf-match-reset" ${disabled}>
            Effacer le match
          </button>
        </div>
      </div>

      <div class="ipf-match-scoreboard">
        <article>
          <span>Total sécurisé</span>
          <strong>${formatKg(summary.securedTotal)} <small>kg</small></strong>
        </article>
        <article>
          <span>Projection actuelle</span>
          <strong>${formatKg(summary.projectedTotal)} <small>kg</small></strong>
        </article>
        <article>
          <span>GL projeté</span>
          <strong>${summary.projectedGl !== null ? summary.projectedGl.toFixed(2) : '—'} <small>GL</small></strong>
        </article>
        <article class="${(
          summary.targetMode === 'gl'
            ? summary.projectedGlGap <= 0 && summary.targetGl
            : summary.projectedGap <= 0 && summary.targetTotal
        ) ? 'is-on-target' : ''}">
          <span>Écart à l’objectif</span>
          <strong>${
            summary.targetMode === 'gl'
              ? (
                  summary.targetGl && summary.projectedGl !== null
                    ? `${summary.projectedGlGap > 0 ? '+' : ''}${summary.projectedGlGap.toFixed(2)} <small>GL</small>`
                    : '—'
                )
              : (
                  summary.targetTotal
                    ? `${summary.projectedGap > 0 ? '+' : ''}${formatKg(summary.projectedGap)} <small>kg</small>`
                    : '—'
                )
          }</strong>
        </article>
      </div>

      <div class="ipf-match-lifts">
        ${IPF_LIFTS.map(({ key, label, short }) => {
          const liftState = safeState.lifts[key]
          const warmups = generateIpfWarmups(
            liftState.attempts[0].kg,
            key
          )
          const recommendation = recommendIpfAttempt(
            safeState,
            key,
            2
          )
          const secondRecommendation = recommendIpfAttempt(
            safeState,
            key,
            1
          )

          return `
            <article class="ipf-match-lift ipf-match-lift--${key}">
              <header>
                <div>
                  <span>${short}</span>
                  <h3>${label}</h3>
                </div>
                <small>PR 1RM · ${escapeHtml(prLabel(sbdPrs, key))}</small>
              </header>

              <section class="ipf-match-sheet">
                <h4>TENTATIVES</h4>
                <div class="ipf-match-table ipf-match-attempts">
                  <div class="ipf-match-row ipf-match-row--head">
                    <span>№</span>
                    <span>KG</span>
                    <span>RÉSULTAT</span>
                  </div>

                  ${liftState.attempts.map((attempt, index) => `
                    <label class="ipf-match-row ipf-match-row--attempt ipf-match-row--${attempt.status}">
                      <b>${index + 1}</b>
                      <input
                        type="number"
                        min="1"
                        max="1000"
                        step="2.5"
                        inputmode="decimal"
                        value="${attempt.kg || ''}"
                        placeholder="—"
                        data-action="ipf-match-field"
                        data-ipf-field="kg"
                        data-ipf-lift="${key}"
                        data-ipf-attempt="${index}"
                        ${disabled}
                      >
                      <select
                        data-action="ipf-match-field"
                        data-ipf-field="status"
                        data-ipf-lift="${key}"
                        data-ipf-attempt="${index}"
                        ${disabled}
                      >
                        <option value="pending" ${attempt.status === 'pending' ? 'selected' : ''}>À venir</option>
                        <option value="good" ${attempt.status === 'good' ? 'selected' : ''}>✓ Validée</option>
                        <option value="failed" ${attempt.status === 'failed' ? 'selected' : ''}>✕ Ratée</option>
                      </select>
                    </label>
                  `).join('')}
                </div>

                ${secondRecommendation ? `
                  <div class="ipf-match-recommendation ipf-match-recommendation--repeat">
                    <div>
                      <span>PROCHAINE BARRE</span>
                      <strong>${formatKg(secondRecommendation.kg)} kg</strong>
                      <small>${escapeHtml(secondRecommendation.reason)}</small>
                    </div>
                    <button
                      type="button"
                      data-action="ipf-match-apply"
                      data-ipf-lift="${key}"
                      data-ipf-attempt="1"
                      ${disabled}
                    >Appliquer</button>
                  </div>
                ` : ''}

                ${recommendation ? `
                  <div class="ipf-match-recommendation ipf-match-recommendation--${recommendation.kind}">
                    <div>
                      <span>3E BARRE CONSEILLÉE</span>
                      <strong>${formatKg(recommendation.kg)} kg</strong>
                      <small>${escapeHtml(recommendation.reason)}</small>
                    </div>
                    <button
                      type="button"
                      data-action="ipf-match-apply"
                      data-ipf-lift="${key}"
                      data-ipf-attempt="2"
                      ${disabled}
                    >Appliquer</button>
                  </div>
                ` : ''}
              </section>

              <section class="ipf-match-sheet ipf-match-warmup">
                <h4>${label.toUpperCase()} · ÉCHAUFFEMENT</h4>
                ${warmups.length ? `
                  <div class="ipf-match-table">
                    <div class="ipf-match-row ipf-match-row--head">
                      <span>REPS</span>
                      <span>% OUV.</span>
                      <span>KG</span>
                    </div>
                    ${warmups.map(row => `
                      <div class="ipf-match-row">
                        <b>${row.reps}</b>
                        <span>${row.percent ? `${formatKg(row.percent)} %` : 'Barre'}</span>
                        <strong>${formatKg(row.kg)}</strong>
                      </div>
                    `).join('')}
                  </div>
                ` : `
                  <p class="ipf-match-empty">Renseigne la première barre pour générer l’échauffement.</p>
                `}
              </section>
            </article>
          `
        }).join('')}
      </div>

      <p class="ipf-match-rule-note">
        Charges arrondies au pas IPF standard de 2,5 kg. GL Points calculés avec la formule IPF GL Classic Powerlifting. Les recommandations restent des aides de décision.
      </p>
    </section>
  `
}

export {
  IPF_LIFTS,
}
