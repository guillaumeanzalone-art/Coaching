import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildTrainingSessionPayload,
  remoteTrainingSessionToLocalState,
} from '../src/training-session-sync.js'

test('synchronise le bodyweight de la séance dans les deux sens', () => {
  const payload =
    buildTrainingSessionPayload({
      athleteSlug: 'athlete',
      programKey: 'block',
      weekIndex: 0,
      dayIndex: 1,
      session: {
        bodyWeightKg: '78,6',
      },
    })

  assert.equal(
    payload.bodyweight_kg,
    78.6
  )

  const local =
    remoteTrainingSessionToLocalState({
      bodyweight_kg: '79.1',
    })

  assert.equal(
    local.bodyWeightKg,
    79.1
  )
})

test('laisse le bodyweight vide hors du calcul et de la synchronisation', () => {
  const payload =
    buildTrainingSessionPayload({
      athleteSlug: 'athlete',
      programKey: 'block',
      weekIndex: 0,
      dayIndex: 1,
      session: {},
    })

  assert.equal(
    payload.bodyweight_kg,
    null
  )

  const invalidPayload =
    buildTrainingSessionPayload({
      athleteSlug: 'athlete',
      programKey: 'block',
      weekIndex: 0,
      dayIndex: 1,
      session: {
        bodyWeightKg: 10,
      },
    })

  assert.equal(
    invalidPayload.bodyweight_kg,
    null
  )
})
