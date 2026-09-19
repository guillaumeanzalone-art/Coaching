import test from 'node:test'
import assert from 'node:assert/strict'
import { athletes } from '../src/athletes.js'
import { normalizeAthleteCloudSlug } from '../src/program-cloud.js'

test('normalise les slugs cloud avant lecture et publication', () => {
  assert.equal(normalizeAthleteCloudSlug('Noe'), 'noe')
  assert.equal(normalizeAthleteCloudSlug(' Matthieu '), 'matthieu')
})

test('les métadonnées athlètes utilisent des slugs cloud minuscules', () => {
  for (const athlete of athletes) {
    assert.equal(
      athlete.cloudSlug,
      normalizeAthleteCloudSlug(athlete.cloudSlug),
      `${athlete.id} contient un cloudSlug non normalisé`,
    )
  }
})
