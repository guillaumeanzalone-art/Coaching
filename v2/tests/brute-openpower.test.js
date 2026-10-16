import test from 'node:test'
import assert from 'node:assert/strict'

import {
  OPENPOWERLIFTING_FFFORCE_RIVALS,
} from '../src/brute-config.js'

test('OpenPowerlifting FFForce rival roster contains usable ranked profiles', () => {
  assert.ok(
    OPENPOWERLIFTING_FFFORCE_RIVALS.length >= 20,
    'PvE should have a broad FFForce rival pool'
  )

  const names =
    new Set(
      OPENPOWERLIFTING_FFFORCE_RIVALS
        .map(rival => rival.name)
    )

  assert.equal(
    names.size,
    OPENPOWERLIFTING_FFFORCE_RIVALS.length,
    'rival names should be unique'
  )

  for (
    const rival
    of OPENPOWERLIFTING_FFFORCE_RIVALS
  ) {
    assert.ok(
      rival.name &&
      rival.name.length >= 3
    )

    assert.ok(
      rival.metric === 'GLP' ||
      rival.metric === 'DOTS'
    )

    assert.ok(
      Number.isFinite(
        Number(rival.points)
      ) &&
      Number(rival.points) > 0
    )

    assert.ok(
      Number.isFinite(
        Number(rival.total)
      ) &&
      Number(rival.total) > 0
    )

    assert.ok(
      Number.isFinite(
        Number(rival.squat)
      ) &&
      Number.isFinite(
        Number(rival.bench)
      ) &&
      Number.isFinite(
        Number(rival.deadlift)
      )
    )
  }
})
