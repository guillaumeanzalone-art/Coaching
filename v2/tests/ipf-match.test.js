import test from 'node:test'
import assert from 'node:assert/strict'
import {
  applyIpfRecommendation,
  calculateIpfMatchSummary,
  createIpfMatchState,
  generateIpfWarmups,
  recommendIpfAttempt,
  roundIpfLoad,
  seedIpfMatchFromPrs,
  updateIpfMatchField,
} from '../src/ipf-match.js'

function plannedMatch() {
  return createIpfMatchState({
    targetEnabled: true,
    targetTotal: 770,
    lifts: {
      squat: {
        attempts: [
          { kg: 275, status: 'good' },
          { kg: 287.5, status: 'good' },
          { kg: 295, status: 'pending' },
        ],
      },
      bench: {
        attempts: [
          { kg: 167.5, status: 'pending' },
          { kg: 175, status: 'pending' },
          { kg: 180, status: 'pending' },
        ],
      },
      deadlift: {
        attempts: [
          { kg: 280, status: 'pending' },
          { kg: 300, status: 'pending' },
          { kg: 302.5, status: 'pending' },
        ],
      },
    },
  })
}

test('arrondit les charges au pas IPF de 2,5 kg', () => {
  assert.equal(roundIpfLoad(286), 285)
  assert.equal(roundIpfLoad(286, 'up'), 287.5)
  assert.equal(roundIpfLoad(286, 'down'), 285)
})

test('propose une troisième barre qui ferme la route vers le total', () => {
  const recommendation =
    recommendIpfAttempt(
      plannedMatch(),
      'squat',
      2
    )

  assert.equal(
    recommendation.kg,
    287.5
  )
  assert.equal(
    recommendation.projectedTotal,
    770
  )
})

test('recommande de répéter la barre précédente après un échec', () => {
  let state = plannedMatch()

  state = updateIpfMatchField(
    state,
    {
      field: 'status',
      lift: 'squat',
      attemptIndex: 1,
      value: 'failed',
    }
  )

  const recommendation =
    recommendIpfAttempt(
      state,
      'squat',
      2
    )

  assert.equal(
    recommendation.kg,
    287.5
  )
  assert.equal(
    recommendation.kind,
    'repeat'
  )
})

test('applique une recommandation sans modifier les autres essais', () => {
  const state = plannedMatch()
  const next =
    applyIpfRecommendation(
      state,
      'squat',
      2
    )

  assert.equal(
    next.lifts.squat
      .attempts[2].kg,
    287.5
  )
  assert.equal(
    next.lifts.bench
      .attempts[2].kg,
    180
  )
})

test('génère les warm-up depuis la première barre', () => {
  const warmups =
    generateIpfWarmups(
      270,
      'squat'
    )

  assert.deepEqual(
    warmups.map(row => row.kg),
    [20, 107.5, 147.5, 195, 222.5, 250]
  )
})

test('préremplit le plan avec les PR une répétition', () => {
  const state =
    seedIpfMatchFromPrs(
      createIpfMatchState(),
      {
        squat: {
          1: { load_kg: 300 },
        },
        bench: {
          1: { load_kg: 200 },
        },
        deadlift: {
          1: { load_kg: 350 },
        },
      }
    )

  assert.equal(
    state.targetTotal,
    850
  )
  assert.deepEqual(
    state.lifts.squat
      .attempts.map(
        attempt => attempt.kg
      ),
    [270, 287.5, 300]
  )
})

test('distingue total sécurisé et total projeté', () => {
  const summary =
    calculateIpfMatchSummary(
      plannedMatch()
    )

  assert.equal(
    summary.securedTotal,
    287.5
  )
  assert.equal(
    summary.projectedTotal,
    777.5
  )
  assert.equal(
    summary.projectedGap,
    -7.5
  )
})
