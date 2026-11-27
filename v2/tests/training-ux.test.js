import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import {
  QUICK_RPE_VALUES,
  plannedLoadSuggestion,
  formatPlannedLoad,
  nextPendingSet,
  progressPercent,
} from '../src/training-ux.js'

test('raccourci charge utilise la borne basse sans enregistrer une valeur inventée', () => {
  assert.equal(plannedLoadSuggestion('62,5 - 65'), 62.5)
  assert.equal(plannedLoadSuggestion('90 – 95'), 90)
  assert.equal(plannedLoadSuggestion('75'), 75)
  assert.equal(formatPlannedLoad(62.5), '62,5')
  for (const invalid of ['', 'RPE 7', null, 0, '1200 - 1250', undefined]) {
    assert.equal(plannedLoadSuggestion(invalid), null)
  }
})

test('RPE rapides couvrent les choix habituels sans enlever le sélecteur complet', async () => {
  assert.deepEqual(QUICK_RPE_VALUES, [7, 8, 8.5, 9, 9.5])
  const code = await readFile(new URL('../src/training.js', import.meta.url), 'utf8')
  assert.match(code, /data-action="training-quick-rpe"/)
  assert.match(code, /data-action="rpe"/)
  assert.match(code, /completeFoundSet\(found, \{ rpe: String\(picked\) \}\)/)
  assert.match(code, /if \(!canEdit \|\| !isSbdExercise\(exercise\)\) return/)
})

test('prochaine série saute les séries terminées et échouées, sans changer leur statut', () => {
  const day = { exercises: [
    { name: 'Squat', sets: [{ id: 'sq-1', reps: 5 }, { id: 'sq-2', reps: 3 }] },
    { name: 'Bench', sets: [{ id: 'bn-1', reps: 2 }] },
  ] }
  const status = new Map([['sq-1', 'done'], ['sq-2', 'failed'], ['bn-1', 'pending']])
  const next = nextPendingSet(day, set => status.get(set.id))
  assert.deepEqual(next, { setId: 'bn-1', exercise: 'Bench', number: 1, reps: '2' })
  assert.equal(status.get('sq-1'), 'done')
  status.set('bn-1', 'done')
  assert.equal(nextPendingSet(day, set => status.get(set.id)), null)
  assert.equal(nextPendingSet({ exercises: [] }, () => 'pending'), null)
})

test('progression bornée et mode séance sans écriture de données', async () => {
  assert.equal(progressPercent(3, 12), 25)
  assert.equal(progressPercent(12, 12), 100)
  assert.equal(progressPercent(20, 12), 100)
  assert.equal(progressPercent(0, 0), 0)
  const main = await readFile(new URL('../src/main.js', import.meta.url), 'utf8')
  const code = await readFile(new URL('../src/training.js', import.meta.url), 'utf8')
  const style = await readFile(new URL('../src/training-ux.css', import.meta.url), 'utf8')
  assert.match(main, /import '\.\/training-ux\.css'/)
  assert.match(main, /const ADVENT_CALENDAR_VISIBLE = false/)
  assert.match(code, /data-action="training-focus-toggle"/)
  assert.match(code, /data-action="training-next-set"/)
  assert.match(code, /data-training-ux-sync/)
  assert.match(code, /id="trainingUxElapsed"/)
  assert.match(code, /saveLoadWithoutRender\(sourceSet, formatPlannedLoad\(plannedKg\), true\)/)
  assert.match(code, /rememberSetViewport\(sourceSet.id\)/)
  assert.match(style, /min-height: 44px/)
  assert.match(style, /safe-area-inset-bottom/)
})
