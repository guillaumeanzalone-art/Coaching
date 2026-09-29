import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildSessionStorySummary,
  isSessionStoryReady,
} from '../src/session-story.js'

const states = {
  a: { status: 'done', load: '180', rpe: '8' },
  b: { status: 'done', load: '160', rpe: '7' },
  c: { status: 'failed', load: '100', rpe: '' },
}

test('builds a completed story recap from the current session', () => {
  const summary = buildSessionStorySummary({
    athleteName: 'Killian',
    blockLabel: 'Bloc 3',
    weekLabel: 'Semaine 2',
    dayName: 'SBD',
    session: {
      completedAt: '2026-09-29T18:00:00.000Z',
      durationSeconds: 5400,
      bodyWeightKg: '67,4',
      note: 'Bonne séance',
    },
    exercises: [
      {
        name: 'Squat',
        sets: [
          { id: 'a', reps: '3' },
          { id: 'b', reps: '5' },
        ],
      },
      {
        name: 'Bench',
        sets: [
          { id: 'c', reps: '1' },
        ],
      },
    ],
    getSetState: sourceSet => states[sourceSet.id],
  })

  assert.equal(summary.completedSets, 3)
  assert.equal(summary.successfulSets, 2)
  assert.equal(summary.failedSets, 1)
  assert.equal(summary.totalSets, 3)
  assert.equal(summary.tonnageKg, 1340)
  assert.equal(summary.bodyWeightKg, 67.4)
  assert.deepEqual(
    summary.exercises[0].groups.map(group => group.label),
    [
      '1×3 @ 180 kg · RPE 8',
      '1×5 @ 160 kg · RPE 7',
    ]
  )
  assert.equal(isSessionStoryReady(summary), true)
})

test('stacks identical completed sets without hiding any series', () => {
  const repeatedStates = {
    a: { status: 'done', load: '100', rpe: '8' },
    b: { status: 'done', load: '100', rpe: '8' },
    c: { status: 'done', load: '100', rpe: '8' },
    d: { status: 'failed', load: '105', rpe: '' },
  }

  const summary = buildSessionStorySummary({
    exercises: [
      {
        name: 'Bench',
        sets: [
          { id: 'a', reps: '5' },
          { id: 'b', reps: '5' },
          { id: 'c', reps: '5' },
          { id: 'd', reps: '5' },
        ],
      },
    ],
    session: {},
    getSetState: sourceSet => repeatedStates[sourceSet.id],
  })

  assert.equal(summary.completedSets, 4)
  assert.equal(summary.seriesGroupCount, 2)
  assert.deepEqual(
    summary.exercises[0].groups.map(group => group.label),
    [
      '3×5 @ 100 kg · RPE 8',
      'ÉCHEC · 1×5 @ 105 kg',
    ]
  )
})

test('does not unlock the story while sets remain pending', () => {
  const summary = buildSessionStorySummary({
    exercises: [
      {
        name: 'Squat',
        sets: [
          { id: 'a', reps: '3' },
          { id: 'pending', reps: '3' },
        ],
      },
    ],
    session: {},
    getSetState: sourceSet =>
      states[sourceSet.id] || {
        status: 'pending',
        load: '',
        rpe: '',
      },
  })

  assert.equal(summary.completedSets, 1)
  assert.equal(summary.totalSets, 2)
  assert.equal(isSessionStoryReady(summary), false)
})
