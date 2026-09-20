import test from 'node:test'
import assert from 'node:assert/strict'
import { createImportedProgram, parseProgramSheet } from '../src/program-importer.js'

const sheet = [
  'MAXs\t\t\t\t\t\t\t\tWEEK 1\t\t\t\t\t\t\t\tWEEK 2',
  'Squat\t180',
  'Bench\t120',
  'Deadlift\t230',
  '\tLABEL\tIntention\tJour 1 Force\tSETS\tREPS\tINTENSITE\tCHARGE POTENTIELLE\tLABEL\tIntention\tJour 1 Force\tSETS\tREPS\tINTENSITE\tCHARGE POTENTIELLE',
  '\tsq\tContrôle\tComp squat\t2 x\t3\t75%\t130 - 135\tsq\tContrôle\tComp squat\t2 x\t3\t78%\t137,5 - 140',
  '\tac\tRenfo\tFacepull\t3 x\t20\tRIR-3\t\tac\tRenfo\tFacepull\t3 x\t20\tRIR-2',
].join('\n')

test('convertit un collage Sheets vers le format GA Coaching', () => {
  const parsed = parseProgramSheet(sheet)
  assert.equal(parsed.summary.weekCount, 2)
  assert.equal(parsed.metrics.maxes.squat, 180)

  const imported = createImportedProgram({
    parsed,
    athlete: { id: 'tom', name: 'Tom', programKey: 'tom' },
    blockNumber: 5,
    blockLabel: 'Bloc 5',
    blockKey: 'tom-block-5',
  })

  const firstExercise = imported.block.weeks[0].days[0].exercises[0]
  assert.equal(imported.program.defaultBlockId, 'tom-block-5')
  assert.equal(firstExercise.type, 'SQ')
  assert.equal(firstExercise.sets.length, 2)
  assert.equal(firstExercise.sets[0].percent, 75)
  assert.equal(firstExercise.sets[0].loadRange, '130 - 135')
  assert.equal(imported.overview.summary.setCount, 10)
})

test('refuse un texte sans séances', () => {
  assert.throws(() => parseProgramSheet('bonjour\tmonde'), /Aucun en-tête/)
})

test('accepte le tableau Markdown utilisé pour les envois', () => {
  const markdown = [
    '|  | LABEL | Intention | Jour 1 Volume | SETS | REPS | INTENSITE | CHARGE POTENTIELLE |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    '|  | bn | Pause | Développé couché | 3 x | 5 | 70% | 75 - 80 |',
    '|  | ac | Dos | Tirage horizontal | 4 x | 12 | RIR-2 |  |',
  ].join('\n')

  const parsed = parseProgramSheet(markdown)
  assert.equal(parsed.summary.weekCount, 1)
  assert.equal(parsed.summary.dayCount, 1)
  assert.equal(parsed.summary.exerciseCount, 2)
  assert.equal(parsed.weeks[0].days[0].exercises[0].name, 'Développé couché')
})

test('regroupe les paliers consécutifs du même exercice dans une seule carte', () => {
  const segmentedSheet = [
    '\tLABEL\tIntention\tJour 2\tSETS\tREPS\tINTENSITE\tCHARGE POTENTIELLE',
    '\tsq\tCompétition\tComp squat primaire\t2 x\t6\t65%\t189 - 201',
    '\tsq\tCompétition\tComp squat primaire\t1 x\t6\t67%\t195 - 207',
    '\tsq\tCompétition\tComp squat primaire\t1 x\t6\t69%\t201 - 213',
    '\tac\tGrand dorsal\tPull over haltères\t2 x\t10-12\t\t',
  ].join('\n')

  const parsed = parseProgramSheet(segmentedSheet)
  const imported = createImportedProgram({
    parsed,
    athlete: { id: 'tom', name: 'Tom', programKey: 'tom' },
    blockNumber: 4,
    blockLabel: 'Bloc 4',
    blockKey: 'tom-block-4',
  })
  const exercises = imported.block.weeks[0].days[0].exercises

  assert.equal(parsed.summary.exerciseCount, 4)
  assert.equal(exercises.length, 2)
  assert.equal(exercises[0].name, 'Comp squat primaire')
  assert.deepEqual(exercises[0].sets.map((set) => set.percent), [65, 65, 67, 69])
  assert.deepEqual(
    exercises[0].sets.map((set) => set.loadRange),
    ['189 - 201', '189 - 201', '195 - 207', '201 - 213'],
  )
  assert.deepEqual(
    exercises[0].sets.map((set) => set.id),
    [
      'tom-block-4-w1-d2-e1-s1',
      'tom-block-4-w1-d2-e1-s2',
      'tom-block-4-w1-d2-e1-s3',
      'tom-block-4-w1-d2-e1-s4',
    ],
  )
  assert.equal(imported.overview.summary.sourceRowCount, 4)
  assert.equal(imported.overview.summary.exerciseCount, 2)
  assert.equal(imported.overview.summary.setCount, 6)
})
