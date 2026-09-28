import test from 'node:test'
import assert from 'node:assert/strict'
import {
  averageBodyWeightsKg,
  formatBodyWeightKg,
  normalizeBodyWeightKg,
} from '../src/bodyweight.js'

test('calcule la moyenne avec les bodyweights renseignés uniquement', () => {
  assert.equal(
    averageBodyWeightsKg([
      70,
      null,
      '',
      '71,0',
      undefined,
    ]),
    70.5
  )
})

test('ignore les bodyweights absents ou hors limites', () => {
  assert.equal(
    averageBodyWeightsKg([
      null,
      '',
      'abc',
      10,
      401,
    ]),
    null
  )

  assert.equal(
    normalizeBodyWeightKg(
      '82,4'
    ),
    82.4
  )
})

test('formate le bodyweight en français avec une décimale utile', () => {
  assert.equal(
    formatBodyWeightKg(70),
    '70'
  )

  assert.equal(
    formatBodyWeightKg(70.55),
    '70,6'
  )
})
