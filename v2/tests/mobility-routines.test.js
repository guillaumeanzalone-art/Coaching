import test from 'node:test'
import assert from 'node:assert/strict'
import { routineForAthleteDate } from '../src/rpg-health.js'

const date = new Date('2026-09-19T12:00:00Z')

test('attribue uniquement la rehab ASI à Duane, Clara et Noé', () => {
  for (const athleteSlug of ['duane', 'magicarpe', 'Noe']) {
    const routine = routineForAthleteDate(athleteSlug, date)
    assert.equal(routine.key, 'asi_rehab')
    assert.equal(routine.exercises.length, 13)
    assert.equal(
      routine.exercises.reduce((total, exercise) => total + exercise.sets, 0),
      27,
    )
  }
})

test('conserve la rotation quotidienne pour les autres athlètes', () => {
  assert.notEqual(routineForAthleteDate('tom', date).key, 'asi_rehab')
})
