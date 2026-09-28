import test from 'node:test'
import assert from 'node:assert/strict'
import {
  analyzeTrainingBlock,
} from '../src/block-analytics.js'

function exercise({
  id,
  name,
  type,
  variant = '',
  reps,
  percent,
}) {
  return {
    id,
    name,
    type,
    variant,
    sets: [
      {
        id: `${id}-set`,
        reps: String(reps),
        percent,
        loadRange: String(percent),
      },
    ],
  }
}

function blockWith(exercises) {
  return {
    weeks: [
      {
        id: 'week-1',
        label: 'S1',
        days: [
          {
            id: 'day-1',
            exercises,
          },
        ],
      },
    ],
  }
}

test('calcule l’intensité uniquement avec les mouvements de compétition', () => {
  const analytics =
    analyzeTrainingBlock({
      block: blockWith([
        exercise({
          id: 'comp-squat',
          name: 'Comp squat primaire',
          type: 'SQ',
          reps: 1,
          percent: 90,
        }),
        exercise({
          id: 'rdl',
          name: 'RDL',
          type: 'DL',
          reps: 10,
          percent: 50,
        }),
        exercise({
          id: 'pause-deadlift',
          name: 'Comp deadlift primaire',
          type: 'DL',
          variant: 'PAUSE',
          reps: 5,
          percent: 60,
        }),
        exercise({
          id: 'larsen',
          name: 'Bench Primaire',
          type: 'BN',
          variant: 'LARSEN',
          reps: 5,
          percent: 65,
        }),
      ]),
      referenceMaxes: {
        squat: 100,
        bench: 100,
        deadlift: 100,
      },
    })

  assert.equal(
    analytics.averageIntensity,
    90
  )

  assert.equal(
    analytics.totalReps,
    21,
    'les variantes restent comptées dans le volume'
  )

  assert.equal(
    analytics.plannedTonnageKg,
    1215,
    'les variantes restent comptées dans le tonnage'
  )
})

test('conserve les consignes techniques des mouvements comp dans l’intensité', () => {
  const analytics =
    analyzeTrainingBlock({
      block: blockWith([
        exercise({
          id: 'comp-bench',
          name: 'Comp bench primaire',
          type: 'BN',
          variant: 'Ne jamais perdre sa position de cage',
          reps: 3,
          percent: 80,
        }),
        exercise({
          id: 'comp-deadlift',
          name: 'Comp deadlift primaire',
          type: 'DL',
          variant: 'Cluster',
          reps: 1,
          percent: 92,
        }),
      ]),
      referenceMaxes: {
        squat: 100,
        bench: 100,
        deadlift: 100,
      },
    })

  assert.equal(
    analytics.averageIntensity,
    83
  )
})

test('applique un barème de tonnage relatif au PDC plus exigeant', () => {
  const analytics =
    analyzeTrainingBlock({
      block: blockWith([
        exercise({
          id: 'volume-squat',
          name: 'Comp squat primaire',
          type: 'SQ',
          reps: 128,
          percent: 100,
        }),
      ]),
      bodyWeight: 80,
      referenceMaxes: {
        squat: 100,
        bench: 100,
        deadlift: 100,
      },
    })

  assert.equal(
    analytics.averageTonnageKg,
    12800
  )

  assert.equal(
    analytics.factors.tonnage,
    42,
    '160 x PDC par semaine ne doit plus saturer le facteur tonnage'
  )
})
