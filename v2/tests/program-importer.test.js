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
